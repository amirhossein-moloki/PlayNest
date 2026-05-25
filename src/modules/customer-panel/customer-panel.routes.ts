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

const router = Router();

router.use(privateApiRateLimiter, authMiddleware, requireActorType(SessionActorType.CUSTOMER));

router.get('/me', CustomerPanelController.getMe);

router.get('/reservations', validate(getCustomerBookingsSchema), CustomerPanelController.getMyBookings);

router.get('/reservations/:reservationId', CustomerPanelController.getMyBookingDetails);

router.post(
  '/reservations/:reservationId/cancel',
  validate(customerCancelBookingSchema),
  CustomerPanelController.cancelMyBooking
);

router.post(
  '/reservations/:reservationId/ratings',
  validate(customerSubmitReviewSchema),
  CustomerPanelController.submitMyReview
);

export { router as customerPanelRouter };
