import { isBefore, addMinutes } from 'date-fns';
import {
  BookingHoldStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentProvider,
  WalletTransactionType,
  Prisma,
  OtpPurpose,
} from '@prisma/client';
import httpStatus from 'http-status';
import AppError from '../../common/errors/AppError';
import { BookingHoldRepo } from './booking-hold.repo';
import { ReservationRepo } from '../reservation/reservation.repo';
import { discountsStation } from '../discounts/discounts.station';
import { calculateBasePrice } from '../../common/utils/money';
import { normalizePhone } from '../../common/utils/phone';
import { AuthRepository } from '../auth/auth.repository';
import { validateLeadTime } from '../reservation/reservation.validation';
import { PaymentsRepo } from '../payments/payments.repo';
import { PaymentProviderFactory } from '../payments/providers';
import { LedgerRepo } from '../payments/ledger.repo';
import { commissionsStation } from '../commissions/commissions.station';
import { prisma } from '../../config/prisma';
import logger from '../../config/logger';
import {
  ExtraControllerSelectionInput,
  validateAndPriceExtraControllers,
} from '../station/extra-controller.service';

export const DEFAULT_HOLD_EXPIRATION_MINUTES = 10;
export const OTP_POST_VERIFICATION_WINDOW_MINUTES = 15;

export interface CreateBookingHoldInput {
  startTime: string;
  durationMinutes?: number;
  items: Array<{
    stationId: string;
    staffId?: string;
    extraControllers?: ExtraControllerSelectionInput[];
  }>;
  customer: { fullName: string; phone: string; email?: string };
  note?: string;
  provider?: string;
  useWallet?: boolean;
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
      // 0. If previous hold with this idempotencyKey was RELEASED or EXPIRED, archive the key so retry succeeds
      if (idempotencyKey) {
        await BookingHoldRepo.archiveInactiveHoldIdempotencyKey(gamingCenter.id, idempotencyKey, tx);
      }

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

      // 4. Calculate prices, extra controllers & dynamic discounts server-side
      let aggregatePrice = 0;
      let aggregateDiscount = 0;
      let aggregateExtraControllersCost = 0;
      void aggregateDiscount;
      const preparedItems = [];

      for (const item of items) {
        const station = stationMap.get(item.stationId)!;
        const stationBasePrice = calculateBasePrice(totalHours, station.hourlyPrice);

        const pricedExtras = await validateAndPriceExtraControllers(
          station.id,
          startTime,
          endTime,
          totalHours,
          item.extraControllers,
          tx
        );
        aggregateExtraControllersCost += pricedExtras.totalCost;

        const itemGrossPrice = stationBasePrice + pricedExtras.totalCost;

        const { applicableDiscount, discountAmount } = await discountsStation.calculateApplicableDiscount(
          gamingCenter.id,
          station.id,
          itemGrossPrice,
          startTime,
          tx
        );

        const itemFinalPrice = Math.max(0, itemGrossPrice - discountAmount);
        aggregatePrice += itemFinalPrice;
        aggregateDiscount += discountAmount;

        preparedItems.push({
          stationId: station.id,
          staffId: item.staffId,
          price: itemFinalPrice,
          extraControllersTotalCost: pricedExtras.totalCost,
          discountAmount,
          discountId: applicableDiscount?.id,
          extraControllers: pricedExtras.items,
          stationSnapshot: {
            name: station.name,
            hourlyPrice: station.hourlyPrice,
            stationType: station.stationType,
            currency: 'IRR',
            extraControllers: pricedExtras.items,
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
          extraControllersTotalCost: aggregateExtraControllersCost,
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
    // 1. Check if active hold with initiated payment already exists for this idempotency key
    if (input.idempotencyKey) {
      const gamingCenter = await ReservationRepo.findGamingCenterBySlugWithSettings(gamingCenterSlug);
      if (gamingCenter) {
        const existingHold = await BookingHoldRepo.findHoldByIdempotencyKey(gamingCenter.id, input.idempotencyKey);
        if (
          existingHold &&
          existingHold.status === BookingHoldStatus.ACTIVE &&
          existingHold.expiresAt > new Date() &&
          existingHold.payment &&
          existingHold.payment.status === PaymentStatus.INITIATED &&
          existingHold.payment.providerCheckoutId
        ) {
          return {
            holdId: existingHold.id,
            paymentId: existingHold.payment.id,
            paymentStatus: existingHold.payment.status,
            holdExpiresAt: existingHold.expiresAt,
            paymentUrl: existingHold.payment.providerCheckoutId,
            totalAmount: existingHold.totalAmount,
            currency: existingHold.currency,
          };
        }
      }
    }

    // 2. Create ACTIVE BookingHold (authoritative validation & pricing)
    const hold = await this.createBookingHold(gamingCenterSlug, input);

    // Resolve customer account for potential wallet payment
    const normalizedPhone = normalizePhone(input.customer.phone);
    const customerAccount = await ReservationRepo.findCustomerAccountByPhone(normalizedPhone);
    const availableBalance = customerAccount?.walletBalance ?? 0;

    // Full Wallet Payment Scenario
    if (input.useWallet && customerAccount && availableBalance >= hold.totalAmount) {
      const fullPayment = await PaymentsRepo.transaction(async (tx) => {
        if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === 'function') {
          await tx.$executeRaw`SELECT id FROM "CustomerAccount" WHERE id = ${customerAccount.id} FOR UPDATE`;
        }

        // Decrement wallet balance
        await tx.customerAccount.update({
          where: { id: customerAccount.id },
          data: { walletBalance: { decrement: hold.totalAmount } },
        });

        if (input.idempotencyKey) {
          const priorPayment = await tx.payment.findFirst({
            where: {
              gamingCenterId: hold.gamingCenterId,
              idempotencyKey: input.idempotencyKey,
            },
          });
          if (priorPayment) {
            await tx.payment.update({
              where: { id: priorPayment.id },
              data: { idempotencyKey: `archived_${priorPayment.id}_${Date.now()}` },
            });
          }
        }

        const paymentRecord = await tx.payment.create({
          data: {
            gamingCenterId: hold.gamingCenterId,
            bookingHoldId: hold.id,
            amount: hold.totalAmount,
            walletAmount: hold.totalAmount,
            currency: hold.currency,
            provider: PaymentProvider.MANUAL,
            method: PaymentMethod.WALLET,
            status: PaymentStatus.PAID,
            paidAt: new Date(),
            referenceCode: `WALLET-HOLD-${hold.id.slice(-8).toUpperCase()}`,
            idempotencyKey: input.idempotencyKey,
          },
        });

        await tx.walletTransaction.create({
          data: {
            customerAccountId: customerAccount.id,
            amount: -hold.totalAmount,
            currency: hold.currency,
            type: WalletTransactionType.RESERVATION_PAYMENT,
            paymentId: paymentRecord.id,
            note: `پرداخت کامل هولد رزرو گروهی ${hold.id} از طریق کیف پول`,
            idempotencyKey: input.idempotencyKey ? `wallet_debit:${input.idempotencyKey}` : undefined,
          },
        });

        const convertedGroup = await BookingHoldRepo.convertHoldToGroupBookingAndReservations(hold.id, tx);

        await LedgerRepo.createCollectionEntry(tx, {
          gamingCenterId: hold.gamingCenterId,
          paymentId: paymentRecord.id,
          amount: hold.totalAmount,
          currency: hold.currency,
          description: `Wallet collection for group hold ${hold.id}`,
        });

        if (convertedGroup?.reservations) {
          for (const res of convertedGroup.reservations) {
            await commissionsStation.calculateCommission(res.id, tx).catch(() => {});
          }
        }

        return { payment: paymentRecord, groupBooking: convertedGroup };
      });

      return {
        holdId: hold.id,
        paymentId: fullPayment.payment.id,
        paymentStatus: PaymentStatus.PAID,
        holdExpiresAt: hold.expiresAt,
        paymentUrl: null,
        checkoutUrl: null,
        totalAmount: hold.totalAmount,
        walletAmount: hold.totalAmount,
        gatewayAmount: 0,
        currency: hold.currency,
        groupBookingId: fullPayment.groupBooking?.id,
        reservations: fullPayment.groupBooking?.reservations,
      };
    }

    // Partial Wallet or Gateway Checkout Scenario
    const isPartialWallet = Boolean(input.useWallet && customerAccount && availableBalance > 0);
    const walletContribution = isPartialWallet ? Math.min(availableBalance, hold.totalAmount) : 0;
    const gatewayAmount = hold.totalAmount - walletContribution;

    // 3. Resolve provider & initiate payment
    const providerName = input.provider;
    const provider = PaymentProviderFactory.getProvider(providerName);

    const payment = await PaymentsRepo.transaction(async (tx) => {
      if (input.idempotencyKey) {
        const priorPayment = await tx.payment.findFirst({
          where: {
            gamingCenterId: hold.gamingCenterId,
            idempotencyKey: input.idempotencyKey,
            status: { in: [PaymentStatus.FAILED] },
          },
        });
        if (priorPayment) {
          await tx.payment.update({
            where: { id: priorPayment.id },
            data: { idempotencyKey: `archived_${priorPayment.id}_${Date.now()}` },
          });
        }
      }

      if (walletContribution > 0 && customerAccount) {
        await tx.customerAccount.update({
          where: { id: customerAccount.id },
          data: { walletBalance: { decrement: walletContribution } },
        });
      }

      const p = await tx.payment.create({
        data: {
          gamingCenterId: hold.gamingCenterId,
          bookingHoldId: hold.id,
          amount: hold.totalAmount,
          walletAmount: walletContribution,
          currency: hold.currency,
          provider: provider.name as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          method: walletContribution > 0 ? PaymentMethod.ONLINE : PaymentMethod.ONLINE,
          status: PaymentStatus.INITIATED,
          idempotencyKey: input.idempotencyKey,
        },
      });

      if (walletContribution > 0 && customerAccount) {
        await tx.walletTransaction.create({
          data: {
            customerAccountId: customerAccount.id,
            amount: -walletContribution,
            currency: hold.currency,
            type: WalletTransactionType.RESERVATION_PAYMENT,
            paymentId: p.id,
            note: `کسر سهم کیف پول برای هولد رزرو گروهی ${hold.id}`,
            idempotencyKey: input.idempotencyKey ? `wallet_debit:${input.idempotencyKey}` : undefined,
          },
        });
      }

      return p;
    });

    // 4. Generate payment gateway request
    try {
      const callbackUrl = provider.name === 'ZIBAL' ? process.env.ZIBAL_CALLBACK_URL : process.env.ZARINPAL_CALLBACK_URL;
      const initiateResult = await provider.initiatePayment({
        amount: gatewayAmount,
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
        walletAmount: walletContribution,
        gatewayAmount,
        currency: hold.currency,
      };
    } catch (error) {
      logger.error({ error, holdId: hold.id, paymentId: payment.id }, 'Payment gateway initiation failed; releasing hold');

      // Fail payment & restore deducted wallet funds & release hold consistently
      await PaymentsRepo.transaction(async (tx) => {
        await PaymentsRepo.handleFailedPayment(
          tx,
          payment.id,
          PaymentStatus.FAILED,
          error instanceof Error ? error.message : 'Gateway initiation failed'
        );
      });

      if (error instanceof AppError) throw error;
      const gatewayReason = error instanceof Error ? error.message : 'Payment gateway request failed';
      throw new AppError(`Failed to initiate payment gateway request: ${gatewayReason}`, httpStatus.BAD_GATEWAY, {
        code: 'PAYMENT_GATEWAY_ERROR',
        details: { holdId: hold.id, paymentId: payment.id, error: gatewayReason },
      });
    }
  },
};
