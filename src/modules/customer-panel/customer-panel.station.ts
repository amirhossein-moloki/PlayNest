import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { CustomerPanelRepo } from './customer-panel.repo';
import { GetCustomerBookingsQuery, CustomerSubmitReviewInput } from './customer-panel.validators';
import { ReservationStatus, Prisma, SessionActorType } from '@prisma/client';
import { auditService } from '../audit/audit.station';
import { WalletService } from '../wallet/wallet.station';
import { AnalyticsRepo } from '../analytics/analytics.repo';
import * as reviewsRepo from '../ratings/ratings.repo';

export const CustomerPanelService = {
  async getProfile(customerAccountId: string) {
    const account = await CustomerPanelRepo.findCustomerAccountById(customerAccountId);
    if (!account) {
      throw new AppError('Customer account not found', httpStatus.NOT_FOUND);
    }
    return account;
  },

  async getBookings(customerAccountId: string, query: GetCustomerBookingsQuery) {
    const { page = 1, pageSize = 10, status, gamingCenterId } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ReservationWhereInput = {
      customerAccountId,
      status,
      gamingCenterId,
    };

    const [reservations, totalItems] = await Promise.all([
      CustomerPanelRepo.findManyReservations(where, skip, pageSize),
      CustomerPanelRepo.countReservations(where),
    ]);

    return {
      data: reservations,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  },

  async getBookingDetails(reservationId: string, customerAccountId: string) {
    const reservation = await CustomerPanelRepo.findReservationById(reservationId, customerAccountId);
    if (!reservation) {
      throw new AppError('Reservation not found', httpStatus.NOT_FOUND);
    }
    return reservation;
  },

  async cancelBooking(
    reservationId: string,
    customerAccountId: string,
    reason?: string,
    context?: { ip?: string; userAgent?: string }
  ) {
    const reservation = await CustomerPanelRepo.findReservationById(reservationId, customerAccountId);
    if (!reservation) {
      throw new AppError('Reservation not found', httpStatus.NOT_FOUND);
    }

    if (!([ReservationStatus.PENDING, ReservationStatus.CONFIRMED] as ReservationStatus[]).includes(reservation.status)) {
      throw new AppError('Reservation cannot be canceled in its current state', httpStatus.BAD_REQUEST);
    }

    const updatedBooking = await CustomerPanelRepo.transaction(async (tx) => {
      const result = await CustomerPanelRepo.updateReservation(reservationId, customerAccountId, {
        status: ReservationStatus.CANCELED,
        canceledAt: new Date(),
        cancelReason: reason || 'Canceled by customer',
      }, tx);

      // Trigger refund if there are successful payments
      await WalletService.refundBookingToWallet(reservationId, tx);

      return result;
    });

    await auditService.log(
      reservation.gamingCenterId,
      { id: customerAccountId, actorType: SessionActorType.CUSTOMER },
      'BOOKING_CANCEL',
      { name: 'Reservation', id: reservationId },
      { old: reservation, new: updatedBooking },
      context
    );

    AnalyticsRepo.syncAllStatsForBooking(reservationId).catch(console.error);

    return updatedBooking;
  },

  async submitReview(
    reservationId: string,
    customerAccountId: string,
    input: CustomerSubmitReviewInput
  ) {
    const reservation = await CustomerPanelRepo.findReservationById(reservationId, customerAccountId);
    if (!reservation) {
      throw new AppError('Reservation not found', httpStatus.NOT_FOUND);
    }

    if (reservation.status !== ReservationStatus.COMPLETED) {
      throw new AppError('Only completed reservations can be reviewed', httpStatus.BAD_REQUEST);
    }

    // Check if rating already exists for this target
    // The Rating model has a unique constraint on [reservationId, target, stationId]

    try {
      const rating = await reviewsRepo.createReview(reservation.gamingCenterId, customerAccountId, {
        reservationId,
        rating: input.rating,
        stationId: input.stationId,
        comment: input.comment,
      });

      AnalyticsRepo.syncAllStatsForReview(rating.id).catch(console.error);

      return rating;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('Rating already exists for this reservation/target', httpStatus.CONFLICT);
      }
      throw error;
    }
  },
};
