import { Router } from 'express';
import { gamingCenterController } from './gamingCenter.controller';
import { authMiddleware } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/requireRole';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../common/middleware/asyncHandler';

const router = Router();

// Public routes
router.get('/', asyncHandler(gamingCenterController.getAllGamingCenters));
router.get('/:id', asyncHandler(gamingCenterController.getGamingCenterById));

// Protected routes - Require authentication and specific roles
router.post(
  '/',
  authMiddleware,
  asyncHandler(gamingCenterController.createGamingCenter),
);
router.patch(
  '/:id',
  authMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER]),
  asyncHandler(gamingCenterController.updateGamingCenter),
);
router.delete(
  '/:id',
  authMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER]),
  asyncHandler(gamingCenterController.deleteGamingCenter),
);

export default router;
