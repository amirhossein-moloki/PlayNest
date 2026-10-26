import { addMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Reservation, ReservationStatus, Prisma, SessionActorType, UserRole } from '@prisma/client';
import { ReservationRepo } from './reservation.repo';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { gamingSessionsStation } from '../gamingSessions/gamingSessions.station';
import { commissionsStation } from '../commissions/commissions.station';
import { walletService } from '../wallet/wallet.station';
import { auditService } from '../audit/audit.station';
import { AppEvents, eventEmitter } from '../../common/events/event-emitter';
import logger from '../../config/logger';
import { env } from '../../config/env';
import { ReservationStateMachine } from './reservation.state-machine';
import { discountsStation } from '../discounts/discounts.station';
import { calculateBasePrice } from '../../common/utils/money';
import {
  validateLeadTime,
  validateOperatingHours,
  validateStationAvailability,
  validateStaffShiftHours,
} from './reservation.validation';
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

export const reservationLifecycle = {
  async confirmReservation(reservationId: string, gamingCenterId: string) {
    const reservation = await findAndValidateReservation(reservationId, gamingCenterId);

    if (reservation.status === ReservationStatus.CONFIRMED) {
      return reservation;
    }

    ReservationStateMachine.validateTransition(reservation.status, ReservationStatus.CONFIRMED);

    const updatedReservation = await ReservationRepo.transaction(async (tx) => {
      const result = await ReservationRepo.updateReservationWithInclude(
        reservationId,
        gamingCenterId,
        { status: ReservationStatus.CONFIRMED },
        {
          gamingCenter: { include: { settings: true } },
          customerAccount: true,
        },
        tx
      );

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

    eventEmitter.emit(AppEvents.RESERVATION_CONFIRMED, {
      reservation: updatedReservation,
      gamingCenter: updatedReservation.gamingCenter,
      customerAccount: updatedReservation.customerAccount,
    });

    return updatedReservation;
  },

  async cancelReservation(
    reservationId: string,
    gamingCenterId: string,
    actor: { id: string; role: UserRole; actorType: SessionActorType },
    data: CancelReservationInput,
    context?: { ip?: string; userAgent?: string }
  ) {
    const reservation = await findAndValidateReservation(reservationId, gamingCenterId);

    if (reservation.status === ReservationStatus.CANCELED) {
      return reservation;
    }

    ReservationStateMachine.validateTransition(reservation.status, ReservationStatus.CANCELED);

    const updatedReservation = await ReservationRepo.transaction(async (tx) => {
      const result = await ReservationRepo.updateReservationWithInclude(
        reservationId,
        gamingCenterId,
        {
          status: ReservationStatus.CANCELED,
          canceledAt: new Date(),
          canceledByUserId: actor.id,
          cancelReason: data.reason,
        },
        {
          gamingCenter: { include: { settings: true } },
          customerAccount: true,
        },
        tx
      );

      if (!result) {
        throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
      }

      await ReservationRepo.createHistory({
        reservationId,
        fromStatus: reservation.status,
        toStatus: ReservationStatus.CANCELED,
        action: 'CANCEL',
        actorId: actor.id,
        actorType: actor.actorType,
        reason: data.reason,
      }, tx);

      // Trigger refund if there are successful payments
      await walletService.refundReservationToWallet(reservationId, tx);

      return result;
    });

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
        await gamingSessionsStation.endSession(reservationId, tx);
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
      return await ReservationRepo.transaction(async (tx) => {
        const reservation = await ReservationRepo.findReservationById(reservationId, gamingCenterId, tx);
        if (!reservation) {
          throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
        }

        if (ReservationStateMachine.isTerminalState(reservation.status)) {
          throw new AppError('Cannot reschedule a reservation in terminal state', httpStatus.CONFLICT, {
            code: 'INVALID_TRANSITION',
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

        const gamingCenter = await ReservationRepo.findGamingCenterWithSettings(gamingCenterId, tx);
        const settings = gamingCenter?.settings;

        // 1. Lead time check (BR-001)
        validateLeadTime(newStartTime, settings?.minAdvanceBookingMinutes ?? 30);

        // 2. Station maintenance check
        const maintenances = await ReservationRepo.findOverlappingMaintenance(effectiveStationId, newStartTime, newEndTime, tx);
        validateStationAvailability(station, maintenances);

        // 3. Global operating hours check
        validateOperatingHours(
          newStartTime,
          newEndTime,
          settings?.workStartTime || gamingCenter?.openingTime,
          settings?.workEndTime || gamingCenter?.closingTime,
          settings?.timeZone
        );

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

        // Recalculate prices and dynamic discounts
        const basePrice = calculateBasePrice(durationHours, station.hourlyPrice);
        const { applicableDiscount, discountAmount } = await discountsStation.calculateApplicableDiscount(
          gamingCenterId,
          effectiveStationId,
          basePrice,
          newStartTime,
          tx
        );
        const finalPrice = Math.max(0, basePrice - discountAmount);

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
          totalPrice: finalPrice,
          discountAmount,
          discountId: applicableDiscount?.id || null,
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
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      });
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23P01' && 'message' in error && typeof error.message === 'string' && error.message.includes('Reservation_no_overlap_active')) {
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
          return ReservationRepo.expireReservationCandidate(candidate.id, now, tx);
        });

        if (expired) {
          result.expiredCount++;
          eventEmitter.emit(AppEvents.RESERVATION_EXPIRED, {
            reservationId: candidate.id,
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
          return ReservationRepo.expireGroupBookingCandidate(groupCandidate.id, now, tx);
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

    return result;
  },

  async expireStaleReservations(now?: Date) {
    const batchResult = await this.processExpiryBatch({ now });
    return batchResult.expiredCount;
  },
};
