import { addMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Reservation, ReservationSource, ReservationStatus, Prisma, SessionActorType, UserRole, OtpPurpose, DiscountFundingSource, CommissionType } from '@prisma/client';
import { ReservationRepo } from './reservation.repo';
import { CommissionsRepo } from '../commissions/commissions.repo';
import { AuthRepository } from '../auth/auth.repository';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { auditService } from '../audit/audit.station';
import { normalizePhone } from '../../common/utils/phone';
import { AppEvents, eventEmitter } from '../../common/events/event-emitter';
import { Metrics } from '../../common/metrics/metrics';
import { ReservationStateMachine } from './reservation.state-machine';
import { discountsStation } from '../discounts/discounts.station';
import { calculateBasePrice } from '../../common/utils/money';
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

import { reservationProposals } from './reservation.proposals';
import { reservationLifecycle } from './reservation.lifecycle';

const OTP_POST_VERIFICATION_WINDOW_MINUTES = 5;

export async function calculateReservationFinancials(
  gamingCenterId: string,
  stationId: string,
  basePrice: number,
  startTime: Date,
  customerAccountId?: string,
  voucherCode?: string | null,
  tx?: Prisma.TransactionClient
) {
  const originalAmount = basePrice;
  let discountAmount = 0;
  let platformFundedDiscount = 0;
  let customerPayableAmount = basePrice;
  let discountFundingSource: DiscountFundingSource | null = null;
  let campaignId: string | null = null;
  let discountId: string | null = null;

  if (voucherCode && voucherCode.trim().length > 0) {
    const promoResult = await discountsStation.validateAndApplyPromoCode(
      gamingCenterId,
      voucherCode.trim(),
      stationId,
      basePrice,
      customerAccountId,
      startTime,
      true,
      tx
    );
    discountAmount = promoResult.discountAmount;
    platformFundedDiscount = promoResult.platformFundedDiscount;
    customerPayableAmount = promoResult.customerPayableAmount;
    discountFundingSource = promoResult.fundingSource;
    campaignId = promoResult.campaign.id;
  } else {
    const autoDiscount = await discountsStation.calculateApplicableDiscount(
      gamingCenterId,
      stationId,
      basePrice,
      startTime,
      tx
    );
    if (autoDiscount.applicableDiscount && autoDiscount.discountAmount > 0) {
      discountAmount = autoDiscount.discountAmount;
      discountId = autoDiscount.applicableDiscount.id;
      discountFundingSource = DiscountFundingSource.PLATFORM;
      platformFundedDiscount = discountAmount;
      customerPayableAmount = Math.max(0, basePrice - discountAmount);
    }
  }

  const policy = await CommissionsRepo.findPolicyByGamingCenterId(gamingCenterId, tx);
  let platformCommission = 0;
  if (policy && policy.isActive) {
    if (policy.type === CommissionType.PERCENT && policy.percentBps) {
      platformCommission = Math.round((originalAmount * policy.percentBps) / 10000);
    } else if (policy.type === CommissionType.FIXED && policy.fixedAmount) {
      platformCommission = policy.fixedAmount;
    }
    if (policy.minimumFeeAmount && platformCommission < policy.minimumFeeAmount) {
      platformCommission = policy.minimumFeeAmount;
    }
  }

  let grossMerchantEntitlement = originalAmount;
  if (discountFundingSource === DiscountFundingSource.MERCHANT_FUNDED) {
    grossMerchantEntitlement = Math.max(0, originalAmount - discountAmount);
  }
  const merchantPayoutAmount = Math.max(0, grossMerchantEntitlement - platformCommission);

  return {
    originalAmount,
    discountAmount,
    platformFundedDiscount,
    customerPayableAmount,
    merchantPayoutAmount,
    platformCommission,
    discountFundingSource,
    campaignId,
    discountId,
    voucherCode: voucherCode || null,
  };
}

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

      // 2. Calculate base price and applicable discount & financials
      const basePrice = calculateBasePrice(durationHours, station.hourlyPrice);

      const financials = await calculateReservationFinancials(
        gamingCenterId,
        stationId,
        basePrice,
        startTime,
        customerAccount.id,
        input.voucherCode,
        tx
      );

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
        totalPrice: financials.customerPayableAmount,
        discountAmount: financials.discountAmount,
        originalAmount: financials.originalAmount,
        customerPayableAmount: financials.customerPayableAmount,
        platformFundedDiscount: financials.platformFundedDiscount,
        merchantPayoutAmount: financials.merchantPayoutAmount,
        discountFundingSource: financials.discountFundingSource,
        campaignId: financials.campaignId,
        voucherCode: financials.voucherCode,
        discountId: financials.discountId,
      }, tx);

      if (financials.campaignId) {
        await discountsStation.consumeCampaignDiscount(
          financials.campaignId,
          reservation.id,
          customerAccount.id,
          financials.discountAmount,
          financials.discountFundingSource || DiscountFundingSource.PLATFORM,
          tx
        );
      }

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

        const basePrice = calculateBasePrice(durationHours, station.hourlyPrice);

        const financials = await calculateReservationFinancials(
          gamingCenter.id,
          station.id,
          basePrice,
          startTime,
          customerAccount.id,
          input.voucherCode,
          tx
        );

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
          voucherCode: financials.voucherCode,
          discountId: financials.discountId,
        }, tx);

        if (financials.campaignId) {
          await discountsStation.consumeCampaignDiscount(
            financials.campaignId,
            reservation.id,
            customerAccount.id,
            financials.discountAmount,
            financials.discountFundingSource || DiscountFundingSource.PLATFORM,
            tx
          );
        }

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
          updateData.totalPrice = calculateBasePrice(durationHours, effectiveStation.hourlyPrice);
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
            const basePrice = calculateBasePrice(durationHours, hourlyRate);

            const financials = await calculateReservationFinancials(
              gamingCenterId,
              effectiveStationId,
              basePrice,
              newStartAt,
              reservation.customerAccountId,
              reservation.voucherCode,
              tx
            );

            updateData.discountAmount = financials.discountAmount;
            updateData.originalAmount = financials.originalAmount;
            updateData.customerPayableAmount = financials.customerPayableAmount;
            updateData.platformFundedDiscount = financials.platformFundedDiscount;
            updateData.merchantPayoutAmount = financials.merchantPayoutAmount;
            updateData.discountFundingSource = financials.discountFundingSource;
            updateData.campaignId = financials.campaignId;
            updateData.discountId = financials.discountId;
            updateData.totalPrice = financials.customerPayableAmount;
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

  confirmReservation(reservationId: string, gamingCenterId: string) {
    return reservationLifecycle.confirmReservation(reservationId, gamingCenterId);
  },

  cancelReservation(
    reservationId: string,
    gamingCenterId: string,
    actor: { id: string; role: UserRole; actorType: SessionActorType },
    data: CancelReservationInput,
    context?: { ip?: string; userAgent?: string }
  ) {
    return reservationLifecycle.cancelReservation(reservationId, gamingCenterId, actor, data, context);
  },

  startReservation(
    reservationId: string,
    gamingCenterId: string,
    actor: { id: string; role: UserRole; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    return reservationLifecycle.startReservation(reservationId, gamingCenterId, actor, context);
  },

  completeReservation(
    reservationId: string,
    gamingCenterId: string,
    actor: { id: string; role: UserRole; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    return reservationLifecycle.completeReservation(reservationId, gamingCenterId, actor, context);
  },

  markAsNoShow(
    reservationId: string,
    gamingCenterId: string,
    actor: { id: string; role: UserRole; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    return reservationLifecycle.markAsNoShow(reservationId, gamingCenterId, actor, context);
  },

  rescheduleReservation(
    reservationId: string,
    gamingCenterId: string,
    data: RescheduleReservationInput,
    actor: { id: string; role?: UserRole; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    return reservationLifecycle.rescheduleReservation(reservationId, gamingCenterId, data, actor, context);
  },

  proposeTime(
    reservationId: string,
    gamingCenterId: string,
    createdByUserId: string,
    data: ProposeTimeInput,
    actor: { id: string; role: UserRole; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    return reservationProposals.proposeTime(reservationId, gamingCenterId, createdByUserId, data, actor, context);
  },

  getProposals(
    reservationId: string,
    gamingCenterId: string,
    actor: { id: string; role: UserRole }
  ) {
    return reservationProposals.getProposals(reservationId, gamingCenterId, actor);
  },

  processExpiryBatch(options?: { batchSize?: number; now?: Date }) {
    return reservationLifecycle.processExpiryBatch(options);
  },

  expireStaleReservations(now?: Date) {
    return reservationLifecycle.expireStaleReservations(now);
  },
};
