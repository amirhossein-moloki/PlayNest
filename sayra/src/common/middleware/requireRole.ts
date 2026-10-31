import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';
import { UserRole } from '@prisma/client';

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const actor = (req as any).actor; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (!actor || !actor.role) {
      return next(
        new AppError('User role could not be determined from the request actor.', httpStatus.INTERNAL_SERVER_ERROR),
      );
    }

    if (actor.actorType === 'PLATFORM_ADMIN' || actor.isSuperuser) {
      return next();
    }

    if (allowedRoles.includes(actor.role)) {
      return next();
    } else {
      return next(
        new AppError('Forbidden: You do not have the required permissions.', httpStatus.FORBIDDEN),
      );
    }
  };
};
