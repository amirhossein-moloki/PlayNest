import { ReservationPaymentState, PaymentProvider, PaymentStatus, ReservationStatus } from '@prisma/client';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { PaymentsRepo } from './payments.repo';
import { env } from '../../config/env';
import { PaymentProviderFactory } from './providers';

const mapProviderEnum = (providerName: string): PaymentProvider => {
  const upper = providerName.toUpperCase();
  if (upper === 'ZARINPAL') return PaymentProvider.ZARINPAL;
  if (upper === 'STRIPE') return PaymentProvider.STRIPE;
  return PaymentProvider.MANUAL;
};

const initiatePayment = async ({
  gamingCenterId,
  reservationId,
  idempotencyKey,
  providerName,
}: {
  gamingCenterId: string;
  reservationId: string;
  idempotencyKey: string | null;
  providerName?: string;
}) => {
  // 1. Fetch the reservation
  const reservation = await PaymentsRepo.findReservationForUpdate(reservationId, gamingCenterId);

  if (!reservation) {
    throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
  }

  // 2. Validate reservation state and payment eligibility
  if (reservation.paymentState === ReservationPaymentState.PAID) {
    throw new AppError('Reservation is already paid.', httpStatus.CONFLICT);
  }

  if (reservation.status === ReservationStatus.CANCELED || reservation.status === ReservationStatus.EXPIRED) {
    throw new AppError('Reservation is canceled or expired and cannot be paid.', httpStatus.BAD_REQUEST);
  }

  // 3. Trusted server-side price & currency calculation
  const calculatedAmount = Math.round(reservation.totalPrice);
  if (calculatedAmount <= 0) {
    throw new AppError('Invalid reservation total price for payment.', httpStatus.BAD_REQUEST);
  }

  const snapshotCurrency = (reservation.stationSnapshot as Record<string, unknown>)?.currency as string | undefined;
  const currency = snapshotCurrency || 'IRR';

  // 4. Resolve provider strategy
  const provider = PaymentProviderFactory.getProvider(providerName);
  const prismaProvider = mapProviderEnum(provider.name);

  // 5. Create durable payment record
  const { payment } = await PaymentsRepo.createPaymentAndUpdateReservation({
    reservationId,
    paymentData: {
      gamingCenter: { connect: { id: gamingCenterId } },
      reservation: { connect: { id: reservationId } },
      amount: calculatedAmount,
      currency,
      provider: prismaProvider,
      status: PaymentStatus.INITIATED,
      idempotencyKey,
    },
  });

  // 6. Initiate with external provider adapter
  try {
    const callbackUrl = env.ZARINPAL_CALLBACK_URL;
    const initiateResult = await provider.initiatePayment({
      amount: calculatedAmount,
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
      providerPaymentId: initiateResult.providerPaymentId,
      checkoutUrl: initiateResult.checkoutUrl,
    };
  } catch (error) {
    // Record payment failure if initiation fails
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
  // 1. Resolve payment record by authority or latest payment for reservation
  let payment = authority
    ? await PaymentsRepo.findPaymentByProviderPaymentId(authority)
    : await PaymentsRepo.findLatestPaymentByReservation(reservationId, gamingCenterId);

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
      failureReason: 'Payment canceled or rejected by user/gateway.',
    };
  }

  // 4. Server-to-server verification with provider
  const provider = PaymentProviderFactory.getProvider(providerName || payment.provider);
  const providerAuthority = authority || payment.providerPaymentId;

  if (!providerAuthority) {
    throw new AppError('Missing provider payment authority for verification.', httpStatus.BAD_REQUEST);
  }

  const verifyResult = await provider.verifyPayment({
    authority: providerAuthority,
    amount: payment.amount,
  });

  // 5. Atomic database status update based on provider result
  const finalPayment = await PaymentsRepo.transaction(async (tx) => {
    if (verifyResult.success) {
      return PaymentsRepo.handleSuccessfulPayment(tx, payment.id, verifyResult.refId);
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
    referenceCode: finalPayment.referenceCode,
    failureReason: finalPayment.failureReason,
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
    amount: payment.amount,
    currency: payment.currency,
    provider: payment.provider,
    referenceCode: payment.referenceCode,
    reservationPaymentState: payment.reservation?.paymentState,
    reservationStatus: payment.reservation?.status,
    createdAt: payment.createdAt,
    paidAt: payment.paidAt,
  };
};

export const PaymentsStation = {
  initiatePayment,
  verifyPayment,
  getPaymentStatus,
};
