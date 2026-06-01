import { Router } from 'express';
import { upsertShiftsController } from './staffShifts.controller';
import { validate } from '../../common/middleware/validate';
import { upsertShiftsSchema } from './staffShifts.validators';
import { authMiddleware } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { privateApiRateLimiter } from '../../common/middleware/rateLimit';
import { asyncHandler } from '../../common/middleware/asyncHandler';

const router = Router({ mergeParams: true });

// All routes in this file are for authenticated users
router.use(privateApiRateLimiter, authMiddleware, tenantGuard);

// Define staffShifts routes
router.put(
  '/',
  requireRole([UserRole.MANAGER]),
  validate(upsertShiftsSchema),
  asyncHandler(upsertShiftsController)
);

export default router;
