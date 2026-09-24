import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import * as discountsController from './discounts.controller';
import {
  createDiscountSchema,
  discountParamSchema,
  listDiscountQuerySchema,
  updateDiscountSchema,
  updateDiscountStatusSchema,
} from './discounts.dto';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(tenantGuard);

const ALLOWED_ROLES = [UserRole.MANAGER, UserRole.ADMIN];

router.post(
  '/',
  requireRole(ALLOWED_ROLES),
  validate(createDiscountSchema),
  asyncHandler(discountsController.createDiscount)
);

router.get(
  '/',
  requireRole(ALLOWED_ROLES),
  validate(listDiscountQuerySchema),
  asyncHandler(discountsController.listDiscounts)
);

router.get(
  '/:id',
  requireRole(ALLOWED_ROLES),
  validate(discountParamSchema),
  asyncHandler(discountsController.getDiscountById)
);

router.patch(
  '/:id',
  requireRole(ALLOWED_ROLES),
  validate(updateDiscountSchema),
  asyncHandler(discountsController.updateDiscount)
);

router.patch(
  '/:id/status',
  requireRole(ALLOWED_ROLES),
  validate(updateDiscountStatusSchema),
  asyncHandler(discountsController.updateDiscountStatus)
);

router.delete(
  '/:id',
  requireRole(ALLOWED_ROLES),
  validate(discountParamSchema),
  asyncHandler(discountsController.deleteDiscount)
);

export const discountsRoutes = router;
