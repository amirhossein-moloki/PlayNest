import { Router, Request, Response, NextFunction } from 'express';
import * as StationController from './station.controller';
import { validate } from '../../common/middleware/validate';
import {
  createStationSchema,
  updateStationSchema,
  stationIdParamSchema,
} from './station.validator';
import { authMiddleware } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/requireRole';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { resolveGamingCenterBySlug } from '../../common/middleware/resolveGamingCenterBySlug';
import { UserRole } from '@prisma/client';
import {
  privateApiRateLimiter,
  publicApiRateLimiter,
} from '../../common/middleware/rateLimit';
import { asyncHandler } from '../../common/middleware/asyncHandler';

// --- Private Router (to be mounted under /api/v1/gamingCenters/:gamingCenterId/stations) ---
export const privateStationRouter = Router({ mergeParams: true });

privateStationRouter.use(privateApiRateLimiter, authMiddleware, tenantGuard);

privateStationRouter.post(
  '/',
  requireRole([UserRole.MANAGER]),
  validate(createStationSchema),
  asyncHandler(StationController.createStation)
);

privateStationRouter.get(
  '/',
  requireRole([UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.STAFF]),
  asyncHandler(StationController.getStations)
);

privateStationRouter.get(
  '/:stationId',
  requireRole([UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.STAFF]),
  validate(stationIdParamSchema),
  asyncHandler(StationController.getStationById)
);

privateStationRouter.patch(
  '/:stationId',
  requireRole([UserRole.MANAGER]),
  validate(updateStationSchema),
  asyncHandler(StationController.updateStation)
);

privateStationRouter.delete(
  '/:stationId',
  requireRole([UserRole.MANAGER]),
  validate(stationIdParamSchema),
  asyncHandler(StationController.deleteStation)
);

// --- Public Router (to be mounted under /api/v1/public/gamingCenters/:gamingCenterSlug/stations) ---
export const publicStationRouter = Router({ mergeParams: true });

publicStationRouter.get(
  '/',
  publicApiRateLimiter,
  resolveGamingCenterBySlug,
  (req: Request, res: Response, next: NextFunction) => {
    // For public-facing routes, we should only show active stations.
    req.query.isActive = 'true';
    next();
  },
  asyncHandler(StationController.getStations)
);
