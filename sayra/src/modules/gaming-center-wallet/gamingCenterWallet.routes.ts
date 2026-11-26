import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authMiddleware } from '../../common/middleware/auth';
import { gamingCenterIdMiddleware } from '../../common/middleware/gamingCenterId.middleware';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { GamingCenterWalletController } from './gamingCenterWallet.controller';
import {
  requestGamingCenterWithdrawalSchema,
  listGamingCenterWithdrawalsSchema,
  gamingCenterWithdrawalIdParamSchema,
  listGamingCenterTransactionsSchema,
  gamingCenterTransactionIdParamSchema,
} from './gamingCenterWallet.validators';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(gamingCenterIdMiddleware);
router.use(tenantGuard);
router.use(requireRole([UserRole.MANAGER]));

router.get('/', asyncHandler(GamingCenterWalletController.getWalletOverview));

router.post(
  '/withdraw',
  validate(requestGamingCenterWithdrawalSchema),
  asyncHandler(GamingCenterWalletController.requestWithdrawal)
);

router.get(
  '/withdrawals',
  validate(listGamingCenterWithdrawalsSchema),
  asyncHandler(GamingCenterWalletController.listWithdrawals)
);

router.get(
  '/withdrawals/:id',
  validate(gamingCenterWithdrawalIdParamSchema),
  asyncHandler(GamingCenterWalletController.getWithdrawalDetails)
);

router.get(
  '/transactions',
  validate(listGamingCenterTransactionsSchema),
  asyncHandler(GamingCenterWalletController.listTransactions)
);

router.get(
  '/transactions/:id',
  validate(gamingCenterTransactionIdParamSchema),
  asyncHandler(GamingCenterWalletController.getTransactionDetails)
);

export const gamingCenterWalletRoutes = router;
