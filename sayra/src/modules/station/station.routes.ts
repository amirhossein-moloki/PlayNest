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
import { prisma } from '../../config/prisma';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import {
  privateApiRateLimiter,
  publicApiRateLimiter,
} from '../../common/middleware/rateLimit';
import { asyncHandler } from '../../common/middleware/asyncHandler';

// --- Station Router (mounted under /api/v1/gamingCenters/:gamingCenterId/stations) ---
export const privateStationRouter = Router({ mergeParams: true });

// Public station list for gaming center (matches OpenAPI GET /gamingCenters/{gamingCenterId}/stations)
privateStationRouter.get(
  '/',
  publicApiRateLimiter,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const centerIdentifier = req.params.gamingCenterId;
    if (!centerIdentifier) {
      return next(new AppError('GamingCenter ID is missing from request params.', httpStatus.BAD_REQUEST));
    }
    let gamingCenter = await prisma.gamingCenter.findUnique({
      where: { id: centerIdentifier },
    });
    if (!gamingCenter) {
      gamingCenter = await prisma.gamingCenter.findFirst({
        where: {
          OR: [{ id: centerIdentifier }, { slug: centerIdentifier }],
          isActive: true,
        },
      });
    }
    if (!gamingCenter) {
      return next(new AppError('GamingCenter not found', httpStatus.NOT_FOUND));
    }
    req.tenant = { gamingCenterId: gamingCenter.id, gamingCenterSlug: gamingCenter.slug };
    req.gamingCenterId = gamingCenter.id;
    next();
  }),
  asyncHandler(StationController.getStations)
);

// Protected routes - Require authentication, tenant isolation, and appropriate roles
privateStationRouter.post(
  '/',
  privateApiRateLimiter,
  authMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER]),
  validate(createStationSchema),
  asyncHandler(StationController.createStation)
);

privateStationRouter.get(
  '/:stationId',
  privateApiRateLimiter,
  authMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER, UserRole.ADMIN]),
  validate(stationIdParamSchema),
  asyncHandler(StationController.getStationById)
);

privateStationRouter.patch(
  '/:stationId',
  privateApiRateLimiter,
  authMiddleware,
  tenantGuard,
  requireRole([UserRole.MANAGER]),
  validate(updateStationSchema),
  asyncHandler(StationController.updateStation)
);

privateStationRouter.delete(
  '/:stationId',
  privateApiRateLimiter,
  authMiddleware,
  tenantGuard,
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
