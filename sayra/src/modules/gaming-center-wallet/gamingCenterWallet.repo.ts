import {
  GamingCenterWalletTransactionType,
  Prisma,
  WithdrawalRequestStatus,
} from '@prisma/client';
import { prisma } from '../../config/prisma';

export interface ListGamingCenterWithdrawalsFilters {
  gamingCenterId?: string;
  status?: WithdrawalRequestStatus;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  skip?: number;
  take?: number;
  sortBy?: 'createdAt' | 'amount' | 'approvedAt' | 'paidAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ListGamingCenterTransactionsFilters {
  gamingCenterId: string;
  type?: GamingCenterWalletTransactionType;
  skip?: number;
  take?: number;
}

export const GamingCenterWalletRepo = {
  async findGamingCenterForUpdate(gamingCenterId: string, tx: Prisma.TransactionClient) {
    if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === 'function') {
      await tx.$executeRaw`SELECT id FROM "GamingCenter" WHERE id = ${gamingCenterId} FOR UPDATE`;
    }
    if (!tx?.gamingCenter?.findUnique) {
      return null;
    }
    return tx.gamingCenter.findUnique({
      where: { id: gamingCenterId },
    });
  },

  async lockWithdrawalRequestForUpdate(withdrawalId: string, tx: Prisma.TransactionClient) {
    if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === 'function') {
      await tx.$executeRaw`SELECT id FROM "GamingCenterWithdrawalRequest" WHERE id = ${withdrawalId} FOR UPDATE`;
    }
  },

  async findGamingCenterById(gamingCenterId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.gamingCenter.findUnique({
      where: { id: gamingCenterId },
    });
  },

  async updateGamingCenterWallet(
    gamingCenterId: string,
    data: Prisma.GamingCenterUpdateInput,
    tx: Prisma.TransactionClient
  ) {
    return tx.gamingCenter.update({
      where: { id: gamingCenterId },
      data,
    });
  },

  async findTransactionByIdempotencyKey(idempotencyKey: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    if (!client?.gamingCenterWalletTransaction?.findUnique) {
      return null;
    }
    return client.gamingCenterWalletTransaction.findUnique({
      where: { idempotencyKey },
    });
  },

  async createWalletTransaction(
    data: Prisma.GamingCenterWalletTransactionUncheckedCreateInput,
    tx: Prisma.TransactionClient
  ) {
    return tx.gamingCenterWalletTransaction.create({ data });
  },

  async getWalletSummaryAggregates(gamingCenterId: string) {
    const canAggregateTx = typeof prisma.gamingCenterWalletTransaction?.aggregate === 'function';
    const canAggregateWithdrawals = typeof prisma.gamingCenterWithdrawalRequest?.aggregate === 'function';

    const [settlementAgg, reversalAgg, withdrawnAgg] = canAggregateTx
      ? await Promise.all([
        prisma.gamingCenterWalletTransaction.aggregate({
          where: {
            gamingCenterId,
            type: GamingCenterWalletTransactionType.RESERVATION_SETTLEMENT,
          },
          _sum: { grossAmount: true, commissionAmount: true, amount: true },
        }),
        prisma.gamingCenterWalletTransaction.aggregate({
          where: {
            gamingCenterId,
            type: GamingCenterWalletTransactionType.SETTLEMENT_REVERSAL,
          },
          _sum: { grossAmount: true, commissionAmount: true, amount: true },
        }),
        prisma.gamingCenterWalletTransaction.aggregate({
          where: {
            gamingCenterId,
            type: GamingCenterWalletTransactionType.WITHDRAWAL_PAID,
          },
          _sum: { amount: true },
        }),
      ])
      : [null, null, null];

    const pendingAgg = canAggregateWithdrawals
      ? await prisma.gamingCenterWithdrawalRequest.aggregate({
        where: {
          gamingCenterId,
          status: {
            in: [
              WithdrawalRequestStatus.PENDING,
              WithdrawalRequestStatus.APPROVED,
              WithdrawalRequestStatus.PROCESSING,
            ],
          },
        },
        _sum: { amount: true },
      })
      : null;

    return {
      totalGrossSettled: Math.max(
        0,
        (settlementAgg?._sum?.grossAmount ?? 0) + (reversalAgg?._sum?.grossAmount ?? 0)
      ),
      totalCommissionDeducted: Math.max(
        0,
        (settlementAgg?._sum?.commissionAmount ?? 0) + (reversalAgg?._sum?.commissionAmount ?? 0)
      ),
      totalNetCredited: Math.max(
        0,
        (settlementAgg?._sum?.amount ?? 0) + (reversalAgg?._sum?.amount ?? 0)
      ),
      totalWithdrawn: Math.abs(withdrawnAgg?._sum?.amount ?? 0),
      pendingWithdrawalsAmount: pendingAgg?._sum?.amount ?? 0,
    };
  },

  async findLastActiveWithdrawalRequest(gamingCenterId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.gamingCenterWithdrawalRequest.findFirst({
      where: {
        gamingCenterId,
        status: {
          notIn: [WithdrawalRequestStatus.CANCELLED, WithdrawalRequestStatus.REJECTED],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createWithdrawalRequest(
    data: Prisma.GamingCenterWithdrawalRequestUncheckedCreateInput,
    tx: Prisma.TransactionClient
  ) {
    return tx.gamingCenterWithdrawalRequest.create({ data });
  },

  async findWithdrawalById(id: string, gamingCenterId?: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const include = {
      gamingCenter: {
        select: {
          id: true,
          name: true,
          slug: true,
          walletBalance: true,
          reservedBalance: true,
        },
      },
      requestedByUser: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
      reviewerAdmin: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      walletTransactions: true,
    };

    if (gamingCenterId) {
      return client.gamingCenterWithdrawalRequest.findFirst({
        where: { id, gamingCenterId },
        include,
      });
    }

    return client.gamingCenterWithdrawalRequest.findUnique({
      where: { id },
      include,
    });
  },

  async updateWithdrawalRequest(
    id: string,
    data: Prisma.GamingCenterWithdrawalRequestUpdateInput,
    tx: Prisma.TransactionClient
  ) {
    return tx.gamingCenterWithdrawalRequest.update({
      where: { id },
      data,
      include: {
        gamingCenter: {
          select: {
            id: true,
            name: true,
            slug: true,
            walletBalance: true,
            reservedBalance: true,
          },
        },
        requestedByUser: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        reviewerAdmin: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  },

  async listWithdrawals(filters: ListGamingCenterWithdrawalsFilters, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const {
      gamingCenterId,
      status,
      search,
      startDate,
      endDate,
      skip = 0,
      take = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where: Prisma.GamingCenterWithdrawalRequestWhereInput = {};

    if (gamingCenterId) {
      where.gamingCenterId = gamingCenterId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { paymentReference: { contains: search, mode: 'insensitive' } },
        {
          gamingCenter: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      client.gamingCenterWithdrawalRequest.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          gamingCenter: {
            select: {
              id: true,
              name: true,
              slug: true,
              walletBalance: true,
              reservedBalance: true,
            },
          },
          requestedByUser: {
            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
          reviewerAdmin: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      }),
      client.gamingCenterWithdrawalRequest.count({ where }),
    ]);

    return { items, total };
  },

  async findOverdueApprovedWithdrawals(cutoffDate: Date, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.gamingCenterWithdrawalRequest.findMany({
      where: {
        status: WithdrawalRequestStatus.APPROVED,
        approvedAt: {
          lte: cutoffDate,
        },
      },
      orderBy: { approvedAt: 'asc' },
      include: {
        gamingCenter: {
          select: {
            id: true,
            name: true,
            slug: true,
            walletBalance: true,
            reservedBalance: true,
          },
        },
      },
    });
  },

  async listTransactions(filters: ListGamingCenterTransactionsFilters, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const { gamingCenterId, type, skip = 0, take = 20 } = filters;

    const where: Prisma.GamingCenterWalletTransactionWhereInput = {
      gamingCenterId,
    };

    if (type) {
      where.type = type;
    }

    const [items, total] = await Promise.all([
      client.gamingCenterWalletTransaction.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          reservation: {
            select: {
              id: true,
              startTime: true,
              status: true,
            },
          },
          earning: {
            select: {
              id: true,
              commissionAmount: true,
              status: true,
            },
          },
          withdrawalRequest: {
            select: {
              id: true,
              status: true,
              amount: true,
            },
          },
        },
      }),
      client.gamingCenterWalletTransaction.count({ where }),
    ]);

    return { items, total };
  },

  async findTransactionById(id: string, gamingCenterId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.gamingCenterWalletTransaction.findFirst({
      where: { id, gamingCenterId },
      include: {
        reservation: {
          select: {
            id: true,
            startTime: true,
            status: true,
          },
        },
        earning: {
          select: {
            id: true,
            commissionAmount: true,
            status: true,
          },
        },
        withdrawalRequest: {
          select: {
            id: true,
            status: true,
            amount: true,
          },
        },
      },
    });
  },
};
