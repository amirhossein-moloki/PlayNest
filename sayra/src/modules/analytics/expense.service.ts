import { prisma } from '../../config/prisma';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { ExpenseCategory, ExpenseStatus, Prisma } from '@prisma/client';

export interface CreateExpenseInput {
  gamingCenterId: string;
  category: ExpenseCategory;
  amount: number;
  currency?: string;
  expenseDate: Date;
  description?: string;
  referenceNumber?: string;
  status?: ExpenseStatus;
  createdById?: string;
}

export interface UpdateExpenseInput {
  category?: ExpenseCategory;
  amount?: number;
  currency?: string;
  expenseDate?: Date;
  description?: string;
  referenceNumber?: string;
  status?: ExpenseStatus;
  approvedById?: string;
}

export const ExpenseService = {
  async createExpense(input: CreateExpenseInput) {
    if (input.amount <= 0) {
      throw new AppError('Expense amount must be greater than zero.', httpStatus.BAD_REQUEST);
    }

    const expense = await prisma.gamingCenterExpense.create({
      data: {
        gamingCenterId: input.gamingCenterId,
        category: input.category,
        amount: input.amount,
        currency: input.currency || 'IRR',
        expenseDate: input.expenseDate,
        description: input.description || null,
        referenceNumber: input.referenceNumber || null,
        status: input.status || ExpenseStatus.APPROVED,
        createdById: input.createdById || null,
        approvedById: input.status === ExpenseStatus.APPROVED ? input.createdById || null : null,
      },
    });

    // Record Audit Log
    await prisma.auditLog.create({
      data: {
        gamingCenterId: input.gamingCenterId,
        userId: input.createdById || null,
        action: 'EXPENSE_CREATED',
        entity: 'GamingCenterExpense',
        entityId: expense.id,
        newData: expense as unknown as Prisma.InputJsonValue,
      },
    });

    return expense;
  },

  async getExpenses(
    gamingCenterId: string,
    startDate?: Date,
    endDate?: Date,
    category?: ExpenseCategory,
    status?: ExpenseStatus
  ) {
    const where: Prisma.GamingCenterExpenseWhereInput = {
      gamingCenterId,
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
    };

    if (startDate || endDate) {
      where.expenseDate = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    const [expenses, totalSum] = await Promise.all([
      prisma.gamingCenterExpense.findMany({
        where,
        orderBy: { expenseDate: 'desc' },
      }),
      prisma.gamingCenterExpense.aggregate({
        where: { ...where, status: ExpenseStatus.APPROVED },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    return {
      expenses,
      summary: {
        totalApprovedAmount: totalSum._sum.amount || 0,
        count: totalSum._count._all,
      },
    };
  },

  async getExpenseById(gamingCenterId: string, id: string) {
    const expense = await prisma.gamingCenterExpense.findFirst({
      where: { id, gamingCenterId },
    });

    if (!expense) {
      throw new AppError('Expense record not found.', httpStatus.NOT_FOUND);
    }

    return expense;
  },

  async updateExpense(gamingCenterId: string, id: string, input: UpdateExpenseInput, userId?: string) {
    const existing = await this.getExpenseById(gamingCenterId, id);

    if (existing.status === ExpenseStatus.VOID) {
      throw new AppError('Cannot update a voided expense.', httpStatus.BAD_REQUEST);
    }

    if (input.amount !== undefined && input.amount <= 0) {
      throw new AppError('Expense amount must be greater than zero.', httpStatus.BAD_REQUEST);
    }

    const updated = await prisma.gamingCenterExpense.update({
      where: { id },
      data: {
        ...(input.category ? { category: input.category } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.currency ? { currency: input.currency } : {}),
        ...(input.expenseDate ? { expenseDate: input.expenseDate } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.referenceNumber !== undefined ? { referenceNumber: input.referenceNumber } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.approvedById ? { approvedById: input.approvedById } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        gamingCenterId,
        userId: userId || null,
        action: 'EXPENSE_UPDATED',
        entity: 'GamingCenterExpense',
        entityId: id,
        oldData: existing as unknown as Prisma.InputJsonValue,
        newData: updated as unknown as Prisma.InputJsonValue,
      },
    });

    return updated;
  },

  async approveExpense(gamingCenterId: string, id: string, approvedById: string) {
    const existing = await this.getExpenseById(gamingCenterId, id);

    if (existing.status === ExpenseStatus.VOID) {
      throw new AppError('Cannot approve a voided expense.', httpStatus.BAD_REQUEST);
    }

    const updated = await prisma.gamingCenterExpense.update({
      where: { id },
      data: {
        status: ExpenseStatus.APPROVED,
        approvedById,
      },
    });

    await prisma.auditLog.create({
      data: {
        gamingCenterId,
        userId: approvedById,
        action: 'EXPENSE_APPROVED',
        entity: 'GamingCenterExpense',
        entityId: id,
        oldData: existing as unknown as Prisma.InputJsonValue,
        newData: updated as unknown as Prisma.InputJsonValue,
      },
    });

    return updated;
  },

  async voidExpense(gamingCenterId: string, id: string, userId?: string) {
    const existing = await this.getExpenseById(gamingCenterId, id);

    const updated = await prisma.gamingCenterExpense.update({
      where: { id },
      data: {
        status: ExpenseStatus.VOID,
      },
    });

    await prisma.auditLog.create({
      data: {
        gamingCenterId,
        userId: userId || null,
        action: 'EXPENSE_VOIDED',
        entity: 'GamingCenterExpense',
        entityId: id,
        oldData: existing as unknown as Prisma.InputJsonValue,
        newData: updated as unknown as Prisma.InputJsonValue,
      },
    });

    return updated;
  },
};
