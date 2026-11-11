import { isBefore } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { CustomerPanelRepo } from './customer-panel.repo';
import { GetCustomerReservationQuery, CustomerSubmitReviewInput, UpdateCustomerProfileInput } from './customer-panel.validators';
import { ReservationStatus, ReservationProposalStatus, Prisma, SessionActorType, CancellationCategory, CancellationActor } from '@prisma/client';
import { auditService } from '../audit/audit.station';
import { walletService } from '../wallet/wallet.station';
import { AnalyticsRepo } from '../analytics/analytics.repo';
import * as reviewsRepo from '../ratings/ratings.repo';
import { AppEvents, eventEmitter } from '../../common/events/event-emitter';
import { ReservationStateMachine } from '../reservation/reservation.state-machine';
import { ReservationRepo } from '../reservation/reservation.repo';
import { reservationStation } from '../reservation/reservation.station';
import { RescheduleReservationInput } from '../reservation/reservation.dto';
import { getZonedStartAndEnd } from '../../common/utils/date';
import { discountsStation } from '../discounts/discounts.station';
import { calculateBasePrice } from '../../common/utils/money';

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

    const [reservations, totalItems] = await Promise.all([
      CustomerPanelRepo.findManyReservation(where, skip, pageSize),
      CustomerPanelRepo.countReservation(where),
    ]);

    // Attach canCancel helper flag for client UI (true only when status is PENDING)
    const formattedReservations = reservations.map((r) => ({
      ...r,
      canCancel: ReservationStateMachine.canCustomerCancelBeforeConfirmation(r.status),
    }));

    return {
      data: formattedReservations,
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
      throw new AppError('Reservation not found', httpStatus.NOT_FOUND);
    }

    // Attach canCancel helper flag for client UI (true only when status is PENDING)
    return {
      ...reservation,
      canCancel: ReservationStateMachine.canCustomerCancelBeforeConfirmation(reservation.status),
    };
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
      throw new AppError('Reservation not found', httpStatus.NOT_FOUND);
    }

    // Idempotent: If already canceled, return reservation safely without re-triggering actions
    if (reservation.status === ReservationStatus.CANCELED) {
      return reservation;
    }

    // Strict rule: Customer pre-confirmation cancellation is only permitted when status is PENDING
    ReservationStateMachine.validateCustomerPreConfirmationCancellation(reservation.status);

    const cancelReason = reason || 'Canceled by customer before confirmation';
    const canceledAt = new Date();

    const updatedReservation = await CustomerPanelRepo.transaction(async (tx) => {
      // Atomic conditional update ensuring only PENDING reservation for this customer can be canceled
      const result = await CustomerPanelRepo.cancelPendingReservationAtomic(
        reservationId,
        customerAccountId,
        {
          status: ReservationStatus.CANCELED,
          canceledAt,
          cancelReason,
          cancelCategory: CancellationCategory.CUSTOMER_CANCEL,
          cancelActor: CancellationActor.CUSTOMER,
        },
        tx
      );

      // If update count was 0, a race condition occurred (e.g. owner confirmed or another cancel executed)
      if (!result) {
        const latest = await CustomerPanelRepo.findReservationById(reservationId, customerAccountId);
        if (!latest) {
          throw new AppError('Reservation not found', httpStatus.NOT_FOUND);
        }
        if (latest.status === ReservationStatus.CANCELED) {
          return latest;
        }
        if (latest.status === ReservationStatus.CONFIRMED) {
          throw new AppError(
            'Reservation has already been confirmed by the gaming center and cannot be canceled via pre-confirmation flow',
            httpStatus.CONFLICT,
            { code: 'RESERVATION_ALREADY_CONFIRMED' }
          );
        }
        throw new AppError(
          `Only pending reservations can be canceled before confirmation. Current status: ${latest.status}`,
          httpStatus.CONFLICT,
          { code: 'INVALID_TRANSITION' }
        );
      }

      await ReservationRepo.createHistory({
        reservationId,
        fromStatus: reservation.status,
        toStatus: ReservationStatus.CANCELED,
        action: 'CANCEL_BY_CUSTOMER',
        actorId: customerAccountId,
        actorType: SessionActorType.CUSTOMER,
        reason: cancelReason,
        metadata: {
          preConfirmation: true,
          canceledAt: canceledAt.toISOString(),
        },
      }, tx);

      // Trigger refund if there are successful payments (idempotent inside walletService)
      await walletService.refundReservationToWallet(reservationId, tx);

      return result;
    });

    // Fire RESERVATION_CANCELED event so waitlist is notified, slot released, SMS sent
    const resWithRelations = updatedReservation as typeof updatedReservation & {
      gamingCenter?: unknown;
      customerAccount?: unknown;
    };
    eventEmitter.emit(AppEvents.RESERVATION_CANCELED, {
      reservation: updatedReservation,
      gamingCenter: resWithRelations.gamingCenter,
      customerAccount: resWithRelations.customerAccount,
    });

    await auditService.log(
      reservation.gamingCenterId,
      { id: customerAccountId, actorType: SessionActorType.CUSTOMER },
      'RESERVATION_CANCEL',
      { name: 'Reservation', id: reservationId },
      { old: reservation, new: updatedReservation },
      context
    );

    AnalyticsRepo.syncAllStatsForReservation(reservationId).catch(console.error);

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

      const { applicableDiscount, discountAmount } = await discountsStation.calculateApplicableDiscount(
        reservation.gamingCenterId,
        reservation.stationId,
        basePrice,
        proposal.proposedStartTime,
        tx
      );

      const finalPrice = Math.max(0, basePrice - discountAmount);

      const updatedReservation = await ReservationRepo.updateReservation(
        reservationId,
        reservation.gamingCenterId,
        {
          startTime: proposal.proposedStartTime,
          endTime: proposal.proposedEndTime,
          totalHours: durationHours,
          totalPrice: finalPrice,
          discountAmount,
          discountId: applicableDiscount?.id || null,
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
