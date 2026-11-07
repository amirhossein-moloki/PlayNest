import { Router } from 'express';
import { validate } from '../../common/middleware/validate';
import * as groupBookingController from './group-booking.controller';
import {
  createPublicGroupReservationSchema,
  createGroupBookingSchema,
  listGroupBookingQuerySchema,
  groupBookingIdParamSchema,
  cancelGroupBookingSchema,
} from './group-booking.validator';
import { idempotencyMiddleware } from '../../common/middleware/idempotency';
import { publicReservationRateLimiter, privateApiRateLimiter } from '../../common/middleware/rateLimit';
import { resolveGamingCenterBySlug } from '../../common/middleware/resolveGamingCenterBySlug';
import { authMiddleware } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/requireRole';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { UserRole } from '@prisma/client';
import { env } from '../../config/env';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AppRequest } from '../../types/express';

// --- Public Group Booking Router ---
// Mount under: /api/v1/public/gamingCenters/:gamingCenterSlug/group-reservations
export const publicGroupBookingRouter = Router({ mergeParams: true });

publicGroupBookingRouter.post(
  '/',
  ...(env.NODE_ENV !== 'test' ? [publicReservationRateLimiter] : []),
  resolveGamingCenterBySlug,
  validate(createPublicGroupReservationSchema),
  asyncHandler(idempotencyMiddleware),
  asyncHandler<AppRequest>(groupBookingController.createPublicGroupBooking)
);

// --- Private Group Booking Router ---
// Mount under: /api/v1/gamingCenters/:gamingCenterId/group-reservations
export const privateGroupBookingRouter = Router({ mergeParams: true });

if (env.NODE_ENV !== 'test') {
  privateGroupBookingRouter.use(privateApiRateLimiter);
}
privateGroupBookingRouter.use(authMiddleware, tenantGuard);

const M_A = [UserRole.MANAGER, UserRole.ADMIN];

privateGroupBookingRouter.post(
  '/',
  requireRole(M_A),
  validate(createGroupBookingSchema),
  asyncHandler<AppRequest>(groupBookingController.createGroupBooking)
);

privateGroupBookingRouter.get(
  '/',
  requireRole(M_A),
  validate(listGroupBookingQuerySchema),
  asyncHandler<AppRequest>(groupBookingController.listGroupBookings)
);

privateGroupBookingRouter.get(
  '/:id',
  requireRole(M_A),
  validate(groupBookingIdParamSchema),
  asyncHandler<AppRequest>(groupBookingController.getGroupBookingById)
);

privateGroupBookingRouter.post(
  '/:id/cancel',
  requireRole(M_A),
  validate(cancelGroupBookingSchema),
  asyncHandler<AppRequest>(groupBookingController.cancelGroupBooking)
);
