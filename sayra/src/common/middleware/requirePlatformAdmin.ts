import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';

export const requirePlatformAdmin = (req: Request, res: Response, next: NextFunction) => {
  const actor = (req as any).actor; // eslint-disable-line @typescript-eslint/no-explicit-any

  if (!actor) {
    return next(new AppError('Unauthorized', httpStatus.UNAUTHORIZED));
  }

  if (actor.actorType !== 'PLATFORM_ADMIN' && !actor.isSuperuser) {
    return next(
      new AppError('Forbidden: PLATFORM_ADMIN access required.', httpStatus.FORBIDDEN)
    );
  }

  next();
};
