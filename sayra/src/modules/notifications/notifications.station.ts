import { NotificationType, NotificationCategory, UserRole, Prisma } from '@prisma/client';
import { notificationsRepo, ListNotificationsOptions, ListNotificationLogsOptions } from './notifications.repo';
import { SmsStation } from './sms.station';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import logger from '../../config/logger';
import { prisma } from '../../config/prisma';
import {
  NotificationTemplateKey,
  renderLocalizedNotification,
  getRecipientPreferredLanguage,
} from './notification-i18n';

export interface NotifyUserInput {
  gamingCenterId?: string;
  userId: string;
  category?: NotificationCategory;
  type: NotificationType;
  title?: string;
  message?: string;
  templateKey?: NotificationTemplateKey;
  templateParams?: Record<string, string | number | undefined | null>;
  language?: string | null;
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
  category?: NotificationCategory;
  channel?: string;
  type: NotificationType;
  title?: string;
  message?: string;
  templateKey?: NotificationTemplateKey;
  templateParams?: Record<string, string | number | undefined | null>;
  language?: string | null;
  templateId?: number;
  parameters?: Array<{ name: string; value: string }>;
  metadata?: Prisma.InputJsonValue;
  scheduledAt?: Date;
  idempotencyKey: string;
  entityType?: string;
  entityId?: string;
}

export interface NotifyGameCenterInput {
  gamingCenterId: string;
  type: NotificationType;
  title?: string;
  message?: string;
  templateKey?: NotificationTemplateKey;
  templateParams?: Record<string, string | number | undefined | null>;
  metadata?: Prisma.InputJsonValue;
  entityType?: string;
  entityId?: string;
}

export interface NotifyManagersInput {
  type: NotificationType;
  title?: string;
  message?: string;
  templateKey?: NotificationTemplateKey;
  templateParams?: Record<string, string | number | undefined | null>;
  metadata?: Prisma.InputJsonValue;
  gamingCenterId?: string;
  entityType?: string;
  entityId?: string;
}

export interface NotifyCustomerTicketInput {
  phone: string;
  type: NotificationType;
  ticketId: string;
  ticketCode?: string;
  templateKey?: NotificationTemplateKey;
  templateParams?: Record<string, string | number | undefined | null>;
  language?: string | null;
  gamingCenterId?: string;
  userId?: string;
}

function inferNotificationCategory(type: NotificationType, explicitCategory?: NotificationCategory): NotificationCategory {
  if (explicitCategory) return explicitCategory;
  if (
    type === NotificationType.TICKET_CREATED ||
    type === NotificationType.TICKET_REPLIED ||
    type === NotificationType.TICKET_CLOSED
  ) {
    return NotificationCategory.CUSTOMER;
  }
  if (
    type === NotificationType.NEW_GAME_CENTER_REGISTRATION ||
    type === NotificationType.NEW_TICKET_CREATED ||
    type === NotificationType.NEW_USER_REPORT ||
    type === NotificationType.REFUND_REQUESTED ||
    type === NotificationType.SYSTEM_ERROR ||
    type === NotificationType.DAILY_BOOKING_SUMMARY
  ) {
    return NotificationCategory.MANAGER;
  }
  return NotificationCategory.GAME_CENTER;
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
    let resolvedTitle = input.title || '';
    let resolvedMessage = input.message || '';
    let resolvedMetadata = input.metadata;

    if (input.templateKey) {
      const localized = renderLocalizedNotification(input.templateKey, input.templateParams, input.language);
      resolvedTitle = localized.title;
      resolvedMessage = localized.message;
      const baseMeta =
        input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
          ? (input.metadata as Record<string, unknown>)
          : {};
      resolvedMetadata = {
        ...baseMeta,
        language: localized.language,
        direction: localized.direction,
        ...(localized.description ? { description: localized.description } : {}),
        ...(localized.actionLabel ? { actionLabel: localized.actionLabel } : {}),
      } as Prisma.InputJsonValue;
    }

    const category = inferNotificationCategory(input.type, input.category);

    // Channel Rule Enforcement: Customer ticket events must use SMS only, never In-App
    const isCustomerTicket =
      input.type === NotificationType.TICKET_CREATED ||
      input.type === NotificationType.TICKET_REPLIED ||
      input.type === NotificationType.TICKET_CLOSED;

    if (isCustomerTicket) {
      if (input.mobile) {
        const key =
          input.idempotencyKey ||
          `ticket:${input.type}:${input.entityId || input.userId}:${Date.now()}`;

        return await this.enqueueNotificationLog({
          gamingCenterId: input.gamingCenterId,
          userId: input.userId,
          recipient: input.mobile,
          category: NotificationCategory.CUSTOMER,
          channel: 'SMS',
          type: input.type,
          title: resolvedTitle,
          message: resolvedMessage,
          templateKey: input.templateKey,
          templateParams: input.templateParams,
          language: input.language,
          templateId: input.templateId,
          parameters: input.parameters,
          metadata: resolvedMetadata,
          idempotencyKey: key,
          entityType: input.entityType || 'Ticket',
          entityId: input.entityId,
        });
      }
      logger.warn({
        msg: 'Customer ticket event skipped: SMS channel required but no mobile recipient provided',
        type: input.type,
        userId: input.userId,
      });
      return null;
    }

    const notification = await notificationsRepo.createNotification({
      userId: input.userId,
      category,
      type: input.type,
      title: resolvedTitle,
      message: resolvedMessage,
      metadata: resolvedMetadata,
    });

    // Channel Rule Enforcement: GameCenter and Manager events are In-App only. No duplicate SMS.
    const isStrictInAppOnly =
      String(input.type).startsWith('GAME_CENTER_') ||
      input.type === NotificationType.NEW_GAME_CENTER_REGISTRATION ||
      input.type === NotificationType.NEW_TICKET_CREATED ||
      input.type === NotificationType.NEW_USER_REPORT ||
      input.type === NotificationType.REFUND_REQUESTED ||
      input.type === NotificationType.SYSTEM_ERROR ||
      input.type === NotificationType.DAILY_BOOKING_SUMMARY;

    if (input.sendSms && input.mobile && !isStrictInAppOnly) {
      const key =
        input.idempotencyKey ||
        `inapp:${input.userId}:${input.type}:${input.entityId || notification.id}:${Date.now()}`;

      await this.enqueueNotificationLog({
        gamingCenterId: input.gamingCenterId,
        userId: input.userId,
        recipient: input.mobile,
        category,
        channel: 'SMS',
        type: input.type,
        title: resolvedTitle,
        message: resolvedMessage,
        templateId: input.templateId,
        parameters: input.parameters,
        metadata: resolvedMetadata,
        idempotencyKey: key,
        entityType: input.entityType || 'Notification',
        entityId: input.entityId || notification.id,
      });
    }

    return notification;
  },

  async enqueueNotificationLog(input: EnqueueNotificationInput) {
    let resolvedTitle = input.title;
    let resolvedMessage = input.message || '';
    let resolvedMetadata = input.metadata;

    if (input.templateKey) {
      const localized = renderLocalizedNotification(input.templateKey, input.templateParams, input.language);
      resolvedTitle = localized.title;
      resolvedMessage = localized.message;
      const baseMeta =
        input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
          ? (input.metadata as Record<string, unknown>)
          : {};
      resolvedMetadata = {
        ...baseMeta,
        language: localized.language,
        direction: localized.direction,
        ...(localized.description ? { description: localized.description } : {}),
        ...(localized.actionLabel ? { actionLabel: localized.actionLabel } : {}),
      } as Prisma.InputJsonValue;
    }

    const category = inferNotificationCategory(input.type, input.category);

    const log = (await notificationsRepo.createNotificationLog({
      gamingCenterId: input.gamingCenterId,
      userId: input.userId,
      recipient: input.recipient,
      category,
      channel: input.channel ?? 'SMS',
      type: input.type,
      title: resolvedTitle,
      message: resolvedMessage,
      templateId: input.templateId,
      parameters: input.parameters as Prisma.InputJsonValue,
      metadata: resolvedMetadata,
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
    const reminderTypes: NotificationType[] = [
      NotificationType.RESERVATION_REMINDER,
      NotificationType.GAME_CENTER_BOOKING_REMINDER_24H,
      NotificationType.GAME_CENTER_BOOKING_REMINDER_2H,
      NotificationType.GAME_CENTER_BOOKING_REMINDER_15M,
    ];

    if (log.entityType === 'Reservation' && log.entityId && reminderTypes.includes(log.type as NotificationType)) {
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

      if (log.channel === 'SMS' || !log.channel) {
        if (log.templateId) {
          const params = Array.isArray(log.parameters)
            ? (log.parameters as Array<{ name: string; value: string }>)
            : [];
          const result = await SmsStation.sendTemplateSms(String(log.recipient), Number(log.templateId), params);
          providerRefId = result && typeof result === 'object' && 'id' in result ? String((result as Record<string, unknown>).id) : undefined;
        } else {
          // Direct SMS delivery (for plain text / ticket notifications)
          const result = await SmsStation.sendDirectSms(String(log.recipient), String(log.message || log.title || ''));
          providerRefId = result && typeof result === 'object' && 'id' in result ? String((result as Record<string, unknown>).id) : undefined;
        }
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

  async notifyGameCenter(input: NotifyGameCenterInput) {
    const gamingCenter = await prisma.gamingCenter.findUnique({
      where: { id: input.gamingCenterId },
      select: { managerId: true },
    });

    const staffUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { gamingCenterId: input.gamingCenterId },
          ...(gamingCenter?.managerId ? [{ id: gamingCenter.managerId }] : []),
        ],
        role: { in: [UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.STAFF, UserRole.ADMIN] },
      },
    });

    const notifications = [];
    for (const user of staffUsers) {
      const notif = await this.notifyUser({
        gamingCenterId: input.gamingCenterId,
        userId: user.id,
        category: NotificationCategory.GAME_CENTER,
        type: input.type,
        title: input.title,
        message: input.message,
        templateKey: input.templateKey,
        templateParams: input.templateParams,
        language: getRecipientPreferredLanguage(user),
        metadata: input.metadata,
        sendSms: false,
        entityType: input.entityType,
        entityId: input.entityId,
      });
      if (notif) notifications.push(notif);
    }
    return notifications;
  },

  async notifyManagers(input: NotifyManagersInput) {
    const managers = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: { in: [UserRole.ADMIN, UserRole.MANAGER] } },
          { isSuperuser: true },
        ],
        ...(input.gamingCenterId
          ? {
              OR: [
                { role: UserRole.ADMIN },
                { isSuperuser: true },
                { gamingCenterId: input.gamingCenterId, role: UserRole.MANAGER },
              ],
            }
          : {}),
      },
    });

    const notifications = [];
    for (const manager of managers) {
      const notif = await this.notifyUser({
        gamingCenterId: input.gamingCenterId,
        userId: manager.id,
        category: NotificationCategory.MANAGER,
        type: input.type,
        title: input.title,
        message: input.message,
        templateKey: input.templateKey,
        templateParams: input.templateParams,
        language: getRecipientPreferredLanguage(manager),
        metadata: input.metadata,
        sendSms: false,
        entityType: input.entityType,
        entityId: input.entityId,
      });
      if (notif) notifications.push(notif);
    }
    return notifications;
  },

  async notifyCustomerTicket(input: NotifyCustomerTicketInput) {
    const key = `ticket:${input.type}:${input.ticketId}:${Date.now()}`;
    const defaultTemplateKey: NotificationTemplateKey =
      input.type === NotificationType.TICKET_CREATED
        ? 'TICKET_CREATED'
        : input.type === NotificationType.TICKET_REPLIED
        ? 'TICKET_REPLIED'
        : 'TICKET_CLOSED';

    return this.enqueueNotificationLog({
      gamingCenterId: input.gamingCenterId,
      userId: input.userId,
      recipient: input.phone,
      category: NotificationCategory.CUSTOMER,
      channel: 'SMS',
      type: input.type,
      templateKey: input.templateKey || defaultTemplateKey,
      templateParams: {
        ticketCode: input.ticketCode || input.ticketId,
        ...input.templateParams,
      },
      language: input.language,
      idempotencyKey: key,
      entityType: 'Ticket',
      entityId: input.ticketId,
    });
  },
};
