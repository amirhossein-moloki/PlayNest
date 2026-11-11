import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { UserRole } from '@prisma/client';
import { AppRequest } from '../../types/express';
import * as closuresController from './closures.controller';
import {
  createClosureSchema,
  deleteClosureSchema,
  getClosuresSchema,
} from './closures.validators';

export const privateClosuresRouter = Router({ mergeParams: true });
export const publicClosuresRouter = Router({ mergeParams: true });

// Private Manager/Admin routes
privateClosuresRouter.use(authMiddleware, tenantGuard);

privateClosuresRouter.get(
  '/',
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(getClosuresSchema),
  asyncHandler<AppRequest>(closuresController.getClosures)
);

privateClosuresRouter.post(
  '/',
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(createClosureSchema),
  asyncHandler<AppRequest>(closuresController.createClosure)
);

privateClosuresRouter.delete(
  '/:closureId',
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(deleteClosureSchema),
  asyncHandler<AppRequest>(closuresController.deleteClosure)
);

// Public route
publicClosuresRouter.get(
  '/',
  asyncHandler<AppRequest>(closuresController.getPublicClosures)
);
