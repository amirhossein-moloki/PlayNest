import { prisma } from '../../config/prisma';
import { NotificationType, Prisma } from '@prisma/client';

type PrismaWithNotificationLog = typeof prisma & {
  notificationLog: {
    create: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
    update: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
    count: (args: unknown) => Promise<number>;
  };
};

const getDb = () => prisma as unknown as PrismaWithNotificationLog;

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

export interface CreateNotificationLogInput {
  gamingCenterId?: string;
  userId?: string;
  recipient: string;
  channel?: string;
  type: NotificationType;
  title?: string;
  message: string;
  templateId?: number;
  parameters?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  status?: string;
  scheduledAt?: Date;
  idempotencyKey: string;
  entityType?: string;
  entityId?: string;
  maxAttempts?: number;
}

export interface ListNotificationLogsOptions {
  gamingCenterId?: string;
  userId?: string;
  status?: string;
  type?: NotificationType;
  channel?: string;
  entityType?: string;
  entityId?: string;
  page?: number;
  pageSize?: number;
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

  // =======================
  // Notification Log / Outbox Methods
  // =======================

  async createNotificationLog(data: CreateNotificationLogInput) {
    try {
      return await getDb().notificationLog.create({
        data: {
          gamingCenterId: data.gamingCenterId,
          userId: data.userId,
          recipient: data.recipient,
          channel: data.channel ?? 'SMS',
          type: data.type,
          title: data.title,
          message: data.message,
          templateId: data.templateId,
          parameters: data.parameters ?? Prisma.JsonNull,
          metadata: data.metadata ?? Prisma.JsonNull,
          status: data.status ?? 'PENDING',
          scheduledAt: data.scheduledAt ?? new Date(),
          idempotencyKey: data.idempotencyKey,
          entityType: data.entityType,
          entityId: data.entityId,
          maxAttempts: data.maxAttempts ?? 3,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await getDb().notificationLog.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
        });
        if (existing) return existing;
      }
      throw error;
    }
  },

  async findLogById(id: string) {
    return getDb().notificationLog.findUnique({
      where: { id },
    });
  },

  async findLogByIdempotencyKey(idempotencyKey: string) {
    return getDb().notificationLog.findUnique({
      where: { idempotencyKey },
    });
  },

  async findPendingNotificationLogs(limit = 50, now = new Date()) {
    return getDb().notificationLog.findMany({
      where: {
        OR: [
          {
            status: 'PENDING',
            scheduledAt: { lte: now },
          },
          {
            status: 'FAILED',
            nextRetryAt: { lte: now },
          },
        ],
      },
      take: limit,
      orderBy: { scheduledAt: 'asc' },
    });
  },

  async updateNotificationLogStatus(
    id: string,
    data: {
      status: string;
      sentAt?: Date | null;
      attempts?: number;
      nextRetryAt?: Date | null;
      lastError?: string | null;
      providerRefId?: string | null;
    }
  ) {
    return getDb().notificationLog.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.sentAt !== undefined ? { sentAt: data.sentAt } : {}),
        ...(data.attempts !== undefined ? { attempts: data.attempts } : {}),
        ...(data.nextRetryAt !== undefined ? { nextRetryAt: data.nextRetryAt } : {}),
        ...(data.lastError !== undefined ? { lastError: data.lastError } : {}),
        ...(data.providerRefId !== undefined ? { providerRefId: data.providerRefId } : {}),
      },
    });
  },

  async cancelPendingLogsByEntity(entityType: string, entityId: string) {
    return getDb().notificationLog.updateMany({
      where: {
        entityType,
        entityId,
        status: {
          in: ['PENDING', 'FAILED'],
        },
      },
      data: {
        status: 'CANCELLED',
      },
    });
  },

  async listNotificationLogs(options: ListNotificationLogsOptions = {}) {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {
      ...(options.gamingCenterId ? { gamingCenterId: options.gamingCenterId } : {}),
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.type ? { type: options.type } : {}),
      ...(options.channel ? { channel: options.channel } : {}),
      ...(options.entityType ? { entityType: options.entityType } : {}),
      ...(options.entityId ? { entityId: options.entityId } : {}),
    };

    const [items, totalItems] = await Promise.all([
      getDb().notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      getDb().notificationLog.count({ where }),
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
};
