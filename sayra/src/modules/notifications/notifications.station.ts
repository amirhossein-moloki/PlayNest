import { NotificationType, Prisma } from '@prisma/client';
import { notificationsRepo, ListNotificationsOptions, ListNotificationLogsOptions } from './notifications.repo';
import { SmsStation } from './sms.station';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import logger from '../../config/logger';
import { prisma } from '../../config/prisma';

export interface NotifyUserInput {
  gamingCenterId?: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
  sendSms?: boolean;
  mobile?: string;
  templateId?: number;
  parameters?: Array<{ name: string; value: string }>;
  idempotencyKey?: string;
  entityType?: string;
  entityId?: string;
}

export interface EnqueueNotificationInput {
  gamingCenterId?: string;
  userId?: string;
  recipient: string;
  channel?: string;
  type: NotificationType;
  title?: string;
  message: string;
  templateId?: number;
  parameters?: Array<{ name: string; value: string }>;
  metadata?: Prisma.InputJsonValue;
  scheduledAt?: Date;
  idempotencyKey: string;
  entityType?: string;
  entityId?: string;
}

export const NotificationStation = {
  calculateBackoff(attempt: number): number {
    const baseSeconds = 60;
    const delaySeconds = Math.min(baseSeconds * Math.pow(2, Math.max(0, attempt - 1)), 3600);
    return delaySeconds * 1000;
  },

  classifyError(error: unknown): { isTransient: boolean; message: string } {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const sanitized = this.sanitizeDiagnostics(rawMessage);

    if (
      /invalid phone|invalid number|invalid parameter|bad request|400|422|unprocessable/i.test(
        sanitized
      )
    ) {
      return { isTransient: false, message: sanitized };
    }

    return { isTransient: true, message: sanitized };
  },

  sanitizeDiagnostics(details: string): string {
    if (!details) return '';
    return details
      .replace(/(api_key|apiKey|secret|password|token|bearer\s+[a-z0-9._-]+)="?[^"&\s]+"?/gi, '$1=[REDACTED]')
      .replace(/\b\d{13,19}\b/g, '[CARD_REDACTED]');
  },

  async notifyUser(input: NotifyUserInput) {
    const notification = await notificationsRepo.createNotification({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      metadata: input.metadata,
    });

    if (input.sendSms && input.mobile) {
      const key =
        input.idempotencyKey ||
        `inapp:${input.userId}:${input.type}:${input.entityId || notification.id}:${Date.now()}`;

      await this.enqueueNotificationLog({
        gamingCenterId: input.gamingCenterId,
        userId: input.userId,
        recipient: input.mobile,
        channel: 'SMS',
        type: input.type,
        title: input.title,
        message: input.message,
        templateId: input.templateId,
        parameters: input.parameters,
        metadata: input.metadata,
        idempotencyKey: key,
        entityType: input.entityType || 'Notification',
        entityId: input.entityId || notification.id,
      });
    }

    return notification;
  },

  async enqueueNotificationLog(input: EnqueueNotificationInput) {
    const log = (await notificationsRepo.createNotificationLog({
      gamingCenterId: input.gamingCenterId,
      userId: input.userId,
      recipient: input.recipient,
      channel: input.channel ?? 'SMS',
      type: input.type,
      title: input.title,
      message: input.message,
      templateId: input.templateId,
      parameters: input.parameters as Prisma.InputJsonValue,
      metadata: input.metadata,
      status: 'PENDING',
      scheduledAt: input.scheduledAt || new Date(),
      idempotencyKey: input.idempotencyKey,
      entityType: input.entityType,
      entityId: input.entityId,
    })) as Record<string, unknown>;

    const now = new Date();
    const scheduledAt = input.scheduledAt || now;

    if (scheduledAt <= now) {
      try {
        return await this.dispatchNotificationLog(String(log.id));
      } catch (err) {
        logger.warn({ msg: 'Immediate outbox dispatch failed; backoff worker will retry', error: err });
      }
    }

    return log;
  },

  async dispatchNotificationLog(logId: string) {
    const log = (await notificationsRepo.findLogById(logId)) as Record<string, unknown> | null;
    if (!log) throw new AppError('Notification log not found', httpStatus.NOT_FOUND);

    if (log.status === 'SENT' || log.status === 'CANCELLED') {
      return log;
    }

    // Reservation State Revalidation before sending reminders
    if (log.entityType === 'Reservation' && log.entityId && log.type === NotificationType.RESERVATION_REMINDER) {
      const reservation = await prisma.reservation.findUnique({
        where: { id: String(log.entityId) },
        select: { status: true, canceledAt: true },
      });

      if (
        !reservation ||
        reservation.canceledAt ||
        (reservation.status !== 'CONFIRMED' && reservation.status !== 'PENDING')
      ) {
        logger.info({
          msg: 'Reservation no longer active; canceling pending reminder notification log',
          logId: log.id,
          reservationId: log.entityId,
          status: reservation?.status,
        });

        return await notificationsRepo.updateNotificationLogStatus(String(log.id), {
          status: 'CANCELLED',
          lastError: `Cancelled due to inactive reservation status: ${reservation?.status || 'NOT_FOUND'}`,
        });
      }
    }

    const currentAttempts = (Number(log.attempts) || 0) + 1;

    try {
      let providerRefId: string | undefined;

      if ((log.channel === 'SMS' || !log.channel) && log.templateId) {
        const params = Array.isArray(log.parameters)
          ? (log.parameters as Array<{ name: string; value: string }>)
          : [];
        const result = await SmsStation.sendTemplateSms(String(log.recipient), Number(log.templateId), params);
        providerRefId = result && typeof result === 'object' && 'id' in result ? String((result as Record<string, unknown>).id) : undefined;
      }

      return await notificationsRepo.updateNotificationLogStatus(String(log.id), {
        status: 'SENT',
        sentAt: new Date(),
        attempts: currentAttempts,
        nextRetryAt: null,
        providerRefId,
      });
    } catch (error) {
      const { isTransient, message } = this.classifyError(error);

      if (isTransient && currentAttempts < (Number(log.maxAttempts) || 3)) {
        const delayMs = this.calculateBackoff(currentAttempts);
        const nextRetryAt = new Date(Date.now() + delayMs);

        return await notificationsRepo.updateNotificationLogStatus(String(log.id), {
          status: 'FAILED',
          attempts: currentAttempts,
          nextRetryAt,
          lastError: message,
        });
      } else {
        return await notificationsRepo.updateNotificationLogStatus(String(log.id), {
          status: 'FAILED',
          attempts: currentAttempts,
          nextRetryAt: null,
          lastError: message,
        });
      }
    }
  },

  async processPendingNotificationLogs(batchSize = 50, now = new Date()) {
    const pendingLogs = (await notificationsRepo.findPendingNotificationLogs(batchSize, now)) as Array<Record<string, unknown>>;

    let processed = 0;
    let success = 0;
    let failed = 0;

    for (const log of pendingLogs) {
      processed++;
      try {
        const result = (await this.dispatchNotificationLog(String(log.id))) as Record<string, unknown>;
        if (result.status === 'SENT') success++;
        else failed++;
      } catch (err) {
        failed++;
        logger.error({ msg: 'Error processing notification log dispatch', logId: String(log.id), error: err });
      }
    }

    return { processed, success, failed };
  },

  async cancelPendingLogsByEntity(entityType: string, entityId: string) {
    return notificationsRepo.cancelPendingLogsByEntity(entityType, entityId);
  },

  async getUserNotifications(userId: string, options: ListNotificationsOptions = {}) {
    return notificationsRepo.getUserNotifications(userId, options);
  },

  async markAsRead(notificationId: string, userId: string) {
    const existing = await notificationsRepo.findById(notificationId);
    if (!existing) {
      throw new AppError('Notification not found', httpStatus.NOT_FOUND);
    }

    if (existing.userId !== userId) {
      throw new AppError('Access denied to notification', httpStatus.FORBIDDEN);
    }

    await notificationsRepo.markAsRead(notificationId, userId);
    return { ...existing, isRead: true };
  },

  async getUnreadCount(userId: string) {
    const count = await notificationsRepo.getUnreadCount(userId);
    return { unreadCount: count };
  },

  async listNotificationLogs(options: ListNotificationLogsOptions = {}) {
    return notificationsRepo.listNotificationLogs(options);
  },

  async retryNotificationLog(logId: string) {
    const log = await notificationsRepo.findLogById(logId);
    if (!log) throw new AppError('Notification log not found', httpStatus.NOT_FOUND);

    await notificationsRepo.updateNotificationLogStatus(logId, {
      status: 'PENDING',
      nextRetryAt: new Date(),
    });

    return this.dispatchNotificationLog(logId);
  },
};
