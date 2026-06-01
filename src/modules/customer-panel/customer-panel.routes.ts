import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { requireActorType } from '../../common/middleware/requireActorType';
import { SessionActorType } from '@prisma/client';
import * as CustomerPanelController from './customer-panel.controller';
import { validate } from '../../common/middleware/validate';
import {
  getCustomerBookingsSchema,
  customerCancelBookingSchema,
  customerSubmitReviewSchema,
} from './customer-panel.validators';
import { privateApiRateLimiter } from '../../common/middleware/rateLimit';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AppRequest } from '../../types/express';

const router = Router();

router.use(privateApiRateLimiter, authMiddleware, requireActorType(SessionActorType.CUSTOMER));

router.get('/me', asyncHandler<AppRequest>(CustomerPanelController.getMe));

router.get('/reservations', validate(getCustomerBookingsSchema), asyncHandler<AppRequest>(CustomerPanelController.getMyBookings));

router.get('/:reservationId', asyncHandler<AppRequest>(CustomerPanelController.getMyBookingDetails));

router.post(
  '/reservations/:reservationId/cancel',
  validate(customerCancelBookingSchema),
  asyncHandler<AppRequest>(CustomerPanelController.cancelMyBooking)
);

router.post(
  '/reservations/:reservationId/ratings',
  validate(customerSubmitReviewSchema),
  asyncHandler<AppRequest>(CustomerPanelController.submitMyReview)
);

export { router as customerPanelRouter };
