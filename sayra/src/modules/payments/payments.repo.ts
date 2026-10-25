import { Prisma, ReservationPaymentState, PaymentStatus, ReservationStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { validateReservationTransition, validatePaymentTransition } from './payments.state';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { commissionsStation } from '../commissions/commissions.station';
import { LedgerRepo } from './ledger.repo';

type Tx = Prisma.TransactionClient;

const findReservationForUpdate = (reservationId: string, gamingCenterId: string) => {
  return prisma.reservation.findFirst({
    where: { id: reservationId, gamingCenterId },
  });
};

const findPaymentByProviderPaymentId = (providerPaymentId: string) => {
  return prisma.payment.findFirst({
    where: { providerPaymentId },
    include: { reservation: true },
  });
};

const findLatestPaymentByReservation = (reservationId: string, gamingCenterId: string) => {
  return prisma.payment.findFirst({
    where: { reservationId, gamingCenterId },
    orderBy: { createdAt: 'desc' },
    include: { reservation: true },
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
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    include: { reservation: true },
  });

  if (!payment) {
    throw new AppError('Payment not found.', httpStatus.NOT_FOUND);
  }

  // Idempotency check: If already paid, do nothing.
  if (payment.status === PaymentStatus.PAID && payment.reservation?.paymentState === ReservationPaymentState.PAID) {
    return payment;
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
    console.warn(
      `Payment ${paymentId} succeeded for ${payment.reservation.status} reservation ${payment.reservationId}. Payment marked PAID for reconciliation without resurrecting reservation.`
    );

    const updatedPayment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        referenceCode: refId || payment.referenceCode,
        failureReason: `Paid after reservation ${payment.reservation.status.toLowerCase()}; logged for reconciliation`,
      },
    });

    await LedgerRepo.createCollectionEntry(tx, {
      gamingCenterId: payment.gamingCenterId,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      description: `Payment collection for ${payment.id} (Reservation ${payment.reservation.status.toLowerCase()})`,
    });

    return updatedPayment;
  }

  // Active reservation path: Validate state transition for Reservation
  validateReservationTransition(payment.reservation.paymentState, ReservationPaymentState.PAID);

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
  createPaymentAndUpdateReservation,
  handleSuccessfulPayment,
  handleFailedPayment,
  updatePayment,
  transaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(fn),
};
