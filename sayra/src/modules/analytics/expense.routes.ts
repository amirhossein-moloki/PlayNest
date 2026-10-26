import { Router } from 'express';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { UserRole } from '@prisma/client';
import { ExpenseController } from './expense.controller';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(tenantGuard);
router.use(requireRole([UserRole.MANAGER, UserRole.ADMIN]));

router.post('/', ExpenseController.createExpense);
router.get('/', ExpenseController.getExpenses);
router.get('/:id', ExpenseController.getExpenseById);
router.patch('/:id', ExpenseController.updateExpense);
router.post('/:id/approve', ExpenseController.approveExpense);
router.delete('/:id', ExpenseController.voidExpense);

export const expenseRoutes = router;
