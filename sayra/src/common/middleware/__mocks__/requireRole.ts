// src/common/middleware/__mocks__/requireRole.ts
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import createHttpError from 'http-errors';

export const requireRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // In our tests, the actor object is manually set.
    // We'll check the role on that object.
    const actorRole = req.actor?.role;
    if (actorRole && roles.includes(actorRole)) {
      next();
    } else {
      next(createHttpError(403, 'Forbidden: You do not have the required permissions.'));
    }
  };
};
