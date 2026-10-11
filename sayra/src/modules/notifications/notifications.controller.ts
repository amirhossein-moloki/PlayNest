import { Response } from 'express';
import { NotificationStation } from './notifications.station';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { AppRequest } from '../../types/express';

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
};
