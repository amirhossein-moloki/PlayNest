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
