import { isBefore, addMinutes } from 'date-fns';
import { BookingHoldStatus, PaymentStatus, Prisma, OtpPurpose } from '@prisma/client';
import httpStatus from 'http-status';
import AppError from '../../common/errors/AppError';
import { BookingHoldRepo } from './booking-hold.repo';
import { ReservationRepo } from '../reservation/reservation.repo';
import { discountsStation } from '../discounts/discounts.station';
import { normalizePhone } from '../../common/utils/phone';
import { AuthRepository } from '../auth/auth.repository';
import { validateLeadTime } from '../reservation/reservation.validation';
import { PaymentsRepo } from '../payments/payments.repo';
import { PaymentProviderFactory } from '../payments/providers';
import { LedgerRepo } from '../payments/ledger.repo';
import { commissionsStation } from '../commissions/commissions.station';
import { prisma } from '../../config/prisma';
import logger from '../../config/logger';

export const DEFAULT_HOLD_EXPIRATION_MINUTES = 10;
export const OTP_POST_VERIFICATION_WINDOW_MINUTES = 15;

export interface CreateBookingHoldInput {
  startTime: string;
  durationMinutes?: number;
  items: Array<{ stationId: string; staffId?: string }>;
  customer: { fullName: string; phone: string; email?: string };
  note?: string;
  provider?: string;
  idempotencyKey?: string | null;
}

export const BookingHoldStation = {
  async createBookingHold(
    gamingCenterSlug: string,
    input: CreateBookingHoldInput
  ) {
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

    const { items, customer, note, idempotencyKey } = input;
    const durationMinutes = input.durationMinutes || 60;
    const totalHours = durationMinutes / 60;
    const endTime = addMinutes(startTime, durationMinutes);

    const stationIds = items.map((i) => i.stationId);
    if (new Set(stationIds).size !== stationIds.length) {
      throw new AppError('Duplicate stations selected in group booking.', httpStatus.BAD_REQUEST, {
        code: 'DUPLICATE_STATIONS_SELECTED',
      });
    }

    // Check idempotency if key provided
    if (idempotencyKey) {
      const existingHold = await BookingHoldRepo.findHoldByIdempotencyKey(gamingCenter.id, idempotencyKey);
      if (existingHold && existingHold.status === BookingHoldStatus.ACTIVE && existingHold.expiresAt > new Date()) {
        return existingHold;
      }
    }

    return BookingHoldRepo.transaction(async (tx) => {
      // 1. Pessimistic lock stations
      await BookingHoldRepo.lockStationsForUpdate(stationIds, tx);

      // 2. Fetch & validate stations
      const stations = await tx.gameStation.findMany({
        where: {
          id: { in: stationIds },
          gamingCenterId: gamingCenter.id,
          isActive: true,
        },
      });

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

      // 3. Authoritative Overlap check against active reservations AND active booking holds
      const overlaps = await BookingHoldRepo.findOverlappingReservationsAndHoldsForStations(
        gamingCenter.id,
        stationIds,
        startTime,
        endTime,
        new Date(),
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

      // 4. Calculate prices & dynamic discounts server-side
      let aggregatePrice = 0;
      let aggregateDiscount = 0;
      void aggregateDiscount;
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
            currency: 'IRR',
          },
        });
      }

      // 5. Find or create customer
      const normalizedPhone = normalizePhone(customer.phone);
      let customerAccount = await tx.customerAccount.findUnique({
        where: { phone: normalizedPhone },
      });

      if (!customerAccount) {
        customerAccount = await tx.customerAccount.create({
          data: {
            phone: normalizedPhone,
            fullName: customer.fullName,
          },
        });
      }

      let customerProfile = await tx.customerProfile.findUnique({
        where: {
          gamingCenterId_customerAccountId: {
            gamingCenterId: gamingCenter.id,
            customerAccountId: customerAccount.id,
          },
        },
      });

      if (!customerProfile) {
        customerProfile = await tx.customerProfile.create({
          data: {
            gamingCenterId: gamingCenter.id,
            customerAccountId: customerAccount.id,
            displayName: customer.fullName,
          },
        });
      }

      // 6. Hold expiration (default 10 minutes)
      const expiresAt = addMinutes(new Date(), DEFAULT_HOLD_EXPIRATION_MINUTES);

      // 7. Create ACTIVE BookingHold
      return BookingHoldRepo.createBookingHold(
        {
          gamingCenterId: gamingCenter.id,
          customerProfileId: customerProfile.id,
          customerAccountId: customerAccount.id,
          startTime,
          endTime,
          durationMinutes,
          playerCount: items.length,
          totalAmount: Math.round(aggregatePrice),
          currency: 'IRR',
          status: BookingHoldStatus.ACTIVE,
          expiresAt,
          idempotencyKey: idempotencyKey || null,
          note,
          items: preparedItems,
        },
        tx
      );
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  },

  async releaseHold(holdId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const hold = await client.bookingHold.findUnique({
      where: { id: holdId },
      include: { payment: true },
    });

    if (!hold) {
      return null;
    }

    if (hold.status === BookingHoldStatus.CONVERTED) {
      throw new AppError('Cannot release a converted booking hold.', httpStatus.CONFLICT);
    }

    if (hold.status === BookingHoldStatus.RELEASED) {
      return hold;
    }

    return client.bookingHold.update({
      where: { id: holdId },
      data: { status: BookingHoldStatus.RELEASED },
    });
  },

  async convertHoldToReservations(
    holdId: string,
    verifiedPaymentId?: string,
    tx?: Prisma.TransactionClient
  ) {
    const executeConversion = async (t: Prisma.TransactionClient) => {
      const hold = await BookingHoldRepo.findHoldForUpdate(holdId, t);
      if (!hold) {
        throw new AppError('Booking hold not found.', httpStatus.NOT_FOUND);
      }

      // Idempotency: If already converted, return existing group booking
      if (hold.status === BookingHoldStatus.CONVERTED && hold.convertedGroupBookingId) {
        const existingGroup = await t.groupBooking.findUnique({
          where: { id: hold.convertedGroupBookingId },
          include: {
            items: { include: { station: true, reservation: true } },
            reservations: true,
            customerAccount: true,
            customerProfile: true,
            payments: true,
          },
        });
        return existingGroup;
      }

      if (hold.status === BookingHoldStatus.RELEASED) {
        throw new AppError('Cannot convert a released booking hold.', httpStatus.CONFLICT);
      }

      const payment = hold.payment || (verifiedPaymentId ? await t.payment.findUnique({ where: { id: verifiedPaymentId } }) : null);

      if (!payment) {
        throw new AppError('No payment associated with this booking hold.', httpStatus.BAD_REQUEST);
      }

      if (payment.status !== PaymentStatus.PAID) {
        throw new AppError('Payment must be PAID before converting booking hold to reservations.', httpStatus.BAD_REQUEST);
      }

      if (payment.amount !== hold.totalAmount) {
        throw new AppError(
          `Payment amount (${payment.amount}) does not match hold total amount (${hold.totalAmount}).`,
          httpStatus.BAD_REQUEST
        );
      }

      // Revalidate station availability against active reservations to prevent double-booking
      const stationIds = hold.items.map((i) => i.stationId);
      const overlappingReservations = await t.reservation.findMany({
        where: {
          gamingCenterId: hold.gamingCenterId,
          stationId: { in: stationIds },
          status: { in: ['CONFIRMED', 'IN_PROGRESS', 'PENDING'] },
          startTime: { lt: hold.endTime },
          endTime: { gt: hold.startTime },
        },
      });

      if (overlappingReservations.length > 0) {
        logger.error({
          msg: 'Critical: Confirmed reservation conflict detected during hold conversion',
          holdId: hold.id,
          paymentId: payment.id,
          conflicts: overlappingReservations.map((r) => r.id),
        });
        throw new AppError('Slot conflict detected during reservation creation. Payment preserved for reconciliation.', httpStatus.CONFLICT, {
          code: 'CONVERSION_CONFLICT',
          details: { paymentId: payment.id },
        });
      }

      // Execute conversion
      const groupBooking = await BookingHoldRepo.convertHoldToGroupBookingAndReservations(hold.id, t);

      // Record financial ledger collection
      await LedgerRepo.createCollectionEntry(t, {
        gamingCenterId: hold.gamingCenterId,
        paymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        description: `Payment collection for group reservation ${groupBooking?.id}`,
      });

      // Calculate commissions for all created reservations
      if (groupBooking?.reservations) {
        for (const res of groupBooking.reservations) {
          try {
            await commissionsStation.calculateCommission(res.id, t);
          } catch (err) {
            logger.error({ err, reservationId: res.id }, 'Failed to calculate commission for group reservation item');
          }
        }
      }

      return groupBooking;
    };

    if (tx) {
      return executeConversion(tx);
    } else {
      return BookingHoldRepo.transaction(executeConversion, {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      });
    }
  },

  async checkoutGroupReservation(
    gamingCenterSlug: string,
    input: CreateBookingHoldInput
  ) {
    // 1. Create ACTIVE BookingHold (authoritative validation & pricing)
    const hold = await this.createBookingHold(gamingCenterSlug, input);

    // 2. Resolve provider & initiate payment
    const providerName = input.provider;
    const provider = PaymentProviderFactory.getProvider(providerName);

    // 3. Create PENDING/INITIATED Payment record associated with BookingHold
    const payment = await PaymentsRepo.transaction(async (tx) => {
      return tx.payment.create({
        data: {
          gamingCenterId: hold.gamingCenterId,
          bookingHoldId: hold.id,
          amount: hold.totalAmount,
          currency: hold.currency,
          provider: provider.name as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          status: PaymentStatus.INITIATED,
          idempotencyKey: input.idempotencyKey,
        },
      });
    });

    // 4. Generate payment gateway request
    try {
      const callbackUrl = provider.name === 'ZIBAL' ? process.env.ZIBAL_CALLBACK_URL : process.env.ZARINPAL_CALLBACK_URL;
      const initiateResult = await provider.initiatePayment({
        amount: hold.totalAmount,
        currency: hold.currency,
        description: `Group Reservation Hold ${hold.id}`,
        callbackUrl,
        reservationId: hold.id,
        gamingCenterId: hold.gamingCenterId,
      });

      // Save provider reference
      await PaymentsRepo.updatePayment(payment.id, {
        providerPaymentId: initiateResult.providerPaymentId,
        providerCheckoutId: initiateResult.providerCheckoutId,
      });

      return {
        holdId: hold.id,
        paymentId: payment.id,
        paymentStatus: PaymentStatus.INITIATED,
        holdExpiresAt: hold.expiresAt,
        paymentUrl: initiateResult.checkoutUrl,
        totalAmount: hold.totalAmount,
        currency: hold.currency,
      };
    } catch (error) {
      logger.error({ error, holdId: hold.id, paymentId: payment.id }, 'Payment gateway initiation failed; releasing hold');

      // Fail payment & release hold consistently
      await PaymentsRepo.transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            failureReason: error instanceof Error ? error.message : 'Gateway initiation failed',
          },
        });
        await tx.bookingHold.update({
          where: { id: hold.id },
          data: { status: BookingHoldStatus.RELEASED },
        });
      });

      if (error instanceof AppError) throw error;
      throw new AppError('Failed to initiate payment gateway request.', httpStatus.BAD_GATEWAY);
    }
  },
};
