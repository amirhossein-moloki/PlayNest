import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';
import { prisma } from '../../config/prisma';

/**
 * This middleware enforces tenant isolation for private routes.
 * It ensures that the authenticated user (actor) belongs to the gamingCenter
 * they are trying to access.
 *
 * If the actor is a PLATFORM_ADMIN (isSuperuser === true), they may access
 * ANY gaming center, provided that the gaming center actually exists.
 *
 * It must be placed AFTER the authMiddleware.
 *
 * @throws {HttpError} 404 - If gamingCenterId does not match or gamingCenter does not exist.
 * @throws {HttpError} 500 - If the actor object is not found on the request.
 */
export const tenantGuard = async (req: Request, res: Response, next: NextFunction) => {
  const { gamingCenterId } = req.params;
  const actor = (req as any).actor; // eslint-disable-line @typescript-eslint/no-explicit-any

  if (!actor) {
    return next(
      new AppError('User context (actor) not found on request.', httpStatus.INTERNAL_SERVER_ERROR)
    );
  }

  // Check if actor is PLATFORM_ADMIN / superuser
  if (actor.actorType === 'PLATFORM_ADMIN' || actor.isSuperuser) {
    if (!gamingCenterId) {
      return next(new AppError('GamingCenter not found.', httpStatus.NOT_FOUND));
    }

    try {
      const center = await (prisma as any).gamingCenter.findUnique /* eslint-disable-line @typescript-eslint/no-explicit-any */({
        where: { id: gamingCenterId },
        select: { id: true, slug: true },
      });

      if (!center) {
        return next(new AppError('GamingCenter not found.', httpStatus.NOT_FOUND));
      }

      (req as any).tenant = { gamingCenterId: center.id, gamingCenterSlug: center.slug }; // eslint-disable-line @typescript-eslint/no-explicit-any
      return next();
    } catch (err) {
      return next(err);
    }
  }

  // Ordinary tenant users: Every user accessing a tenant route MUST have a gamingCenterId.
  if (!actor.gamingCenterId) {
    return next(new AppError('GamingCenter not found.', httpStatus.NOT_FOUND));
  }

  if (actor.gamingCenterId !== gamingCenterId) {
    // Use 404 to prevent tenant enumeration attacks.
    return next(new AppError('GamingCenter not found.', httpStatus.NOT_FOUND));
  }

  // Attach tenant context to the request for use in downstream stations/repos.
  (req as any).tenant = { gamingCenterId }; // eslint-disable-line @typescript-eslint/no-explicit-any

  next();
};
