import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';
import { UserRole } from '@prisma/client';

// This is a higher-order function that takes an array of allowed roles
// and returns a middleware function.
export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // This middleware must run AFTER authMiddleware, so req.actor should exist.
    const actor = (req as any).actor; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (!actor || !actor.role) {
      // This indicates a server-side configuration error.
      // authMiddleware should have been called first.
      return next(
        new AppError('User role could not be determined from the request actor.', httpStatus.INTERNAL_SERVER_ERROR),
      );
    }

    if (allowedRoles.includes(actor.role)) {
      // User has one of the allowed roles, proceed to the next handler.
      return next();
    } else {
      // User's role is not in the allowed list, deny access.
      return next(
        new AppError('Forbidden: You do not have the required permissions.', httpStatus.FORBIDDEN),
      );
    }
  };
};
