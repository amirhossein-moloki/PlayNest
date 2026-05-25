import { Prisma, ReservationPaymentState, PaymentStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { validateBookingTransition, validatePaymentTransition } from './payments.state';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { commissionsService } from '../commissions/commissions.station';
import { WalletService } from '../wallet/wallet.station';

type Tx = Prisma.TransactionClient;

const findBookingForUpdate = (reservationId: string, gamingCenterId: string) => {
  return prisma.reservation.findFirst({
    where: { id: reservationId, gamingCenterId },
  });
};

const createPaymentAndUpdateBooking = ({
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

const handleSuccessfulPayment = async (tx: Tx, paymentId: string) => {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    include: { reservation: true },
  });

  if (!payment) {
    throw new AppError('Payment not found.', httpStatus.NOT_FOUND);
  }

  // Idempotency check: If already paid, do nothing.
  if (payment.status === PaymentStatus.PAID && payment.reservation.paymentState === ReservationPaymentState.PAID) {
    return;
  }

  // Validate state transitions
  validatePaymentTransition(payment.status, PaymentStatus.PAID);

  try {
    validateBookingTransition(payment.reservation.paymentState, ReservationPaymentState.PAID);

    // Update records
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.PAID, paidAt: new Date() },
    });

    await tx.reservation.update({
      where: { id: payment.reservationId },
      data: { paymentState: ReservationPaymentState.PAID },
    });
  } catch (error) {
    if (error instanceof AppError && error.statusCode === httpStatus.CONFLICT) {
      // If reservation is in a state that doesn't allow transitioning to PAID (e.g., CANCELED)
      // we still mark the payment as PAID but immediately refund it to the wallet.
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.PAID, paidAt: new Date() },
      });

      await WalletService.refundBookingToWallet(payment.reservationId, tx);
      return;
    }
    throw error;
  }

  // Trigger commission calculation (async, non-blocking for the transaction)
  // We use the reservationId from the payment record
  commissionsService.calculateCommission(payment.reservationId).catch((err) => {
    console.error('Failed to calculate commission for reservation after payment:', payment.reservationId, err);
  });
};

const handleFailedPayment = async (
  tx: Tx,
  paymentId: string,
  newStatus: PaymentStatus = PaymentStatus.FAILED
) => {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    include: { reservation: true },
  });

  if (!payment) {
    throw new AppError('Payment not found.', httpStatus.NOT_FOUND);
  }

  // Idempotency check: If already in a final failed/canceled state, do nothing.
  if (payment.status === newStatus) {
    return;
  }

  // Validate state transitions
  const newBookingState = newStatus === PaymentStatus.CANCELED ? ReservationPaymentState.CANCELED : ReservationPaymentState.FAILED;
  validatePaymentTransition(payment.status, newStatus);
  validateBookingTransition(payment.reservation.paymentState, newBookingState);

  // Update records
  await tx.payment.update({
    where: { id: paymentId },
    data: { status: newStatus },
  });

  await tx.reservation.update({
    where: { id: payment.reservationId },
    data: { paymentState: newBookingState },
  });
};

const updatePayment = (paymentId: string, data: Prisma.PaymentUpdateInput) => {
  return prisma.payment.update({
    where: { id: paymentId },
    data,
  });
};

export const PaymentsRepo = {
  findBookingForUpdate,
  createPaymentAndUpdateBooking,
  handleSuccessfulPayment,
  handleFailedPayment,
  updatePayment,
  transaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(fn),
};
