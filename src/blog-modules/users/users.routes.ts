import { Router } from 'express';
import { createUserController, deleteUserController, getUserController, getUsersController, updateUserController } from './users.controller';
import { validate } from '../../common/middleware/validate';
import { createUserSchema, updateUserSchema } from './users.validators';
import { authMiddleware } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { privateApiRateLimiter } from '../../common/middleware/rateLimit';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AppRequest } from '../../types/express';

const router = Router({ mergeParams: true }); // mergeParams is important for nested routes

// All routes in this file are for authenticated users
router.use(privateApiRateLimiter, authMiddleware, tenantGuard);

// Define staff routes
router.post(
  '/',
  requireRole([UserRole.MANAGER]),
  validate(createUserSchema),
  asyncHandler<AppRequest>(createUserController)
);

router.get('/', asyncHandler<AppRequest>(getUsersController)); // Any authenticated user of the gamingCenter can get the staff list

router.get('/:userId', asyncHandler<AppRequest>(getUserController)); // Any authenticated user of the gamingCenter can get a specific staff member

router.put(
  '/:userId',
  requireRole([UserRole.MANAGER]),
  validate(updateUserSchema),
  asyncHandler<AppRequest>(updateUserController)
);

router.delete(
  '/:userId',
  requireRole([UserRole.MANAGER]),
  asyncHandler<AppRequest>(deleteUserController)
);

export default router;
