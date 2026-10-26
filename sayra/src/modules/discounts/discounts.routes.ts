import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authMiddleware } from '../../common/middleware/auth';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { requireRole } from '../../common/middleware/requireRole';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import * as discountsController from './discounts.controller';
import {
  createCampaignSchema,
  createDiscountSchema,
  discountParamSchema,
  listDiscountQuerySchema,
  updateCampaignSchema,
  updateDiscountSchema,
  updateDiscountStatusSchema,
  validatePromoCodeSchema,
} from './discounts.dto';

const router = Router({ mergeParams: true });

router.use(authMiddleware);
router.use(tenantGuard);

const ALLOWED_ROLES = [UserRole.MANAGER, UserRole.ADMIN];

// Campaign Routes
router.post(
  '/campaigns',
  requireRole(ALLOWED_ROLES),
  validate(createCampaignSchema),
  asyncHandler(discountsController.createCampaign)
);

router.get(
  '/campaigns',
  requireRole(ALLOWED_ROLES),
  asyncHandler(discountsController.listCampaigns)
);

router.get(
  '/campaigns/:id',
  requireRole(ALLOWED_ROLES),
  asyncHandler(discountsController.getCampaignById)
);

router.patch(
  '/campaigns/:id',
  requireRole(ALLOWED_ROLES),
  validate(updateCampaignSchema),
  asyncHandler(discountsController.updateCampaign)
);

// Promo Code Validation Endpoint
router.post(
  '/validate',
  validate(validatePromoCodeSchema),
  asyncHandler(discountsController.validatePromoCode)
);

// Direct Station/Center Discounts Routes
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
