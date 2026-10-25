import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/requireRole';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { notificationsController } from './notifications.controller';
import {
  listNotificationsSchema,
  notificationIdParamSchema,
  listNotificationLogsSchema,
  notificationLogIdParamSchema,
} from './notifications.validators';
import { UserRole } from '@prisma/client';

const notificationsRouter = Router();

notificationsRouter.use(authMiddleware);

notificationsRouter.get(
  '/',
  validate(listNotificationsSchema),
  asyncHandler(notificationsController.getNotifications)
);

notificationsRouter.get(
  '/unread-count',
  asyncHandler(notificationsController.getUnreadCount)
);

notificationsRouter.patch(
  '/:id/read',
  validate(notificationIdParamSchema),
  asyncHandler(notificationsController.markAsRead)
);

// Operational Outbox Logs & Management
notificationsRouter.get(
  '/logs',
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(listNotificationLogsSchema),
  asyncHandler(notificationsController.listNotificationLogs)
);

notificationsRouter.post(
  '/logs/:id/retry',
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(notificationLogIdParamSchema),
  asyncHandler(notificationsController.retryNotificationLog)
);

export default notificationsRouter;
