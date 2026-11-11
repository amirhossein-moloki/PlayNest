import { Prisma, WithdrawalRequestStatus, WalletTransactionType } from '@prisma/client';
import { prisma } from '../../config/prisma';

export interface ListWithdrawalRequestsFilters {
  customerAccountId?: string;
  status?: WithdrawalRequestStatus;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  skip?: number;
  take?: number;
  sortBy?: 'createdAt' | 'amount' | 'approvedAt' | 'paidAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ListTransactionsFilters {
  customerAccountId: string;
  type?: WalletTransactionType;
  skip?: number;
  take?: number;
}

export const WithdrawalRepo = {
  async findCustomerAccountForUpdate(customerAccountId: string, tx: Prisma.TransactionClient) {
    // Pessimistic lock on CustomerAccount
    await tx.$executeRaw`SELECT id FROM "CustomerAccount" WHERE id = ${customerAccountId} FOR UPDATE`;
    return tx.customerAccount.findUnique({
      where: { id: customerAccountId },
    });
  },

  async findCustomerAccountById(customerAccountId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.customerAccount.findUnique({
      where: { id: customerAccountId },
    });
  },

  async findLastWithdrawalRequest(customerAccountId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.withdrawalRequest.findFirst({
      where: {
        customerAccountId,
        status: {
          notIn: [WithdrawalRequestStatus.CANCELLED, WithdrawalRequestStatus.REJECTED],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createWithdrawalRequest(
    data: Prisma.WithdrawalRequestUncheckedCreateInput,
    tx: Prisma.TransactionClient
  ) {
    return tx.withdrawalRequest.create({ data });
  },

  async updateCustomerAccount(
    customerAccountId: string,
    data: Prisma.CustomerAccountUpdateInput,
    tx: Prisma.TransactionClient
  ) {
    return tx.customerAccount.update({
      where: { id: customerAccountId },
      data,
    });
  },

  async createWalletTransaction(
    data: Prisma.WalletTransactionUncheckedCreateInput,
    tx: Prisma.TransactionClient
  ) {
    return tx.walletTransaction.create({ data });
  },

  async findWithdrawalById(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.withdrawalRequest.findUnique({
      where: { id },
      include: {
        customerAccount: {
          select: {
            id: true,
            phone: true,
            fullName: true,
            walletBalance: true,
            reservedBalance: true,
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
      },
    });
  },

  async updateWithdrawalRequest(
    id: string,
    data: Prisma.WithdrawalRequestUpdateInput,
    tx: Prisma.TransactionClient
  ) {
    return tx.withdrawalRequest.update({
      where: { id },
      data,
      include: {
        customerAccount: true,
      },
    });
  },

  async listWithdrawals(filters: ListWithdrawalRequestsFilters, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const {
      customerAccountId,
      status,
      search,
      startDate,
      endDate,
      skip = 0,
      take = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where: Prisma.WithdrawalRequestWhereInput = {};

    if (customerAccountId) {
      where.customerAccountId = customerAccountId;
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
          customerAccount: {
            OR: [
              { phone: { contains: search, mode: 'insensitive' } },
              { fullName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      client.withdrawalRequest.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customerAccount: {
            select: {
              id: true,
              phone: true,
              fullName: true,
              walletBalance: true,
              reservedBalance: true,
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
      client.withdrawalRequest.count({ where }),
    ]);

    return { items, total };
  },

  async findOverdueApprovedWithdrawals(cutoffDate: Date, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.withdrawalRequest.findMany({
      where: {
        status: WithdrawalRequestStatus.APPROVED,
        approvedAt: {
          lte: cutoffDate,
        },
      },
      orderBy: { approvedAt: 'asc' },
      include: {
        customerAccount: {
          select: {
            id: true,
            phone: true,
            fullName: true,
            walletBalance: true,
            reservedBalance: true,
          },
        },
      },
    });
  },

  async listCustomerTransactions(filters: ListTransactionsFilters, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const { customerAccountId, type, skip = 0, take = 20 } = filters;

    const where: Prisma.WalletTransactionWhereInput = {
      customerAccountId,
    };

    if (type) {
      where.type = type;
    }

    const [items, total] = await Promise.all([
      client.walletTransaction.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      client.walletTransaction.count({ where }),
    ]);

    return { items, total };
  },

  async findTransactionById(id: string, customerAccountId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.walletTransaction.findFirst({
      where: { id, customerAccountId },
      include: {
        withdrawalRequest: true,
        reservation: true,
      },
    });
  },

  async createCustomerNotification(
    data: Prisma.CustomerNotificationUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.customerNotification.create({ data });
  },

  async listCustomerNotifications(
    customerAccountId: string,
    options: { skip?: number; take?: number } = {},
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    const { skip = 0, take = 20 } = options;

    const [items, total, unreadCount] = await Promise.all([
      client.customerNotification.findMany({
        where: { customerAccountId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      client.customerNotification.count({
        where: { customerAccountId },
      }),
      client.customerNotification.count({
        where: { customerAccountId, isRead: false },
      }),
    ]);

    return { items, total, unreadCount };
  },

  async markNotificationAsRead(id: string, customerAccountId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.customerNotification.updateMany({
      where: { id, customerAccountId },
      data: { isRead: true },
    });
  },
};
