import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { validate } from '../../common/middleware/validate';
import { PaymentsController } from './payments.controller';
import {
  InitPaymentValidators,
  VerifyPaymentValidators,
  GetPaymentStatusValidators,
  RequestRefundValidators,
  GetRefundValidators,
  ListRefundsValidators,
  GetLedgerValidators,
  ReconcileValidators,
} from './payments.validators';
import { gamingCenterIdMiddleware } from '../../common/middleware/gamingCenterId.middleware';
import { idempotencyMiddleware } from '../../common/middleware/idempotency';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AppRequest } from '../../types/express';

const router = Router();

// Initiate payment
router.post(
  '/:reservationId/payments/init',
  authMiddleware,
  gamingCenterIdMiddleware,
  tenantGuard,
  asyncHandler(idempotencyMiddleware),
  requireRole([UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.STAFF]),
  validate(InitPaymentValidators),
  asyncHandler<AppRequest>(PaymentsController.initiatePayment)
);

// Verify payment (GET callback from gateway browser return)
router.get(
  '/:reservationId/payments/verify',
  authMiddleware,
  gamingCenterIdMiddleware,
  tenantGuard,
  validate(VerifyPaymentValidators),
  asyncHandler<AppRequest>(PaymentsController.verifyPayment)
);

// Verify payment (POST callback or manual server verification)
router.post(
  '/:reservationId/payments/verify',
  authMiddleware,
  gamingCenterIdMiddleware,
  tenantGuard,
  validate(VerifyPaymentValidators),
  asyncHandler<AppRequest>(PaymentsController.verifyPayment)
);

// Get payment status for a reservation
router.get(
  '/:reservationId/payments/status',
  authMiddleware,
  gamingCenterIdMiddleware,
  tenantGuard,
  validate(GetPaymentStatusValidators),
  asyncHandler<AppRequest>(PaymentsController.getPaymentStatus)
);

export const paymentsRoutes = router;

// Management Router for Refunds, Ledger, and Reconciliation
const managementRouter = Router({ mergeParams: true });

// Request refund for a payment
managementRouter.post(
  '/:paymentId/refunds',
  authMiddleware,
  gamingCenterIdMiddleware,
  tenantGuard,
  asyncHandler(idempotencyMiddleware),
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(RequestRefundValidators),
  asyncHandler<AppRequest>(PaymentsController.requestRefund)
);

// Get refund status
managementRouter.get(
  '/:paymentId/refunds/:refundId',
  authMiddleware,
  gamingCenterIdMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.STAFF]),
  validate(GetRefundValidators),
  asyncHandler<AppRequest>(PaymentsController.getRefundStatus)
);

// List refunds for a payment
managementRouter.get(
  '/:paymentId/refunds',
  authMiddleware,
  gamingCenterIdMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.STAFF]),
  validate(ListRefundsValidators),
  asyncHandler<AppRequest>(PaymentsController.listRefunds)
);

// View financial ledger history
managementRouter.get(
  '/ledger',
  authMiddleware,
  gamingCenterIdMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(GetLedgerValidators),
  asyncHandler<AppRequest>(PaymentsController.getLedgerHistory)
);

// Run reconciliation
managementRouter.post(
  '/reconcile',
  authMiddleware,
  gamingCenterIdMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(ReconcileValidators),
  asyncHandler<AppRequest>(PaymentsController.reconcile)
);

export const paymentsManagementRouter = managementRouter;
