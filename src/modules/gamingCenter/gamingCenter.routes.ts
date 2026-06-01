import { Router } from 'express';
import { salonController } from './gamingCenter.controller';
import { authMiddleware } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/requireRole';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../common/middleware/asyncHandler';

const router = Router();

// Public routes
router.get('/', asyncHandler(salonController.getAllSalons));
router.get('/:id', asyncHandler(salonController.getSalonById));

// Protected routes - Require authentication and specific roles
router.post(
  '/',
  authMiddleware,
  asyncHandler(salonController.createSalon),
);
router.patch(
  '/:id',
  authMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER]),
  asyncHandler(salonController.updateSalon),
);
router.delete(
  '/:id',
  authMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER]),
  asyncHandler(salonController.deleteSalon),
);

export default router;
