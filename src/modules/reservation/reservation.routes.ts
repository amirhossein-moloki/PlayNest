import { Router } from 'express';
import { validate } from '../../common/middleware/validate';
import * as reservationController from './reservation.controller';
import {
  createReservationSchema,
  updateReservationSchema,
  cancelReservationSchema,
  listReservationQuerySchema,
} from './reservation.dto';
import { authMiddleware } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { idParamSchema } from '../../common/validators/common.validators';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { privateApiRateLimiter } from '../../common/middleware/rateLimit';
import { env } from '../../config/env';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AppRequest } from '../../types/express';

const router = Router({ mergeParams: true });

if (env.NODE_ENV !== 'test') {
  router.use(privateApiRateLimiter);
}
router.use(authMiddleware, tenantGuard);

const M_R = [UserRole.MANAGER, UserRole.SUPERVISOR]; // Manager or Receptionist for write actions
const M_R_S = [UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.STAFF]; // All roles for read actions

// 1. Create Reservation
router.post(
  '/',
  requireRole(M_R),
  validate(createReservationSchema),
  asyncHandler<AppRequest>(reservationController.createReservation)
);

// 2. List Reservation
router.get(
  '/',
  requireRole(M_R_S),
  validate(listReservationQuerySchema),
  asyncHandler<AppRequest>(reservationController.getReservation)
);

// 3. Get Reservation by ID
router.get(
  '/:reservationId',
  requireRole(M_R_S),
  validate(idParamSchema('reservationId')),
  asyncHandler<AppRequest>(reservationController.getReservationById)
);

// 4. Update Reservation Details
router.patch(
  '/:reservationId',
  requireRole(M_R),
  validate(updateReservationSchema),
  asyncHandler<AppRequest>(reservationController.updateReservation)
);

// 5. Confirm Reservation
router.post(
  '/:reservationId/confirm',
  requireRole(M_R),
  validate(idParamSchema('reservationId')),
  asyncHandler<AppRequest>(reservationController.confirmReservation)
);

// 6. Cancel Reservation
router.post(
  '/:reservationId/cancel',
  requireRole(M_R),
  validate(cancelReservationSchema),
  asyncHandler<AppRequest>(reservationController.cancelReservation)
);

// 7. Start Reservation
router.post(
  '/:reservationId/start',
  requireRole(M_R),
  validate(idParamSchema('reservationId')),
  asyncHandler<AppRequest>(reservationController.startReservation)
);

// 8. Complete Reservation
router.post(
  '/:reservationId/complete',
  requireRole(M_R),
  validate(idParamSchema('reservationId')),
  asyncHandler<AppRequest>(reservationController.completeReservation)
);

// 9. Mark as No-Show
router.post(
  '/:reservationId/no-show',
  requireRole(M_R),
  validate(idParamSchema('reservationId')),
  asyncHandler<AppRequest>(reservationController.markAsNoShow)
);

export default router;
