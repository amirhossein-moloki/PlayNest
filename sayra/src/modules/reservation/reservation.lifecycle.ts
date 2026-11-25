import { addMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import {
  Reservation,
  ReservationStatus,
  ReservationPaymentState,
  ReservationSource,
  GamingSessionStatus,
  PaymentStatus,
  Prisma,
  SessionActorType,
  UserRole,
  CancellationCategory,
  CancellationActor,
} from '@prisma/client';
import { ReservationRepo } from './reservation.repo';
import { PaymentsRepo } from '../payments/payments.repo';
import AppError from '../../common/errors/AppError';
import { isReservationOverlapDbError } from '../../common/errors/dbErrors';
import httpStatus from 'http-status';
import { gamingSessionsStation } from '../gamingSessions/gamingSessions.station';
import { GamingSessionsRepo } from '../gamingSessions/gamingSessions.repo';
import { discountsStation } from '../discounts/discounts.station';
import { commissionsStation } from '../commissions/commissions.station';
import { walletService } from '../wallet/wallet.station';
import { auditService } from '../audit/audit.station';
import { AppEvents, eventEmitter } from '../../common/events/event-emitter';
import logger from '../../config/logger';
import { env } from '../../config/env';
import { invalidatePublicCacheByPrefix } from '../../common/utils/publicCache';
import { ReservationStateMachine } from './reservation.state-machine';
import { calculateBasePrice } from '../../common/utils/money';
import {
  resolveCancellationWindowMinutes,
  validateCancellationWindowMinutes,
  validateLeadTime,
  validateOperatingHours,
  validateStationAvailability,
  validateStaffShiftHours,
} from './reservation.validation';
import { GroupBookingRepo } from '../group-booking/group-booking.repo';
import { CancelReservationInput, RescheduleReservationInput } from './reservation.dto';

const findAndValidateReservation = async (
  reservationId: string,
  gamingCenterId: string
): Promise<Reservation> => {
  const reservation = await ReservationRepo.findReservationById(reservationId, gamingCenterId);
  if (!reservation) {
    throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
  }
  return reservation;
};

const assertReservationPayableEligibility = (
  reservation: {
    paymentState?: ReservationPaymentState | null;
    source?: ReservationSource | null;
    customerPayableAmount?: number | null;
    totalPrice?: number | null;
  },
  actionLabel: 'confirm' | 'start'
) => {
  if (
    reservation.paymentState === ReservationPaymentState.FAILED ||
    reservation.paymentState === ReservationPaymentState.CANCELED
  ) {
    throw new AppError(
      `Cannot ${actionLabel} a reservation with failed or canceled payment.`,
      httpStatus.CONFLICT,
      { code: 'PAYMENT_FAILED' }
    );
  }

  let payableAmount = 0;
  if (typeof reservation.customerPayableAmount === 'number' && reservation.customerPayableAmount > 0) {
    payableAmount = reservation.customerPayableAmount;
  } else if (typeof reservation.totalPrice === 'number') {
    payableAmount = reservation.totalPrice;
  }

  if (
    reservation.source === ReservationSource.ONLINE &&
    payableAmount > 0 &&
    reservation.paymentState &&
    reservation.paymentState !== ReservationPaymentState.PAID
  ) {
    throw new AppError(
      `Cannot ${actionLabel} an unpaid online reservation.`,
      httpStatus.CONFLICT,
      { code: 'PAYMENT_REQUIRED' }
    );
  }
};

export const reservationLifecycle = {
  async confirmReservation(reservationId: string, gamingCenterId: string) {
    const now = new Date();

    const updatedReservation = await ReservationRepo.transaction(async (tx) => {
      const reservation = await ReservationRepo.findReservationById(reservationId, gamingCenterId, tx);
      if (!reservation) {
        throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
      }

      if (reservation.status === ReservationStatus.CONFIRMED) {
        return reservation;
      }

      if (reservation.status === ReservationStatus.EXPIRED) {
        throw new AppError('Reservation has expired and cannot be confirmed.', httpStatus.CONFLICT, {
          code: 'RESERVATION_EXPIRED',
        });
      }

      if (reservation.status !== ReservationStatus.PENDING) {
        ReservationStateMachine.validateTransition(reservation.status, ReservationStatus.CONFIRMED);
      }

      assertReservationPayableEligibility(reservation, 'confirm');

      // Check confirmation deadline
      const deadline = reservation.confirmationExpiresAt || reservation.expiresAt;
      if (deadline && deadline <= now) {
        // Mark as EXPIRED atomically and refund paid amount before throwing
        const expiredRes = await ReservationRepo.updateReservation(
          reservationId,
          gamingCenterId,
          { status: ReservationStatus.EXPIRED },
          tx
        );
        await ReservationRepo.createHistory({
          reservationId,
          fromStatus: reservation.status,
          toStatus: ReservationStatus.EXPIRED,
          action: 'EXPIRE',
          reason: 'عدم تأیید رزرو توسط صاحب گیمنت در مهلت تعیین‌شده',
        }, tx);
        await walletService.refundReservationToWallet(reservationId, tx);
        if (typeof commissionsStation?.reverseCommissionForReservation === 'function') {
          await commissionsStation.reverseCommissionForReservation(
            reservationId,
            { reason: 'Reservation expired before confirmation' },
            tx
          );
        }

        return { expiredOnConfirm: true as const, reservation: expiredRes || reservation };
      }

      // Atomic conditional update: only update if still PENDING
      const updateResult = await tx.reservation.updateMany({
        where: {
          id: reservationId,
          gamingCenterId,
          status: ReservationStatus.PENDING,
        },
        data: {
          status: ReservationStatus.CONFIRMED,
          confirmationExpiresAt: null,
          expiresAt: null,
        },
      });

      if (updateResult.count === 0) {
        // Concurrently modified by expiry worker or cancelled
        const current = await ReservationRepo.findReservationById(reservationId, gamingCenterId, tx);
        if (current?.status === ReservationStatus.EXPIRED) {
          throw new AppError('Reservation has expired and cannot be confirmed.', httpStatus.CONFLICT, {
            code: 'RESERVATION_EXPIRED',
          });
        }
        throw new AppError('Invalid state transition or reservation no longer pending', httpStatus.CONFLICT, {
          code: 'INVALID_TRANSITION',
        });
      }

      const result = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: {
          gamingCenter: { include: { settings: true } },
          customerAccount: true,
        },
      });

      if (!result) {
        throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
      }

      await ReservationRepo.createHistory({
        reservationId,
        fromStatus: reservation.status,
        toStatus: ReservationStatus.CONFIRMED,
        action: 'CONFIRM',
      }, tx);

      return result;
    });

    if (
      updatedReservation &&
      typeof updatedReservation === 'object' &&
      'expiredOnConfirm' in updatedReservation &&
      updatedReservation.expiredOnConfirm
    ) {
      eventEmitter.emit(AppEvents.RESERVATION_EXPIRED, {
        reservationId,
        reservation: updatedReservation.reservation,
        gamingCenterId,
      });
      throw new AppError('Confirmation deadline has expired.', httpStatus.CONFLICT, {
        code: 'CONFIRMATION_EXPIRED',
      });
    }

    if ('gamingCenter' in updatedReservation && 'customerAccount' in updatedReservation) {
      eventEmitter.emit(AppEvents.RESERVATION_CONFIRMED, {
        reservation: updatedReservation,
        gamingCenter: updatedReservation.gamingCenter,
        customerAccount: updatedReservation.customerAccount,
      });
    }

    void invalidatePublicCacheByPrefix(`public:avail:${gamingCenterId}:`);

    return updatedReservation;
  },

  async cancelReservation(
    reservationId: string,
    gamingCenterId: string,
    actor: { id: string; role: UserRole; actorType: SessionActorType },
    data: CancelReservationInput,
    context?: { ip?: string; userAgent?: string }
  ) {
    const now = new Date();
    const reservation = await findAndValidateReservation(reservationId, gamingCenterId);

    if (reservation.status === ReservationStatus.CANCELED) {
      return reservation;
    }

    ReservationStateMachine.validateTransition(reservation.status, ReservationStatus.CANCELED);

    if (
      reservation.completedAt ||
      (reservation.status !== ReservationStatus.PENDING && reservation.endTime && new Date(reservation.endTime) <= now)
    ) {
      throw new AppError(
        'Cannot cancel a reservation that has already ended.',
        httpStatus.CONFLICT,
        { code: 'RESERVATION_ALREADY_ENDED' }
      );
    }

    const txOutcome = await ReservationRepo.transaction(async (tx) => {
      if (typeof ReservationRepo.lockReservationForUpdate === 'function') {
        await ReservationRepo.lockReservationForUpdate(reservationId, tx);
      }

      let locked: {
        id: string;
        status: ReservationStatus;
        endTime: Date;
        completedAt: Date | null;
        groupBookingId: string | null;
        campaignId: string | null;
        discountId: string | null;
      } | null = null;

      if (typeof tx?.reservation?.findFirst === 'function') {
        locked = await tx.reservation.findFirst({
          where: { id: reservationId, gamingCenterId },
          select: {
            id: true,
            status: true,
            endTime: true,
            completedAt: true,
            groupBookingId: true,
            campaignId: true,
            discountId: true,
          },
        });

        if (!locked) {
          throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
        }

        if (locked.status === ReservationStatus.CANCELED) {
          return {
            alreadyCanceled: true as const,
            existingReservation: { ...reservation, ...locked },
          };
        }

        ReservationStateMachine.validateTransition(locked.status, ReservationStatus.CANCELED);

        const txNow = new Date();
        if (
          locked.completedAt ||
          (locked.status !== ReservationStatus.PENDING && locked.endTime && new Date(locked.endTime) <= txNow)
        ) {
          throw new AppError(
            'Cannot cancel a reservation that has already ended.',
            httpStatus.CONFLICT,
            { code: 'RESERVATION_ALREADY_ENDED' }
          );
        }
      }

      if (typeof tx?.gamingSession?.findFirst === 'function') {
        const completedSession = await tx.gamingSession.findFirst({
          where: {
            reservationId,
            status: GamingSessionStatus.COMPLETED,
          },
          select: { id: true },
        });
        if (completedSession) {
          throw new AppError(
            'Cannot cancel a reservation with a completed gaming session.',
            httpStatus.CONFLICT,
            { code: 'INVALID_TRANSITION' }
          );
        }
      }

      const result = await ReservationRepo.updateReservationWithInclude(
        reservationId,
        gamingCenterId,
        {
          status: ReservationStatus.CANCELED,
          canceledAt: new Date(),
          canceledByUserId: actor.actorType === SessionActorType.USER ? actor.id : null,
          cancelReason: data.reason,
          cancelCategory: data.cancelCategory || CancellationCategory.UNKNOWN,
          cancelActor: data.cancelActor || (actor.actorType === SessionActorType.CUSTOMER ? CancellationActor.CUSTOMER : CancellationActor.STAFF),
        },
        {
          gamingCenter: { include: { settings: true } },
          customerAccount: true,
        },
        tx
      );

      if (!result) {
        throw new AppError(
          'Reservation can no longer be canceled due to a concurrent state change.',
          httpStatus.CONFLICT,
          { code: 'INVALID_TRANSITION' }
        );
      }

      const effectiveStatus = locked?.status ?? reservation.status;
      const effectiveGroupBookingId = locked?.groupBookingId ?? reservation.groupBookingId;
      const effectiveCampaignId = locked ? locked.campaignId : reservation.campaignId;
      const effectiveDiscountId = locked ? locked.discountId : reservation.discountId;

      await ReservationRepo.createHistory({
        reservationId,
        fromStatus: effectiveStatus,
        toStatus: ReservationStatus.CANCELED,
        action: 'CANCEL',
        actorId: actor.id,
        actorType: actor.actorType,
        reason: data.reason,
      }, tx);

      // Cancel any pending time proposals for this reservation
      if (typeof ReservationRepo.cancelPendingProposals === 'function') {
        await ReservationRepo.cancelPendingProposals(reservationId, tx);
      }

      // Close any active or paused gaming session if canceling an in-progress reservation
      if (effectiveStatus === ReservationStatus.IN_PROGRESS) {
        const activeSession = await GamingSessionsRepo.findActiveOrPausedSessionByReservationId?.(reservationId, tx);
        if (activeSession) {
          await GamingSessionsRepo.updateSession(
            activeSession.id,
            {
              status: GamingSessionStatus.INTERRUPTED,
              endTime: new Date(),
              pausedAt: null,
              interruptionReason: data.reason || 'Reservation canceled',
            },
            tx
          );
        }
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
            data.reason || 'Reservation canceled'
          );
        }
      }

      // Trigger refund if there are successful payments
      await walletService.refundReservationToWallet(reservationId, tx);
      if (typeof commissionsStation?.reverseCommissionForReservation === 'function') {
        await commissionsStation.reverseCommissionForReservation(
          reservationId,
          { reason: data.reason || 'Reservation canceled' },
          tx
        );
      }

      // Release any campaign or voucher discount reservation hold
      if (effectiveCampaignId || effectiveDiscountId) {
        await discountsStation.releaseDiscountForReservation(
          reservationId,
          data.reason || 'Reservation canceled',
          tx
        ).catch((err) => {
          logger.warn({ err, reservationId }, 'Failed to release discount on cancellation');
        });
      }

      if (effectiveGroupBookingId && typeof GroupBookingRepo?.syncParentGroupBookingStatus === 'function') {
        await GroupBookingRepo.syncParentGroupBookingStatus(effectiveGroupBookingId, tx);
      }

      return { alreadyCanceled: false as const, updatedReservation: result };
    });

    if (txOutcome.alreadyCanceled) {
      return txOutcome.existingReservation;
    }

    const updatedReservation = txOutcome.updatedReservation!;

    eventEmitter.emit(AppEvents.RESERVATION_CANCELED, {
      reservation: updatedReservation,
      gamingCenter: updatedReservation.gamingCenter,
      customerAccount: updatedReservation.customerAccount,
    });

    await auditService.log(
      gamingCenterId,
      actor,
      'RESERVATION_CANCEL',
      { name: 'Reservation', id: reservationId },
      { old: reservation, new: updatedReservation },
      context
    );

    void invalidatePublicCacheByPrefix(`public:avail:${gamingCenterId}:`);

    return updatedReservation;
  },

  async startReservation(
    reservationId: string,
    gamingCenterId: string,
    actor: { id: string; role: UserRole; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    return ReservationRepo.transaction(async (tx) => {
      const reservation = await ReservationRepo.findReservationById(reservationId, gamingCenterId, tx);
      if (!reservation) {
        throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
      }

      if (reservation.status === ReservationStatus.IN_PROGRESS) {
        return reservation;
      }

      ReservationStateMachine.validateTransition(reservation.status, ReservationStatus.IN_PROGRESS);
      assertReservationPayableEligibility(reservation, 'start');

      const updatedReservation = await ReservationRepo.updateReservation(reservationId, gamingCenterId, {
        status: ReservationStatus.IN_PROGRESS,
      }, tx);

      if (!updatedReservation) {
        throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
      }

      await ReservationRepo.createHistory({
        reservationId,
        fromStatus: reservation.status,
        toStatus: ReservationStatus.IN_PROGRESS,
        action: 'START',
        actorId: actor.id,
        actorType: actor.actorType,
      }, tx);

      await gamingSessionsStation.startSession(reservationId, reservation.stationId, tx);

      if (updatedReservation.groupBookingId && typeof GroupBookingRepo?.syncParentGroupBookingStatus === 'function') {
        await GroupBookingRepo.syncParentGroupBookingStatus(updatedReservation.groupBookingId, tx);
      }

      await auditService.log(
        gamingCenterId,
        actor,
        'RESERVATION_START',
        { name: 'Reservation', id: reservationId },
        { old: reservation, new: updatedReservation },
        context
      );

      return updatedReservation;
    });
  },

  async completeReservation(
    reservationId: string,
    gamingCenterId: string,
    actor: { id: string; role: UserRole; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const reservation = await findAndValidateReservation(reservationId, gamingCenterId);

    if (reservation.status === ReservationStatus.COMPLETED) {
      return reservation;
    }

    ReservationStateMachine.validateTransition(reservation.status, ReservationStatus.COMPLETED);

    const updatedReservation = await ReservationRepo.transaction(async (tx) => {
      const updated = await ReservationRepo.updateReservation(reservationId, gamingCenterId, {
        status: ReservationStatus.COMPLETED,
        completedAt: new Date(),
      }, tx);

      if (!updated) {
        throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
      }

      await ReservationRepo.createHistory({
        reservationId,
        fromStatus: reservation.status,
        toStatus: ReservationStatus.COMPLETED,
        action: 'COMPLETE',
        actorId: actor.id,
        actorType: actor.actorType,
      }, tx);

      if (reservation.status === ReservationStatus.IN_PROGRESS) {
        const activeSession = await GamingSessionsRepo.findActiveOrPausedSessionByReservationId?.(reservationId, tx);
        if (activeSession) {
          await gamingSessionsStation.endSession(reservationId, tx);
        }
      }

      if (updated.groupBookingId && typeof GroupBookingRepo?.syncParentGroupBookingStatus === 'function') {
        await GroupBookingRepo.syncParentGroupBookingStatus(updated.groupBookingId, tx);
      }

      return updated;
    });

    await auditService.log(
      gamingCenterId,
      actor,
      'RESERVATION_COMPLETE',
      { name: 'Reservation', id: reservationId },
      { old: reservation, new: updatedReservation },
      context
    );

    eventEmitter.emit(AppEvents.RESERVATION_COMPLETED, { reservation: updatedReservation });

    // Trigger commission calculation
    await commissionsStation.calculateCommission(reservationId).catch((err) => {
      console.error('Failed to calculate commission for reservation:', reservationId, err);
    });

    void invalidatePublicCacheByPrefix(`public:avail:${gamingCenterId}:`);

    return updatedReservation;
  },

  async markAsNoShow(
    reservationId: string,
    gamingCenterId: string,
    actor: { id: string; role: UserRole; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const reservation = await findAndValidateReservation(reservationId, gamingCenterId);

    if (reservation.status === ReservationStatus.NO_SHOW) {
      return reservation;
    }

    const now = new Date();
    if (reservation.startTime > now) {
      throw new AppError('Reservation start time has not yet passed for no-show marking.', httpStatus.BAD_REQUEST, {
        code: 'RESERVATION_NOT_STARTED',
      });
    }

    ReservationStateMachine.validateTransition(reservation.status, ReservationStatus.NO_SHOW);

    const updatedReservation = await ReservationRepo.transaction(async (tx) => {
      const updated = await ReservationRepo.updateReservation(reservationId, gamingCenterId, {
        status: ReservationStatus.NO_SHOW,
        noShowAt: now,
      }, tx);

      if (!updated) {
        throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
      }

      await ReservationRepo.createHistory({
        reservationId,
        fromStatus: reservation.status,
        toStatus: ReservationStatus.NO_SHOW,
        action: 'NO_SHOW',
        actorId: actor.id,
        actorType: actor.actorType,
      }, tx);

      if (updated.groupBookingId && typeof GroupBookingRepo?.syncParentGroupBookingStatus === 'function') {
        await GroupBookingRepo.syncParentGroupBookingStatus(updated.groupBookingId, tx);
      }

      return updated;
    });

    await auditService.log(
      gamingCenterId,
      actor,
      'RESERVATION_NOSHOW',
      { name: 'Reservation', id: reservationId },
      { old: reservation, new: updatedReservation },
      context
    );

    eventEmitter.emit(AppEvents.RESERVATION_NOSHOW, { reservation: updatedReservation });

    void invalidatePublicCacheByPrefix(`public:avail:${gamingCenterId}:`);

    return updatedReservation;
  },

  async rescheduleReservation(
    reservationId: string,
    gamingCenterId: string,
    data: RescheduleReservationInput,
    actor: { id: string; role?: UserRole; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    try {
      const rescheduled = await ReservationRepo.transaction(async (tx) => {
        if (typeof ReservationRepo.lockReservationForUpdate === 'function') {
          await ReservationRepo.lockReservationForUpdate(reservationId, tx);
        }

        const reservation = await ReservationRepo.findReservationById(reservationId, gamingCenterId, tx);
        if (!reservation) {
          throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
        }

        if (ReservationStateMachine.isTerminalState(reservation.status)) {
          throw new AppError('Cannot reschedule a reservation in terminal state', httpStatus.CONFLICT, {
            code: 'INVALID_TRANSITION',
          });
        }

        if (reservation.status === ReservationStatus.IN_PROGRESS) {
          throw new AppError('Cannot reschedule an in-progress reservation.', httpStatus.CONFLICT, {
            code: 'INVALID_TRANSITION',
          });
        }

        const now = new Date();
        if (reservation.completedAt || (reservation.endTime && new Date(reservation.endTime) <= now)) {
          throw new AppError('Cannot reschedule a reservation that has already ended.', httpStatus.CONFLICT, {
            code: 'RESERVATION_ALREADY_ENDED',
          });
        }

        if (typeof tx?.gamingSession?.findFirst === 'function') {
          const existingSession = await tx.gamingSession.findFirst({
            where: { reservationId },
            select: { id: true },
          });
          if (existingSession) {
            throw new AppError(
              'Cannot reschedule a reservation whose gaming session has already started or completed.',
              httpStatus.CONFLICT,
              { code: 'RESERVATION_SESSION_STARTED' }
            );
          }
        }

        if (actor.actorType === SessionActorType.CUSTOMER && reservation.startTime && new Date(reservation.startTime) <= now) {
          throw new AppError('Cannot reschedule a reservation that has already started.', httpStatus.CONFLICT, {
            code: 'RESERVATION_ALREADY_STARTED',
          });
        }

        const effectiveStationId = data.stationId || reservation.stationId;
        const effectiveStaffId = data.staffId || reservation.staffId;

        // Lock station to prevent concurrent allocation
        await ReservationRepo.lockStationForUpdate(effectiveStationId, tx);

        const station = await ReservationRepo.findStation(effectiveStationId, gamingCenterId, true, tx);
        if (!station) {
          throw new AppError('GameStation not found or is not active.', httpStatus.NOT_FOUND);
        }

        if (effectiveStaffId) {
          const staff = await ReservationRepo.findStaff(effectiveStaffId, gamingCenterId, effectiveStationId, undefined, tx);
          if (!staff) {
            throw new AppError('Staff member not found or does not perform this station.', httpStatus.NOT_FOUND);
          }
        }

        const newStartTime = new Date(data.startTime);
        const durationHours = station.defaultDurationHours;
        const newEndTime = addMinutes(newStartTime, durationHours * 60);

        const isPaidOrPartial =
          reservation.paymentState === ReservationPaymentState.PAID ||
          reservation.paymentState === ReservationPaymentState.PARTIALLY_PAID;
        if (actor.actorType === SessionActorType.CUSTOMER && isPaidOrPartial) {
          if (data.stationId && data.stationId !== reservation.stationId) {
            throw new AppError(
              'Cannot change game station on an already paid reservation.',
              httpStatus.BAD_REQUEST,
              { code: 'PAID_RESERVATION_UPGRADE_NOT_ALLOWED' }
            );
          }
          if (
            typeof reservation.totalHours === 'number' &&
            durationHours > reservation.totalHours
          ) {
            throw new AppError(
              'Cannot increase duration on an already paid reservation.',
              httpStatus.BAD_REQUEST,
              { code: 'PAID_RESERVATION_UPGRADE_NOT_ALLOWED' }
            );
          }
        }

        const gamingCenter = await ReservationRepo.findGamingCenterWithSettings(gamingCenterId, tx);
        const settings = gamingCenter?.settings;

        if (actor.actorType === SessionActorType.CUSTOMER && reservation.startTime) {
          const cancellationWindowMinutes = resolveCancellationWindowMinutes(settings);
          validateCancellationWindowMinutes(new Date(reservation.startTime), cancellationWindowMinutes, now);
        }

        // 1. Lead time check (BR-001)
        validateLeadTime(newStartTime, settings?.minAdvanceBookingMinutes ?? 30);

        // 2. Station maintenance check
        const maintenances = await ReservationRepo.findOverlappingMaintenance(effectiveStationId, newStartTime, newEndTime, tx);
        validateStationAvailability(station, maintenances);

        // 3. Global operating hours check
        validateOperatingHours(newStartTime, newEndTime, {
          openingTime: settings?.workStartTime || gamingCenter?.openingTime,
          closingTime: settings?.workEndTime || gamingCenter?.closingTime,
          timeZone: settings?.timeZone || gamingCenter?.timezone,
          closedDays: gamingCenter?.closedDays,
          schedules: gamingCenter?.schedules,
          closures: gamingCenter?.closures,
        });

        // 4. Staff shift check
        const timeZone = settings?.timeZone || 'UTC';
        const zonedNewStartAt = toZonedTime(newStartTime, timeZone);
        if (effectiveStaffId) {
          const staffShift = await ReservationRepo.findStaffShift(gamingCenterId, effectiveStaffId, zonedNewStartAt.getDay(), tx);
          validateStaffShiftHours(staffShift, newStartTime, newEndTime, timeZone);
        }

        // 5. Overlap check
        const preventOverlaps = settings?.preventOverlaps ?? true;
        if (preventOverlaps && effectiveStaffId) {
          const overlappingReservation = await ReservationRepo.findOverlappingReservation(
            gamingCenterId,
            effectiveStaffId,
            newStartTime,
            newEndTime,
            reservation.id,
            tx,
            effectiveStationId
          );

          if (overlappingReservation) {
            throw new AppError('Reservation overlaps with another reservation.', httpStatus.CONFLICT, {
              code: 'SLOT_NOT_AVAILABLE',
            });
          }
        }

        // Recalculate prices and dynamic discounts using centralized financials engine
        const basePrice = calculateBasePrice(durationHours, station.hourlyPrice);
        const { calculateReservationFinancials } = await import('./reservation.station');
        const financials = await calculateReservationFinancials(
          gamingCenterId,
          effectiveStationId,
          basePrice,
          newStartTime,
          reservation.customerAccountId,
          reservation.voucherCode,
          tx,
          reservation.source
        );

        const existingPayable =
          typeof reservation.customerPayableAmount === 'number'
            ? reservation.customerPayableAmount
            : reservation.totalPrice;
        if (
          actor.actorType === SessionActorType.CUSTOMER &&
          isPaidOrPartial &&
          financials.customerPayableAmount > existingPayable
        ) {
          throw new AppError(
            'Cannot reschedule a paid reservation to a higher-priced slot or station.',
            httpStatus.BAD_REQUEST,
            { code: 'PAID_RESERVATION_UPGRADE_NOT_ALLOWED' }
          );
        }

        const updateData: Prisma.ReservationUncheckedUpdateInput = {
          startTime: newStartTime,
          endTime: newEndTime,
          stationId: effectiveStationId,
          staffId: effectiveStaffId,
          stationSnapshot: {
            name: station.name,
            hourlyPrice: station.hourlyPrice,
            stationType: station.stationType,
          },
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
        };

        if (data.reason) {
          updateData.note = data.reason;
        }

        const updatedReservation = await ReservationRepo.updateReservation(reservationId, gamingCenterId, updateData, tx);
        if (!updatedReservation) {
          throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
        }

        // Write ReservationHistory
        await ReservationRepo.createHistory({
          reservationId,
          fromStatus: reservation.status,
          toStatus: updatedReservation.status,
          action: 'RESCHEDULE',
          actorId: actor.id,
          actorType: actor.actorType,
          reason: data.reason,
          metadata: {
            oldStartTime: reservation.startTime,
            oldEndTime: reservation.endTime,
            newStartTime,
            newEndTime,
            stationId: effectiveStationId,
          },
        }, tx);

        await auditService.log(
          gamingCenterId,
          actor,
          'RESERVATION_RESCHEDULE',
          { name: 'Reservation', id: reservationId },
          { old: reservation, new: updatedReservation },
          context
        );

        return updatedReservation;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      });

      void invalidatePublicCacheByPrefix(`public:avail:${gamingCenterId}:`);
      return rescheduled;
    } catch (error: unknown) {
      if (isReservationOverlapDbError(error)) {
        throw new AppError('Reservation overlaps with another for the same station/time.', httpStatus.CONFLICT, {
          code: 'SLOT_NOT_AVAILABLE',
        });
      }
      throw error;
    }
  },

  async processExpiryBatch(options?: { batchSize?: number; now?: Date }) {
    const batchSize = options?.batchSize ?? env.RESERVATION_EXPIRY_BATCH_SIZE;
    const now = options?.now ?? new Date();

    const reservationCandidates = await ReservationRepo.findExpiryCandidateReservations(batchSize, now);
    const remainingBatch = Math.max(0, batchSize - reservationCandidates.length);
    const groupCandidates = remainingBatch > 0 ? await ReservationRepo.findExpiryCandidateGroupBookings(remainingBatch, now) : [];

    const result = {
      candidatesFound: reservationCandidates.length + groupCandidates.length,
      expiredCount: 0,
      skippedCount: 0,
      failedCount: 0,
    };

    if (result.candidatesFound === 0) {
      return result;
    }

    for (const candidate of reservationCandidates) {
      try {
        const expired = await ReservationRepo.transaction(async (tx) => {
          const success = await ReservationRepo.expireReservationCandidate(candidate.id, now, tx);
          if (success) {
            if (typeof tx.payment?.findMany === 'function') {
              const initiatedPayments = await tx.payment.findMany({
                where: {
                  reservationId: candidate.id,
                  status: PaymentStatus.INITIATED,
                },
              });
              for (const p of initiatedPayments) {
                await PaymentsRepo.handleFailedPayment(
                  tx,
                  p.id,
                  PaymentStatus.CANCELED,
                  'Reservation expired before payment completion'
                );
              }
            }
            // Trigger refund to wallet if paid
            await walletService.refundReservationToWallet(candidate.id, tx);
            if (typeof commissionsStation?.reverseCommissionForReservation === 'function') {
              await commissionsStation.reverseCommissionForReservation(
                candidate.id,
                { reason: 'Reservation expired' },
                tx
              );
            }
            await discountsStation.releaseDiscountForReservation(
              candidate.id,
              'Reservation expired without payment',
              tx
            ).catch(() => {});
          }
          return success;
        });

        if (expired) {
          result.expiredCount++;
          const fullRes = await ReservationRepo.findReservationById(candidate.id, candidate.gamingCenterId);
          eventEmitter.emit(AppEvents.RESERVATION_EXPIRED, {
            reservationId: candidate.id,
            reservation: fullRes,
            gamingCenterId: candidate.gamingCenterId,
          });
        } else {
          result.skippedCount++;
          logger.info({
            msg: 'Reservation expiry skipped as state changed concurrently',
            reservationId: candidate.id,
          });
        }
      } catch (error) {
        result.failedCount++;
        logger.error({
          msg: 'Failed to expire reservation candidate',
          reservationId: candidate.id,
          error,
        });
      }
    }

    for (const groupCandidate of groupCandidates) {
      try {
        const expired = await ReservationRepo.transaction(async (tx) => {
          const success = await ReservationRepo.expireGroupBookingCandidate(groupCandidate.id, now, tx);
          if (success) {
            if (typeof tx.payment?.findMany === 'function') {
              const initiatedGroupPayments = await tx.payment.findMany({
                where: {
                  groupBookingId: groupCandidate.id,
                  status: PaymentStatus.INITIATED,
                },
              });
              for (const p of initiatedGroupPayments) {
                await PaymentsRepo.handleFailedPayment(
                  tx,
                  p.id,
                  PaymentStatus.CANCELED,
                  'Group booking expired before payment completion'
                );
              }
            }
            // Trigger refund for group booking child reservations
            const children = await tx.reservation.findMany({
              where: { groupBookingId: groupCandidate.id },
              select: { id: true },
            });
            for (const child of children) {
              await walletService.refundReservationToWallet(child.id, tx);
              if (typeof commissionsStation?.reverseCommissionForReservation === 'function') {
                await commissionsStation.reverseCommissionForReservation(
                  child.id,
                  { reason: 'Group booking expired' },
                  tx
                );
              }
            }
          }
          return success;
        });

        if (expired) {
          result.expiredCount++;
          eventEmitter.emit(AppEvents.RESERVATION_EXPIRED, {
            groupBookingId: groupCandidate.id,
            gamingCenterId: groupCandidate.gamingCenterId,
          });
        } else {
          result.skippedCount++;
          logger.info({
            msg: 'GroupBooking expiry skipped as state changed concurrently',
            groupBookingId: groupCandidate.id,
          });
        }
      } catch (error) {
        result.failedCount++;
        logger.error({
          msg: 'Failed to expire group booking candidate',
          groupBookingId: groupCandidate.id,
          error,
        });
      }
    }

    if (result.expiredCount > 0) {
      void invalidatePublicCacheByPrefix('public:avail:');
    }

    return result;
  },

  async expireStaleReservations(now?: Date) {
    const batchResult = await this.processExpiryBatch({ now });
    return batchResult.expiredCount;
  },

  /**
   * Automatically completes IN_PROGRESS reservations whose endTime has passed
   * and marks CONFIRMED reservations whose endTime has passed without starting as NO_SHOW.
   */
  async processAutoLifecycleBatch(options?: { batchSize?: number; now?: Date }) {
    const batchSize = options?.batchSize ?? env.RESERVATION_EXPIRY_BATCH_SIZE;
    const now = options?.now ?? new Date();

    const result = {
      autoCompletedCount: 0,
      autoNoShowCount: 0,
      failedCount: 0,
    };

    const { prisma } = await import('../../config/prisma');

    // 1. Auto-complete IN_PROGRESS reservations whose endTime <= now
    const dueToComplete = await prisma.reservation.findMany({
      where: {
        status: ReservationStatus.IN_PROGRESS,
        endTime: { lte: now },
      },
      select: { id: true, gamingCenterId: true, groupBookingId: true },
      take: batchSize,
      orderBy: { endTime: 'asc' },
    });

    for (const candidate of dueToComplete) {
      try {
        const completed = await ReservationRepo.transaction(async (tx) => {
          const updated = await tx.reservation.updateMany({
            where: {
              id: candidate.id,
              status: ReservationStatus.IN_PROGRESS,
              endTime: { lte: now },
            },
            data: {
              status: ReservationStatus.COMPLETED,
              completedAt: now,
            },
          });

          if (updated.count === 0) return null;

          await ReservationRepo.createHistory(
            {
              reservationId: candidate.id,
              fromStatus: ReservationStatus.IN_PROGRESS,
              toStatus: ReservationStatus.COMPLETED,
              action: 'AUTO_COMPLETE',
              reason: 'اتمام خودکار سشن پس از پایان زمان رزرو',
            },
            tx
          );

          const activeSession = await GamingSessionsRepo.findActiveOrPausedSessionByReservationId?.(candidate.id, tx);
          if (activeSession) {
            await gamingSessionsStation.endSession(candidate.id, tx);
          }

          if (candidate.groupBookingId && typeof GroupBookingRepo?.syncParentGroupBookingStatus === 'function') {
            await GroupBookingRepo.syncParentGroupBookingStatus(candidate.groupBookingId, tx);
          }

          return tx.reservation.findUnique({ where: { id: candidate.id } });
        });

        if (completed) {
          result.autoCompletedCount++;
          eventEmitter.emit(AppEvents.RESERVATION_COMPLETED, { reservation: completed });
          await commissionsStation.calculateCommission(candidate.id).catch(() => {});
        }
      } catch (error) {
        result.failedCount++;
        logger.error({ msg: 'Failed to auto-complete reservation', reservationId: candidate.id, error });
      }
    }

    // 2. Auto-mark CONFIRMED reservations whose endTime <= now (never started) as NO_SHOW
    const dueToNoShow = await prisma.reservation.findMany({
      where: {
        status: ReservationStatus.CONFIRMED,
        endTime: { lte: now },
      },
      select: { id: true, gamingCenterId: true, groupBookingId: true },
      take: batchSize,
      orderBy: { endTime: 'asc' },
    });

    for (const candidate of dueToNoShow) {
      try {
        const marked = await ReservationRepo.transaction(async (tx) => {
          const updated = await tx.reservation.updateMany({
            where: {
              id: candidate.id,
              status: ReservationStatus.CONFIRMED,
              endTime: { lte: now },
            },
            data: {
              status: ReservationStatus.NO_SHOW,
              noShowAt: now,
            },
          });

          if (updated.count === 0) return null;

          await ReservationRepo.createHistory(
            {
              reservationId: candidate.id,
              fromStatus: ReservationStatus.CONFIRMED,
              toStatus: ReservationStatus.NO_SHOW,
              action: 'AUTO_NO_SHOW',
              reason: 'عدم حضور کاربر تا پایان زمان رزرو',
            },
            tx
          );

          if (candidate.groupBookingId && typeof GroupBookingRepo?.syncParentGroupBookingStatus === 'function') {
            await GroupBookingRepo.syncParentGroupBookingStatus(candidate.groupBookingId, tx);
          }

          return tx.reservation.findUnique({ where: { id: candidate.id } });
        });

        if (marked) {
          result.autoNoShowCount++;
          eventEmitter.emit(AppEvents.RESERVATION_NOSHOW, { reservation: marked });
        }
      } catch (error) {
        result.failedCount++;
        logger.error({ msg: 'Failed to auto-mark reservation as no-show', reservationId: candidate.id, error });
      }
    }

    return result;
  },
};
