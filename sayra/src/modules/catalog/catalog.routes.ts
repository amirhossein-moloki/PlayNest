import { Router } from 'express';
import * as CatalogController from './catalog.controller';
import { validate } from '../../common/middleware/validate';
import {
  createDeviceCatalogSchema,
  updateDeviceCatalogSchema,
  createGameCatalogSchema,
  updateGameCatalogSchema,
  catalogIdParamSchema,
} from './catalog.validator';
import { authMiddleware } from '../../common/middleware/auth';
import { requirePlatformAdmin } from '../../common/middleware/requirePlatformAdmin';
import { privateApiRateLimiter, publicApiRateLimiter } from '../../common/middleware/rateLimit';
import { asyncHandler } from '../../common/middleware/asyncHandler';

// ==========================================
// Platform Admin Catalog Router
// ==========================================
export const platformAdminCatalogRouter = Router();

// Protect all admin catalog routes with auth and requirePlatformAdmin
platformAdminCatalogRouter.use(authMiddleware, requirePlatformAdmin, privateApiRateLimiter);

// Devices
platformAdminCatalogRouter.post(
  '/devices',
  validate(createDeviceCatalogSchema),
  asyncHandler(CatalogController.createDevice)
);
platformAdminCatalogRouter.get(
  '/devices',
  asyncHandler(CatalogController.getDevices)
);
platformAdminCatalogRouter.get(
  '/devices/:id',
  validate(catalogIdParamSchema),
  asyncHandler(CatalogController.getDeviceById)
);
platformAdminCatalogRouter.patch(
  '/devices/:id',
  validate(updateDeviceCatalogSchema),
  asyncHandler(CatalogController.updateDevice)
);
platformAdminCatalogRouter.delete(
  '/devices/:id',
  validate(catalogIdParamSchema),
  asyncHandler(CatalogController.deleteDevice)
);

// Games
platformAdminCatalogRouter.post(
  '/games',
  validate(createGameCatalogSchema),
  asyncHandler(CatalogController.createGame)
);
platformAdminCatalogRouter.get(
  '/games',
  asyncHandler(CatalogController.getGames)
);
platformAdminCatalogRouter.get(
  '/games/:id',
  validate(catalogIdParamSchema),
  asyncHandler(CatalogController.getGameById)
);
platformAdminCatalogRouter.patch(
  '/games/:id',
  validate(updateGameCatalogSchema),
  asyncHandler(CatalogController.updateGame)
);
platformAdminCatalogRouter.delete(
  '/games/:id',
  validate(catalogIdParamSchema),
  asyncHandler(CatalogController.deleteGame)
);

// ==========================================
// Public / Gaming Center Manager Catalog Router
// ==========================================
export const publicCatalogRouter = Router();

// Allow authenticated users (managers, staff, admins) or public to view active catalog items
publicCatalogRouter.get(
  '/devices',
  publicApiRateLimiter,
  (req, _res, next) => {
    // Default to active devices unless explicitly permitted
    if (req.query.isActive === undefined) {
      req.query.isActive = 'true';
    }
    next();
  },
  asyncHandler(CatalogController.getDevices)
);

publicCatalogRouter.get(
  '/devices/:id',
  publicApiRateLimiter,
  validate(catalogIdParamSchema),
  asyncHandler(CatalogController.getDeviceById)
);

publicCatalogRouter.get(
  '/games',
  publicApiRateLimiter,
  (req, _res, next) => {
    // Default to active games unless explicitly permitted
    if (req.query.isActive === undefined) {
      req.query.isActive = 'true';
    }
    next();
  },
  asyncHandler(CatalogController.getGames)
);

publicCatalogRouter.get(
  '/games/:id',
  publicApiRateLimiter,
  validate(catalogIdParamSchema),
  asyncHandler(CatalogController.getGameById)
);
