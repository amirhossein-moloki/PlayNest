import { ReconciliationStatus, PaymentStatus, RefundStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { PaymentProviderFactory } from './providers';

export interface ReconcilePaymentInput {
  gamingCenterId: string;
  paymentId: string;
}

const reconcilePayment = async ({ gamingCenterId, paymentId }: ReconcilePaymentInput) => {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, gamingCenterId },
    include: {
      refunds: true,
      ledgerEntries: true,
    },
  });

  if (!payment) {
    throw new AppError('Payment not found for reconciliation.', httpStatus.NOT_FOUND);
  }

  const discrepancies: string[] = [];
  let status: ReconciliationStatus = ReconciliationStatus.MATCHED;

  if (payment.status === PaymentStatus.PAID && !payment.providerPaymentId && !payment.referenceCode) {
    status = ReconciliationStatus.MISSING_PROVIDER_REF;
    discrepancies.push('Payment marked PAID internally but missing provider reference ID / code.');
  }

  if (payment.providerPaymentId) {
    try {
      const provider = PaymentProviderFactory.getProvider(payment.provider);
      const verifyResult = await provider.verifyPayment({
        authority: payment.providerPaymentId,
        amount: payment.amount,
      });

      if (verifyResult.success && payment.status !== PaymentStatus.PAID) {
        status = ReconciliationStatus.DISCREPANCY_STATUS;
        discrepancies.push(
          `Provider verified payment as SUCCESSFUL, but internal status is ${payment.status}.`
        );
      } else if (!verifyResult.success && payment.status === PaymentStatus.PAID) {
        status = ReconciliationStatus.DISCREPANCY_STATUS;
        discrepancies.push(
          `Internal status is PAID, but provider verification failed: ${verifyResult.failureReason || 'Unconfirmed'}.`
        );
      }
    } catch (err) {
      status = ReconciliationStatus.UNCONFIRMED_PROVIDER_STATE;
      discrepancies.push(
        `Unable to reach provider for reconciliation: ${err instanceof Error ? err.message : 'Provider timeout'}`
      );
    }
  } else if (payment.status === PaymentStatus.PAID) {
    status = ReconciliationStatus.MISSING_PROVIDER_REF;
    discrepancies.push('Payment status is PAID but has no providerPaymentId to verify against provider.');
  }

  const collectionLedger = payment.ledgerEntries.find(
    (e) => e.entryType === 'PAYMENT_COLLECTION'
  );

  if (payment.status === PaymentStatus.PAID && !collectionLedger) {
    status = ReconciliationStatus.DISCREPANCY_STATUS;
    discrepancies.push('Payment is PAID internally but missing PAYMENT_COLLECTION ledger entry.');
  } else if (collectionLedger && collectionLedger.amount !== payment.amount) {
    status = ReconciliationStatus.DISCREPANCY_AMOUNT;
    discrepancies.push(
      `Ledger collection amount (${collectionLedger.amount}) does not match payment amount (${payment.amount}).`
    );
  }

  for (const refund of payment.refunds) {
    if (refund.status === RefundStatus.SUCCESSFUL) {
      const refundLedger = payment.ledgerEntries.find(
        (e) => e.refundId === refund.id && e.entryType === 'REFUND_DISBURSEMENT'
      );
      if (!refundLedger) {
        status = ReconciliationStatus.DISCREPANCY_STATUS;
        discrepancies.push(`Refund ${refund.id} is SUCCESSFUL but missing REFUND_DISBURSEMENT ledger entry.`);
      } else if (refundLedger.amount !== refund.amount) {
        status = ReconciliationStatus.DISCREPANCY_AMOUNT;
        discrepancies.push(
          `Refund ${refund.id} amount (${refund.amount}) does not match ledger disbursement amount (${refundLedger.amount}).`
        );
      }
    } else if (refund.status === RefundStatus.AMBIGUOUS) {
      if (status === ReconciliationStatus.MATCHED) {
        status = ReconciliationStatus.UNCONFIRMED_PROVIDER_STATE;
      }
      discrepancies.push(`Refund ${refund.id} is in AMBIGUOUS state and requires investigation.`);
    }
  }

  const record = await prisma.reconciliationRecord.create({
    data: {
      gamingCenter: { connect: { id: gamingCenterId } },
      payment: { connect: { id: paymentId } },
      status,
      details: {
        discrepancies,
        paymentStatus: payment.status,
        paymentAmount: payment.amount,
        refundCount: payment.refunds.length,
        ledgerCount: payment.ledgerEntries.length,
      } as Prisma.InputJsonValue,
    },
  });

  return {
    reconciliationId: record.id,
    paymentId: record.paymentId,
    status: record.status,
    discrepancies,
    reconciledAt: record.reconciledAt,
  };
};

const reconcileGamingCenter = async (gamingCenterId: string, limit: number = 50) => {
  const payments = await prisma.payment.findMany({
    where: { gamingCenterId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true },
  });

  const results = [];
  for (const p of payments) {
    const report = await reconcilePayment({ gamingCenterId, paymentId: p.id });
    results.push(report);
  }

  const matchedCount = results.filter((r) => r.status === ReconciliationStatus.MATCHED).length;
  const discrepancyCount = results.length - matchedCount;

  return {
    gamingCenterId,
    totalReconciled: results.length,
    matchedCount,
    discrepancyCount,
    reports: results,
  };
};

export const ReconciliationStation = {
  reconcilePayment,
  reconcileGamingCenter,
};
