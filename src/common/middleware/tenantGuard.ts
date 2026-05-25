import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';

/**
 * This middleware enforces tenant isolation for private routes.
 * It ensures that the authenticated user (actor) belongs to the gamingCenter
 * they are trying to access.
 *
 * It must be placed AFTER the authMiddleware.
 *
 * @throws {HttpError} 404 - If gamingCenterId does not match or user is not part of a gamingCenter.
 * @throws {HttpError} 500 - If the actor object is not found on the request.
 */
export const tenantGuard = (req: Request, res: Response, next: NextFunction) => {
  const { gamingCenterId } = req.params;
  const actor = (req as any).actor; // eslint-disable-line @typescript-eslint/no-explicit-any

  if (!actor) {
    // This indicates a server-side configuration error.
    // authMiddleware should have been called first.
    return next(
      new AppError('User context (actor) not found on request.', httpStatus.INTERNAL_SERVER_ERROR)
    );
  }

  // Every user accessing a tenant route MUST have a gamingCenterId.
  if (!actor.gamingCenterId) {
    return next(new AppError('GamingCenter not found.', httpStatus.NOT_FOUND));
  }

  if (actor.gamingCenterId !== gamingCenterId) {
    // Use 404 to prevent tenant enumeration attacks.
    // The user should not know that a gamingCenter with this ID exists.
    return next(new AppError('GamingCenter not found.', httpStatus.NOT_FOUND));
  }

  // Attach tenant context to the request for use in downstream stations/repos.
  (req as any).tenant = { gamingCenterId }; // eslint-disable-line @typescript-eslint/no-explicit-any

  next();
};
