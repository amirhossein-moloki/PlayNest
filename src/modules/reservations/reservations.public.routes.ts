import { Router } from 'express';
import { validate } from '../../common/middleware/validate';
import * as bookingsController from './reservations.controller';
import { createPublicBookingSchema } from './reservations.validators';
import { idempotencyMiddleware } from '../../common/middleware/idempotency';
import { publicBookingRateLimiter } from '../../common/middleware/rateLimit';
import { resolveSalonBySlug } from '../../common/middleware/resolveSalonBySlug';
import { env } from '../../config/env';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AppRequest } from '../../types/express';

const router = Router({ mergeParams: true });

// 1. Create Online Reservation
router.post(
  '/',
  ...(env.NODE_ENV !== 'test' ? [publicBookingRateLimiter] : []),
  resolveSalonBySlug,
  validate(createPublicBookingSchema),
  asyncHandler(idempotencyMiddleware),
  asyncHandler<AppRequest>(bookingsController.createPublicBooking)
);

export default router;
