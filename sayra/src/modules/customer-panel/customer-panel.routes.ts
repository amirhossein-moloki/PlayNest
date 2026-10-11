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
  proposalActionParamsSchema,
  listProposalsParamsSchema,
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

router.get(
  '/reservation/:reservationId/proposals',
  validate(listProposalsParamsSchema),
  asyncHandler<AppRequest>(CustomerPanelController.getMyProposals)
);

router.post(
  '/reservation/:reservationId/proposals/:proposalId/accept',
  validate(proposalActionParamsSchema),
  asyncHandler<AppRequest>(CustomerPanelController.acceptProposal)
);

router.post(
  '/reservation/:reservationId/proposals/:proposalId/reject',
  validate(proposalActionParamsSchema),
  asyncHandler<AppRequest>(CustomerPanelController.rejectProposal)
);

export { router as customerPanelRouter };
