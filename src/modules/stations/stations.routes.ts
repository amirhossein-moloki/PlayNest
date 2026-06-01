import { Router, Request, Response, NextFunction } from 'express';
import * as ServiceController from './stations.controller';
import { validate } from '../../common/middleware/validate';
import {
  createStationSchema,
  updateStationSchema,
  serviceIdParamSchema,
} from './stations.validators';
import { authMiddleware } from '../../common/middleware/auth';
import { requireRole } from '../../common/middleware/requireRole';
import { tenantGuard } from '../../common/middleware/tenantGuard';
import { resolveSalonBySlug } from '../../common/middleware/resolveSalonBySlug';
import { UserRole } from '@prisma/client';
import {
  privateApiRateLimiter,
  publicApiRateLimiter,
} from '../../common/middleware/rateLimit';
import { asyncHandler } from '../../common/middleware/asyncHandler';

// --- Private Router (to be mounted under /api/v1/gamingCenters/:gamingCenterId/stations) ---
export const privateServiceRouter = Router({ mergeParams: true });

privateServiceRouter.use(privateApiRateLimiter, authMiddleware, tenantGuard);

privateServiceRouter.post(
  '/',
  requireRole([UserRole.MANAGER]),
  validate(createStationSchema),
  asyncHandler(ServiceController.createStation)
);

privateServiceRouter.get(
  '/',
  requireRole([UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.STAFF]),
  asyncHandler(ServiceController.getServices)
);

privateServiceRouter.get(
  '/:stationId',
  requireRole([UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.STAFF]),
  validate(serviceIdParamSchema),
  asyncHandler(ServiceController.getStationById)
);

privateServiceRouter.patch(
  '/:stationId',
  requireRole([UserRole.MANAGER]),
  validate(updateStationSchema),
  asyncHandler(ServiceController.updateStation)
);

privateServiceRouter.delete(
  '/:stationId',
  requireRole([UserRole.MANAGER]),
  validate(serviceIdParamSchema),
  asyncHandler(ServiceController.deleteService)
);

// --- Public Router (to be mounted under /api/v1/public/gamingCenters/:salonSlug/stations) ---
export const publicServiceRouter = Router({ mergeParams: true });

publicServiceRouter.get(
  '/',
  publicApiRateLimiter,
  resolveSalonBySlug,
  (req: Request, res: Response, next: NextFunction) => {
    // For public-facing routes, we should only show active stations.
    req.query.isActive = 'true';
    next();
  },
  asyncHandler(ServiceController.getServices)
);
