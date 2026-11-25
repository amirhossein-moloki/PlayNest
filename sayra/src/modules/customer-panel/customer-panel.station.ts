import { isBefore } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { CustomerPanelRepo } from './customer-panel.repo';
import { GetCustomerReservationQuery, CustomerSubmitReviewInput, UpdateCustomerProfileInput } from './customer-panel.validators';
import {
  ReservationStatus,
  ReservationProposalStatus,
  PaymentStatus,
  Prisma,
  SessionActorType,
  CancellationCategory,
  CancellationActor,
} from '@prisma/client';
import { auditService } from '../audit/audit.station';
import { walletService } from '../wallet/wallet.station';
import { PaymentsRepo } from '../payments/payments.repo';
import { AnalyticsRepo } from '../analytics/analytics.repo';
import * as reviewsRepo from '../ratings/ratings.repo';
import { ReservationStateMachine } from '../reservation/reservation.state-machine';
import { ReservationRepo } from '../reservation/reservation.repo';
import { reservationStation } from '../reservation/reservation.station';
import { RescheduleReservationInput } from '../reservation/reservation.dto';
import { getZonedStartAndEnd } from '../../common/utils/date';
import { calculateBasePrice } from '../../common/utils/money';
import {
  resolveCancellationWindowMinutes,
  validateCancellationWindowMinutes,
} from '../reservation/reservation.validation';
import { recordGamingCenterChangeEvent } from '../integrations/outbox.service';
import { prisma } from '../../config/prisma';
import { GroupBookingStation } from '../group-booking/group-booking.station';
import { AppEvents, eventEmitter } from '../../common/events/event-emitter';
import { commissionsStation } from '../commissions/commissions.station';
import { discountsStation } from '../discounts/discounts.station';
import { invalidatePublicCacheByPrefix } from '../../common/utils/publicCache';
import logger from '../../config/logger';

export const CustomerPanelStation = {
  async getProfile(customerAccountId: string) {
    const account = await CustomerPanelRepo.findCustomerAccountById(customerAccountId);
    if (!account) {
      throw new AppError('Customer account not found', httpStatus.NOT_FOUND);
    }
    return account;
  },

  async updateProfile(customerAccountId: string, input: UpdateCustomerProfileInput) {
    const account = await CustomerPanelRepo.findCustomerAccountById(customerAccountId);
    if (!account) {
      throw new AppError('Customer account not found', httpStatus.NOT_FOUND);
    }

    const data: Prisma.CustomerAccountUpdateInput = {};
    if (input.fullName !== undefined) {
      data.fullName = input.fullName;
    }

    const updated = await CustomerPanelRepo.updateCustomerAccount(customerAccountId, data);
    return updated;
  },

  async getReservation(customerAccountId: string, query: GetCustomerReservationQuery) {
    const { page = 1, pageSize = 10, status, gamingCenterId } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ReservationWhereInput = {
      customerAccountId,
      status,
      gamingCenterId,
    };

    const [reservation, totalItems] = await Promise.all([
      CustomerPanelRepo.findManyReservation(where, skip, pageSize),
      CustomerPanelRepo.countReservation(where),
    ]);

    return {
      data: reservation,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  },

  async getReservationDetails(reservationId: string, customerAccountId: string) {
    const reservation = await CustomerPanelRepo.findReservationById(reservationId, customerAccountId);
    if (!reservation) {
      const groupBooking = await prisma.groupBooking.findFirst({
        where: { id: reservationId, customerAccountId },
        include: {
          gamingCenter: { include: { settings: true } },
          reservations: {
            include: {
              station: { select: { id: true, name: true } },
              staff: { select: { id: true, fullName: true, avatarUrl: true } },
            },
          },
          items: true,
        },
      });
      if (groupBooking) {
        return groupBooking;
      }
      throw new AppError('Reservation not found', httpStatus.NOT_FOUND);
    }
    return reservation;
  },

  async rescheduleReservation(
    reservationId: string,
    customerAccountId: string,
    data: RescheduleReservationInput,
    context?: { ip?: string; userAgent?: string }
  ) {
    const reservation = await CustomerPanelRepo.findReservationById(reservationId, customerAccountId);
    if (!reservation) {
      throw new AppError('Reservation not found', httpStatus.NOT_FOUND);
    }

    return reservationStation.rescheduleReservation(
      reservationId,
      reservation.gamingCenterId,
      data,
      { id: customerAccountId, actorType: SessionActorType.CUSTOMER },
      context
    );
  },

  async cancelReservation(
    reservationId: string,
    customerAccountId: string,
    reason?: string,
    context?: { ip?: string; userAgent?: string }
  ) {
    const reservation = await CustomerPanelRepo.findReservationById(reservationId, customerAccountId);
    if (!reservation) {
      const groupBooking = await prisma.groupBooking.findFirst({
        where: { id: reservationId, customerAccountId },
        include: { gamingCenter: { include: { settings: true } } },
      });
      if (groupBooking) {
        if (groupBooking.status === ReservationStatus.CANCELED) {
          return groupBooking;
        }
        const gbSettings =
          groupBooking.gamingCenter?.settings ||
          (typeof ReservationRepo.findSettings === 'function'
            ? await Promise.resolve(ReservationRepo.findSettings(groupBooking.gamingCenterId))
            : null);
        const gbCancellationWindowMinutes = resolveCancellationWindowMinutes(gbSettings);
        validateCancellationWindowMinutes(new Date(groupBooking.startTime), gbCancellationWindowMinutes);

        return GroupBookingStation.cancelGroupBooking(
          reservationId,
          groupBooking.gamingCenterId,
          { id: customerAccountId, actorType: SessionActorType.CUSTOMER, customerAccountId },
          reason,
          context
        );
      }
      throw new AppError('Reservation not found', httpStatus.NOT_FOUND);
    }

    if (reservation.status === ReservationStatus.CANCELED) {
      return reservation;
    }

    if (reservation.status === ReservationStatus.IN_PROGRESS) {
      throw new AppError(
        'Cannot cancel an in-progress reservation. Please contact the gaming center staff.',
        httpStatus.CONFLICT,
        { code: 'INVALID_TRANSITION' }
      );
    }

    const settings =
      reservation.gamingCenter?.settings ||
      (typeof ReservationRepo.findSettings === 'function'
        ? await Promise.resolve(ReservationRepo.findSettings(reservation.gamingCenterId))
        : null);
    const cancellationWindowMinutes = resolveCancellationWindowMinutes(settings);
    validateCancellationWindowMinutes(new Date(reservation.startTime), cancellationWindowMinutes);

    ReservationStateMachine.validateTransition(reservation.status, ReservationStatus.CANCELED);

    const updatedReservation = await CustomerPanelRepo.transaction(async (tx) => {
      const result = await CustomerPanelRepo.updateReservation(reservationId, customerAccountId, {
        status: ReservationStatus.CANCELED,
        canceledAt: new Date(),
        cancelReason: reason || 'Canceled by customer',
        cancelCategory: CancellationCategory.CUSTOMER_CANCEL,
        cancelActor: CancellationActor.CUSTOMER,
      }, tx);

      await ReservationRepo.createHistory({
        reservationId,
        fromStatus: reservation.status,
        toStatus: ReservationStatus.CANCELED,
        action: 'CANCEL',
        actorId: customerAccountId,
        actorType: SessionActorType.CUSTOMER,
        reason: reason || 'Canceled by customer',
      }, tx);

      // Cancel any pending time proposals for this reservation
      if (typeof ReservationRepo.cancelPendingProposals === 'function') {
        await ReservationRepo.cancelPendingProposals(reservationId, tx);
      }

      // Cancel any initiated payments restoring deducted wallet funds
      if (typeof tx.payment?.findMany === 'function') {
        const activePayments = await tx.payment.findMany({
          where: {
            reservationId,
            status: PaymentStatus.INITIATED,
          },
        });
        for (const p of activePayments) {
          await PaymentsRepo.handleFailedPayment(
            tx,
            p.id,
            PaymentStatus.CANCELED,
            reason || 'Canceled by customer'
          );
        }
      }

      // Trigger refund if there are successful payments
      await walletService.refundReservationToWallet(reservationId, tx);
      if (typeof commissionsStation?.reverseCommissionForReservation === 'function') {
        await commissionsStation.reverseCommissionForReservation(
          reservationId,
          { reason: reason || 'Canceled by customer' },
          tx
        );
      }

      // Release any campaign or voucher discount reservation hold
      if (reservation.campaignId || reservation.discountId) {
        await discountsStation
          .releaseDiscountForReservation(
            reservationId,
            reason || 'Canceled by customer',
            tx
          )
          .catch((err) => {
            logger.warn({ err, reservationId }, 'Failed to release discount on customer cancellation');
          });
      }

      return result;
    });

    void invalidatePublicCacheByPrefix(`public:avail:${reservation.gamingCenterId}:`);

    await auditService.log(
      reservation.gamingCenterId,
      { id: customerAccountId, actorType: SessionActorType.CUSTOMER },
      'RESERVATION_CANCEL',
      { name: 'Reservation', id: reservationId },
      { old: reservation, new: updatedReservation },
      context
    );

    AnalyticsRepo.syncAllStatsForReservation(reservationId).catch(console.error);

    const customerAccount = (reservation as { customerAccount?: unknown }).customerAccount;
    if (updatedReservation && reservation.gamingCenter && customerAccount) {
      eventEmitter.emit(AppEvents.RESERVATION_CANCELED, {
        reservation: updatedReservation,
        gamingCenter: reservation.gamingCenter,
        customerAccount,
      });
    }

    return updatedReservation;
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
      throw new AppError('Only completed reservation can be reviewed', httpStatus.BAD_REQUEST);
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

      void recordGamingCenterChangeEvent({
        gamingCenterId: reservation.gamingCenterId,
        eventType: 'GAMING_CENTER_REVIEW_CHANGED',
        changedFields: ['ratings'],
        metadata: { ratingId: rating.id, action: 'CUSTOMER_CREATED', status: rating.status },
      });

      return rating;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('Rating already exists for this reservation/target', httpStatus.CONFLICT);
      }
      throw error;
    }
  },

  async getCustomerProposals(reservationId: string, customerAccountId: string) {
    const reservation = await CustomerPanelRepo.findReservationById(reservationId, customerAccountId);
    if (!reservation) {
      throw new AppError('Reservation not found', httpStatus.NOT_FOUND);
    }

    return ReservationRepo.listProposalsByReservationId(reservationId);
  },

  async acceptProposal(
    reservationId: string,
    proposalId: string,
    customerAccountId: string,
    context?: { ip?: string; userAgent?: string }
  ) {
    const reservation = await CustomerPanelRepo.findReservationById(reservationId, customerAccountId);
    if (!reservation) {
      throw new AppError('Reservation not found', httpStatus.NOT_FOUND);
    }

    const proposal = await ReservationRepo.findProposalById(proposalId, reservationId);
    if (!proposal) {
      throw new AppError('Proposal not found', httpStatus.NOT_FOUND);
    }

    if (proposal.status !== ReservationProposalStatus.PENDING) {
      throw new AppError('Proposal is no longer pending', httpStatus.CONFLICT, {
        code: 'INVALID_PROPOSAL_STATE',
      });
    }

    if (ReservationStateMachine.isTerminalState(reservation.status)) {
      throw new AppError('Reservation is in a terminal state', httpStatus.CONFLICT, {
        code: 'INVALID_TRANSITION',
      });
    }

    if (isBefore(proposal.proposedStartTime, new Date())) {
      await ReservationRepo.updateProposalStatus(proposalId, ReservationProposalStatus.EXPIRED);
      throw new AppError('Proposal has expired', httpStatus.CONFLICT, {
        code: 'PROPOSAL_EXPIRED',
      });
    }

    const result = await ReservationRepo.transaction(async (tx) => {
      const settings = await ReservationRepo.findSettings(reservation.gamingCenterId, tx);
      const timeZone = settings?.timeZone || 'UTC';
      const zonedStartAt = toZonedTime(proposal.proposedStartTime, timeZone);

      if (reservation.staffId) {
        const staffShift = await ReservationRepo.findStaffShift(reservation.gamingCenterId, reservation.staffId, zonedStartAt.getDay(), tx);

        if (!staffShift || !staffShift.startTime || !staffShift.endTime) {
          throw new AppError('Selected time is not available.', httpStatus.CONFLICT, {
            code: 'SLOT_NOT_AVAILABLE',
          });
        }

        const shiftStart = getZonedStartAndEnd(staffShift.startTime, proposal.proposedStartTime, timeZone);
        const shiftEnd = getZonedStartAndEnd(staffShift.endTime, proposal.proposedStartTime, timeZone);

        if (proposal.proposedStartTime.getTime() < shiftStart.getTime() || proposal.proposedEndTime.getTime() > shiftEnd.getTime()) {
          throw new AppError('Selected time is not available.', httpStatus.CONFLICT, {
            code: 'SLOT_NOT_AVAILABLE',
          });
        }

        const preventOverlaps = settings?.preventOverlaps ?? true;
        if (preventOverlaps) {
          const overlappingReservation = await ReservationRepo.findOverlappingReservation(
            reservation.gamingCenterId,
            reservation.staffId,
            proposal.proposedStartTime,
            proposal.proposedEndTime,
            reservation.id,
            tx
          );

          if (overlappingReservation) {
            throw new AppError('Reservation overlaps with another for the same staff member.', httpStatus.CONFLICT, {
              code: 'OVERLAP_CONFLICT',
            });
          }
        }
      }

      const durationHours = (proposal.proposedEndTime.getTime() - proposal.proposedStartTime.getTime()) / (1000 * 60 * 60);
      const station = await ReservationRepo.findStation(reservation.stationId, reservation.gamingCenterId, undefined, tx);
      const hourlyPrice = station?.hourlyPrice ?? ((reservation.stationSnapshot as Record<string, unknown>)?.hourlyPrice as number) ?? 0;
      const basePrice = calculateBasePrice(durationHours, hourlyPrice);

      const { calculateReservationFinancials } = await import('../reservation/reservation.station');
      const financials = await calculateReservationFinancials(
        reservation.gamingCenterId,
        reservation.stationId,
        basePrice,
        proposal.proposedStartTime,
        reservation.customerAccountId,
        reservation.voucherCode,
        tx,
        reservation.source
      );

      const updatedReservation = await ReservationRepo.updateReservation(
        reservationId,
        reservation.gamingCenterId,
        {
          startTime: proposal.proposedStartTime,
          endTime: proposal.proposedEndTime,
          totalHours: durationHours,
          totalPrice: financials.customerPayableAmount,
          discountAmount: financials.discountAmount,
          originalAmount: financials.originalAmount,
          customerPayableAmount: financials.customerPayableAmount,
          platformFundedDiscount: financials.platformFundedDiscount,
          merchantPayoutAmount: financials.merchantPayoutAmount,
          discountFundingSource: financials.discountFundingSource,
          campaignId: financials.campaignId,
          discountId: financials.discountId,
        },
        tx
      );

      const updatedProposal = await ReservationRepo.updateProposalStatus(
        proposalId,
        ReservationProposalStatus.ACCEPTED,
        new Date(),
        tx
      );

      await ReservationRepo.createHistory({
        reservationId,
        fromStatus: reservation.status,
        toStatus: updatedReservation.status,
        action: 'ACCEPT_PROPOSAL',
        actorId: customerAccountId,
        actorType: SessionActorType.CUSTOMER,
        metadata: { proposalId },
      }, tx);

      await auditService.log(
        reservation.gamingCenterId,
        { id: customerAccountId, actorType: SessionActorType.CUSTOMER },
        'RESERVATION_PROPOSAL_ACCEPTED',
        { name: 'ReservationTimeProposal', id: proposalId },
        { old: proposal, new: updatedReservation },
        context
      );

      return { proposal: updatedProposal, reservation: updatedReservation };
    });

    AnalyticsRepo.syncAllStatsForReservation(reservationId).catch(console.error);

    return result;
  },

  async rejectProposal(
    reservationId: string,
    proposalId: string,
    customerAccountId: string,
    context?: { ip?: string; userAgent?: string }
  ) {
    const reservation = await CustomerPanelRepo.findReservationById(reservationId, customerAccountId);
    if (!reservation) {
      throw new AppError('Reservation not found', httpStatus.NOT_FOUND);
    }

    const proposal = await ReservationRepo.findProposalById(proposalId, reservationId);
    if (!proposal) {
      throw new AppError('Proposal not found', httpStatus.NOT_FOUND);
    }

    if (proposal.status !== ReservationProposalStatus.PENDING) {
      throw new AppError('Proposal is no longer pending', httpStatus.CONFLICT, {
        code: 'INVALID_PROPOSAL_STATE',
      });
    }

    const updatedProposal = await ReservationRepo.updateProposalStatus(
      proposalId,
      ReservationProposalStatus.REJECTED,
      new Date()
    );

    await auditService.log(
      reservation.gamingCenterId,
      { id: customerAccountId, actorType: SessionActorType.CUSTOMER },
      'RESERVATION_PROPOSAL_REJECTED',
      { name: 'ReservationTimeProposal', id: proposalId },
      { old: proposal },
      context
    );

    return updatedProposal;
  },
};
