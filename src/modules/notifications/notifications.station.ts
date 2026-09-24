import { NotificationType, Prisma } from '@prisma/client';
import { notificationsRepo, ListNotificationsOptions } from './notifications.repo';
import { queueSms } from '../../jobs/producers/sms.producer';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export interface NotifyUserInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
  sendSms?: boolean;
  mobile?: string;
  templateId?: number;
  parameters?: Array<{ name: string; value: string }>;
}

export const NotificationStation = {
  async notifyUser(input: NotifyUserInput) {
    const notification = await notificationsRepo.createNotification({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      metadata: input.metadata,
    });

    if (input.sendSms && input.mobile && input.templateId) {
      try {
        await queueSms({
          mobile: input.mobile,
          templateId: input.templateId,
          parameters: input.parameters || [],
        });
      } catch (error) {
        console.error('Failed to queue SMS in NotificationStation:', error);
      }
    }

    return notification;
  },

  async createNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return notificationsRepo.createNotification(data);
  },

  async sendSms(mobile: string, templateId: number, parameters: Array<{ name: string; value: string }>) {
    try {
      await queueSms({ mobile, templateId, parameters });
    } catch (error) {
      console.error('Failed to queue SMS:', error);
      throw error;
    }
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
};
