import { addMinutes, isBefore } from 'date-fns';
import {
  ReservationStatus,
  ReservationPaymentState,
  ReservationSource,
  PaymentStatus,
  PaymentMethod,
  PaymentProvider,
  Payment,
  WalletTransactionType,
  Prisma,
  SessionActorType,
  UserRole,
  OtpPurpose,
  CancellationActor,
  CancellationCategory,
  GamingSessionStatus,
} from '@prisma/client';
import { GroupBookingRepo } from './group-booking.repo';
import { ReservationRepo } from '../reservation/reservation.repo';
import { ReservationStateMachine } from '../reservation/reservation.state-machine';
import { AuthRepository } from '../auth/auth.repository';
import { discountsStation } from '../discounts/discounts.station';
import { walletService } from '../wallet/wallet.station';
import { auditService } from '../audit/audit.station';
import { PaymentsRepo } from '../payments/payments.repo';
import { LedgerRepo } from '../payments/ledger.repo';
import { assertCustomerOwnsWallet, getAvailableWalletBalance } from '../wallet/wallet-access.guard';
import { commissionsStation } from '../commissions/commissions.station';
import { calculateBasePrice } from '../../common/utils/money';
import AppError from '../../common/errors/AppError';
import { isReservationOverlapDbError } from '../../common/errors/dbErrors';
import httpStatus from 'http-status';
import { normalizePhone } from '../../common/utils/phone';
import {
  resolveCancellationWindowMinutes,
  validateCancellationWindowMinutes,
  validateOperatingHours,
} from '../reservation/reservation.validation';
import { RequestActor } from '../../types/express';
import { prisma } from '../../config/prisma';
import { eventEmitter, AppEvents } from '../../common/events/event-emitter';
import { invalidatePublicCacheByPrefix } from '../../common/utils/publicCache';

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
    useWallet?: boolean;
    provider?: string;
    actor?: { id: string; role?: UserRole; actorType?: SessionActorType };
  }) {
    const { gamingCenterId, createdByUserId, items, customer, note, source, actor } = input;
    const wantsWallet = Boolean(input.useWallet || input.provider?.toUpperCase() === 'WALLET');
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

    if (gamingCenter.isActive === false) {
      throw new AppError('GamingCenter is currently inactive.', httpStatus.FORBIDDEN, {
        code: 'GAMING_CENTER_INACTIVE',
      });
    }

    validateOperatingHours(startTime, endTime, {
      openingTime: gamingCenter.settings?.workStartTime || gamingCenter.openingTime,
      closingTime: gamingCenter.settings?.workEndTime || gamingCenter.closingTime,
      timeZone: gamingCenter.settings?.timeZone || gamingCenter.timezone,
      closedDays: gamingCenter.closedDays,
      schedules: gamingCenter.schedules,
      closures: gamingCenter.closures,
    });

    if (
      wantsWallet &&
      typeof prisma?.customerAccount?.findUnique === 'function' &&
      typeof PaymentsRepo?.reapStaleCustomerInitiatedPayments === 'function'
    ) {
      try {
        const preTxCustomer = await prisma.customerAccount.findUnique({
          where: { phone: normalizePhone(customer.phone) },
          select: { id: true },
        });
        if (preTxCustomer?.id) {
          await PaymentsRepo.reapStaleCustomerInitiatedPayments(preTxCustomer.id).catch(() => {});
        }
      } catch {
        // Ignore pre-transaction reap failures in mocked or offline environments
      }
    }

    let result;
    try {
      result = await GroupBookingRepo.transaction(async (tx) => {
        // Resolve effective User record ID for createdByUserId
        let effectiveCreatedByUserId = createdByUserId;
        if (actor?.actorType === SessionActorType.CUSTOMER) {
          const systemUser = await tx.user.findFirst({ where: { gamingCenterId, isActive: true } });
          if (!systemUser) {
            throw new AppError('GamingCenter staff account not found.', httpStatus.INTERNAL_SERVER_ERROR);
          }
          effectiveCreatedByUserId = systemUser.id;
        }

        // 3. Lock all selected stations deterministically to prevent race conditions & deadlocks
        await ReservationRepo.lockStationsForUpdate(stationIds, tx);

      // Batch fetch all stations
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
        const itemBasePrice = calculateBasePrice(totalHours, station.hourlyPrice);

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

      await ReservationRepo.assertActiveReservationLimitNotExceeded(customerAccount.id, tx);

      const isPayable = aggregatePrice > 0;
      if (wantsWallet) {
        throw new AppError(
          'Staff/Manager walk-in bookings cannot debit customer wallet balance directly.',
          httpStatus.FORBIDDEN,
          { code: 'UNAUTHORIZED_WALLET_ACCESS' }
        );
      }
      const isWalletPayment = false;
      const initialPaymentState: ReservationPaymentState = isPayable
        ? ReservationPaymentState.UNPAID
        : ReservationPaymentState.PAID;

      const status: ReservationStatus = ReservationStatus.CONFIRMED;
      const expiresAt = (status as ReservationStatus) === ReservationStatus.PENDING
        ? new Date(Date.now() + 60 * 1000)
        : null;

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
          paymentState: initialPaymentState,
          source: source || ReservationSource.WALK_IN,
          note,
          expiresAt,
          items: preparedItems,
        },
        tx
      );

      const payment: Payment | null = null;

        return { groupBooking: createdGroupBooking, isWalletPayment, payment };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      });
    } catch (error: unknown) {
      if (isReservationOverlapDbError(error)) {
        throw new AppError('One or more selected stations are not available for the requested time.', httpStatus.CONFLICT, {
          code: 'SLOT_NOT_AVAILABLE',
        });
      }
      throw error;
    }

    if (result.isWalletPayment && result.groupBooking?.reservations) {
      for (const res of result.groupBooking.reservations) {
        await commissionsStation.calculateCommission(res.id).catch(() => {});
      }
    }

    try {
      const gamingCenter = typeof prisma.gamingCenter?.findUnique === 'function'
        ? await prisma.gamingCenter.findUnique({
          where: { id: result.groupBooking.gamingCenterId },
          include: { settings: true },
        })
        : null;

      if (gamingCenter && result.groupBooking?.customerAccount) {
        if (result.isWalletPayment && result.payment) {
          eventEmitter.emit(AppEvents.PAYMENT_SUCCESS, {
            payment: result.payment,
          });
        }

        const isConfirmed = result.groupBooking.status === ReservationStatus.CONFIRMED;
        for (const res of result.groupBooking.reservations || []) {
          eventEmitter.emit(
            isConfirmed ? AppEvents.RESERVATION_CONFIRMED : AppEvents.RESERVATION_CREATED,
            {
              reservation: res,
              gamingCenter,
              customerAccount: result.groupBooking.customerAccount,
            }
          );
        }
      }
    } catch (evtErr) {
      // Safe fallback
    }

    void invalidatePublicCacheByPrefix(`public:avail:${gamingCenterId}:`);

    return result.groupBooking;
  },

  async createPublicGroupBooking(gamingCenterSlug: string, input: {
    startTime: string | Date;
    durationMinutes?: number;
    items: Array<{ stationId: string; staffId?: string }>;
    customer: { fullName: string; phone: string; email?: string };
    note?: string;
    useWallet?: boolean;
    provider?: string;
    actor?: RequestActor;
  }) {
    const gamingCenter = await ReservationRepo.findGamingCenterBySlugWithSettings(gamingCenterSlug);
    if (!gamingCenter) {
      throw new AppError('GamingCenter not found.', httpStatus.NOT_FOUND);
    }

    if (gamingCenter.isActive === false) {
      throw new AppError('GamingCenter is currently inactive.', httpStatus.FORBIDDEN, {
        code: 'GAMING_CENTER_INACTIVE',
      });
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

      // If the caller is already authenticated via JWT with matching phone number or staff/admin, bypass OTP
      let isAuthenticatedCustomer = false;
      if (input.actor) {
        if (
          input.actor.actorType === SessionActorType.USER ||
          input.actor.actorType === SessionActorType.PLATFORM_ADMIN
        ) {
          isAuthenticatedCustomer = true;
        } else if (input.actor.actorType === SessionActorType.CUSTOMER) {
          const actorCustomer = await prisma.customerAccount.findUnique({
            where: { id: input.actor.id },
            select: { id: true, phone: true },
          });
          if (actorCustomer && normalizePhone(actorCustomer.phone) === normalizedPhone) {
            isAuthenticatedCustomer = true;
          }
        }
      }

      if (!isAuthenticatedCustomer) {
        const verificationWindow = new Date(Date.now() - OTP_POST_VERIFICATION_WINDOW_MINUTES * 60 * 1000);
        const recentVerifiedOtp = await AuthRepository.findRecentConsumedOtp(normalizedPhone, OtpPurpose.LOGIN, verificationWindow);

        if (!recentVerifiedOtp) {
          throw new AppError('Phone number not verified. Please verify via OTP first.', httpStatus.UNAUTHORIZED, {
            code: 'OTP_REQUIRED',
          });
        }
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

    validateOperatingHours(startTime, endTime, {
      openingTime: gamingCenter.settings?.workStartTime || gamingCenter.openingTime,
      closingTime: gamingCenter.settings?.workEndTime || gamingCenter.closingTime,
      timeZone: gamingCenter.settings?.timeZone || gamingCenter.timezone,
      closedDays: gamingCenter.closedDays,
      schedules: gamingCenter.schedules,
      closures: gamingCenter.closures,
    });

    const wantsWallet = Boolean(input.useWallet || input.provider?.toUpperCase() === 'WALLET');
    if (
      wantsWallet &&
      typeof prisma?.customerAccount?.findUnique === 'function' &&
      typeof PaymentsRepo?.reapStaleCustomerInitiatedPayments === 'function'
    ) {
      try {
        const preTxCustomer = await prisma.customerAccount.findUnique({
          where: { phone: normalizePhone(customer.phone) },
          select: { id: true },
        });
        if (preTxCustomer?.id) {
          await PaymentsRepo.reapStaleCustomerInitiatedPayments(preTxCustomer.id).catch(() => {});
        }
      } catch {
        // Ignore pre-transaction reap failures in mocked or offline environments
      }
    }

    let result;
    try {
      result = await GroupBookingRepo.transaction(async (tx) => {
        await ReservationRepo.lockStationsForUpdate(stationIds, tx);

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
        const itemBasePrice = calculateBasePrice(totalHours, station.hourlyPrice);

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

      await ReservationRepo.assertActiveReservationLimitNotExceeded(customerAccount.id, tx);

      const isPayable = aggregatePrice > 0;
      const roundedPayable = Math.round(aggregatePrice);
      const isWalletPayment = Boolean(wantsWallet && isPayable);

      if (wantsWallet) {
        assertCustomerOwnsWallet(input.actor, customerAccount.id);
      }

      let initialPaymentState: ReservationPaymentState = isPayable
        ? ReservationPaymentState.UNPAID
        : ReservationPaymentState.PAID;

      if (isWalletPayment) {

        if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === 'function') {
          await tx.$executeRaw`SELECT id FROM "CustomerAccount" WHERE id = ${customerAccount.id} FOR UPDATE`;
        }

        const freshAccount = await tx.customerAccount.findUnique({
          where: { id: customerAccount.id },
          select: { walletBalance: true, reservedBalance: true },
        });

        const currentBalance = getAvailableWalletBalance(freshAccount);
        if (currentBalance < roundedPayable) {
          throw new AppError('Insufficient wallet balance.', httpStatus.BAD_REQUEST, {
            code: 'INSUFFICIENT_WALLET_BALANCE',
          });
        }

        await tx.customerAccount.update({
          where: { id: customerAccount.id },
          data: { walletBalance: { decrement: roundedPayable } },
        });

        initialPaymentState = ReservationPaymentState.PAID;
      }

      const isPaid = initialPaymentState === ReservationPaymentState.PAID;
      const status =
        isPaid && gamingCenter.settings?.onlineBookingAutoConfirm
          ? ReservationStatus.CONFIRMED
          : ReservationStatus.PENDING;

      const timeoutMinutes = gamingCenter.settings?.reservationConfirmationTimeoutMinutes ?? 30;
      const unpaidReleaseMinutes = gamingCenter.settings?.autoReleaseUnpaidMinutes ?? 15;
      const effectiveTimeout = !isPaid
        ? Math.min(unpaidReleaseMinutes, timeoutMinutes)
        : timeoutMinutes;
      const confirmationExpiresAt = status === ReservationStatus.PENDING
        ? new Date(Date.now() + effectiveTimeout * 60 * 1000)
        : null;
      const expiresAt = confirmationExpiresAt;

      // Find staff/system user to assign as creator
      const systemUser = await tx.user.findFirst({ where: { gamingCenterId: gamingCenter.id } });
      if (!systemUser) {
        throw new AppError('System error: Gaming center user not found.', httpStatus.INTERNAL_SERVER_ERROR);
      }

      const createdGroupBooking = await GroupBookingRepo.createGroupBookingWithDetails(
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
          paymentState: initialPaymentState,
          source: ReservationSource.ONLINE,
          note,
          expiresAt,
          confirmationExpiresAt,
          items: preparedItems,
        },
        tx
      );

      let payment: Payment | null = null;
      if (isWalletPayment && createdGroupBooking) {
        payment = await tx.payment.create({
          data: {
            gamingCenter: { connect: { id: gamingCenter.id } },
            groupBooking: { connect: { id: createdGroupBooking.id } },
            amount: roundedPayable,
            walletAmount: roundedPayable,
            currency: 'IRR',
            provider: PaymentProvider.MANUAL,
            method: PaymentMethod.WALLET,
            status: PaymentStatus.PAID,
            paidAt: new Date(),
            referenceCode: `WALLET-GB-${createdGroupBooking.id.slice(-8).toUpperCase()}`,
          },
        });

        await tx.walletTransaction.create({
          data: {
            customerAccountId: customerAccount.id,
            amount: -roundedPayable,
            currency: 'IRR',
            type: WalletTransactionType.RESERVATION_PAYMENT,
            paymentId: payment.id,
            note: `پرداخت کامل هزینه رزرو گروهی ${createdGroupBooking.id} از طریق کیف پول`,
          },
        });

        await LedgerRepo.createCollectionEntry(tx, {
          gamingCenterId: gamingCenter.id,
          paymentId: payment.id,
          amount: roundedPayable,
          currency: 'IRR',
          description: `Wallet payment collection for group booking ${createdGroupBooking.id}`,
        });
      }

        return { groupBooking: createdGroupBooking, isWalletPayment, payment };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      });
    } catch (error: unknown) {
      if (isReservationOverlapDbError(error)) {
        throw new AppError('One or more selected stations are not available for the requested time.', httpStatus.CONFLICT, {
          code: 'SLOT_NOT_AVAILABLE',
        });
      }
      throw error;
    }

    if (result.isWalletPayment && result.groupBooking?.reservations) {
      for (const res of result.groupBooking.reservations) {
        await commissionsStation.calculateCommission(res.id).catch(() => {});
      }
    }

    try {
      const gc = typeof prisma.gamingCenter?.findUnique === 'function'
        ? await prisma.gamingCenter.findUnique({
          where: { id: result.groupBooking.gamingCenterId },
          include: { settings: true },
        })
        : gamingCenter;

      if (gc && result.groupBooking?.customerAccount) {
        if (result.isWalletPayment && result.payment) {
          eventEmitter.emit(AppEvents.PAYMENT_SUCCESS, {
            payment: result.payment,
          });
        }

        const isConfirmed = result.groupBooking.status === ReservationStatus.CONFIRMED;
        for (const res of result.groupBooking.reservations || []) {
          eventEmitter.emit(
            isConfirmed ? AppEvents.RESERVATION_CONFIRMED : AppEvents.RESERVATION_CREATED,
            {
              reservation: res,
              gamingCenter: gc,
              customerAccount: result.groupBooking.customerAccount,
            }
          );
        }
      }
    } catch (evtErr) {
      // Safe fallback
    }

    void invalidatePublicCacheByPrefix(`public:avail:${gamingCenter.id}:`);

    return result.groupBooking;
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
    const now = new Date();
    const groupBooking = await GroupBookingRepo.findGroupBookingById(id, gamingCenterId);
    if (!groupBooking) {
      throw new AppError('Group booking not found.', httpStatus.NOT_FOUND);
    }

    const isPlatformAdmin = actor?.actorType === SessionActorType.PLATFORM_ADMIN;
    const isCustomer =
      actor?.actorType === SessionActorType.CUSTOMER ||
      (!isPlatformAdmin && !actor?.role && actor?.actorType !== SessionActorType.USER);
    const isUserActor =
      actor?.actorType === SessionActorType.USER ||
      (!actor?.actorType && Boolean(actor?.role));
    const canceledByUserId = isUserActor ? actor.id : null;

    if (isCustomer) {
      const effectiveCustomerId = actor?.customerAccountId || actor?.id;
      if (groupBooking.customerAccountId !== effectiveCustomerId) {
        throw new AppError('Group booking not found.', httpStatus.NOT_FOUND);
      }
    }

    const validateCancelableGroupState = (
      gb: {
        status?: ReservationStatus | null;
        startTime?: Date | null;
        endTime?: Date | null;
        reservations?: Array<{
          id: string;
          status?: ReservationStatus | null;
          startTime?: Date | null;
          endTime?: Date | null;
          completedAt?: Date | null;
          campaignId?: string | null;
          discountId?: string | null;
        }>;
      },
      checkNow: Date
    ) => {
      if (gb.status === ReservationStatus.CANCELED) {
        throw new AppError('Group booking is already canceled.', httpStatus.CONFLICT);
      }

      if (gb.status) {
        ReservationStateMachine.validateTransition(gb.status, ReservationStatus.CANCELED);
      }

      if (isCustomer && gb.status === ReservationStatus.IN_PROGRESS) {
        throw new AppError(
          'Cannot cancel an in-progress group booking. Please contact the gaming center staff.',
          httpStatus.CONFLICT,
          { code: 'INVALID_TRANSITION' }
        );
      }

      if (gb.status !== ReservationStatus.PENDING && gb.endTime && new Date(gb.endTime) <= checkNow) {
        throw new AppError(
          'Cannot cancel a group booking that has already ended.',
          httpStatus.CONFLICT,
          { code: 'RESERVATION_ALREADY_ENDED' }
        );
      }

      if (Array.isArray(gb.reservations)) {
        for (const res of gb.reservations) {
          if (
            res.status === ReservationStatus.COMPLETED ||
            res.status === ReservationStatus.NO_SHOW ||
            res.status === ReservationStatus.EXPIRED ||
            res.completedAt
          ) {
            throw new AppError(
              'Cannot cancel group booking because one or more constituent reservations have already completed or ended.',
              httpStatus.CONFLICT,
              { code: 'INVALID_TRANSITION' }
            );
          }

          if (res.status !== ReservationStatus.PENDING && res.endTime && new Date(res.endTime) <= checkNow) {
            throw new AppError(
              'Cannot cancel group booking because one or more constituent reservations have already ended.',
              httpStatus.CONFLICT,
              { code: 'RESERVATION_ALREADY_ENDED' }
            );
          }

          if (isCustomer && res.status === ReservationStatus.IN_PROGRESS) {
            throw new AppError(
              'Cannot cancel an in-progress group booking. Please contact the gaming center staff.',
              httpStatus.CONFLICT,
              { code: 'INVALID_TRANSITION' }
            );
          }

          if (isCustomer && res.startTime && new Date(res.startTime) <= checkNow) {
            throw new AppError(
              'Cannot cancel a group booking that has already started.',
              httpStatus.CONFLICT,
              { code: 'RESERVATION_ALREADY_STARTED' }
            );
          }
        }
      }

      if (isCustomer && gb.startTime && new Date(gb.startTime) <= checkNow) {
        throw new AppError(
          'Cannot cancel a group booking that has already started.',
          httpStatus.CONFLICT,
          { code: 'RESERVATION_ALREADY_STARTED' }
        );
      }
    };

    validateCancelableGroupState(groupBooking, now);

    let gbCancellationWindowMinutes: number | null = null;
    if (isCustomer && groupBooking.startTime) {
      const settings =
        (
          groupBooking as {
            gamingCenter?: {
              settings?: {
                cancellationWindowMinutes?: number | null;
                cancellationHours?: number | null;
              } | null;
            } | null;
          }
        ).gamingCenter?.settings ||
        (typeof ReservationRepo.findSettings === 'function'
          ? await Promise.resolve(ReservationRepo.findSettings(gamingCenterId))
          : null);
      gbCancellationWindowMinutes = resolveCancellationWindowMinutes(settings);
      validateCancellationWindowMinutes(new Date(groupBooking.startTime), gbCancellationWindowMinutes, now);
    }

    const effectiveReason = reason || (isCustomer ? 'Canceled by customer' : undefined);
    const cancelCategory = isCustomer
      ? CancellationCategory.CUSTOMER_CANCEL
      : CancellationCategory.UNKNOWN;
    const cancelActor = isCustomer
      ? CancellationActor.CUSTOMER
      : CancellationActor.STAFF;

    const updated = await GroupBookingRepo.transaction(async (tx) => {
      if (typeof (tx as { $executeRaw?: unknown })?.$executeRaw === 'function') {
        await tx.$executeRaw`SELECT id FROM "GroupBooking" WHERE id = ${id} FOR UPDATE`;
        await tx.$executeRaw`SELECT id FROM "Reservation" WHERE "groupBookingId" = ${id} FOR UPDATE`;
      }

      let effectiveChildren = groupBooking.reservations || [];

      if (typeof tx?.groupBooking?.findFirst === 'function') {
        const lockedGroup = await tx.groupBooking.findFirst({
          where: { id, gamingCenterId },
          include: {
            reservations: {
              select: {
                id: true,
                status: true,
                startTime: true,
                endTime: true,
                completedAt: true,
                campaignId: true,
                discountId: true,
              },
            },
          },
        });

        if (!lockedGroup) {
          throw new AppError('Group booking not found.', httpStatus.NOT_FOUND);
        }

        const txNow = new Date();
        validateCancelableGroupState(lockedGroup, txNow);
        if (isCustomer && lockedGroup.startTime && gbCancellationWindowMinutes !== null) {
          validateCancellationWindowMinutes(new Date(lockedGroup.startTime), gbCancellationWindowMinutes, txNow);
        }
        effectiveChildren = (lockedGroup.reservations || []) as typeof effectiveChildren;
      }

      const childIds = effectiveChildren.map((r) => r.id);
      if (childIds.length > 0 && typeof tx?.gamingSession?.findFirst === 'function') {
        if (isCustomer) {
          const startedSession = await tx.gamingSession.findFirst({
            where: { reservationId: { in: childIds } },
            select: { id: true },
          });
          if (startedSession) {
            throw new AppError(
              'Cannot cancel a group booking whose gaming session has already started or completed.',
              httpStatus.CONFLICT,
              { code: 'RESERVATION_SESSION_STARTED' }
            );
          }
        } else {
          const completedSession = await tx.gamingSession.findFirst({
            where: {
              reservationId: { in: childIds },
              status: GamingSessionStatus.COMPLETED,
            },
            select: { id: true },
          });
          if (completedSession) {
            throw new AppError(
              'Cannot cancel group booking because a constituent gaming session has already completed.',
              httpStatus.CONFLICT,
              { code: 'INVALID_TRANSITION' }
            );
          }

          if (typeof tx.gamingSession.updateMany === 'function') {
            await tx.gamingSession.updateMany({
              where: {
                reservationId: { in: childIds },
                status: { in: [GamingSessionStatus.ACTIVE, GamingSessionStatus.PAUSED] },
              },
              data: {
                status: GamingSessionStatus.INTERRUPTED,
                endTime: new Date(),
                pausedAt: null,
                interruptionReason: effectiveReason || 'Group booking canceled',
              },
            });
          }
        }
      }

      const canceled = await GroupBookingRepo.cancelGroupBookingAndReservations(
        id,
        gamingCenterId,
        canceledByUserId,
        effectiveReason,
        tx,
        { cancelCategory, cancelActor }
      );

      if (!canceled) {
        throw new AppError(
          'Group booking can no longer be canceled due to a concurrent state change.',
          httpStatus.CONFLICT,
          { code: 'INVALID_TRANSITION' }
        );
      }

      // Cancel any initiated payments for this group booking, restoring deducted wallet funds
      if (typeof tx.payment?.findMany === 'function') {
        const activePayments = await tx.payment.findMany({
          where: {
            groupBookingId: id,
            status: PaymentStatus.INITIATED,
          },
        });
        for (const p of activePayments) {
          await PaymentsRepo.handleFailedPayment(
            tx,
            p.id,
            PaymentStatus.CANCELED,
            reason || 'Group booking canceled'
          );
        }
      }

      // Trigger wallet refunds for all reservations under this group booking if paid
      if (effectiveChildren.length > 0) {
        for (const res of effectiveChildren) {
          if (typeof ReservationRepo.cancelPendingProposals === 'function') {
            await ReservationRepo.cancelPendingProposals(res.id, tx);
          }
          await walletService.refundReservationToWallet(res.id, tx);
          if (typeof commissionsStation?.reverseCommissionForReservation === 'function') {
            await commissionsStation.reverseCommissionForReservation(
              res.id,
              { reason: effectiveReason || 'Group booking canceled' },
              tx
            );
          }
          if (
            (res.campaignId || res.discountId) &&
            typeof discountsStation?.releaseDiscountForReservation === 'function'
          ) {
            await Promise.resolve(
              discountsStation.releaseDiscountForReservation(
                res.id,
                effectiveReason || 'Group booking canceled',
                tx
              )
            ).catch(() => {});
          }
        }
      }

      // After child refunds read group PAID payments, mark group-level PAID payments and paymentState REFUNDED
      if (
        typeof tx?.payment?.updateMany === 'function' &&
        typeof tx?.groupBooking?.updateMany === 'function'
      ) {
        const updatedPayments = await tx.payment.updateMany({
          where: {
            groupBookingId: id,
            status: PaymentStatus.PAID,
          },
          data: {
            status: PaymentStatus.REFUNDED,
          },
        });
        if (updatedPayments && updatedPayments.count > 0) {
          await tx.groupBooking.updateMany({
            where: { id, gamingCenterId },
            data: { paymentState: ReservationPaymentState.REFUNDED },
          });
        }
      }

      return canceled;
    });

    const auditActorType =
      actor.actorType ??
      (isCustomer ? SessionActorType.CUSTOMER : SessionActorType.USER);
    await auditService.log(
      gamingCenterId,
      {
        id: isCustomer ? (actor.customerAccountId || actor.id) : actor.id,
        actorType: auditActorType,
      },
      'GROUP_BOOKING_CANCEL',
      { name: 'GroupBooking', id },
      { old: groupBooking, new: updated },
      context
    );

    const updatedWithRelations = updated as unknown as {
      gamingCenter?: unknown;
      customerAccount?: unknown;
      reservations?: unknown[];
    } | null;
    if (
      updatedWithRelations?.gamingCenter &&
      updatedWithRelations?.customerAccount &&
      Array.isArray(updatedWithRelations.reservations)
    ) {
      for (const res of updatedWithRelations.reservations) {
        eventEmitter.emit(AppEvents.RESERVATION_CANCELED, {
          reservation: res,
          gamingCenter: updatedWithRelations.gamingCenter,
          customerAccount: updatedWithRelations.customerAccount,
        });
      }
    }

    void invalidatePublicCacheByPrefix(`public:avail:${gamingCenterId}:`);

    return updated;
  },
};
