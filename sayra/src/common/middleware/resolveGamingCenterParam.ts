import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import AppError from '../errors/AppError';
import { asyncHandler } from './asyncHandler';
import { resolveTenantByIdOrSlug } from '../utils/tenantCache';

/**
 * Shared middleware to resolve a gamingCenter by ID or slug param (`gamingCenterId`)
 * using Redis cache + DB fallback and attach tenant context to `req.tenant`.
 */
export const resolveGamingCenterParam = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const centerIdentifier = req.params.gamingCenterId;
    if (!centerIdentifier) {
      return next(new AppError('GamingCenter ID is missing from request params.', httpStatus.BAD_REQUEST));
    }

    const gamingCenter = await resolveTenantByIdOrSlug(centerIdentifier);
    if (!gamingCenter) {
      return next(new AppError('GamingCenter not found', httpStatus.NOT_FOUND));
    }

    req.tenant = { gamingCenterId: gamingCenter.id, gamingCenterSlug: gamingCenter.slug };
    req.gamingCenterId = gamingCenter.id;
    next();
  }
);
