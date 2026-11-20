import { Prisma, ReservationPaymentState, PaymentStatus, ReservationStatus, PaymentMethod, PaymentProvider, WalletTransactionType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import logger from '../../config/logger';
import { validateReservationTransition, validatePaymentTransition } from './payments.state';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { commissionsStation } from '../commissions/commissions.station';
import { LedgerRepo } from './ledger.repo';
import { walletService } from '../wallet/wallet.station';

type Tx = Prisma.TransactionClient;

const findReservationForUpdate = (reservationId: string, gamingCenterId?: string) => {
  return prisma.reservation.findFirst({
    where: {
      id: reservationId,
      ...(gamingCenterId ? { gamingCenterId } : {}),
    },
    include: {
      customerAccount: true,
    },
  });
};

const findPaymentByProviderPaymentId = (providerPaymentId: string) => {
  return prisma.payment.findFirst({
    where: { providerPaymentId },
    include: { reservation: true, bookingHold: true, groupBooking: true },
  });
};

const findLatestPaymentByReservation = (reservationId: string, gamingCenterId: string) => {
  return prisma.payment.findFirst({
    where: { reservationId, gamingCenterId },
    orderBy: { createdAt: 'desc' },
    include: { reservation: true },
  });
};

const findLatestPaymentByEntity = (entityId: string, gamingCenterId: string) => {
  return prisma.payment.findFirst({
    where: {
      OR: [
        { reservationId: entityId, gamingCenterId },
        { bookingHoldId: entityId, gamingCenterId },
        { id: entityId, gamingCenterId },
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: { reservation: true, bookingHold: true, groupBooking: true },
  });
};

const createPaymentAndUpdateReservation = ({
  reservationId,
  paymentData,
}: {
  reservationId: string;
  paymentData: Prisma.PaymentCreateInput;
}) => {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({ data: paymentData });
    const reservation = await tx.reservation.update({
      where: { id: reservationId },
      data: { paymentState: ReservationPaymentState.PENDING },
    });

    return { payment, reservation };
  });
};

const createFullWalletPayment = async ({
  reservationId,
  gamingCenterId,
  customerAccountId,
  amount,
  currency,
  idempotencyKey,
}: {
  reservationId: string;
  gamingCenterId: string;
  customerAccountId: string;
  amount: number;
  currency: string;
  idempotencyKey: string | null;
}) => {
  return prisma.$transaction(async (tx) => {
    // 1. Lock CustomerAccount and Reservation row
    if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === 'function') {
      await tx.$executeRaw`SELECT id FROM "CustomerAccount" WHERE id = ${customerAccountId} FOR UPDATE`;
      await tx.$executeRaw`SELECT id FROM "Reservation" WHERE id = ${reservationId} FOR UPDATE`;
    }

    const account = await tx.customerAccount.findUnique({
      where: { id: customerAccountId },
      select: { id: true, walletBalance: true },
    });
    if (!account || account.walletBalance < amount) {
      throw new AppError('Insufficient wallet balance.', httpStatus.BAD_REQUEST, {
        code: 'INSUFFICIENT_WALLET_BALANCE',
      });
    }

    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, status: true, paymentState: true },
    });
    if (!reservation) {
      throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
    }
    if (reservation.paymentState === ReservationPaymentState.PAID) {
      throw new AppError('Reservation is already paid.', httpStatus.CONFLICT);
    }

    // 2. Decrement wallet balance atomically
    await tx.customerAccount.update({
      where: { id: customerAccountId },
      data: { walletBalance: { decrement: amount } },
    });

    // 3. Create Payment record for full wallet payment
    const payment = await tx.payment.create({
      data: {
        gamingCenter: { connect: { id: gamingCenterId } },
        reservation: { connect: { id: reservationId } },
        amount,
        walletAmount: amount,
        currency,
        provider: PaymentProvider.MANUAL,
        method: PaymentMethod.WALLET,
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        referenceCode: `WALLET-${reservationId.slice(-8).toUpperCase()}`,
        idempotencyKey,
      },
    });

    // 4. Create WalletTransaction for the full wallet deduction
    await tx.walletTransaction.create({
      data: {
        customerAccountId,
        amount: -amount,
        currency,
        type: WalletTransactionType.RESERVATION_PAYMENT,
        reservationId,
        paymentId: payment.id,
        note: `پرداخت کامل هزینه رزرو ${reservationId} از طریق کیف پول`,
        idempotencyKey: idempotencyKey ? `wallet_debit:${idempotencyKey}` : undefined,
      },
    });

    // 5. Update Reservation status
    const updateData: Prisma.ReservationUpdateInput = {
      paymentState: ReservationPaymentState.PAID,
    };
    if (reservation.status === ReservationStatus.PENDING) {
      updateData.status = ReservationStatus.CONFIRMED;
    }
    const updatedReservation = await tx.reservation.update({
      where: { id: reservationId },
      data: updateData,
    });

    // 6. Record Ledger Entry
    await LedgerRepo.createCollectionEntry(tx, {
      gamingCenterId,
      paymentId: payment.id,
      amount,
      currency,
      description: `Wallet payment collection for reservation ${reservationId}`,
    });

    // 7. Commission calculation
    await commissionsStation.calculateCommission(reservationId, tx).catch((err) => {
      logger.error({ err, reservationId }, 'Failed to calculate commission after wallet payment');
    });

    return { payment, reservation: updatedReservation };
  });
};

const createPartialPayment = async ({
  reservationId,
  gamingCenterId,
  customerAccountId,
  totalAmount,
  walletContribution,
  currency,
  provider,
  idempotencyKey,
}: {
  reservationId: string;
  gamingCenterId: string;
  customerAccountId: string;
  totalAmount: number;
  walletContribution: number;
  currency: string;
  provider: PaymentProvider;
  idempotencyKey: string | null;
}) => {
  return prisma.$transaction(async (tx) => {
    // 1. Lock CustomerAccount and Reservation row
    if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === 'function') {
      await tx.$executeRaw`SELECT id FROM "CustomerAccount" WHERE id = ${customerAccountId} FOR UPDATE`;
      await tx.$executeRaw`SELECT id FROM "Reservation" WHERE id = ${reservationId} FOR UPDATE`;
    }

    const account = await tx.customerAccount.findUnique({
      where: { id: customerAccountId },
      select: { id: true, walletBalance: true },
    });
    if (!account || account.walletBalance < walletContribution) {
      throw new AppError('Insufficient wallet balance.', httpStatus.BAD_REQUEST, {
        code: 'INSUFFICIENT_WALLET_BALANCE',
      });
    }

    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, status: true, paymentState: true },
    });
    if (!reservation) {
      throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
    }
    if (reservation.paymentState === ReservationPaymentState.PAID) {
      throw new AppError('Reservation is already paid.', httpStatus.CONFLICT);
    }

    // 2. Decrement wallet balance for partial wallet contribution
    await tx.customerAccount.update({
      where: { id: customerAccountId },
      data: { walletBalance: { decrement: walletContribution } },
    });

    // 3. Create Payment record with total amount, storing walletAmount
    const payment = await tx.payment.create({
      data: {
        gamingCenter: { connect: { id: gamingCenterId } },
        reservation: { connect: { id: reservationId } },
        amount: totalAmount,
        walletAmount: walletContribution,
        currency,
        provider,
        method: PaymentMethod.ONLINE,
        status: PaymentStatus.INITIATED,
        idempotencyKey,
      },
    });

    // 4. Create WalletTransaction for wallet deduction
    await tx.walletTransaction.create({
      data: {
        customerAccountId,
        amount: -walletContribution,
        currency,
        type: WalletTransactionType.RESERVATION_PAYMENT,
        reservationId,
        paymentId: payment.id,
        note: `پرداخت سهم کیف پول برای رزرو ${reservationId}`,
        idempotencyKey: idempotencyKey ? `wallet_debit:${idempotencyKey}` : undefined,
      },
    });

    // 5. Update Reservation payment state to PENDING
    const updatedReservation = await tx.reservation.update({
      where: { id: reservationId },
      data: { paymentState: ReservationPaymentState.PENDING },
    });

    return { payment, reservation: updatedReservation };
  });
};

const handleSuccessfulPayment = async (tx: Tx, paymentId: string, refId?: string) => {
  // Lock Reservation (first) and Payment (second) to serialize with concurrent cancellations/expirations
  if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === 'function') {
    const initialPayment = await tx.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, reservationId: true },
    });

    if (!initialPayment) {
      throw new AppError('Payment not found.', httpStatus.NOT_FOUND);
    }

    if (initialPayment.reservationId) {
      await tx.$executeRaw`SELECT id FROM "Reservation" WHERE id = ${initialPayment.reservationId} FOR UPDATE`;
    }
    await tx.$executeRaw`SELECT id FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;
  }

  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    include: { reservation: true, bookingHold: true, groupBooking: true },
  });

  if (!payment) {
    throw new AppError('Payment not found.', httpStatus.NOT_FOUND);
  }

  // Idempotency check: If already refunded, do nothing.
  if (payment.status === PaymentStatus.REFUNDED) {
    return payment;
  }

  // Idempotency check: If already paid
  if (payment.status === PaymentStatus.PAID) {
    if (
      payment.reservationId &&
      payment.reservation &&
      (payment.reservation.status === ReservationStatus.CANCELED ||
        payment.reservation.status === ReservationStatus.EXPIRED)
    ) {
      await walletService.refundReservationToWallet(payment.reservationId, tx);
      const refreshed = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { reservation: true, bookingHold: true, groupBooking: true },
      });
      return refreshed || payment;
    }

    if (!payment.reservation || payment.reservation.paymentState === ReservationPaymentState.PAID) {
      return payment;
    }
  }

  // Validate state transitions for Payment
  validatePaymentTransition(payment.status, PaymentStatus.PAID);

  if (!payment.reservation) {
    const updatedPaymentNoRes = await tx.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.PAID, paidAt: new Date(), referenceCode: refId || payment.referenceCode },
    });

    await LedgerRepo.createCollectionEntry(tx, {
      gamingCenterId: payment.gamingCenterId,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      description: `Payment collection for ${payment.id}`,
    });

    return updatedPaymentNoRes;
  }

  // Handle case where reservation was cancelled or expired before payment succeeded
  if (
    payment.reservation.status === ReservationStatus.CANCELED ||
    payment.reservation.status === ReservationStatus.EXPIRED
  ) {
    logger.warn(
      { paymentId, reservationId: payment.reservationId, reservationStatus: payment.reservation.status },
      `Payment succeeded for ${payment.reservation.status} reservation. Payment marked PAID and refunding to customer wallet.`
    );

    const updatedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        referenceCode: refId || payment.referenceCode,
        failureReason: `Paid after reservation ${payment.reservation.status.toLowerCase()}; refunded to wallet`,
      },
    });

    await LedgerRepo.createCollectionEntry(tx, {
      gamingCenterId: payment.gamingCenterId,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      description: `Payment collection for ${payment.id} (Reservation ${payment.reservation.status.toLowerCase()})`,
    });

    await walletService.refundReservationToWallet(payment.reservationId!, tx);

    const refreshedPayment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { reservation: true, bookingHold: true, groupBooking: true },
    });

    return refreshedPayment || updatedPayment;
  }

  // Active reservation path: Validate state transition for Reservation
  if (payment.reservation.paymentState !== ReservationPaymentState.PAID) {
    validateReservationTransition(payment.reservation.paymentState, ReservationPaymentState.PAID);
  }

  const updatedPayment = await tx.payment.update({
    where: { id: paymentId },
    data: {
      status: PaymentStatus.PAID,
      paidAt: new Date(),
      referenceCode: refId || payment.referenceCode,
    },
  });

  const updateData: Prisma.ReservationUpdateInput = {
    paymentState: ReservationPaymentState.PAID,
  };

  if (payment.reservation.status === ReservationStatus.PENDING) {
    updateData.status = ReservationStatus.CONFIRMED;
  }

  await tx.reservation.update({
    where: { id: payment.reservationId! },
    data: updateData,
  });

  const totalCollectedAmount = payment.amount;

  await LedgerRepo.createCollectionEntry(tx, {
    gamingCenterId: payment.gamingCenterId,
    paymentId: payment.id,
    amount: totalCollectedAmount,
    currency: payment.currency,
    description: `Payment collection for reservation ${payment.reservationId}`,
  });

  // Trigger commission calculation within transaction
  await commissionsStation.calculateCommission(payment.reservationId!, tx).catch((err) => {
    console.error('Failed to calculate commission for reservation after payment:', payment.reservationId, err);
  });

  return updatedPayment;
};

const handleFailedPayment = async (
  tx: Tx,
  paymentId: string,
  newStatus: PaymentStatus = PaymentStatus.FAILED,
  failureReason?: string
) => {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    include: { reservation: true },
  });

  if (!payment) {
    throw new AppError('Payment not found.', httpStatus.NOT_FOUND);
  }

  // Idempotency check: If already in target status, do nothing.
  if (payment.status === newStatus) {
    return payment;
  }

  validatePaymentTransition(payment.status, newStatus);

  const updatedPayment = await tx.payment.update({
    where: { id: paymentId },
    data: {
      status: newStatus,
      failureReason: failureReason || payment.failureReason,
    },
  });

  // If payment had a wallet contribution deducted, restore it safely and idempotently!
  if (payment.walletAmount > 0 && payment.reservation?.customerAccountId) {
    const existingFailureRefund = await tx.walletTransaction.findFirst({
      where: {
        paymentId: payment.id,
        type: WalletTransactionType.REFUND,
      },
    });

    if (!existingFailureRefund) {
      await tx.customerAccount.update({
        where: { id: payment.reservation.customerAccountId },
        data: {
          walletBalance: { increment: payment.walletAmount },
        },
      });

      await tx.walletTransaction.create({
        data: {
          customerAccountId: payment.reservation.customerAccountId,
          amount: payment.walletAmount,
          currency: payment.currency,
          type: WalletTransactionType.REFUND,
          paymentId: payment.id,
          reservationId: payment.reservationId,
          note: `استرداد سهم کسر شده از کیف پول به علت ناموفق بودن پرداخت درگاه ${payment.id}`,
        },
      });

      logger.info({
        msg: 'Restored wallet contribution after payment failure',
        paymentId: payment.id,
        reservationId: payment.reservationId,
        walletRestoredAmount: payment.walletAmount,
      });
    }
  }

  if (payment.bookingHoldId) {
    await tx.bookingHold.updateMany({
      where: { id: payment.bookingHoldId, status: 'ACTIVE' },
      data: { status: 'RELEASED' },
    });
  }

  if (payment.reservation && payment.reservation.paymentState !== ReservationPaymentState.PAID) {
    const newReservationPaymentState =
      newStatus === PaymentStatus.CANCELED
        ? ReservationPaymentState.CANCELED
        : ReservationPaymentState.FAILED;

    try {
      validateReservationTransition(payment.reservation.paymentState, newReservationPaymentState);

      const isTerminal =
        payment.reservation.status === ReservationStatus.CANCELED ||
        payment.reservation.status === ReservationStatus.COMPLETED;

      const updateData: Prisma.ReservationUpdateInput = {
        paymentState: newReservationPaymentState,
      };

      if (!isTerminal) {
        updateData.status = ReservationStatus.CANCELED;
        updateData.canceledAt = new Date();
        updateData.cancelReason = failureReason || 'لغو خودکار به دلیل ناموفق بودن پرداخت';
      }

      await tx.reservation.update({
        where: { id: payment.reservationId! },
        data: updateData,
      });

      if (!isTerminal && typeof (tx as unknown as { reservationHistory?: { create: unknown } }).reservationHistory?.create === 'function') {
        await tx.reservationHistory.create({
          data: {
            reservationId: payment.reservationId!,
            fromStatus: payment.reservation.status,
            toStatus: ReservationStatus.CANCELED,
            action: 'CANCEL',
            reason: failureReason || 'لغو خودکار به دلیل عدم پرداخت / تراکنش ناموفق',
          },
        });
      }
    } catch (err) {
      logger.warn({ err, reservationId: payment.reservationId }, 'Failed to transition reservation state on payment failure');
    }
  }

  return updatedPayment;
};

const updatePayment = (paymentId: string, data: Prisma.PaymentUpdateInput) => {
  return prisma.payment.update({
    where: { id: paymentId },
    data,
  });
};

export const PaymentsRepo = {
  findReservationForUpdate,
  findPaymentByProviderPaymentId,
  findLatestPaymentByReservation,
  findLatestPaymentByEntity,
  createPaymentAndUpdateReservation,
  createFullWalletPayment,
  createPartialPayment,
  handleSuccessfulPayment,
  handleFailedPayment,
  updatePayment,
  transaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(fn),
};
