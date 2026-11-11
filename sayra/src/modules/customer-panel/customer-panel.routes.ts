import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { requireActorType } from '../../common/middleware/requireActorType';
import { SessionActorType } from '@prisma/client';
import * as CustomerPanelController from './customer-panel.controller';
import { validate } from '../../common/middleware/validate';
import {
  getCustomerReservationSchema,
  customerCancelReservationSchema,
  customerRescheduleReservationSchema,
  customerSubmitReviewSchema,
  proposalActionParamsSchema,
  listProposalsParamsSchema,
  updateCustomerProfileSchema,
} from './customer-panel.validators';
import { privateApiRateLimiter } from '../../common/middleware/rateLimit';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AppRequest } from '../../types/express';

const router = Router();

router.use(privateApiRateLimiter, authMiddleware, requireActorType(SessionActorType.CUSTOMER));

router.get('/me', asyncHandler<AppRequest>(CustomerPanelController.getMe));

router.patch(
  '/me',
  validate(updateCustomerProfileSchema),
  asyncHandler<AppRequest>(CustomerPanelController.updateMe)
);

// Customer Wallet & Withdrawal Endpoints
import * as WithdrawalController from '../wallet/withdrawal.controller';
import {
  requestWithdrawalSchema,
  listCustomerWithdrawalsSchema,
  customerWithdrawalIdParamSchema,
  listCustomerTransactionsSchema,
  customerTransactionIdParamSchema,
  listCustomerNotificationsSchema,
  customerNotificationIdParamSchema,
} from '../wallet/withdrawal.validators';

router.get('/wallet', asyncHandler<AppRequest>(WithdrawalController.getMyWallet));

// Customer Online Wallet Charge Endpoints
import * as ChargeController from '../wallet/charge.controller';
import { chargeWalletSchema, getChargeStatusSchema } from '../wallet/charge.validators';

router.post(
  '/wallet/charge',
  validate(chargeWalletSchema),
  asyncHandler<AppRequest>(ChargeController.initiateWalletCharge)
);

router.get(
  '/wallet/charge/:chargeId',
  validate(getChargeStatusSchema),
  asyncHandler<AppRequest>(ChargeController.getWalletChargeStatus)
);

router.post(
  '/wallet/withdraw',
  validate(requestWithdrawalSchema),
  asyncHandler<AppRequest>(WithdrawalController.createWithdrawalRequest)
);

router.get(
  '/wallet/withdrawals',
  validate(listCustomerWithdrawalsSchema),
  asyncHandler<AppRequest>(WithdrawalController.listMyWithdrawals)
);

router.get(
  '/wallet/withdrawals/:id',
  validate(customerWithdrawalIdParamSchema),
  asyncHandler<AppRequest>(WithdrawalController.getMyWithdrawalDetails)
);

router.get(
  '/wallet/transactions',
  validate(listCustomerTransactionsSchema),
  asyncHandler<AppRequest>(WithdrawalController.listMyTransactions)
);

router.get(
  '/wallet/transactions/:id',
  validate(customerTransactionIdParamSchema),
  asyncHandler<AppRequest>(WithdrawalController.getMyTransactionDetails)
);

// Customer In-App Notifications
router.get(
  '/notifications',
  validate(listCustomerNotificationsSchema),
  asyncHandler<AppRequest>(WithdrawalController.listMyNotifications)
);

router.patch(
  '/notifications/:id/read',
  validate(customerNotificationIdParamSchema),
  asyncHandler<AppRequest>(WithdrawalController.markMyNotificationAsRead)
);

router.get('/reservation', validate(getCustomerReservationSchema), asyncHandler<AppRequest>(CustomerPanelController.getMyReservation));

router.get('/:reservationId', asyncHandler<AppRequest>(CustomerPanelController.getMyReservationDetails));

router.post(
  '/reservation/:reservationId/cancel',
  validate(customerCancelReservationSchema),
  asyncHandler<AppRequest>(CustomerPanelController.cancelMyReservation)
);

router.post(
  '/reservation/:reservationId/reschedule',
  validate(customerRescheduleReservationSchema),
  asyncHandler<AppRequest>(CustomerPanelController.rescheduleMyReservation)
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
