import { Router } from 'express';
import { validate } from '../../common/middleware/validate';
import * as reservationController from './reservation.controller';
import { createPublicReservationSchema } from './reservation.dto';
import { idempotencyMiddleware } from '../../common/middleware/idempotency';
import { publicReservationRateLimiter } from '../../common/middleware/rateLimit';
import { resolveGamingCenterBySlug } from '../../common/middleware/resolveGamingCenterBySlug';
import { env } from '../../config/env';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AppRequest } from '../../types/express';

const router = Router({ mergeParams: true });

// 1. Create Online Reservation
router.post(
  '/',
  ...(env.NODE_ENV !== 'test' ? [publicReservationRateLimiter] : []),
  resolveGamingCenterBySlug,
  validate(createPublicReservationSchema),
  asyncHandler(idempotencyMiddleware),
  asyncHandler<AppRequest>(reservationController.createPublicReservation)
);

export default router;
