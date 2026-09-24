import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { notificationsController } from './notifications.controller';
import { listNotificationsSchema, notificationIdParamSchema } from './notifications.validators';

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

export default notificationsRouter;
