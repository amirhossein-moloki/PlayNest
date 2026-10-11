import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';
import { SessionActorType } from '@prisma/client';

export const requireActorType = (allowedType: SessionActorType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const actor = (req as any).actor; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (!actor || !actor.actorType) {
      return next(
        new AppError('Actor type could not be determined from the request actor.', httpStatus.INTERNAL_SERVER_ERROR),
      );
    }

    if (actor.actorType === allowedType) {
      return next();
    } else {
      return next(
        new AppError('Forbidden: This endpoint is restricted to ' + allowedType, httpStatus.FORBIDDEN),
      );
    }
  };
};
