
import { addMinutes } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { Reservation, ReservationSource, ReservationStatus, ReservationProposalStatus, Prisma, SessionActorType, UserRole, OtpPurpose } from '@prisma/client';
import { generateTrackingCode, normalizeTrackingCode } from '../../common/utils/trackingCode';
import { ReservationRepo } from './reservation.repo';
import { AuthRepository } from '../auth/auth.repository';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { gamingSessionsStation } from '../gamingSessions/gamingSessions.station';
import { commissionsStation } from '../commissions/commissions.station';
import { walletService } from '../wallet/wallet.station';
import { auditService } from '../audit/audit.station';
import { normalizePhone } from '../../common/utils/phone';
import { AppEvents, eventEmitter } from '../../common/events/event-emitter';
import { Metrics } from '../../common/metrics/metrics';
import logger from '../../config/logger';
import { env } from '../../config/env';
import { ReservationStateMachine } from './reservation.state-machine';
import { discountsStation } from '../discounts/discounts.station';
import {
  validateLeadTime,
  validateOperatingHours,
  validateStationAvailability,
  validateStaffShiftHours,
} from './reservation.validation';

import {
  CancelReservationInput,
  CreateReservationInput,
  CreatePublicReservationInput,
  ListReservationQuery,
  ProposeTimeInput,
  RescheduleReservationInput,
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

      // Lock station for update to prevent concurrent double-booking
      await ReservationRepo.lockStationForUpdate(stationId, tx);

      // 1. Fetch GameStation and Customer Profile details
      const station = await ReservationRepo.findStation(stationId, gamingCenterId, true, tx);

      if (!station) {
        throw new AppError('GameStation not found or is not active.', httpStatus.NOT_FOUND);
      }

      const durationHours = station.defaultDurationHours;
      const endTime = addMinutes(startTime, durationHours * 60);

      // Check station maintenance
      const maintenances = await ReservationRepo.findOverlappingMaintenance(stationId, startTime, endTime, tx);
      validateStationAvailability(station, maintenances);

      const gamingCenter = await ReservationRepo.findGamingCenterWithSettings(gamingCenterId, tx);

      if (!gamingCenter) {
        throw new AppError('GamingCenter not found.', httpStatus.NOT_FOUND);
      }

      // Check global operating hours
      validateOperatingHours(
        startTime,
        endTime,
        gamingCenter.settings?.workStartTime || gamingCenter.openingTime,
        gamingCenter.settings?.workEndTime || gamingCenter.closingTime,
        gamingCenter.settings?.timeZone
      );

      const staff = await ReservationRepo.findStaff(staffId, gamingCenterId, stationId, undefined, tx);

      if (!staff) {
        throw new AppError(
          'Staff member not found or does not perform this station.',
          httpStatus.NOT_FOUND
        );
      }

      const overlappingReservation = await ReservationRepo.findOverlappingReservation(
        gamingCenterId,
        staffId,
        startTime,
        endTime,
        undefined,
        tx,
        stationId
      );

      if (overlappingReservation) {
        throw new AppError('Selected time is not available.', httpStatus.CONFLICT, {
          code: 'SLOT_NOT_AVAILABLE',
        });
      }

      const { customerAccount, customerProfile } = await findOrCreateCustomerProfile(
        tx,
        gamingCenterId,
        customer as { fullName: string; phone: string; email?: string }
      );

      await ReservationRepo.assertActiveReservationLimitNotExceeded(customerAccount.id, tx);

      // 2. Calculate base price and applicable discount
      const basePrice = durationHours * station.hourlyPrice;

      const { applicableDiscount, discountAmount } = await discountsStation.calculateApplicableDiscount(
        gamingCenterId,
        stationId,
        basePrice,
        startTime,
        tx
      );

      const finalPrice = Math.max(0, basePrice - discountAmount);

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
        trackingCode: generateTrackingCode(),
        stationSnapshot: {
          name: station.name,
          hourlyPrice: station.hourlyPrice,
          stationType: station.stationType,
        },
        totalHours: durationHours,
        totalPrice: finalPrice,
        discountAmount,
        discountId: applicableDiscount?.id,
      }, tx);

      await ReservationRepo.createHistory({
        reservationId: reservation.id,
        fromStatus: ReservationStatus.CONFIRMED,
        toStatus: ReservationStatus.CONFIRMED,
        action: 'CREATE',
        actorId: createdByUserId,
        actorType: SessionActorType.USER,
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
        validateLeadTime(startTime, gamingCenter.settings?.minAdvanceBookingMinutes ?? 30);

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

        await ReservationRepo.lockStationForUpdate(input.stationId, tx);

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

        // Check station maintenance
        const maintenances = await ReservationRepo.findOverlappingMaintenance(station.id, startTime, endTime, tx);
        validateStationAvailability(station, maintenances);

        // Check global operating hours
        validateOperatingHours(
          startTime,
          endTime,
          gamingCenter.settings?.workStartTime || gamingCenter.openingTime,
          gamingCenter.settings?.workEndTime || gamingCenter.closingTime,
          gamingCenter.settings?.timeZone
        );

        const timeZone = gamingCenter.settings?.timeZone || 'UTC';
        const zonedStartAt = toZonedTime(startTime, timeZone);

        const staffShift = await ReservationRepo.findStaffShift(gamingCenter.id, staff.id, zonedStartAt.getDay(), tx);

        validateStaffShiftHours(staffShift, startTime, endTime, timeZone);

        const overlappingReservation = await ReservationRepo.findOverlappingReservation(gamingCenter.id, staff.id, startTime, endTime, undefined, tx, station.id);

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

        await ReservationRepo.assertActiveReservationLimitNotExceeded(customerAccount.id, tx);

        const status = gamingCenter.settings?.onlineBookingAutoConfirm
          ? ReservationStatus.CONFIRMED
          : ReservationStatus.PENDING;

        const basePrice = durationHours * station.hourlyPrice;
        const { applicableDiscount, discountAmount } = await discountsStation.calculateApplicableDiscount(
          gamingCenter.id,
          station.id,
          basePrice,
          startTime,
          tx
        );

        const finalPrice = Math.max(0, basePrice - discountAmount);

        const expiresAt = status === ReservationStatus.PENDING
          ? new Date(Date.now() + 60 * 1000)
          : null;

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
          expiresAt,
          trackingCode: generateTrackingCode(),
          stationSnapshot: {
            name: station.name,
            hourlyPrice: station.hourlyPrice,
            stationType: station.stationType,
          },
          totalHours: durationHours,
          totalPrice: finalPrice,
          discountAmount,
          discountId: applicableDiscount?.id,
        }, tx);

        await ReservationRepo.createHistory({
          reservationId: reservation.id,
          fromStatus: status,
          toStatus: status,
          action: 'CREATE',
          actorId: customerAccount.id,
          actorType: SessionActorType.CUSTOMER,
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

        if (ReservationStateMachine.isTerminalState(reservation.status)) {
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
          const gamingCenter = await ReservationRepo.findGamingCenterWithSettings(gamingCenterId, tx);
          const settings = gamingCenter?.settings;
          const timeZone = settings?.timeZone || 'UTC';

          const newStartAt = data.startTime ? new Date(data.startTime) : reservation.startTime;
          const durationHours = effectiveStation
            ? effectiveStation.defaultDurationHours
            : reservation.totalHours;
          const newEndAt = addMinutes(newStartAt, durationHours * 60);

          // Check station maintenance
          const maintenances = await ReservationRepo.findOverlappingMaintenance(effectiveStationId, newStartAt, newEndAt, tx);
          validateStationAvailability(effectiveStation, maintenances);

          // Check global operating hours
          validateOperatingHours(
            newStartAt,
            newEndAt,
            settings?.workStartTime || gamingCenter?.openingTime,
            settings?.workEndTime || gamingCenter?.closingTime,
            settings?.timeZone
          );

          const zonedNewStartAt = toZonedTime(newStartAt, timeZone);

          if (effectiveStaffId) {
            const staffShift = await ReservationRepo.findStaffShift(gamingCenterId, effectiveStaffId, zonedNewStartAt.getDay(), tx);
            validateStaffShiftHours(staffShift, newStartAt, newEndAt, timeZone);
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

            const hourlyRate = stationChanged
              ? effectiveStation!.hourlyPrice
              : ((reservation.stationSnapshot as Record<string, unknown>)?.hourlyPrice as number) || 0;
            const basePrice = durationHours * hourlyRate;

            const { applicableDiscount, discountAmount } = await discountsStation.calculateApplicableDiscount(
              gamingCenterId,
              effectiveStationId,
              basePrice,
              newStartAt,
              tx
            );

            updateData.discountAmount = discountAmount;
            updateData.discountId = applicableDiscount?.id || null;
            updateData.totalPrice = Math.max(0, basePrice - discountAmount);
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
        const basePrice = durationHours * station.hourlyPrice;
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

  async proposeTime(
    reservationId: string,
    gamingCenterId: string,
    createdByUserId: string,
    data: ProposeTimeInput,
    actor: { id: string; role: UserRole; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const reservation = await findAndValidateReservation(reservationId, gamingCenterId);

    if (actor.role === UserRole.STAFF && reservation.staffId && reservation.staffId !== actor.id) {
      throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
    }

    if (ReservationStateMachine.isTerminalState(reservation.status)) {
      throw new AppError('Cannot propose time for a reservation in terminal state', httpStatus.CONFLICT, {
        code: 'INVALID_TRANSITION',
      });
    }

    const proposedStartTime = new Date(data.startTime);
    const proposedEndTime = new Date(data.endTime);

    const gamingCenter = await ReservationRepo.findGamingCenterWithSettings(gamingCenterId);
    const settings = gamingCenter?.settings;
    validateLeadTime(proposedStartTime, settings?.minAdvanceBookingMinutes ?? 30);

    const station = await ReservationRepo.findStation(reservation.stationId, gamingCenterId);
    const maintenances = await ReservationRepo.findOverlappingMaintenance(reservation.stationId, proposedStartTime, proposedEndTime);
    if (station) {
      validateStationAvailability(station, maintenances);
    }

    validateOperatingHours(
      proposedStartTime,
      proposedEndTime,
      settings?.workStartTime || gamingCenter?.openingTime,
      settings?.workEndTime || gamingCenter?.closingTime,
      settings?.timeZone
    );

    const proposal = await ReservationRepo.transaction(async (tx) => {
      // Cancel any existing PENDING proposal for this reservation
      await ReservationRepo.cancelPendingProposals(reservationId, tx);

      const created = await ReservationRepo.createTimeProposal(
        {
          reservationId,
          originalStartTime: reservation.startTime,
          originalEndTime: reservation.endTime,
          proposedStartTime,
          proposedEndTime,
          note: data.note,
          status: ReservationProposalStatus.PENDING,
          createdByUserId,
        },
        tx
      );

      await auditService.log(
        gamingCenterId,
        actor,
        'RESERVATION_TIME_PROPOSED',
        { name: 'ReservationTimeProposal', id: created.id },
        { new: created },
        context
      );

      return created;
    });

    eventEmitter.emit(AppEvents.RESERVATION_TIME_PROPOSED, {
      reservationId: reservation.id,
      customerId: reservation.customerAccountId,
      gamingCenterId: reservation.gamingCenterId,
      proposalId: proposal.id,
      proposal,
    });

    return proposal;
  },

  async getProposals(
    reservationId: string,
    gamingCenterId: string,
    actor: { id: string; role: UserRole }
  ) {
    const reservation = await findAndValidateReservation(reservationId, gamingCenterId);

    if (actor.role === UserRole.STAFF && reservation.staffId !== actor.id) {
      throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
    }

    return ReservationRepo.listProposalsByReservationId(reservationId);
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

  async lookupReservationByTrackingCode(gamingCenterId: string, inputCode: string) {
    const normalizedCode = normalizeTrackingCode(inputCode);
    if (!normalizedCode) {
      throw new AppError('Tracking code is required.', httpStatus.BAD_REQUEST);
    }

    const reservation = await ReservationRepo.findReservationByTrackingCode(gamingCenterId, normalizedCode);

    if (!reservation) {
      throw new AppError('Reservation not found for this tracking code.', httpStatus.NOT_FOUND);
    }

    const gamingCenter = await ReservationRepo.findGamingCenterWithSettings(gamingCenterId);
    const timeZone = gamingCenter?.settings?.timeZone || 'UTC';

    let isEligibleForCheckIn = false;
    let checkInIneligibilityReason: string | null = null;

    if (reservation.checkedInAt) {
      isEligibleForCheckIn = false;
      checkInIneligibilityReason = 'Reservation has already been checked in.';
    } else if (reservation.status === ReservationStatus.CANCELED) {
      isEligibleForCheckIn = false;
      checkInIneligibilityReason = 'Reservation is canceled.';
    } else if (reservation.status === ReservationStatus.EXPIRED) {
      isEligibleForCheckIn = false;
      checkInIneligibilityReason = 'Reservation is expired.';
    } else if (reservation.status === ReservationStatus.NO_SHOW) {
      isEligibleForCheckIn = false;
      checkInIneligibilityReason = 'Reservation is marked as no-show.';
    } else if (reservation.status === ReservationStatus.COMPLETED) {
      isEligibleForCheckIn = false;
      checkInIneligibilityReason = 'Reservation is already completed.';
    } else if (reservation.status === ReservationStatus.PENDING) {
      isEligibleForCheckIn = false;
      checkInIneligibilityReason = 'Reservation is pending confirmation.';
    } else if (reservation.status === ReservationStatus.CONFIRMED || reservation.status === ReservationStatus.IN_PROGRESS) {
      isEligibleForCheckIn = true;
      checkInIneligibilityReason = null;
    } else {
      isEligibleForCheckIn = false;
      checkInIneligibilityReason = 'Reservation is not eligible for check-in.';
    }

    const customerDisplayName =
      reservation.customerProfile?.displayName ||
      reservation.customerAccount?.fullName ||
      'Guest Customer';

    return {
      id: reservation.id,
      trackingCode: reservation.trackingCode,
      status: reservation.status,
      paymentState: reservation.paymentState,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      siteTimezone: timeZone,
      localStartTime: formatInTimeZone(reservation.startTime, timeZone, 'yyyy-MM-dd HH:mm'),
      localEndTime: formatInTimeZone(reservation.endTime, timeZone, 'yyyy-MM-dd HH:mm'),
      station: reservation.station
        ? {
          id: reservation.station.id,
          name: reservation.station.name,
          stationType: reservation.station.stationType,
        }
        : null,
      customer: {
        displayName: customerDisplayName,
      },
      checkedInAt: reservation.checkedInAt,
      isEligibleForCheckIn,
      checkInIneligibilityReason,
    };
  },

  async checkInReservation(
    reservationIdOrCode: string,
    gamingCenterId: string,
    actor: { id: string; role: UserRole; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    return ReservationRepo.transaction(async (tx) => {
      const normalizedCode = normalizeTrackingCode(reservationIdOrCode);
      let initialReservation = await ReservationRepo.findReservationByTrackingCode(gamingCenterId, normalizedCode, tx) as Reservation | null;

      if (!initialReservation) {
        initialReservation = await ReservationRepo.findReservationById(reservationIdOrCode, gamingCenterId, tx);
      }

      if (!initialReservation) {
        throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
      }

      // Lock reservation row to ensure concurrent check-in requests are serialized
      await ReservationRepo.lockReservationForUpdate(initialReservation.id, tx);

      // Re-fetch post-lock if available, otherwise use initialReservation
      const reservation = (await ReservationRepo.findReservationById(initialReservation.id, gamingCenterId, tx)) || initialReservation;

      if (reservation.checkedInAt) {
        return reservation;
      }

      if (
        reservation.status === ReservationStatus.CANCELED ||
        reservation.status === ReservationStatus.EXPIRED ||
        reservation.status === ReservationStatus.NO_SHOW ||
        reservation.status === ReservationStatus.COMPLETED ||
        reservation.status === ReservationStatus.PENDING
      ) {
        throw new AppError(
          `Reservation in state ${reservation.status} is not eligible for check-in.`,
          httpStatus.CONFLICT,
          { code: 'CHECKIN_INELIGIBLE' }
        );
      }

      const now = new Date();
      const nextStatus = reservation.status === ReservationStatus.CONFIRMED ? ReservationStatus.IN_PROGRESS : reservation.status;

      const updatedReservation = await ReservationRepo.updateReservation(
        reservation.id,
        gamingCenterId,
        {
          checkedInAt: now,
          checkedInByUserId: actor.id,
          status: nextStatus,
        },
        tx
      );

      if (!updatedReservation) {
        throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
      }

      await ReservationRepo.createHistory(
        {
          reservationId: reservation.id,
          fromStatus: reservation.status,
          toStatus: nextStatus,
          action: 'CHECK_IN',
          actorId: actor.id,
          actorType: actor.actorType,
          reason: 'Customer arrived and checked in verbally with staff',
        },
        tx
      );

      if (reservation.status === ReservationStatus.CONFIRMED) {
        await gamingSessionsStation.startSession(reservation.id, reservation.stationId, tx);
      }

      await auditService.log(
        gamingCenterId,
        actor,
        'RESERVATION_CHECKIN',
        { name: 'Reservation', id: reservation.id },
        { old: reservation, new: updatedReservation },
        context
      );

      return updatedReservation;
    });
  },
};
