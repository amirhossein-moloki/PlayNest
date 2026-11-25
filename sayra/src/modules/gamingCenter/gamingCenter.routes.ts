import { Router } from 'express';
import { gamingCenterController } from './gamingCenter.controller';
import { authMiddleware } from '../../common/middleware/auth';
import { requirePlatformAdmin } from '../../common/middleware/requirePlatformAdmin';
import { requireRole } from '../../common/middleware/requireRole';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { publicApiRateLimiter } from '../../common/middleware/rateLimit';

const router = Router();

// Public routes
router.get('/', publicApiRateLimiter, asyncHandler(gamingCenterController.getAllGamingCenters));
router.get('/map', publicApiRateLimiter, asyncHandler(gamingCenterController.getMapGamingCenters));
router.get('/:id', publicApiRateLimiter, asyncHandler(gamingCenterController.getGamingCenterById));

// Protected routes - Require authentication and specific roles
router.post(
  '/',
  authMiddleware,
  requirePlatformAdmin,
  asyncHandler(gamingCenterController.createGamingCenter),
);
router.patch(
  '/:id',
  authMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  asyncHandler(gamingCenterController.updateGamingCenter),
);
router.delete(
  '/:id',
  authMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  asyncHandler(gamingCenterController.deleteGamingCenter),
);

export default router;
