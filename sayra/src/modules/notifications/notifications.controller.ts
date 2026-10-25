import { Response } from 'express';
import { NotificationStation } from './notifications.station';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { AppRequest } from '../../types/express';
import { NotificationType, UserRole } from '@prisma/client';

export const notificationsController = {
  async getNotifications(req: AppRequest, res: Response) {
    const userId = req.actor?.id;
    if (!userId) {
      throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
    }

    const { page, pageSize, isRead } = req.query as {
      page?: string;
      pageSize?: string;
      isRead?: boolean;
    };

    const options = {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      isRead: isRead !== undefined ? Boolean(isRead) : undefined,
    };

    const result = await NotificationStation.getUserNotifications(userId, options);
    return res.ok(result.items, { pagination: result.pagination });
  },

  async markAsRead(req: AppRequest, res: Response) {
    const userId = req.actor?.id;
    if (!userId) {
      throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
    }

    const notificationId = req.params.id;
    const result = await NotificationStation.markAsRead(notificationId, userId);
    return res.ok(result);
  },

  async getUnreadCount(req: AppRequest, res: Response) {
    const userId = req.actor?.id;
    if (!userId) {
      throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
    }

    const result = await NotificationStation.getUnreadCount(userId);
    return res.ok(result);
  },

  async listNotificationLogs(req: AppRequest, res: Response) {
    const role = req.actor?.role;
    if (!role || (role !== UserRole.MANAGER && role !== UserRole.ADMIN)) {
      throw new AppError('Forbidden: Access denied to notification logs', httpStatus.FORBIDDEN);
    }

    const { page, pageSize, status, type, channel, entityType, entityId, gamingCenterId } = req.query as Record<string, string | undefined>;

    const effectiveGamingCenterId =
      role === UserRole.ADMIN ? gamingCenterId : req.actor.gamingCenterId;

    const result = await NotificationStation.listNotificationLogs({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      status,
      type: type as NotificationType | undefined,
      channel,
      entityType,
      entityId,
      gamingCenterId: effectiveGamingCenterId,
    });

    return res.ok(result.items, { pagination: result.pagination });
  },

  async retryNotificationLog(req: AppRequest, res: Response) {
    const role = req.actor?.role;
    if (!role || (role !== UserRole.MANAGER && role !== UserRole.ADMIN)) {
      throw new AppError('Forbidden: Access denied to retry notification log', httpStatus.FORBIDDEN);
    }

    const logId = req.params.id;
    const result = await NotificationStation.retryNotificationLog(logId);
    return res.ok(result);
  },
};
