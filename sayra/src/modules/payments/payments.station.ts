import { ReservationPaymentState, PaymentProvider, PaymentStatus, ReservationStatus, SessionActorType } from '@prisma/client';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { PaymentsRepo } from './payments.repo';
import { env } from '../../config/env';
import { PaymentProviderFactory } from './providers';
import { calculatePaymentSplit } from './payment-calculation';
import { prisma } from '../../config/prisma';
import { RequestActor } from '../../types/express';

const mapProviderEnum = (providerName: string): PaymentProvider => {
  const upper = providerName.toUpperCase();
  if (upper === 'ZARINPAL') return PaymentProvider.ZARINPAL;
  if (upper === 'ZIBAL') return PaymentProvider.ZIBAL;
  if (upper === 'STRIPE') return PaymentProvider.STRIPE;
  return PaymentProvider.MANUAL;
};

const initiatePayment = async ({
  gamingCenterId,
  reservationId,
  idempotencyKey,
  providerName,
  useWallet,
  actor,
}: {
  gamingCenterId: string;
  reservationId: string;
  idempotencyKey: string | null;
  providerName?: string;
  useWallet?: boolean;
  actor?: RequestActor;
}) => {
  // 1. Fetch the reservation
  const reservation = await PaymentsRepo.findReservationForUpdate(reservationId, gamingCenterId);

  if (!reservation) {
    throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
  }

  // Security check: Customer can only pay for their own reservation
  if (
    actor?.actorType === SessionActorType.CUSTOMER &&
    reservation.customerAccountId &&
    reservation.customerAccountId !== actor.id
  ) {
    throw new AppError('Unauthorized access to reservation payment.', httpStatus.FORBIDDEN);
  }

  // 2. Validate reservation state and payment eligibility
  if (reservation.paymentState === ReservationPaymentState.PAID) {
    throw new AppError('Reservation is already paid.', httpStatus.CONFLICT);
  }

  if (reservation.status === ReservationStatus.CANCELED || reservation.status === ReservationStatus.EXPIRED) {
    throw new AppError('Reservation is canceled or expired and cannot be paid.', httpStatus.BAD_REQUEST);
  }

  // 3. Trusted server-side price & currency calculation (Backend Authority & Legacy Compatibility)
  // Prefers validated customerPayableAmount, with graceful fallback to totalPrice for legacy reservations
  const payableCandidate = typeof reservation.customerPayableAmount === 'number' && reservation.customerPayableAmount > 0
    ? reservation.customerPayableAmount
    : reservation.totalPrice;

  const calculatedAmount = Math.round(payableCandidate);
  if (calculatedAmount <= 0) {
    throw new AppError('Invalid reservation payable amount for payment.', httpStatus.BAD_REQUEST);
  }

  const snapshotCurrency = (reservation.stationSnapshot as Record<string, unknown>)?.currency as string | undefined;
  const currency = snapshotCurrency || 'IRR';

  // 4. Resolve customer wallet balance
  let availableWalletBalance = 0;
  if (reservation.customerAccountId) {
    const customerAccount = await prisma.customerAccount.findUnique({
      where: { id: reservation.customerAccountId },
      select: { walletBalance: true },
    });
    availableWalletBalance = customerAccount?.walletBalance ?? 0;
  }

  // 5. Calculate payment split
  const paymentSplit = calculatePaymentSplit({
    payableAmount: calculatedAmount,
    walletBalance: availableWalletBalance,
    useWallet: Boolean(useWallet),
    currency,
  });

  // Scenario A: Full Wallet Payment (No external gateway needed)
  if (paymentSplit.coversEntireAmount && reservation.customerAccountId) {
    const { payment } = await PaymentsRepo.createFullWalletPayment({
      reservationId,
      gamingCenterId,
      customerAccountId: reservation.customerAccountId,
      amount: paymentSplit.totalAmount,
      currency,
      idempotencyKey,
    });

    return {
      paymentId: payment.id,
      paymentStatus: payment.status,
      totalAmount: paymentSplit.totalAmount,
      walletAmount: paymentSplit.walletContribution,
      gatewayAmount: 0,
      checkoutUrl: null,
      message: 'Payment completed successfully using wallet balance.',
    };
  }

  // Resolve provider strategy for external gateway portion
  const provider = PaymentProviderFactory.getProvider(providerName);
  const prismaProvider = mapProviderEnum(provider.name);

  // Scenario B: Partial Wallet Payment (Wallet + External gateway)
  if (paymentSplit.walletContribution > 0 && reservation.customerAccountId) {
    const { payment } = await PaymentsRepo.createPartialPayment({
      reservationId,
      gamingCenterId,
      customerAccountId: reservation.customerAccountId,
      totalAmount: paymentSplit.totalAmount,
      walletContribution: paymentSplit.walletContribution,
      currency,
      provider: prismaProvider,
      idempotencyKey,
    });

    try {
      const callbackUrl = provider.name === 'ZIBAL' ? env.ZIBAL_CALLBACK_URL : env.ZARINPAL_CALLBACK_URL;
      const initiateResult = await provider.initiatePayment({
        amount: paymentSplit.gatewayAmount,
        currency,
        description: `Reservation ${reservation.id} - ${gamingCenterId}`,
        callbackUrl,
        reservationId: reservation.id,
        gamingCenterId,
      });

      // Save provider reference
      await PaymentsRepo.updatePayment(payment.id, {
        providerPaymentId: initiateResult.providerPaymentId,
        providerCheckoutId: initiateResult.providerCheckoutId,
      });

      return {
        paymentId: payment.id,
        paymentStatus: payment.status,
        totalAmount: paymentSplit.totalAmount,
        walletAmount: paymentSplit.walletContribution,
        gatewayAmount: paymentSplit.gatewayAmount,
        providerPaymentId: initiateResult.providerPaymentId,
        checkoutUrl: initiateResult.checkoutUrl,
      };
    } catch (error) {
      // Record payment failure if initiation fails, restoring deducted wallet funds atomically
      await PaymentsRepo.transaction(async (tx) => {
        await PaymentsRepo.handleFailedPayment(
          tx,
          payment.id,
          PaymentStatus.FAILED,
          error instanceof Error ? error.message : 'Provider initiation failed'
        );
      });

      if (error instanceof AppError) throw error;
      console.error('Payment initiation error:', error);
      throw new AppError('Internal error during payment initiation.', httpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Scenario C & D: External gateway only (Wallet disabled or empty)
  const { payment } = await PaymentsRepo.createPaymentAndUpdateReservation({
    reservationId,
    paymentData: {
      gamingCenter: { connect: { id: gamingCenterId } },
      reservation: { connect: { id: reservationId } },
      amount: paymentSplit.totalAmount,
      walletAmount: 0,
      currency,
      provider: prismaProvider,
      status: PaymentStatus.INITIATED,
      idempotencyKey,
    },
  });

  try {
    const callbackUrl = provider.name === 'ZIBAL' ? env.ZIBAL_CALLBACK_URL : env.ZARINPAL_CALLBACK_URL;
    const initiateResult = await provider.initiatePayment({
      amount: paymentSplit.gatewayAmount,
      currency,
      description: `Reservation ${reservation.id} - ${gamingCenterId}`,
      callbackUrl,
      reservationId: reservation.id,
      gamingCenterId,
    });

    await PaymentsRepo.updatePayment(payment.id, {
      providerPaymentId: initiateResult.providerPaymentId,
      providerCheckoutId: initiateResult.providerCheckoutId,
    });

    return {
      paymentId: payment.id,
      paymentStatus: payment.status,
      totalAmount: paymentSplit.totalAmount,
      walletAmount: 0,
      gatewayAmount: paymentSplit.gatewayAmount,
      providerPaymentId: initiateResult.providerPaymentId,
      checkoutUrl: initiateResult.checkoutUrl,
    };
  } catch (error) {
    await PaymentsRepo.transaction(async (tx) => {
      await PaymentsRepo.handleFailedPayment(
        tx,
        payment.id,
        PaymentStatus.FAILED,
        error instanceof Error ? error.message : 'Provider initiation failed'
      );
    });

    if (error instanceof AppError) throw error;
    console.error('Payment initiation error:', error);
    throw new AppError('Internal error during payment initiation.', httpStatus.INTERNAL_SERVER_ERROR);
  }
};

const verifyPayment = async ({
  gamingCenterId,
  reservationId,
  authority,
  status,
  providerName,
}: {
  gamingCenterId: string;
  reservationId: string;
  authority?: string;
  status?: string;
  providerName?: string;
}) => {
  // 1. Resolve payment record by authority or latest payment for reservation/hold
  const payment = authority
    ? await PaymentsRepo.findPaymentByProviderPaymentId(authority)
    : await PaymentsRepo.findLatestPaymentByEntity(reservationId, gamingCenterId);

  if (!payment) {
    throw new AppError('Payment record not found.', httpStatus.NOT_FOUND);
  }

  if (payment.gamingCenterId !== gamingCenterId) {
    throw new AppError('Payment does not belong to the specified gaming center.', httpStatus.FORBIDDEN);
  }

  // 2. Idempotency check: If already paid, return existing success state
  if (payment.status === PaymentStatus.PAID) {
    return {
      success: true,
      paymentId: payment.id,
      paymentStatus: PaymentStatus.PAID,
      totalAmount: payment.amount,
      walletAmount: payment.walletAmount || 0,
      gatewayAmount: payment.amount - (payment.walletAmount || 0),
      referenceCode: payment.referenceCode,
      message: 'Payment already verified.',
    };
  }

  // 3. User cancellation or gateway error return check
  const isExplicitFailure = status && (status.toUpperCase() === 'NOK' || status.toUpperCase() === 'FAILED' || status.toUpperCase() === 'CANCELLED');
  if (isExplicitFailure) {
    const updated = await PaymentsRepo.transaction(async (tx) => {
      return PaymentsRepo.handleFailedPayment(tx, payment.id, PaymentStatus.FAILED, 'Gateway returned non-OK status');
    });

    return {
      success: false,
      paymentId: payment.id,
      paymentStatus: updated.status,
      totalAmount: updated.amount,
      walletAmount: updated.walletAmount || 0,
      gatewayAmount: updated.amount - (updated.walletAmount || 0),
      failureReason: 'Payment canceled or rejected by user/gateway.',
    };
  }

  // 4. Server-to-server verification with provider
  const provider = PaymentProviderFactory.getProvider(providerName || payment.provider);
  const providerAuthority = authority || payment.providerPaymentId;

  if (!providerAuthority) {
    throw new AppError('Missing provider payment authority for verification.', httpStatus.BAD_REQUEST);
  }

  const gatewayExpectedAmount = payment.amount - (payment.walletAmount || 0);

  const verifyResult = await provider.verifyPayment({
    authority: providerAuthority,
    amount: gatewayExpectedAmount,
    metadata: {
      orderId: payment.reservationId || payment.bookingHoldId || payment.id,
      reservationId: payment.reservationId,
      paymentId: payment.id,
    },
  });

  // 5. Atomic database status update based on provider result
  const finalPayment = await PaymentsRepo.transaction(async (tx) => {
    if (verifyResult.success) {
      const updated = await PaymentsRepo.handleSuccessfulPayment(tx, payment.id, verifyResult.refId);

      // If linked to BookingHold, convert to reservations atomically inside same transaction or right after
      if (payment.bookingHoldId) {
        const { BookingHoldStation } = await import('../booking-hold/booking-hold.station');
        await BookingHoldStation.convertHoldToReservations(payment.bookingHoldId, payment.id, tx);
      }

      return updated;
    } else {
      return PaymentsRepo.handleFailedPayment(
        tx,
        payment.id,
        verifyResult.status,
        verifyResult.failureReason
      );
    }
  });

  return {
    success: verifyResult.success,
    paymentId: payment.id,
    paymentStatus: finalPayment.status,
    totalAmount: finalPayment.amount,
    walletAmount: finalPayment.walletAmount || 0,
    gatewayAmount: finalPayment.amount - (finalPayment.walletAmount || 0),
    referenceCode: finalPayment.referenceCode,
    failureReason: finalPayment.failureReason,
  };
};

const calculatePayment = async ({
  gamingCenterId,
  reservationId,
  useWallet,
  actor,
}: {
  gamingCenterId: string;
  reservationId: string;
  useWallet?: boolean;
  actor?: RequestActor;
}) => {
  const reservation = await PaymentsRepo.findReservationForUpdate(reservationId, gamingCenterId);

  if (!reservation) {
    throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
  }

  if (
    actor?.actorType === SessionActorType.CUSTOMER &&
    reservation.customerAccountId &&
    reservation.customerAccountId !== actor.id
  ) {
    throw new AppError('Unauthorized access to reservation payment.', httpStatus.FORBIDDEN);
  }

  const payableCandidate = typeof reservation.customerPayableAmount === 'number' && reservation.customerPayableAmount > 0
    ? reservation.customerPayableAmount
    : reservation.totalPrice;

  const totalAmount = Math.round(payableCandidate);
  if (totalAmount <= 0) {
    throw new AppError('Invalid reservation payable amount for payment.', httpStatus.BAD_REQUEST);
  }

  const snapshotCurrency = (reservation.stationSnapshot as Record<string, unknown>)?.currency as string | undefined;
  const currency = snapshotCurrency || 'IRR';

  let walletBalance = 0;
  if (reservation.customerAccountId) {
    const customerAccount = await prisma.customerAccount.findUnique({
      where: { id: reservation.customerAccountId },
      select: { walletBalance: true },
    });
    walletBalance = customerAccount?.walletBalance ?? 0;
  }

  const calculation = calculatePaymentSplit({
    payableAmount: totalAmount,
    walletBalance,
    useWallet: Boolean(useWallet),
    currency,
  });

  return {
    reservationId,
    totalAmount: calculation.totalAmount,
    walletBalance: calculation.walletBalance,
    walletContribution: calculation.walletContribution,
    gatewayAmount: calculation.gatewayAmount,
    currency: calculation.currency,
    useWallet: Boolean(useWallet),
    coversEntireAmount: calculation.coversEntireAmount,
  };
};

const getPaymentStatus = async ({
  gamingCenterId,
  reservationId,
}: {
  gamingCenterId: string;
  reservationId: string;
}) => {
  const payment = await PaymentsRepo.findLatestPaymentByReservation(reservationId, gamingCenterId);

  if (!payment) {
    throw new AppError('No payment record found for this reservation.', httpStatus.NOT_FOUND);
  }

  return {
    paymentId: payment.id,
    status: payment.status,
    totalAmount: payment.amount,
    walletAmount: payment.walletAmount || 0,
    gatewayAmount: payment.amount - (payment.walletAmount || 0),
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    provider: payment.provider,
    referenceCode: payment.referenceCode,
    failureReason: payment.failureReason,
    reservationPaymentState: payment.reservation?.paymentState,
    reservationStatus: payment.reservation?.status,
    createdAt: payment.createdAt,
    paidAt: payment.paidAt,
  };
};

export const PaymentsStation = {
  initiatePayment,
  verifyPayment,
  calculatePayment,
  getPaymentStatus,
};
