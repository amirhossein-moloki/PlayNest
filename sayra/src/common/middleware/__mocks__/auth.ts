// src/common/middleware/__mocks__/auth.ts
import { Request, Response, NextFunction } from 'express';
import { SessionActorType } from '@prisma/client';
import createHttpError from 'http-errors';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // In our tests, we'll manually set the actor on the request object
  // to simulate an authenticated user.
  if (req.headers.authorization) {
    const token = req.headers.authorization.split(' ')[1];
    if (token === 'mock-manager-token') {
      req.actor = {
        id: 'mock-manager-id',
        role: 'MANAGER',
        gamingCenterId: req.params.gamingCenterId,
        actorType: SessionActorType.USER,
      };
    } else if (token === 'mock-staff-token') {
      req.actor = {
        id: 'mock-staff-id',
        role: 'STAFF',
        gamingCenterId: req.params.gamingCenterId,
        actorType: SessionActorType.USER,
      };
    }
    return next();
  }
  return next(createHttpError(401, 'Authorization header is missing or invalid'));
};
