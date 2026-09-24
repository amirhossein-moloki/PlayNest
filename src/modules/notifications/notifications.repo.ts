import { prisma } from '../../config/prisma';
import { NotificationType, Prisma } from '@prisma/client';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}

export interface ListNotificationsOptions {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
}

export const notificationsRepo = {
  async createNotification(data: CreateNotificationInput) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: data.metadata ?? Prisma.JsonNull,
      },
    });
  },

  async getUserNotifications(userId: string, options: ListNotificationsOptions = {}) {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(options.isRead !== undefined ? { isRead: options.isRead } : {}),
    };

    const [items, totalItems] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      items,
      pagination: {
        totalItems,
        page,
        pageSize,
        totalPages,
      },
    };
  },

  async findById(notificationId: string) {
    return prisma.notification.findUnique({
      where: { id: notificationId },
    });
  },

  async markAsRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        isRead: true,
      },
    });
  },

  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  },
};
