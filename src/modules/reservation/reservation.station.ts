
import { addMinutes, isBefore } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Reservation, ReservationSource, ReservationStatus, Prisma, SessionActorType, UserRole, OtpPurpose } from '@prisma/client';
import { ReservationRepo } from './reservation.repo';
import { AuthRepository } from '../auth/auth.repository';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { getZonedStartAndEnd } from '../../common/utils/date';
import { gamingSessionsStation } from '../gamingSessions/gamingSessions.station';
import { commissionsStation } from '../commissions/commissions.station';
import { walletService } from '../wallet/wallet.station';
import { auditService } from '../audit/audit.station';
import { normalizePhone } from '../../common/utils/phone';
import { AppEvents, eventEmitter } from '../../common/events/event-emitter';
import { Metrics } from '../../common/metrics/metrics';
import { ReservationStateMachine } from './reservation.state-machine';

import {
  CancelReservationInput,
  CreateReservationInput,
  CreatePublicReservationInput,
  ListReservationQuery,
  UpdateReservationInput,
} from './reservation.dto';



const OTP_POST_VERIFICATION_WINDOW_MINUTES = 5;

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

const findOrCreateCustomerProfile = async (
  tx: Prisma.TransactionClient,
  gamingCenterId: string,
  customer: { fullName: string; phone: string; email?: string }
) => {
  const normalizedPhone = normalizePhone(customer.phone);
  let customerAccount = await ReservationRepo.findCustomerAccountByPhone(normalizedPhone, tx);

  if (!customerAccount) {
    customerAccount = await ReservationRepo.createCustomerAccount(
      { phone: normalizedPhone, fullName: customer.fullName },
      tx
    );
  }

  let customerProfile = await ReservationRepo.findCustomerProfile(gamingCenterId, customerAccount.id, tx);

  if (!customerProfile) {
    customerProfile = await ReservationRepo.createCustomerProfile(
      {
        gamingCenterId,
        customerAccountId: customerAccount.id,
        displayName: customer.fullName,
      },
      tx
    );
  }

  return { customerAccount, customerProfile };
};

export const reservationStation = {
  async createReservation(input: CreateReservationInput & { gamingCenterId: string; createdByUserId: string; }) {
    const result = await ReservationRepo.transaction(async (tx) => {
      const { gamingCenterId, stationId, staffId, customer, startTime: startAtString, createdByUserId, note } = input;
      const startTime = new Date(startAtString);

      // 1. Fetch GameStation and Customer Profile details
      const station = await ReservationRepo.findStation(stationId, gamingCenterId, true, tx);

      if (!station) {
        throw new AppError('GameStation not found or is not active.', httpStatus.NOT_FOUND);
      }

      const staff = await ReservationRepo.findStaff(staffId, gamingCenterId, stationId, undefined, tx);

      if (!staff) {
        throw new AppError(
          'Staff member not found or does not perform this station.',
          httpStatus.NOT_FOUND
        );
      }

      const { customerAccount, customerProfile } = await findOrCreateCustomerProfile(
        tx,
        gamingCenterId,
        customer as { fullName: string; phone: string; email?: string }
      );

      const gamingCenter = await ReservationRepo.findGamingCenterWithSettings(gamingCenterId, tx);

      if (!gamingCenter) {
        throw new AppError('GamingCenter not found.', httpStatus.NOT_FOUND);
      }

      // 2. Calculate endTime and create reservation
      const durationHours = station.defaultDurationHours;
      const endTime = addMinutes(startTime, durationHours * 60);

      const reservation = await ReservationRepo.createReservation({
        gamingCenterId,
        stationId,
        staffId,
        customerProfileId: customerProfile.id,
        customerAccountId: customerAccount.id,
        createdByUserId,
        startTime,
        endTime,
        note,
        status: ReservationStatus.CONFIRMED,
        stationSnapshot: {
          name: station.name,
          hourlyPrice: station.hourlyPrice,
          stationType: station.stationType,
        },
        totalHours: durationHours,
        totalPrice: durationHours * station.hourlyPrice,
      }, tx);

      return { reservation, gamingCenter, customerAccount };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });

    // Emit event
    eventEmitter.emit(AppEvents.RESERVATION_CREATED, {
      reservation: result.reservation,
      gamingCenter: result.gamingCenter,
      customerAccount: result.customerAccount,
    });

    Metrics.recordReservationCreated(true, result.reservation.gamingCenterId);

    return result.reservation;
  },

  async createPublicReservation(gamingCenterSlug: string, input: CreatePublicReservationInput) {
    try {
      const result = await ReservationRepo.transaction(async (tx) => {
        const gamingCenter = await ReservationRepo.findGamingCenterBySlugWithSettings(gamingCenterSlug, tx);

        if (!gamingCenter) {
          throw new AppError('GamingCenter not found.', httpStatus.NOT_FOUND);
        }

        if (!gamingCenter.settings?.allowOnlineBooking) {
          throw new AppError('Online reservation is disabled.', httpStatus.FORBIDDEN, {
            code: 'ONLINE_RESERVATION_DISABLED',
          });
        }

        const startTime = new Date(input.startTime);
        if (isBefore(startTime, new Date())) {
          throw new AppError('Reservation start time must be in the future.', httpStatus.BAD_REQUEST, {
            code: 'RESERVATION_START_TIME_IN_PAST',
          });
        }

        // Configurable OTP verification
        if (gamingCenter.settings?.requireOtpForPublicBooking) {
          const normalizedPhone = normalizePhone(input.customer.phone);
          const verificationWindow = new Date(Date.now() - OTP_POST_VERIFICATION_WINDOW_MINUTES * 60 * 1000);
          const recentVerifiedOtp = await AuthRepository.findRecentConsumedOtp(normalizedPhone, OtpPurpose.LOGIN, verificationWindow);

          if (!recentVerifiedOtp) {
            throw new AppError('Phone number not verified. Please verify via OTP first.', httpStatus.UNAUTHORIZED, {
              code: 'OTP_REQUIRED',
            });
          }
        }

        const station = await ReservationRepo.findStation(input.stationId, gamingCenter.id, true, tx);

        if (!station) {
          throw new AppError('GameStation not found or is not active.', httpStatus.NOT_FOUND);
        }

        const staff = await ReservationRepo.findStaff(input.staffId, gamingCenter.id, input.stationId, true, tx);

        if (!staff) {
          throw new AppError(
            'Staff member not found or does not perform this station.',
            httpStatus.NOT_FOUND
          );
        }

        const durationHours = station.defaultDurationHours;
        const endTime = addMinutes(startTime, durationHours * 60);
        const timeZone = gamingCenter.settings?.timeZone || 'UTC';
        const zonedStartAt = toZonedTime(startTime, timeZone);

        const staffShift = await ReservationRepo.findStaffShift(gamingCenter.id, staff.id, zonedStartAt.getDay(), tx);

        if (!staffShift || !staffShift.startTime || !staffShift.endTime) {
          throw new AppError('Selected time is not available.', httpStatus.CONFLICT, {
            code: 'SLOT_NOT_AVAILABLE',
          });
        }

        const shiftStart = getZonedStartAndEnd(staffShift.startTime, startTime, timeZone);
        const shiftEnd = getZonedStartAndEnd(staffShift.endTime, startTime, timeZone);

        if (startTime.getTime() < shiftStart.getTime() || endTime.getTime() > shiftEnd.getTime()) {
          throw new AppError('Selected time is not available.', httpStatus.CONFLICT, {
            code: 'SLOT_NOT_AVAILABLE',
          });
        }

        const overlappingReservation = await ReservationRepo.findOverlappingReservation(gamingCenter.id, staff.id, startTime, endTime, undefined, tx);

        if (overlappingReservation) {
          throw new AppError('Selected time is not available.', httpStatus.CONFLICT, {
            code: 'SLOT_NOT_AVAILABLE',
          });
        }

        const { customerAccount, customerProfile } = await findOrCreateCustomerProfile(
          tx,
          gamingCenter.id,
          input.customer as { fullName: string; phone: string; email?: string }
        );

        const status = gamingCenter.settings?.onlineBookingAutoConfirm
          ? ReservationStatus.CONFIRMED
          : ReservationStatus.PENDING;

        const reservation = await ReservationRepo.createReservation({
          gamingCenterId: gamingCenter.id,
          stationId: station.id,
          staffId: staff.id,
          customerProfileId: customerProfile.id,
          customerAccountId: customerAccount.id,
          createdByUserId: staff.id,
          startTime,
          endTime,
          note: input.note,
          status,
          source: ReservationSource.ONLINE,
          stationSnapshot: {
            name: station.name,
            hourlyPrice: station.hourlyPrice,
            stationType: station.stationType,
          },
          totalHours: durationHours,
          totalPrice: durationHours * station.hourlyPrice,
        }, tx);

        return { reservation, gamingCenter, customerAccount };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      });

      // Emit event
      eventEmitter.emit(AppEvents.RESERVATION_CREATED, {
        reservation: result.reservation,
        gamingCenter: result.gamingCenter,
        customerAccount: result.customerAccount,
      });

      return result.reservation;
    } catch (error: unknown) {
      Metrics.recordReservationCreated(false, gamingCenterSlug);
      if (error && typeof error === 'object' && 'code' in error && error.code === '23P01' && 'message' in error && typeof error.message === 'string' && error.message.includes('Reservation_no_overlap_active')) {
        throw new AppError('This time slot is already booked.', httpStatus.CONFLICT, {
          code: 'SLOT_NOT_AVAILABLE',
        });
      }
      throw error;
    }
  },

  async getReservation(gamingCenterId: string, query: ListReservationQuery, actor: { id: string, role: UserRole }) {
    const { page = 1, pageSize = 20, sortBy = 'startTime', sortOrder = 'asc', status, staffId, customerProfileId, dateFrom, dateTo } = query;
    const where: Prisma.ReservationWhereInput = {
      gamingCenterId,
      status,
      staffId,
      customerProfileId,
      startTime: {
        gte: dateFrom ? new Date(dateFrom) : undefined,
        lt: dateTo ? new Date(dateTo) : undefined,
      },
    };

    if (actor.role === 'STAFF') {
      where.staffId = actor.id;
    }

    const [reservation, totalItems] = await ReservationRepo.transaction(async (tx) => {
      const b = await ReservationRepo.findManyReservation(
        where,
        (page - 1) * pageSize,
        pageSize,
        { [sortBy]: sortOrder },
        tx
      );
      const c = await ReservationRepo.countReservation(where, tx);
      return [b, c] as const;
    });

    return {
      data: reservation,
      meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
    };
  },

  async getReservationById(reservationId: string, gamingCenterId: string, actor: { id: string, role: UserRole }) {
    const reservation = await findAndValidateReservation(reservationId, gamingCenterId);

    if (actor.role === 'STAFF' && reservation.staffId !== actor.id) {
      throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
    }

    return reservation;
  },

  async updateReservation(
    reservationId: string,
    gamingCenterId: string,
    data: UpdateReservationInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    try {
      return await ReservationRepo.transaction(async (tx) => {
        const reservation = await ReservationRepo.findReservationById(reservationId, gamingCenterId, tx);
        if (!reservation) {
          throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
        }

        if (([ReservationStatus.CANCELED, ReservationStatus.COMPLETED, ReservationStatus.NO_SHOW] as ReservationStatus[]).includes(reservation.status)) {
          throw new AppError('Reservation is in a terminal state', httpStatus.CONFLICT, {
            code: 'INVALID_TRANSITION',
          });
        }

        const stationChanged = !!data.stationId && data.stationId !== reservation.stationId;
        const staffChanged = !!data.staffId && data.staffId !== reservation.staffId;
        const startAtChanged = !!data.startTime;
        const hasTimeChange = stationChanged || staffChanged || startAtChanged;

        const effectiveStationId = stationChanged ? data.stationId! : reservation.stationId;
        const effectiveStaffId = staffChanged ? data.staffId! : reservation.staffId;

        let effectiveStation = null;
        if (stationChanged) {
          effectiveStation = await ReservationRepo.findStation(effectiveStationId, gamingCenterId, true, tx);

          if (!effectiveStation) {
            throw new AppError('GameStation not found or is not active.', httpStatus.NOT_FOUND);
          }
        } else if (hasTimeChange) {
          effectiveStation = await ReservationRepo.findStation(effectiveStationId, gamingCenterId, undefined, tx);

          if (!effectiveStation) {
            throw new AppError('GameStation not found.', httpStatus.NOT_FOUND);
          }
        }

        if ((staffChanged || stationChanged) && effectiveStaffId) {
          const staff = await ReservationRepo.findStaff(effectiveStaffId!, gamingCenterId, effectiveStationId, undefined, tx);

          if (!staff || !staff.id) {
            throw new AppError(
              'Staff member not found or does not perform this station.',
              httpStatus.NOT_FOUND
            );
          }
        }

        const updateData: Prisma.ReservationUncheckedUpdateInput = {};

        if (stationChanged && effectiveStation) {
          updateData.stationId = effectiveStationId;
          const durationHours = effectiveStation.defaultDurationHours;
          updateData.stationSnapshot = {
            name: effectiveStation.name,
            hourlyPrice: effectiveStation.hourlyPrice,
            stationType: effectiveStation.stationType,
          };
          updateData.totalHours = durationHours;
          updateData.totalPrice = durationHours * effectiveStation.hourlyPrice;
        }

        if (staffChanged) {
          updateData.staffId = effectiveStaffId;
        }

        if (data.note !== undefined) {
          updateData.note = data.note;
        }

        if (hasTimeChange) {
          const settings = await ReservationRepo.findSettings(gamingCenterId, tx);
          const timeZone = settings?.timeZone || 'UTC';

          const newStartAt = data.startTime ? new Date(data.startTime) : reservation.startTime;
          const durationHours = effectiveStation
            ? effectiveStation.defaultDurationHours
            : reservation.totalHours;
          const newEndAt = addMinutes(newStartAt, durationHours * 60);
          const zonedNewStartAt = toZonedTime(newStartAt, timeZone);

          const staffShift = effectiveStaffId ? await ReservationRepo.findStaffShift(gamingCenterId, effectiveStaffId!, zonedNewStartAt.getDay(), tx) : null;

          if (!staffShift || !staffShift.startTime || !staffShift.endTime) {
            throw new AppError('Selected time is not available.', httpStatus.CONFLICT, {
              code: 'SLOT_NOT_AVAILABLE',
            });
          }

          const shiftStart = getZonedStartAndEnd(staffShift.startTime, newStartAt, timeZone);
          const shiftEnd = getZonedStartAndEnd(staffShift.endTime, newStartAt, timeZone);

          if (newStartAt.getTime() < shiftStart.getTime() || newEndAt.getTime() > shiftEnd.getTime()) {
            throw new AppError('Selected time is not available.', httpStatus.CONFLICT, {
              code: 'SLOT_NOT_AVAILABLE',
            });
          }

          const preventOverlaps = settings?.preventOverlaps ?? true;
          if (preventOverlaps && effectiveStaffId) {
            const overlappingReservation = await ReservationRepo.findOverlappingReservation(
              gamingCenterId,
              effectiveStaffId,
              newStartAt,
              newEndAt,
              reservation.id,
              tx
            );

            if (overlappingReservation) {
              throw new AppError('Reservation overlaps with another for the same staff member.', httpStatus.CONFLICT, {
                code: 'OVERLAP_CONFLICT',
              });
            }
          }

          if (data.startTime) {
            updateData.startTime = newStartAt;
          }

          if (stationChanged || data.startTime) {
            updateData.endTime = newEndAt;
            updateData.totalHours = durationHours;
            // Recalculate totalPrice if station didn't change but startTime did (and we use current snapshot price)
            if (!stationChanged) {
              const snapshot = reservation.stationSnapshot as Record<string, unknown>;
              updateData.totalPrice = durationHours * ((snapshot?.hourlyPrice as number) || 0);
            }
          }
        }

        const updatedReservation = await ReservationRepo.updateReservation(reservationId, gamingCenterId, updateData, tx);

        if (!updatedReservation) {
          throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
        }

        await auditService.log(
          gamingCenterId,
          actor,
          'RESERVATION_UPDATE',
          { name: 'Reservation', id: reservationId },
          { old: reservation, new: updatedReservation },
          context
        );

        return { updatedReservation, oldReservation: reservation };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      }).then(({ updatedReservation, oldReservation }) => {
        eventEmitter.emit(AppEvents.RESERVATION_UPDATED, { updatedReservation, oldReservation });
        return updatedReservation;
      });
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23P01' && 'message' in error && typeof error.message === 'string' && error.message.includes('Reservation_no_overlap_active')) {
        throw new AppError('Reservation overlaps with another for the same staff member.', httpStatus.CONFLICT, {
          code: 'OVERLAP_CONFLICT',
        });
      }
      throw error;
    }
  },

  async confirmReservation(reservationId: string, gamingCenterId: string) {
    const reservation = await findAndValidateReservation(reservationId, gamingCenterId);

    ReservationStateMachine.validateTransition(reservation.status, ReservationStatus.CONFIRMED);

    const updatedReservation = await ReservationRepo.updateReservationWithInclude(
      reservationId,
      gamingCenterId,
      { status: ReservationStatus.CONFIRMED },
      {
        gamingCenter: { include: { settings: true } },
        customerAccount: true,
      }
    );

    if (!updatedReservation) {
      throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
    }

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

      ReservationStateMachine.validateTransition(reservation.status, ReservationStatus.IN_PROGRESS);

      const updatedReservation = await ReservationRepo.updateReservation(reservationId, gamingCenterId, {
        status: ReservationStatus.IN_PROGRESS,
      }, tx);

      if (!updatedReservation) {
        throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
      }

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

    ReservationStateMachine.validateTransition(reservation.status, ReservationStatus.COMPLETED);

    const updatedReservation = await ReservationRepo.transaction(async (tx) => {
      const updated = await ReservationRepo.updateReservation(reservationId, gamingCenterId, {
        status: ReservationStatus.COMPLETED,
        completedAt: new Date(),
      }, tx);

      if (!updated) {
        throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
      }

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

    ReservationStateMachine.validateTransition(reservation.status, ReservationStatus.NO_SHOW);

    const updatedReservation = await ReservationRepo.updateReservation(reservationId, gamingCenterId, {
      status: ReservationStatus.NO_SHOW,
      noShowAt: new Date(),
    });

    if (!updatedReservation) {
      throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
    }

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
};
