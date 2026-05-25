import { Router, Request, Response, NextFunction } from 'express';
import * as ServiceController from './stations.controller';
import { validate } from '../../common/middleware/validate';
import {
  createServiceSchema,
  updateServiceSchema,
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

// --- Private Router (to be mounted under /api/v1/gamingCenters/:gamingCenterId/stations) ---
export const privateServiceRouter = Router({ mergeParams: true });

privateServiceRouter.use(privateApiRateLimiter, authMiddleware, tenantGuard);

privateServiceRouter.post(
  '/',
  requireRole([UserRole.MANAGER]),
  validate(createServiceSchema),
  ServiceController.createService
);

privateServiceRouter.get(
  '/',
  requireRole([UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.STAFF]),
  ServiceController.getServices
);

privateServiceRouter.get(
  '/:stationId',
  requireRole([UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.STAFF]),
  validate(serviceIdParamSchema),
  ServiceController.getServiceById
);

privateServiceRouter.patch(
  '/:stationId',
  requireRole([UserRole.MANAGER]),
  validate(updateServiceSchema),
  ServiceController.updateService
);

privateServiceRouter.delete(
  '/:stationId',
  requireRole([UserRole.MANAGER]),
  validate(serviceIdParamSchema),
  ServiceController.deleteService
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
  ServiceController.getServices
);
