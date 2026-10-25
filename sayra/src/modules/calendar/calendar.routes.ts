import { Router } from 'express';
import { validate } from '../../common/middleware/validate';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { privateApiRateLimiter } from '../../common/middleware/rateLimit';
import { env } from '../../config/env';
import { getCalendarQuerySchema } from './calendar.dto';
import * as CalendarController from './calendar.controller';

const router = Router({ mergeParams: true });

if (env.NODE_ENV !== 'test') {
  router.use(privateApiRateLimiter);
}

router.use(authMiddleware, tenantGuard);

const ADMIN_READ_ROLES = [UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.STAFF];

router.get(
  '/',
  requireRole(ADMIN_READ_ROLES),
  validate(getCalendarQuerySchema),
  asyncHandler(CalendarController.getAdminCalendar)
);

export default router;
