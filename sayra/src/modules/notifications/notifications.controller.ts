import { Response } from 'express';
import { NotificationStation } from './notifications.station';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { AppRequest } from '../../types/express';
import { NotificationType, NotificationCategory, UserRole, Prisma, SessionActorType } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const notificationsController = {
  async getNotifications(req: AppRequest, res: Response) {
    const userId = req.actor?.id;
    if (!userId) {
      throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
    }

    const { page, pageSize, isRead, category, type } = req.query as {
      page?: string;
      pageSize?: string;
      isRead?: boolean;
      category?: NotificationCategory;
      type?: NotificationType;
    };

    const options = {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      isRead: isRead !== undefined ? Boolean(isRead) : undefined,
      category,
      type,
    };

    if (req.actor?.actorType === 'CUSTOMER') {
      const p = Math.max(1, options.page || 1);
      const ps = Math.min(100, Math.max(1, options.pageSize || 20));
      const skip = (p - 1) * ps;
      const where: Prisma.CustomerNotificationWhereInput = {
        customerAccountId: userId,
        ...(options.isRead !== undefined ? { isRead: options.isRead } : {}),
      };
      const [items, totalItems] = await Promise.all([
        prisma.customerNotification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: ps,
        }),
        prisma.customerNotification.count({ where }),
      ]);
      const totalPages = Math.ceil(totalItems / ps);
      return res.ok(items, {
        pagination: { totalItems, page: p, pageSize: ps, totalPages },
      });
    }

    const result = await NotificationStation.getUserNotifications(userId, options);
    return res.ok(result.items, { pagination: result.pagination });
  },

  async markAsRead(req: AppRequest, res: Response) {
    const userId = req.actor?.id;
    if (!userId) {
      throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
    }

    const notificationId = req.params.id;

    if (req.actor?.actorType === 'CUSTOMER') {
      const existing = await prisma.customerNotification.findUnique({
        where: { id: notificationId },
      });
      if (!existing || existing.customerAccountId !== userId) {
        throw new AppError('Notification not found', httpStatus.NOT_FOUND);
      }
      await prisma.customerNotification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
      return res.ok({ ...existing, isRead: true });
    }

    const result = await NotificationStation.markAsRead(notificationId, userId);
    return res.ok(result);
  },

  async getUnreadCount(req: AppRequest, res: Response) {
    const userId = req.actor?.id;
    if (!userId) {
      throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
    }

    if (req.actor?.actorType === 'CUSTOMER') {
      const count = await prisma.customerNotification.count({
        where: { customerAccountId: userId, isRead: false },
      });
      return res.ok({ unreadCount: count });
    }

    const result = await NotificationStation.getUnreadCount(userId);
    return res.ok(result);
  },

  async listNotificationLogs(req: AppRequest, res: Response) {
    const isPlatformAdmin = req.actor?.actorType === SessionActorType.PLATFORM_ADMIN;
    const role = req.actor?.role;
    if (!isPlatformAdmin && (!role || (role !== UserRole.MANAGER && role !== UserRole.ADMIN))) {
      throw new AppError('Forbidden: Access denied to notification logs', httpStatus.FORBIDDEN);
    }

    const { page, pageSize, status, category, type, channel, entityType, entityId, gamingCenterId } = req.query as Record<string, string | undefined>;

    if (!isPlatformAdmin) {
      if (!req.actor?.gamingCenterId) {
        throw new AppError('Forbidden: Tenant gamingCenterId required for notification logs', httpStatus.FORBIDDEN);
      }
      if (gamingCenterId && gamingCenterId !== req.actor.gamingCenterId) {
        throw new AppError('Forbidden: Cannot access notification logs for another gaming center', httpStatus.FORBIDDEN);
      }
    }

    const effectiveGamingCenterId = isPlatformAdmin
      ? gamingCenterId
      : req.actor.gamingCenterId;

    const result = await NotificationStation.listNotificationLogs({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      status,
      category: category as NotificationCategory | undefined,
      type: type as NotificationType | undefined,
      channel,
      entityType,
      entityId,
      gamingCenterId: effectiveGamingCenterId,
    });

    return res.ok(result.items, { pagination: result.pagination });
  },

  async retryNotificationLog(req: AppRequest, res: Response) {
    const isPlatformAdmin = req.actor?.actorType === SessionActorType.PLATFORM_ADMIN;
    const role = req.actor?.role;
    if (!isPlatformAdmin && (!role || (role !== UserRole.MANAGER && role !== UserRole.ADMIN))) {
      throw new AppError('Forbidden: Access denied to retry notification log', httpStatus.FORBIDDEN);
    }

    const logId = req.params.id;
    const result = await NotificationStation.retryNotificationLog(logId, req.actor);
    return res.ok(result);
  },
};
