import { Router } from 'express';
import * as CatalogController from './catalog.controller';
import { validate } from '../../common/middleware/validate';
import {
  createDeviceTypeSchema,
  updateDeviceTypeSchema,
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
import multer from 'multer';

const catalogUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed') as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    }
  },
});

// ==========================================
// Platform Admin Catalog Router
// ==========================================
export const platformAdminCatalogRouter = Router();

// Protect all admin catalog routes with auth and requirePlatformAdmin
platformAdminCatalogRouter.use(authMiddleware, requirePlatformAdmin, privateApiRateLimiter);

// Device Types (Dynamic Types)
platformAdminCatalogRouter.post(
  '/device-types',
  validate(createDeviceTypeSchema),
  asyncHandler(CatalogController.createDeviceType)
);
platformAdminCatalogRouter.get(
  '/device-types',
  asyncHandler(CatalogController.getDeviceTypes)
);
platformAdminCatalogRouter.get(
  '/device-types/:id',
  validate(catalogIdParamSchema),
  asyncHandler(CatalogController.getDeviceTypeById)
);
platformAdminCatalogRouter.patch(
  '/device-types/:id',
  validate(updateDeviceTypeSchema),
  asyncHandler(CatalogController.updateDeviceType)
);
platformAdminCatalogRouter.delete(
  '/device-types/:id',
  validate(catalogIdParamSchema),
  asyncHandler(CatalogController.deleteDeviceType)
);

// Devices
platformAdminCatalogRouter.post(
  '/devices',
  catalogUpload.single('file'),
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
  catalogUpload.single('file'),
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
  catalogUpload.single('file'),
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
  catalogUpload.single('file'),
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

// Device Types (Public / Manager)
publicCatalogRouter.get(
  '/device-types',
  publicApiRateLimiter,
  (req, _res, next) => {
    if (req.query.isActive === undefined) {
      req.query.isActive = 'true';
    }
    next();
  },
  asyncHandler(CatalogController.getDeviceTypes)
);

publicCatalogRouter.get(
  '/device-types/:id',
  publicApiRateLimiter,
  validate(catalogIdParamSchema),
  asyncHandler(CatalogController.getDeviceTypeById)
);

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
