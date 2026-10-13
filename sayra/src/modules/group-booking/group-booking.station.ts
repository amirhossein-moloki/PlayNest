import { addMinutes, isBefore } from 'date-fns';
import { ReservationStatus, ReservationPaymentState, ReservationSource, Prisma, SessionActorType, UserRole, OtpPurpose } from '@prisma/client';
import { GroupBookingRepo } from './group-booking.repo';
import { ReservationRepo } from '../reservation/reservation.repo';
import { AuthRepository } from '../auth/auth.repository';
import { discountsStation } from '../discounts/discounts.station';
import { walletService } from '../wallet/wallet.station';
import { auditService } from '../audit/audit.station';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { normalizePhone } from '../../common/utils/phone';

const OTP_POST_VERIFICATION_WINDOW_MINUTES = 5;

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

export const GroupBookingStation = {
  async createGroupBooking(input: {
    gamingCenterId: string;
    createdByUserId: string;
    startTime: string | Date;
    durationMinutes?: number;
    items: Array<{ stationId: string; staffId?: string }>;
    customer: { fullName: string; phone: string; email?: string };
    note?: string;
    source?: ReservationSource;
    actor?: { id: string; role?: UserRole; actorType?: SessionActorType };
  }) {
    const { gamingCenterId, createdByUserId, items, customer, note, source, actor } = input;
    const startTime = new Date(input.startTime);

    if (!gamingCenterId) {
      throw new AppError('Gaming center ID is required.', httpStatus.BAD_REQUEST, {
        code: 'GAMING_CENTER_ID_REQUIRED',
      });
    }

    if (!items || items.length === 0) {
      throw new AppError('At least one gaming station must be selected.', httpStatus.BAD_REQUEST, {
        code: 'NO_STATIONS_SELECTED',
      });
    }

    // 1. Validate station unique selection
    const stationIds = items.map((i) => i.stationId);
    if (new Set(stationIds).size !== stationIds.length) {
      throw new AppError('Duplicate stations selected in group booking.', httpStatus.BAD_REQUEST, {
        code: 'DUPLICATE_STATIONS_SELECTED',
      });
    }

    const durationMinutes = input.durationMinutes || 60;
    const totalHours = durationMinutes / 60;
    const endTime = addMinutes(startTime, durationMinutes);

    // 2. Fetch gaming center settings
    const gamingCenter = await ReservationRepo.findGamingCenterWithSettings(gamingCenterId);
    if (!gamingCenter) {
      throw new AppError('GamingCenter not found.', httpStatus.NOT_FOUND);
    }

    return GroupBookingRepo.transaction(async (tx) => {
      // Resolve effective User record ID for createdByUserId
      let effectiveCreatedByUserId = createdByUserId;
      if (actor?.actorType === SessionActorType.CUSTOMER) {
        const systemUser = await tx.user.findFirst({ where: { gamingCenterId, isActive: true } });
        if (!systemUser) {
          throw new AppError('GamingCenter staff account not found.', httpStatus.INTERNAL_SERVER_ERROR);
        }
        effectiveCreatedByUserId = systemUser.id;
      }

      // 3. Batch fetch all stations
      const stations = await GroupBookingRepo.findStationsBatch(stationIds, gamingCenterId, true, tx);
      if (stations.length !== stationIds.length) {
        throw new AppError('One or more selected stations are invalid or inactive.', httpStatus.NOT_FOUND, {
          code: 'STATION_NOT_FOUND_OR_INACTIVE',
        });
      }

      // Map stations for fast lookup
      const stationMap = new Map(stations.map((s) => [s.id, s]));

      // Check duration constraints for each station
      for (const s of stations) {
        if (totalHours < s.minRentHours || totalHours > s.maxRentHours) {
          throw new AppError(
            `Duration for station ${s.name} must be between ${s.minRentHours} and ${s.maxRentHours} hours.`,
            httpStatus.BAD_REQUEST,
            { code: 'INVALID_DURATION' }
          );
        }
      }

      // 4. Atomic availability check
      const overlaps = await GroupBookingRepo.findOverlappingReservationsForStations(
        gamingCenterId,
        stationIds,
        startTime,
        endTime,
        undefined,
        tx
      );

      if (overlaps.length > 0) {
        const unavailableStations = overlaps.map((o) => ({
          stationId: o.stationId,
          stationName: o.station?.name || 'Unknown',
        }));
        throw new AppError('One or more selected stations are not available for the requested time.', httpStatus.CONFLICT, {
          code: 'SLOT_NOT_AVAILABLE',
          details: { unavailableStations },
        });
      }

      // 5. Calculate pricing and discounts per item
      let aggregatePrice = 0;
      let aggregateDiscount = 0;
      const preparedItems = [];

      for (const item of items) {
        const station = stationMap.get(item.stationId)!;
        const itemBasePrice = totalHours * station.hourlyPrice;

        const { applicableDiscount, discountAmount } = await discountsStation.calculateApplicableDiscount(
          gamingCenterId,
          station.id,
          itemBasePrice,
          startTime,
          tx
        );

        const itemFinalPrice = Math.max(0, itemBasePrice - discountAmount);
        aggregatePrice += itemFinalPrice;
        aggregateDiscount += discountAmount;

        preparedItems.push({
          stationId: station.id,
          staffId: item.staffId,
          price: itemFinalPrice,
          discountAmount,
          discountId: applicableDiscount?.id,
          stationSnapshot: {
            name: station.name,
            hourlyPrice: station.hourlyPrice,
            stationType: station.stationType,
          },
        });
      }

      // 6. Customer profile
      const { customerAccount, customerProfile } = await findOrCreateCustomerProfile(tx, gamingCenterId, customer);

      // 7. Create GroupBooking and child entities
      const createdGroupBooking = await GroupBookingRepo.createGroupBookingWithDetails(
        {
          gamingCenterId,
          customerProfileId: customerProfile.id,
          customerAccountId: customerAccount.id,
          createdByUserId: effectiveCreatedByUserId,
          startTime,
          endTime,
          totalHours,
          totalPrice: aggregatePrice,
          discountAmount: aggregateDiscount,
          status: ReservationStatus.CONFIRMED,
          paymentState: ReservationPaymentState.UNPAID,
          source: source || ReservationSource.WALK_IN,
          note,
          items: preparedItems,
        },
        tx
      );

      return createdGroupBooking;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  },

  async createPublicGroupBooking(gamingCenterSlug: string, input: {
    startTime: string | Date;
    durationMinutes?: number;
    items: Array<{ stationId: string; staffId?: string }>;
    customer: { fullName: string; phone: string; email?: string };
    note?: string;
  }) {
    const gamingCenter = await ReservationRepo.findGamingCenterBySlugWithSettings(gamingCenterSlug);
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

    const { items, customer, note } = input;
    const durationMinutes = input.durationMinutes || 60;
    const totalHours = durationMinutes / 60;
    const endTime = addMinutes(startTime, durationMinutes);

    const stationIds = items.map((i) => i.stationId);
    if (new Set(stationIds).size !== stationIds.length) {
      throw new AppError('Duplicate stations selected in group booking.', httpStatus.BAD_REQUEST, {
        code: 'DUPLICATE_STATIONS_SELECTED',
      });
    }

    return GroupBookingRepo.transaction(async (tx) => {
      const stations = await GroupBookingRepo.findStationsBatch(stationIds, gamingCenter.id, true, tx);
      if (stations.length !== stationIds.length) {
        throw new AppError('One or more selected stations are invalid or inactive.', httpStatus.NOT_FOUND, {
          code: 'STATION_NOT_FOUND_OR_INACTIVE',
        });
      }

      const stationMap = new Map(stations.map((s) => [s.id, s]));

      for (const s of stations) {
        if (totalHours < s.minRentHours || totalHours > s.maxRentHours) {
          throw new AppError(
            `Duration for station ${s.name} must be between ${s.minRentHours} and ${s.maxRentHours} hours.`,
            httpStatus.BAD_REQUEST,
            { code: 'INVALID_DURATION' }
          );
        }
      }

      const overlaps = await GroupBookingRepo.findOverlappingReservationsForStations(
        gamingCenter.id,
        stationIds,
        startTime,
        endTime,
        undefined,
        tx
      );

      if (overlaps.length > 0) {
        const unavailableStations = overlaps.map((o) => ({
          stationId: o.stationId,
          stationName: o.station?.name || 'Unknown',
        }));
        throw new AppError('One or more selected stations are not available for the requested time.', httpStatus.CONFLICT, {
          code: 'SLOT_NOT_AVAILABLE',
          details: { unavailableStations },
        });
      }

      let aggregatePrice = 0;
      let aggregateDiscount = 0;
      const preparedItems = [];

      for (const item of items) {
        const station = stationMap.get(item.stationId)!;
        const itemBasePrice = totalHours * station.hourlyPrice;

        const { applicableDiscount, discountAmount } = await discountsStation.calculateApplicableDiscount(
          gamingCenter.id,
          station.id,
          itemBasePrice,
          startTime,
          tx
        );

        const itemFinalPrice = Math.max(0, itemBasePrice - discountAmount);
        aggregatePrice += itemFinalPrice;
        aggregateDiscount += discountAmount;

        preparedItems.push({
          stationId: station.id,
          staffId: item.staffId,
          price: itemFinalPrice,
          discountAmount,
          discountId: applicableDiscount?.id,
          stationSnapshot: {
            name: station.name,
            hourlyPrice: station.hourlyPrice,
            stationType: station.stationType,
          },
        });
      }

      const { customerAccount, customerProfile } = await findOrCreateCustomerProfile(tx, gamingCenter.id, customer);

      const status = gamingCenter.settings?.onlineBookingAutoConfirm
        ? ReservationStatus.CONFIRMED
        : ReservationStatus.PENDING;

      // Find staff/system user to assign as creator
      const systemUser = await tx.user.findFirst({ where: { gamingCenterId: gamingCenter.id } });
      if (!systemUser) {
        throw new AppError('System error: Gaming center user not found.', httpStatus.INTERNAL_SERVER_ERROR);
      }

      return GroupBookingRepo.createGroupBookingWithDetails(
        {
          gamingCenterId: gamingCenter.id,
          customerProfileId: customerProfile.id,
          customerAccountId: customerAccount.id,
          createdByUserId: systemUser.id,
          startTime,
          endTime,
          totalHours,
          totalPrice: aggregatePrice,
          discountAmount: aggregateDiscount,
          status,
          paymentState: ReservationPaymentState.UNPAID,
          source: ReservationSource.ONLINE,
          note,
          items: preparedItems,
        },
        tx
      );
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  },

  async getGroupBookingById(
    id: string,
    gamingCenterId: string,
    actor?: { id: string; role?: UserRole; actorType?: SessionActorType; customerAccountId?: string }
  ) {
    const groupBooking = await GroupBookingRepo.findGroupBookingById(id, gamingCenterId);
    if (!groupBooking) {
      throw new AppError('Group booking not found.', httpStatus.NOT_FOUND);
    }

    const isCustomer = actor?.actorType === SessionActorType.CUSTOMER || (!actor?.role && actor?.actorType !== SessionActorType.USER);
    if (isCustomer) {
      const effectiveCustomerId = actor?.customerAccountId || actor?.id;
      if (groupBooking.customerAccountId !== effectiveCustomerId) {
        throw new AppError('Group booking not found.', httpStatus.NOT_FOUND);
      }
    }

    return groupBooking;
  },

  async listGroupBookings(
    gamingCenterId: string,
    query: {
      page?: number;
      pageSize?: number;
      status?: ReservationStatus;
      customerProfileId?: string;
      customerAccountId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    actor?: { id: string; role?: UserRole; actorType?: SessionActorType; customerAccountId?: string }
  ) {
    const { page = 1, pageSize = 20, status, customerProfileId, dateFrom, dateTo } = query;
    let effectiveCustomerAccountId = query.customerAccountId;

    const isCustomer = actor?.actorType === SessionActorType.CUSTOMER || (!actor?.role && actor?.actorType !== SessionActorType.USER);
    if (isCustomer) {
      effectiveCustomerAccountId = actor?.customerAccountId || actor?.id;
    }

    const skip = (page - 1) * pageSize;

    const where: Prisma.GroupBookingWhereInput = {
      gamingCenterId,
      status,
      customerProfileId,
      customerAccountId: effectiveCustomerAccountId,
      startTime: {
        gte: dateFrom ? new Date(dateFrom) : undefined,
        lt: dateTo ? new Date(dateTo) : undefined,
      },
    };

    const [data, totalItems] = await Promise.all([
      GroupBookingRepo.findManyGroupBookings(where, skip, pageSize, { startTime: 'desc' }),
      GroupBookingRepo.countGroupBookings(where),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  },

  async cancelGroupBooking(
    id: string,
    gamingCenterId: string,
    actor: { id: string; role?: UserRole; actorType?: SessionActorType; customerAccountId?: string },
    reason?: string,
    context?: { ip?: string; userAgent?: string }
  ) {
    const groupBooking = await GroupBookingRepo.findGroupBookingById(id, gamingCenterId);
    if (!groupBooking) {
      throw new AppError('Group booking not found.', httpStatus.NOT_FOUND);
    }

    const isCustomer = actor?.actorType === SessionActorType.CUSTOMER || (!actor?.role && actor?.actorType !== SessionActorType.USER);
    if (isCustomer) {
      const effectiveCustomerId = actor?.customerAccountId || actor?.id;
      if (groupBooking.customerAccountId !== effectiveCustomerId) {
        throw new AppError('Group booking not found.', httpStatus.NOT_FOUND);
      }
    }

    if (groupBooking.status === ReservationStatus.CANCELED) {
      throw new AppError('Group booking is already canceled.', httpStatus.CONFLICT);
    }

    const updated = await GroupBookingRepo.transaction(async (tx) => {
      const canceled = await GroupBookingRepo.cancelGroupBookingAndReservations(
        id,
        gamingCenterId,
        actor.id,
        reason,
        tx
      );

      // Trigger wallet refunds for all reservations under this group booking if paid
      if (groupBooking.reservations) {
        for (const res of groupBooking.reservations) {
          await walletService.refundReservationToWallet(res.id, tx);
        }
      }

      return canceled;
    });

    await auditService.log(
      gamingCenterId,
      actor as { id: string; role: UserRole; actorType: SessionActorType },
      'GROUP_BOOKING_CANCEL',
      { name: 'GroupBooking', id },
      { old: groupBooking, new: updated },
      context
    );

    return updated;
  },
};
