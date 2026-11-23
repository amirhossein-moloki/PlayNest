import { Router } from 'express';
import * as commissionsController from './commissions.controller';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { requirePlatformAdmin } from '../../common/middleware/requirePlatformAdmin';
import { validate } from '../../common/middleware/validate';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import {
  upsertPolicySchema,
  listEarningsQuerySchema,
  recordCommissionPaymentSchema,
  getTargetProgressQuerySchema,
  waiveCommissionSchema,
} from './commissions.validators';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(tenantGuard);

// Managers (and Platform Admins) can view policies, target progress, and commission earnings
router.get(
  '/policy',
  requireRole([UserRole.MANAGER]),
  asyncHandler(commissionsController.getPolicy)
);

router.get(
  '/target-progress',
  requireRole([UserRole.MANAGER]),
  validate(getTargetProgressQuerySchema),
  asyncHandler(commissionsController.getTargetProgress)
);

router.get(
  '/',
  requireRole([UserRole.MANAGER]),
  validate(listEarningsQuerySchema),
  asyncHandler(commissionsController.listEarnings)
);

// Only Platform Admins can mutate policies, record manual commission settlements, or waive commissions
router.post(
  '/policy',
  requirePlatformAdmin,
  validate(upsertPolicySchema),
  asyncHandler(commissionsController.upsertPolicy)
);

router.put(
  '/policy',
  requirePlatformAdmin,
  validate(upsertPolicySchema),
  asyncHandler(commissionsController.upsertPolicy)
);

router.post(
  '/:earningId/pay',
  requirePlatformAdmin,
  validate(recordCommissionPaymentSchema),
  asyncHandler(commissionsController.payCommission)
);

router.post(
  '/:earningId/waive',
  requirePlatformAdmin,
  validate(waiveCommissionSchema),
  asyncHandler(commissionsController.waiveCommission)
);

export const commissionsRoutes = router;
