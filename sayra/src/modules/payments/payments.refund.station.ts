import { RefundStatus, PaymentStatus, ReservationPaymentState, Prisma } from '@prisma/client';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { PaymentsRepo } from './payments.repo';
import { RefundsRepo } from './payments.refund.repo';
import { LedgerRepo } from './ledger.repo';
import { PaymentProviderFactory } from './providers';

export interface RequestRefundInput {
  gamingCenterId: string;
  paymentId: string;
  amount: number;
  currency: string;
  reason?: string;
  idempotencyKey?: string;
  requestedById?: string;
  providerName?: string;
}

const requestRefund = async (input: RequestRefundInput) => {
  const {
    gamingCenterId,
    paymentId,
    amount,
    currency,
    reason,
    idempotencyKey,
    requestedById,
    providerName,
  } = input;

  // 1. Idempotency Check
  if (idempotencyKey) {
    const existing = await RefundsRepo.findRefundByIdempotencyKey(gamingCenterId, idempotencyKey);
    if (existing) {
      return {
        refundId: existing.id,
        paymentId: existing.paymentId,
        amount: existing.amount,
        currency: existing.currency,
        status: existing.status,
        providerRefundId: existing.providerRefundId,
        failureReason: existing.failureReason,
        processedAt: existing.processedAt,
        createdAt: existing.createdAt,
      };
    }
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new AppError('Refund amount must be a positive integer.', httpStatus.BAD_REQUEST);
  }

  // Early validation of requested provider name before creating DB record
  if (providerName) {
    PaymentProviderFactory.getProvider(providerName);
  }

  // 2. Lock payment row & validate eligibility inside database transaction
  const initialData = await PaymentsRepo.transaction(async (tx) => {
    const payment = await RefundsRepo.findPaymentForRefundLock(tx, paymentId, gamingCenterId);

    if (!payment) {
      throw new AppError('Payment not found.', httpStatus.NOT_FOUND);
    }

    if (payment.status !== PaymentStatus.PAID) {
      throw new AppError(
        `Only successful (PAID) payments can be refunded. Current payment status is ${payment.status}.`,
        httpStatus.BAD_REQUEST
      );
    }

    if (currency.toUpperCase() !== payment.currency.toUpperCase()) {
      throw new AppError(
        `Refund currency (${currency}) does not match payment currency (${payment.currency}).`,
        httpStatus.BAD_REQUEST
      );
    }

    const { remainingBalance } = await RefundsRepo.calculateRefundableBalance(
      tx,
      paymentId,
      payment.amount
    );

    if (amount > remainingBalance) {
      throw new AppError(
        `Requested refund amount (${amount}) exceeds remaining refundable balance (${remainingBalance}).`,
        httpStatus.CONFLICT
      );
    }

    const refund = await RefundsRepo.createRefundRecord(tx, {
      gamingCenter: { connect: { id: gamingCenterId } },
      payment: { connect: { id: paymentId } },
      amount,
      currency: payment.currency,
      status: RefundStatus.PENDING,
      reason,
      idempotencyKey,
      requestedById,
    });

    return { payment, refund };
  });

  const { payment, refund } = initialData;

  // 3. Provider execution
  const provider = PaymentProviderFactory.getProvider(providerName || payment.provider);

  if (!provider.supportsRefunds || !provider.requestRefund) {
    const failedRefund = await PaymentsRepo.transaction(async (tx) => {
      return RefundsRepo.updateRefundStatus(tx, refund.id, {
        status: RefundStatus.FAILED,
        failureReason: `Payment provider ${provider.name} does not support automated direct refunds.`,
      });
    });

    return {
      refundId: failedRefund.id,
      paymentId: failedRefund.paymentId,
      amount: failedRefund.amount,
      currency: failedRefund.currency,
      status: failedRefund.status,
      failureReason: failedRefund.failureReason,
      createdAt: failedRefund.createdAt,
    };
  }

  try {
    const providerResult = await provider.requestRefund({
      paymentId: payment.id,
      providerPaymentId: payment.providerPaymentId || undefined,
      amount,
      currency: payment.currency,
      reason,
      idempotencyKey: idempotencyKey || undefined,
    });

    // 4. Update status & persist ledger entries based on provider result
    const finalizedRefund = await PaymentsRepo.transaction(async (tx) => {
      if (providerResult.status === RefundStatus.SUCCESSFUL) {
        const updated = await RefundsRepo.updateRefundStatus(tx, refund.id, {
          status: RefundStatus.SUCCESSFUL,
          providerRefundId: providerResult.providerRefundId,
          processedAt: new Date(),
          rawPayload: providerResult.rawPayload as Prisma.InputJsonValue,
        });

        await LedgerRepo.createRefundEntry(tx, {
          gamingCenterId,
          paymentId: payment.id,
          refundId: updated.id,
          amount: updated.amount,
          currency: updated.currency,
          description: `Refund disbursement for payment ${payment.id}`,
        });

        if (payment.reservationId) {
          const { totalRefundedOrPending } = await RefundsRepo.calculateRefundableBalance(
            tx,
            payment.id,
            payment.amount
          );

          const newPaymentState =
            totalRefundedOrPending >= payment.amount
              ? ReservationPaymentState.REFUNDED
              : ReservationPaymentState.PARTIALLY_PAID;

          await tx.reservation.update({
            where: { id: payment.reservationId },
            data: { paymentState: newPaymentState },
          });
        }

        return updated;
      } else if (providerResult.status === RefundStatus.FAILED) {
        return RefundsRepo.updateRefundStatus(tx, refund.id, {
          status: RefundStatus.FAILED,
          failureReason: providerResult.failureReason || 'Provider rejected refund',
          rawPayload: providerResult.rawPayload as Prisma.InputJsonValue,
        });
      } else {
        return RefundsRepo.updateRefundStatus(tx, refund.id, {
          status: providerResult.status,
          failureReason: providerResult.failureReason || 'Refund status ambiguous / pending provider confirmation',
          rawPayload: providerResult.rawPayload as Prisma.InputJsonValue,
        });
      }
    });

    return {
      refundId: finalizedRefund.id,
      paymentId: finalizedRefund.paymentId,
      amount: finalizedRefund.amount,
      currency: finalizedRefund.currency,
      status: finalizedRefund.status,
      providerRefundId: finalizedRefund.providerRefundId,
      failureReason: finalizedRefund.failureReason,
      processedAt: finalizedRefund.processedAt,
      createdAt: finalizedRefund.createdAt,
    };
  } catch (error) {
    const ambiguousRefund = await PaymentsRepo.transaction(async (tx) => {
      return RefundsRepo.updateRefundStatus(tx, refund.id, {
        status: RefundStatus.AMBIGUOUS,
        failureReason: error instanceof Error ? error.message : 'Unexpected error during provider refund request',
      });
    });

    return {
      refundId: ambiguousRefund.id,
      paymentId: ambiguousRefund.paymentId,
      amount: ambiguousRefund.amount,
      currency: ambiguousRefund.currency,
      status: ambiguousRefund.status,
      failureReason: ambiguousRefund.failureReason,
      createdAt: ambiguousRefund.createdAt,
    };
  }
};

const getRefundStatus = async (gamingCenterId: string, paymentId: string, refundId: string) => {
  const refund = await RefundsRepo.findRefundById(refundId, gamingCenterId);

  if (!refund || refund.paymentId !== paymentId) {
    throw new AppError('Refund record not found.', httpStatus.NOT_FOUND);
  }

  return {
    refundId: refund.id,
    paymentId: refund.paymentId,
    amount: refund.amount,
    currency: refund.currency,
    status: refund.status,
    reason: refund.reason,
    failureReason: refund.failureReason,
    providerRefundId: refund.providerRefundId,
    processedAt: refund.processedAt,
    createdAt: refund.createdAt,
    updatedAt: refund.updatedAt,
  };
};

const listRefunds = async (gamingCenterId: string, paymentId: string) => {
  const refunds = await RefundsRepo.findRefundsByPaymentId(paymentId, gamingCenterId);

  return refunds.map((r) => ({
    refundId: r.id,
    paymentId: r.paymentId,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    reason: r.reason,
    failureReason: r.failureReason,
    providerRefundId: r.providerRefundId,
    processedAt: r.processedAt,
    createdAt: r.createdAt,
  }));
};

export const RefundsStation = {
  requestRefund,
  getRefundStatus,
  listRefunds,
};
