import { Prisma, LedgerEntryType } from '@prisma/client';
import { prisma } from '../../config/prisma';

type Tx = Prisma.TransactionClient;

const getDbClient = (tx?: Tx) => tx || prisma;

const createCollectionEntry = async (
  tx: Tx,
  data: {
    gamingCenterId: string;
    paymentId: string;
    amount: number;
    currency: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }
) => {
  const idempotencyKey = `payment-ledger-${data.paymentId}`;

  const existing = await tx.ledgerEntry.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    return existing;
  }

  return tx.ledgerEntry.create({
    data: {
      gamingCenter: { connect: { id: data.gamingCenterId } },
      payment: { connect: { id: data.paymentId } },
      entryType: LedgerEntryType.PAYMENT_COLLECTION,
      amount: data.amount,
      currency: data.currency,
      idempotencyKey,
      description: data.description || `Payment collection for ${data.paymentId}`,
      metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
};

const createRefundEntry = async (
  tx: Tx,
  data: {
    gamingCenterId: string;
    paymentId: string;
    refundId: string;
    amount: number;
    currency: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }
) => {
  const idempotencyKey = `refund-ledger-${data.refundId}`;

  const existing = await tx.ledgerEntry.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    return existing;
  }

  return tx.ledgerEntry.create({
    data: {
      gamingCenter: { connect: { id: data.gamingCenterId } },
      payment: { connect: { id: data.paymentId } },
      refund: { connect: { id: data.refundId } },
      entryType: LedgerEntryType.REFUND_DISBURSEMENT,
      amount: data.amount,
      currency: data.currency,
      idempotencyKey,
      description: data.description || `Refund disbursement for ${data.refundId}`,
      metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
};

const createAdjustmentEntry = async (
  tx: Tx,
  data: {
    gamingCenterId: string;
    paymentId?: string;
    refundId?: string;
    amount: number;
    currency: string;
    idempotencyKey: string;
    description: string;
    metadata?: Record<string, unknown>;
  }
) => {
  const existing = await tx.ledgerEntry.findUnique({
    where: { idempotencyKey: data.idempotencyKey },
  });

  if (existing) {
    return existing;
  }

  return tx.ledgerEntry.create({
    data: {
      gamingCenter: { connect: { id: data.gamingCenterId } },
      payment: data.paymentId ? { connect: { id: data.paymentId } } : undefined,
      refund: data.refundId ? { connect: { id: data.refundId } } : undefined,
      entryType: LedgerEntryType.COMPENSATING_ADJUSTMENT,
      amount: data.amount,
      currency: data.currency,
      idempotencyKey: data.idempotencyKey,
      description: data.description,
      metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
};

const getLedgerHistory = async (
  params: {
    gamingCenterId: string;
    entryType?: LedgerEntryType;
    paymentId?: string;
    refundId?: string;
    page?: number;
    limit?: number;
  },
  tx?: Tx
) => {
  const client = getDbClient(tx);
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.LedgerEntryWhereInput = {
    gamingCenterId: params.gamingCenterId,
  };

  if (params.entryType) where.entryType = params.entryType;
  if (params.paymentId) where.paymentId = params.paymentId;
  if (params.refundId) where.refundId = params.refundId;

  const [items, total] = await Promise.all([
    client.ledgerEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        payment: true,
        refund: true,
      },
    }),
    client.ledgerEntry.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const LedgerRepo = {
  createCollectionEntry,
  createRefundEntry,
  createAdjustmentEntry,
  getLedgerHistory,
};
