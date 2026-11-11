import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { UserRole } from '@prisma/client';
import { AppRequest } from '../../types/express';
import * as schedulesController from './schedules.controller';
import { getSchedulesSchema, updateSchedulesSchema } from './schedules.validators';

export const privateSchedulesRouter = Router({ mergeParams: true });
export const publicSchedulesRouter = Router({ mergeParams: true });

// Private Manager/Admin routes
privateSchedulesRouter.use(authMiddleware, tenantGuard);

privateSchedulesRouter.get(
  '/',
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(getSchedulesSchema),
  asyncHandler<AppRequest>(schedulesController.getSchedules)
);

privateSchedulesRouter.put(
  '/',
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(updateSchedulesSchema),
  asyncHandler<AppRequest>(schedulesController.updateSchedules)
);

// Public route
publicSchedulesRouter.get(
  '/',
  asyncHandler<AppRequest>(schedulesController.getPublicSchedules)
);
