import { Router } from 'express';
import { createUserController, deleteUserController, getUserController, getUsersController, updateUserController } from './users.controller';
import { validate } from '../../common/middleware/validate';
import { createUserSchema, updateUserSchema } from './users.validators';
import { authMiddleware } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { privateApiRateLimiter } from '../../common/middleware/rateLimit';

const router = Router({ mergeParams: true }); // mergeParams is important for nested routes

// All routes in this file are for authenticated users
router.use(privateApiRateLimiter, authMiddleware, tenantGuard);

// Define staff routes
router.post(
  '/',
  requireRole([UserRole.MANAGER]),
  validate(createUserSchema),
  createUserController
);

router.get('/', getUsersController); // Any authenticated user of the gamingCenter can get the staff list

router.get('/:userId', getUserController); // Any authenticated user of the gamingCenter can get a specific staff member

router.put(
  '/:userId',
  requireRole([UserRole.MANAGER]),
  validate(updateUserSchema),
  updateUserController
);

router.delete(
  '/:userId',
  requireRole([UserRole.MANAGER]),
  deleteUserController
);

export default router;
