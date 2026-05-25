import { Router } from 'express';
import { validate } from '../../common/middleware/validate';
import * as bookingsController from './reservations.controller';
import {
  createBookingSchema,
  updateBookingSchema,
  cancelBookingSchema,
  listBookingsQuerySchema,
} from './reservations.validators';
import { authMiddleware } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { idParamSchema } from '../../common/validators/common.validators';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { privateApiRateLimiter } from '../../common/middleware/rateLimit';
import { env } from '../../config/env';

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
  validate(createBookingSchema),
  bookingsController.createBooking
);

// 2. List Bookings
router.get(
  '/',
  requireRole(M_R_S),
  validate(listBookingsQuerySchema),
  bookingsController.getBookings
);

// 3. Get Reservation by ID
router.get(
  '/:reservationId',
  requireRole(M_R_S),
  validate(idParamSchema('reservationId')),
  bookingsController.getBookingById
);

// 4. Update Reservation Details
router.patch(
  '/:reservationId',
  requireRole(M_R),
  validate(updateBookingSchema),
  bookingsController.updateBooking
);

// 5. Confirm Reservation
router.post(
  '/:reservationId/confirm',
  requireRole(M_R),
  validate(idParamSchema('reservationId')),
  bookingsController.confirmBooking
);

// 6. Cancel Reservation
router.post(
  '/:reservationId/cancel',
  requireRole(M_R),
  validate(cancelBookingSchema),
  bookingsController.cancelBooking
);

// 7. Complete Reservation
router.post(
  '/:reservationId/complete',
  requireRole(M_R),
  validate(idParamSchema('reservationId')),
  bookingsController.completeBooking
);

// 8. Mark as No-Show
router.post(
  '/:reservationId/no-show',
  requireRole(M_R),
  validate(idParamSchema('reservationId')),
  bookingsController.markAsNoShow
);

export default router;
