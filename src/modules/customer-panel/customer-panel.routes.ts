import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { requireActorType } from '../../common/middleware/requireActorType';
import { SessionActorType } from '@prisma/client';
import * as CustomerPanelController from './customer-panel.controller';
import { validate } from '../../common/middleware/validate';
import {
  getCustomerReservationSchema,
  customerCancelReservationSchema,
  customerSubmitReviewSchema,
} from './customer-panel.validators';
import { privateApiRateLimiter } from '../../common/middleware/rateLimit';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AppRequest } from '../../types/express';

const router = Router();

router.use(privateApiRateLimiter, authMiddleware, requireActorType(SessionActorType.CUSTOMER));

router.get('/me', asyncHandler<AppRequest>(CustomerPanelController.getMe));

router.get('/reservation', validate(getCustomerReservationSchema), asyncHandler<AppRequest>(CustomerPanelController.getMyReservation));

router.get('/:reservationId', asyncHandler<AppRequest>(CustomerPanelController.getMyReservationDetails));

router.post(
  '/reservation/:reservationId/cancel',
  validate(customerCancelReservationSchema),
  asyncHandler<AppRequest>(CustomerPanelController.cancelMyReservation)
);

router.post(
  '/reservation/:reservationId/ratings',
  validate(customerSubmitReviewSchema),
  asyncHandler<AppRequest>(CustomerPanelController.submitMyReview)
);

export { router as customerPanelRouter };
