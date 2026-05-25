import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { validate } from '../../common/middleware/validate';
import { PaymentsController } from './payments.controller';
import { InitPaymentValidators } from './payments.validators';
import { salonIdMiddleware } from '../../common/middleware/gamingCenterId.middleware';
import { idempotencyMiddleware } from '../../common/middleware/idempotency';

const router = Router();

router.post(
  '/reservations/:reservationId/payments/init', // Path is now relative to `/gamingCenters/:gamingCenterId/reservations`
  authMiddleware,
  salonIdMiddleware,
  tenantGuard,
  idempotencyMiddleware,
  requireRole([UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.STAFF]),
  validate(InitPaymentValidators),
  PaymentsController.initiatePayment
);

export const paymentsRoutes = router;