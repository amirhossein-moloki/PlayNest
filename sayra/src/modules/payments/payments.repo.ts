import { Prisma, ReservationPaymentState, PaymentStatus, ReservationStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import logger from '../../config/logger';
import { validateReservationTransition, validatePaymentTransition } from './payments.state';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { commissionsStation } from '../commissions/commissions.station';
import { LedgerRepo } from './ledger.repo';
import { walletService } from '../wallet/wallet.station';

type Tx = Prisma.TransactionClient;

const findReservationForUpdate = (reservationId: string, gamingCenterId: string) => {
  return prisma.reservation.findFirst({
    where: { id: reservationId, gamingCenterId },
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

  await LedgerRepo.createCollectionEntry(tx, {
    gamingCenterId: payment.gamingCenterId,
    paymentId: payment.id,
    amount: payment.amount,
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
      await tx.reservation.update({
        where: { id: payment.reservationId! },
        data: { paymentState: newReservationPaymentState },
      });
    } catch {
      // Ignore transition error if reservation is already in a terminal payment state
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
  handleSuccessfulPayment,
  handleFailedPayment,
  updatePayment,
  transaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(fn),
};
