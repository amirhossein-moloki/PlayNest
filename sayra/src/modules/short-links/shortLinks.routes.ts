import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { authMiddleware } from '../../common/middleware/auth';
import {
  privateApiRateLimiter,
  shortLinkCreateRateLimiter,
  shortLinkQrRateLimiter,
  shortLinkRedirectRateLimiter,
} from '../../common/middleware/rateLimit';
import { requirePlatformAdmin } from '../../common/middleware/requirePlatformAdmin';
import { requireRole } from '../../common/middleware/requireRole';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { validate } from '../../common/middleware/validate';
import { ShortLinksController } from './shortLinks.controller';
import {
  campaignIdParamSchema,
  changeDestinationSchema,
  createDomainRuleSchema,
  createShortLinkCampaignSchema,
  createShortLinkSchema,
  domainRuleIdParamSchema,
  shortLinkIdParamSchema,
  updateCampaignStatusSchema,
  updateDomainRuleSchema,
  updateShortLinkCampaignSchema,
  updateShortLinkSchema,
  updateShortLinkStatusSchema,
} from './shortLinks.validators';

function mountLinkManagementRoutes(router: Router): void {
  router.post(
    '/',
    shortLinkCreateRateLimiter,
    validate(createShortLinkSchema),
    asyncHandler(ShortLinksController.createLink)
  );
  router.get('/', asyncHandler(ShortLinksController.listLinks));
  router.get(
    '/:linkId',
    validate(shortLinkIdParamSchema),
    asyncHandler(ShortLinksController.getLinkById)
  );
  router.patch(
    '/:linkId',
    validate(updateShortLinkSchema),
    asyncHandler(ShortLinksController.updateLink)
  );
  router.patch(
    '/:linkId/destination',
    validate(changeDestinationSchema),
    asyncHandler(ShortLinksController.changeDestination)
  );
  router.patch(
    '/:linkId/status',
    validate(updateShortLinkStatusSchema),
    asyncHandler(ShortLinksController.updateLinkStatus)
  );
  router.delete(
    '/:linkId',
    validate(shortLinkIdParamSchema),
    asyncHandler(ShortLinksController.deleteLink)
  );
  router.get(
    '/:linkId/history',
    validate(shortLinkIdParamSchema),
    asyncHandler(ShortLinksController.getLinkHistory)
  );
  router.get(
    '/:linkId/stats',
    validate(shortLinkIdParamSchema),
    asyncHandler(ShortLinksController.getLinkStats)
  );
  router.get(
    '/:linkId/qr',
    shortLinkQrRateLimiter,
    validate(shortLinkIdParamSchema),
    asyncHandler(ShortLinksController.getLinkQr)
  );
}

function mountCampaignRoutes(router: Router): void {
  router.post(
    '/',
    validate(createShortLinkCampaignSchema),
    asyncHandler(ShortLinksController.createCampaign)
  );
  router.get('/', asyncHandler(ShortLinksController.listCampaigns));
  router.get(
    '/:campaignId',
    validate(campaignIdParamSchema),
    asyncHandler(ShortLinksController.getCampaignById)
  );
  router.patch(
    '/:campaignId',
    validate(updateShortLinkCampaignSchema),
    asyncHandler(ShortLinksController.updateCampaign)
  );
  router.patch(
    '/:campaignId/status',
    validate(updateCampaignStatusSchema),
    asyncHandler(ShortLinksController.updateCampaignStatus)
  );
  router.delete(
    '/:campaignId',
    validate(campaignIdParamSchema),
    asyncHandler(ShortLinksController.deleteCampaign)
  );
  router.get(
    '/:campaignId/stats',
    validate(campaignIdParamSchema),
    asyncHandler(ShortLinksController.getCampaignStats)
  );
}

// 1. Public Fast Redirect Router (/r/:code, /s/:code, /api/v1/short-links/r/:code)
export const shortLinkRedirectRouter = Router();
shortLinkRedirectRouter.get(
  '/:code',
  shortLinkRedirectRateLimiter,
  asyncHandler(ShortLinksController.redirect)
);

// 2. Gaming Center Scoped Routers (/api/v1/gamingCenters/:gamingCenterId/short-links & short-link-campaigns)
export const gamingCenterShortLinksRouter = Router({ mergeParams: true });
gamingCenterShortLinksRouter.use(
  authMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  privateApiRateLimiter
);
mountLinkManagementRoutes(gamingCenterShortLinksRouter);

export const gamingCenterShortLinkCampaignsRouter = Router({ mergeParams: true });
gamingCenterShortLinkCampaignsRouter.use(
  authMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  privateApiRateLimiter
);
mountCampaignRoutes(gamingCenterShortLinkCampaignsRouter);

// 3. Platform Admin Global Routers (/api/v1/platform-admin/short-links & short-link-campaigns)
export const platformAdminShortLinksRouter = Router();
platformAdminShortLinksRouter.use(authMiddleware, requirePlatformAdmin, privateApiRateLimiter);

// Domain rules MUST be registered before /:linkId wildcard routes
platformAdminShortLinksRouter.get('/domains', asyncHandler(ShortLinksController.listDomainRules));
platformAdminShortLinksRouter.post(
  '/domains',
  validate(createDomainRuleSchema),
  asyncHandler(ShortLinksController.createDomainRule)
);
platformAdminShortLinksRouter.patch(
  '/domains/:ruleId',
  validate(updateDomainRuleSchema),
  asyncHandler(ShortLinksController.updateDomainRule)
);
platformAdminShortLinksRouter.delete(
  '/domains/:ruleId',
  validate(domainRuleIdParamSchema),
  asyncHandler(ShortLinksController.deleteDomainRule)
);
mountLinkManagementRoutes(platformAdminShortLinksRouter);

export const platformAdminShortLinkCampaignsRouter = Router();
platformAdminShortLinkCampaignsRouter.use(authMiddleware, requirePlatformAdmin, privateApiRateLimiter);
mountCampaignRoutes(platformAdminShortLinkCampaignsRouter);

// 4. Actor-Scoped Routers (/api/v1/short-links & /api/v1/short-link-campaigns)
export const scopedShortLinksRouter = Router();
scopedShortLinksRouter.use(authMiddleware, privateApiRateLimiter);
mountLinkManagementRoutes(scopedShortLinksRouter);

export const scopedShortLinkCampaignsRouter = Router();
scopedShortLinkCampaignsRouter.use(authMiddleware, privateApiRateLimiter);
mountCampaignRoutes(scopedShortLinkCampaignsRouter);
