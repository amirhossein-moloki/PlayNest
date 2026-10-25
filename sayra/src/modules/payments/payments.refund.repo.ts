import { Prisma, RefundStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';

type Tx = Prisma.TransactionClient;

const getDbClient = (tx?: Tx) => tx || prisma;

const findPaymentForRefundLock = async (
  tx: Tx,
  paymentId: string,
  gamingCenterId: string
) => {
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      gamingCenterId: string;
      amount: number;
      currency: string;
      provider: string;
      providerPaymentId: string | null;
      status: PaymentStatus;
      reservationId: string | null;
    }>
  >`
    SELECT id, "gamingCenterId", amount, currency, provider, "providerPaymentId", status, "reservationId"
    FROM "Payment"
    WHERE id = ${paymentId} AND "gamingCenterId" = ${gamingCenterId}
    FOR UPDATE
  `;

  return rows.length > 0 ? rows[0] : null;
};

const calculateRefundableBalance = async (tx: Tx, paymentId: string, totalPaymentAmount: number) => {
  const aggregate = await tx.refund.aggregate({
    where: {
      paymentId,
      status: { in: [RefundStatus.SUCCESSFUL, RefundStatus.PENDING] },
    },
    _sum: {
      amount: true,
    },
  });

  const totalRefundedOrPending = aggregate._sum.amount || 0;
  const remainingBalance = totalPaymentAmount - totalRefundedOrPending;

  return {
    totalRefundedOrPending,
    remainingBalance: Math.max(0, remainingBalance),
  };
};

const findRefundById = (refundId: string, gamingCenterId: string, tx?: Tx) => {
  const client = getDbClient(tx);
  return client.refund.findFirst({
    where: { id: refundId, gamingCenterId },
    include: {
      payment: true,
      ledgerEntries: true,
    },
  });
};

const findRefundByIdempotencyKey = (gamingCenterId: string, idempotencyKey: string, tx?: Tx) => {
  const client = getDbClient(tx);
  return client.refund.findFirst({
    where: { gamingCenterId, idempotencyKey },
    include: {
      payment: true,
      ledgerEntries: true,
    },
  });
};

const findRefundsByPaymentId = (paymentId: string, gamingCenterId: string, tx?: Tx) => {
  const client = getDbClient(tx);
  return client.refund.findMany({
    where: { paymentId, gamingCenterId },
    orderBy: { createdAt: 'desc' },
    include: {
      ledgerEntries: true,
    },
  });
};

const createRefundRecord = (tx: Tx, data: Prisma.RefundCreateInput) => {
  return tx.refund.create({
    data,
  });
};

const updateRefundStatus = (
  tx: Tx,
  refundId: string,
  data: {
    status: RefundStatus;
    failureReason?: string | null;
    providerRefundId?: string | null;
    processedAt?: Date | null;
    rawPayload?: Prisma.InputJsonValue;
  }
) => {
  return tx.refund.update({
    where: { id: refundId },
    data: {
      status: data.status,
      failureReason: data.failureReason,
      providerRefundId: data.providerRefundId,
      processedAt: data.processedAt,
      rawPayload: data.rawPayload ? data.rawPayload : undefined,
    },
  });
};

export const RefundsRepo = {
  findPaymentForRefundLock,
  calculateRefundableBalance,
  findRefundById,
  findRefundByIdempotencyKey,
  findRefundsByPaymentId,
  createRefundRecord,
  updateRefundStatus,
};
