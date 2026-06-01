import { Router } from 'express';
import * as SettingsController from './settings.controller';
import { validate } from '../../common/middleware/validate';
import {
  updateSettingsSchema,
  getSettingsSchema,
} from './settings.validators';
import { authMiddleware } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/requireRole';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { UserRole } from '@prisma/client';
import { privateApiRateLimiter } from '../../common/middleware/rateLimit';
import { asyncHandler } from '../../common/middleware/asyncHandler';

const router = Router({ mergeParams: true });

router.use(privateApiRateLimiter, authMiddleware, tenantGuard);

router.get(
  '/',
  requireRole([UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.STAFF]),
  validate(getSettingsSchema),
  asyncHandler(SettingsController.getSettings)
);

router.patch(
  '/',
  requireRole([UserRole.MANAGER]),
  validate(updateSettingsSchema),
  asyncHandler(SettingsController.updateSettings)
);

export { router as settingsRouter };
