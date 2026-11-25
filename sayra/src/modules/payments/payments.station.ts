import {
  ReservationPaymentState,
  PaymentProvider,
  PaymentStatus,
  Payment,
  ReservationStatus,
  SessionActorType,
  CancellationCategory,
  CancellationActor,
} from '@prisma/client';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { PaymentsRepo } from './payments.repo';
import { ReservationStateMachine } from '../reservation/reservation.state-machine';
import { env } from '../../config/env';
import { PaymentProviderFactory } from './providers';
import { calculatePaymentSplit } from './payment-calculation';
import { assertCustomerOwnsWallet, getAvailableWalletBalance } from '../wallet/wallet-access.guard';
import { prisma } from '../../config/prisma';
import logger from '../../config/logger';
import { RequestActor } from '../../types/express';
import { eventEmitter, AppEvents } from '../../common/events/event-emitter';

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

  // Idempotency check: If an idempotencyKey was provided, check for existing payment record
  if (idempotencyKey) {
    const existingPayment = typeof PaymentsRepo.findPaymentByIdempotencyKey === 'function'
      ? await PaymentsRepo.findPaymentByIdempotencyKey(gamingCenterId, idempotencyKey)
      : null;

    if (existingPayment) {
      if (existingPayment.status === PaymentStatus.PAID) {
        return {
          paymentId: existingPayment.id,
          paymentStatus: existingPayment.status,
          totalAmount: existingPayment.amount,
          walletAmount: existingPayment.walletAmount || 0,
          gatewayAmount: existingPayment.amount - (existingPayment.walletAmount || 0),
          checkoutUrl: null,
          message: 'Payment already completed.',
        };
      }

      if (existingPayment.status === PaymentStatus.INITIATED) {
        return {
          paymentId: existingPayment.id,
          paymentStatus: existingPayment.status,
          totalAmount: existingPayment.amount,
          walletAmount: existingPayment.walletAmount || 0,
          gatewayAmount: existingPayment.amount - (existingPayment.walletAmount || 0),
          providerPaymentId: existingPayment.providerPaymentId,
          checkoutUrl: null,
          message: 'Payment already initiated.',
        };
      }
    }
  }

  // 2. Validate reservation state and payment eligibility
  if (reservation.paymentState === ReservationPaymentState.PAID) {
    throw new AppError('Reservation is already paid.', httpStatus.CONFLICT);
  }

  if (reservation.status === ReservationStatus.CANCELED || reservation.status === ReservationStatus.EXPIRED) {
    throw new AppError('Reservation is canceled or expired and cannot be paid.', httpStatus.BAD_REQUEST);
  }

  if (
    reservation.paymentState === ReservationPaymentState.FAILED ||
    reservation.paymentState === ReservationPaymentState.CANCELED
  ) {
    throw new AppError('Reservation payment has already failed or been canceled.', httpStatus.BAD_REQUEST);
  }

  const isWalletOnlyProvider = providerName?.toUpperCase() === 'WALLET';
  const effectiveUseWallet = Boolean(useWallet || isWalletOnlyProvider);

  if (effectiveUseWallet) {
    assertCustomerOwnsWallet(actor, reservation.customerAccountId);
  }

  // Reclaim any stale initiated payments with stranded wallet deductions (> 15m)
  if (reservation.customerAccountId && typeof PaymentsRepo.reapStaleCustomerInitiatedPayments === 'function') {
    await Promise.resolve(PaymentsRepo.reapStaleCustomerInitiatedPayments(reservation.customerAccountId)).catch(() => {});
  }

  // Cancel any stale INITIATED payment for this reservation, restoring any deducted wallet contribution
  // without canceling the reservation itself since a new payment attempt is starting immediately.
  const activeExistingPayment = typeof PaymentsRepo.findActiveInitiatedPayment === 'function'
    ? await PaymentsRepo.findActiveInitiatedPayment(reservationId)
    : null;

  if (activeExistingPayment) {
    await PaymentsRepo.transaction(async (tx) => {
      await PaymentsRepo.handleFailedPayment(
        tx,
        activeExistingPayment.id,
        PaymentStatus.FAILED,
        'Superseded by new payment initiation',
        { cancelReservation: false }
      );
    });
  }

  const isAlreadyPaidConflict = (error: unknown): boolean =>
    error instanceof AppError &&
    error.statusCode === httpStatus.CONFLICT &&
    error.message === 'Reservation is already paid.';

  const cancelUnpaidEntityOnFailure = async (reason: string) => {
    try {
      await PaymentsRepo.transaction(async (tx) => {
        const isGroupBooking = Boolean((reservation as unknown as { isGroupBooking?: boolean }).isGroupBooking);
        if (isGroupBooking) {
          const freshGroup =
            typeof tx.groupBooking?.findUnique === 'function'
              ? await tx.groupBooking.findUnique({
                where: { id: reservationId },
                select: { status: true, paymentState: true },
              })
              : reservation;

          if (freshGroup?.paymentState === ReservationPaymentState.PAID) {
            return;
          }

          const isTerminal = freshGroup?.status
            ? ReservationStateMachine.isTerminalState(freshGroup.status)
            : false;

          if (typeof tx.groupBooking?.update === 'function') {
            const groupUpdateData: Record<string, unknown> = {
              paymentState: ReservationPaymentState.FAILED,
            };
            if (!isTerminal) {
              groupUpdateData.status = ReservationStatus.CANCELED;
              groupUpdateData.canceledAt = new Date();
              groupUpdateData.cancelReason = reason;
            }
            await tx.groupBooking.update({
              where: { id: reservationId },
              data: groupUpdateData,
            });
          }

          if (typeof tx.reservation?.updateMany === 'function') {
            const childUpdateData: Record<string, unknown> = {
              paymentState: ReservationPaymentState.FAILED,
            };
            if (!isTerminal) {
              childUpdateData.status = ReservationStatus.CANCELED;
              childUpdateData.canceledAt = new Date();
              childUpdateData.cancelReason = reason;
              childUpdateData.cancelCategory = CancellationCategory.PAYMENT_FAILED;
              childUpdateData.cancelActor = CancellationActor.SYSTEM;
            }
            await tx.reservation.updateMany({
              where: { groupBookingId: reservationId },
              data: childUpdateData,
            });
          }
        } else {
          const freshRes =
            typeof tx.reservation?.findUnique === 'function'
              ? await tx.reservation.findUnique({
                where: { id: reservationId },
                select: { status: true, paymentState: true },
              })
              : reservation;

          if (freshRes?.paymentState === ReservationPaymentState.PAID) {
            return;
          }

          const isTerminal = freshRes?.status
            ? ReservationStateMachine.isTerminalState(freshRes.status)
            : false;

          if (typeof tx.reservation?.update === 'function') {
            const resUpdateData: Record<string, unknown> = {
              paymentState: ReservationPaymentState.FAILED,
            };
            if (!isTerminal) {
              resUpdateData.status = ReservationStatus.CANCELED;
              resUpdateData.canceledAt = new Date();
              resUpdateData.cancelReason = reason;
              resUpdateData.cancelCategory = CancellationCategory.PAYMENT_FAILED;
              resUpdateData.cancelActor = CancellationActor.SYSTEM;
            }
            await tx.reservation.update({
              where: { id: reservationId },
              data: resUpdateData,
            });
          }

          if (!isTerminal && typeof (tx as unknown as { reservationHistory?: { create: unknown } }).reservationHistory?.create === 'function') {
            await tx.reservationHistory.create({
              data: {
                reservationId,
                fromStatus: freshRes?.status || reservation.status,
                toStatus: ReservationStatus.CANCELED,
                action: 'CANCEL',
                reason,
              },
            });
          }
        }
      });
    } catch (cleanupErr) {
      logger.warn({ err: cleanupErr, reservationId }, 'Failed to cancel unpaid reservation on payment initiation failure');
    }
  };

  // 3. Trusted server-side price & currency calculation (Backend Authority & Legacy Compatibility)
  // Prefers validated customerPayableAmount, with graceful fallback to totalPrice for legacy reservations
  const payableCandidate = typeof reservation.customerPayableAmount === 'number' && reservation.customerPayableAmount > 0
    ? reservation.customerPayableAmount
    : reservation.totalPrice;

  const calculatedAmount = Math.round(payableCandidate);
  if (isNaN(calculatedAmount) || calculatedAmount <= 0) {
    await cancelUnpaidEntityOnFailure('Invalid reservation payable amount for payment.');
    throw new AppError('Invalid reservation payable amount for payment.', httpStatus.BAD_REQUEST);
  }

  const snapshotCurrency = (reservation.stationSnapshot as Record<string, unknown>)?.currency as string | undefined;
  const currency = snapshotCurrency || 'IRR';

  // 4. Resolve customer spendable wallet balance (excluding reserved withdrawal holds)
  let availableWalletBalance = 0;
  if (effectiveUseWallet && reservation.customerAccountId) {
    const customerAccount = await prisma.customerAccount.findUnique({
      where: { id: reservation.customerAccountId },
      select: { walletBalance: true, reservedBalance: true },
    });
    availableWalletBalance = getAvailableWalletBalance(customerAccount);
  }

  // 5. Calculate payment split
  let paymentSplit;
  try {
    paymentSplit = calculatePaymentSplit({
      payableAmount: calculatedAmount,
      walletBalance: availableWalletBalance,
      useWallet: effectiveUseWallet,
      currency,
    });
  } catch (error) {
    await cancelUnpaidEntityOnFailure(error instanceof Error ? error.message : 'Payment calculation failed');
    throw error;
  }

  // Scenario A: Full Wallet Payment (No external gateway needed)
  if (paymentSplit.coversEntireAmount && reservation.customerAccountId) {
    try {
      const { payment } = await PaymentsRepo.createFullWalletPayment({
        reservationId,
        gamingCenterId,
        customerAccountId: reservation.customerAccountId,
        amount: paymentSplit.totalAmount,
        currency,
        idempotencyKey,
      });

      let refreshedPayment: Payment | null = null;
      try {
        refreshedPayment = typeof PaymentsRepo.findPaymentByIdempotencyKey === 'function' && idempotencyKey
          ? await PaymentsRepo.findPaymentByIdempotencyKey(gamingCenterId, idempotencyKey)
          : (typeof prisma.payment?.findUnique === 'function' ? await prisma.payment.findUnique({ where: { id: payment.id } }).catch(() => null) : null);
      } catch {
        refreshedPayment = null;
      }

      eventEmitter.emit(AppEvents.PAYMENT_SUCCESS, {
        payment: refreshedPayment || payment,
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
    } catch (error) {
      if (!isAlreadyPaidConflict(error)) {
        await cancelUnpaidEntityOnFailure(
          error instanceof Error ? error.message : 'تراکنش پرداخت با کیف پول ناموفق بود'
        );
      }
      throw error;
    }
  }

  if (isWalletOnlyProvider) {
    await cancelUnpaidEntityOnFailure('Insufficient wallet balance.');
    throw new AppError('Insufficient wallet balance.', httpStatus.BAD_REQUEST, {
      code: 'INSUFFICIENT_WALLET_BALANCE',
    });
  }

  // Resolve provider strategy for external gateway portion
  let provider;
  try {
    provider = PaymentProviderFactory.getProvider(providerName);
  } catch (error) {
    await cancelUnpaidEntityOnFailure(error instanceof Error ? error.message : 'Unsupported payment provider');
    throw error;
  }
  const prismaProvider = mapProviderEnum(provider.name);

  // Scenario B: Partial Wallet Payment (Wallet + External gateway)
  if (paymentSplit.walletContribution > 0 && reservation.customerAccountId) {
    let payment;
    try {
      const partialResult = await PaymentsRepo.createPartialPayment({
        reservationId,
        gamingCenterId,
        customerAccountId: reservation.customerAccountId,
        totalAmount: paymentSplit.totalAmount,
        walletContribution: paymentSplit.walletContribution,
        currency,
        provider: prismaProvider,
        idempotencyKey,
      });
      payment = partialResult.payment;
    } catch (error) {
      if (!isAlreadyPaidConflict(error)) {
        await cancelUnpaidEntityOnFailure(
          error instanceof Error ? error.message : 'Partial wallet payment initiation failed'
        );
      }
      throw error;
    }

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
  let payment;
  try {
    const gatewayCreateResult = await PaymentsRepo.createPaymentAndUpdateReservation({
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
    payment = gatewayCreateResult.payment;
  } catch (error) {
    if (!isAlreadyPaidConflict(error)) {
      await cancelUnpaidEntityOnFailure(
        error instanceof Error ? error.message : 'Payment creation failed'
      );
    }
    throw error;
  }

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

  // Idempotency check: If already failed or cancelled, return existing failure state without re-invoking provider
  if (payment.status === PaymentStatus.FAILED || payment.status === PaymentStatus.CANCELED) {
    return {
      success: false,
      paymentId: payment.id,
      paymentStatus: payment.status,
      totalAmount: payment.amount,
      walletAmount: payment.walletAmount || 0,
      gatewayAmount: payment.amount - (payment.walletAmount || 0),
      failureReason: payment.failureReason || 'Payment already terminated.',
    };
  }

  // 3. Authority matching and cancellation check
  if (authority && payment.providerPaymentId && authority !== payment.providerPaymentId) {
    throw new AppError('Payment authority mismatch.', httpStatus.BAD_REQUEST);
  }

  const isExplicitFailure = status && (status.toUpperCase() === 'NOK' || status.toUpperCase() === 'FAILED' || status.toUpperCase() === 'CANCELLED');
  if (isExplicitFailure) {
    const updated = await PaymentsRepo.transaction(async (tx) => {
      return PaymentsRepo.handleFailedPayment(tx, payment.id, PaymentStatus.FAILED, 'Gateway returned non-OK status');
    });

    eventEmitter.emit(AppEvents.PAYMENT_FAILED, {
      payment: updated,
      failureReason: 'Payment canceled or rejected by user/gateway.',
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

  // 4. Server-to-server verification with authoritative stored provider
  const provider = PaymentProviderFactory.getProvider(payment.provider || providerName);
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
      let updated = await PaymentsRepo.handleSuccessfulPayment(tx, payment.id, verifyResult.refId);

      // If linked to BookingHold, convert to reservations atomically inside same transaction or right after
      if (payment.bookingHoldId) {
        const { BookingHoldStation } = await import('../booking-hold/booking-hold.station');
        await BookingHoldStation.convertHoldToReservations(payment.bookingHoldId, payment.id, tx);
        if (typeof tx.payment?.findUnique === 'function') {
          const refreshed = await tx.payment.findUnique({
            where: { id: payment.id },
          });
          if (refreshed) {
            updated = refreshed;
          }
        }
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

  if (verifyResult.success) {
    eventEmitter.emit(AppEvents.PAYMENT_SUCCESS, { payment: finalPayment });
  } else {
    eventEmitter.emit(AppEvents.PAYMENT_FAILED, {
      payment: finalPayment,
      failureReason: finalPayment.failureReason || 'Payment verification failed',
    });
  }

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

  if (useWallet) {
    assertCustomerOwnsWallet(actor, reservation.customerAccountId);
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
  const isOwnerCustomer =
    actor?.actorType === SessionActorType.CUSTOMER &&
    Boolean(reservation.customerAccountId) &&
    actor.id === reservation.customerAccountId;
  if (reservation.customerAccountId && isOwnerCustomer) {
    await PaymentsRepo.reapStaleCustomerInitiatedPayments(reservation.customerAccountId).catch(() => {});
    const customerAccount = await prisma.customerAccount.findUnique({
      where: { id: reservation.customerAccountId },
      select: { walletBalance: true, reservedBalance: true },
    });
    walletBalance = getAvailableWalletBalance(customerAccount);
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
