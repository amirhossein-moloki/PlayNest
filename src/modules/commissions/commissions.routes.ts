
import { Router } from 'express';
import * as commissionsController from './commissions.controller';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { validate } from '../../common/middleware/validate';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import {
  upsertPolicySchema,
  listCommissionsQuerySchema,
  recordCommissionPaymentSchema,
} from './commissions.validators';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(tenantGuard);

// Only Managers can view/manage policies and record payments
router.get(
  '/policy',
  requireRole([UserRole.MANAGER]),
  asyncHandler(commissionsController.getPolicy)
);

router.post(
  '/policy',
  requireRole([UserRole.MANAGER]),
  validate(upsertPolicySchema),
  asyncHandler(commissionsController.upsertPolicy)
);

router.get(
  '/',
  requireRole([UserRole.MANAGER]),
  validate(listCommissionsQuerySchema),
  asyncHandler(commissionsController.listCommissions)
);

router.post(
  '/:earningId/pay',
  requireRole([UserRole.MANAGER]),
  validate(recordCommissionPaymentSchema),
  asyncHandler(commissionsController.payCommission)
);

export const commissionsRoutes = router;
