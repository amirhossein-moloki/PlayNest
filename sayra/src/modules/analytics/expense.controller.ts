import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { ExpenseService } from './expense.service';
import { ExpenseCategory, ExpenseStatus } from '@prisma/client';

const createExpense = asyncHandler(async (req: AppRequest, res: Response) => {
  const { category, amount, currency, expenseDate, description, referenceNumber, status } = req.body;

  const result = await ExpenseService.createExpense({
    gamingCenterId: req.tenant.gamingCenterId,
    category,
    amount: Number(amount),
    currency,
    expenseDate: new Date(expenseDate),
    description,
    referenceNumber,
    status,
    createdById: req.actor?.id,
  });

  res.created(result);
});

const getExpenses = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate, category, status } = req.query as {
    startDate?: string;
    endDate?: string;
    category?: ExpenseCategory;
    status?: ExpenseStatus;
  };

  const result = await ExpenseService.getExpenses(
    req.tenant.gamingCenterId,
    startDate ? new Date(startDate) : undefined,
    endDate ? new Date(endDate) : undefined,
    category,
    status
  );

  res.ok(result);
});

const getExpenseById = asyncHandler(async (req: AppRequest, res: Response) => {
  const { id } = req.params;
  const result = await ExpenseService.getExpenseById(req.tenant.gamingCenterId, id);
  res.ok(result);
});

const updateExpense = asyncHandler(async (req: AppRequest, res: Response) => {
  const { id } = req.params;
  const { category, amount, currency, expenseDate, description, referenceNumber, status } = req.body;

  const result = await ExpenseService.updateExpense(
    req.tenant.gamingCenterId,
    id,
    {
      category,
      amount: amount !== undefined ? Number(amount) : undefined,
      currency,
      expenseDate: expenseDate ? new Date(expenseDate) : undefined,
      description,
      referenceNumber,
      status,
    },
    req.actor?.id
  );

  res.ok(result);
});

const approveExpense = asyncHandler(async (req: AppRequest, res: Response) => {
  const { id } = req.params;
  const result = await ExpenseService.approveExpense(req.tenant.gamingCenterId, id, req.actor?.id || '');
  res.ok(result);
});

const voidExpense = asyncHandler(async (req: AppRequest, res: Response) => {
  const { id } = req.params;
  const result = await ExpenseService.voidExpense(req.tenant.gamingCenterId, id, req.actor?.id);
  res.ok(result);
});

export const ExpenseController = {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  approveExpense,
  voidExpense,
};
