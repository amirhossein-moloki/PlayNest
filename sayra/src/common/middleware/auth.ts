import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';
import { verifyToken } from '../../modules/auth/auth.tokens';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authorization header is missing or invalid', httpStatus.UNAUTHORIZED));
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token, env.JWT_ACCESS_SECRET);
  if (!payload) {
    return next(new AppError('Invalid or expired token', httpStatus.UNAUTHORIZED));
  }

  let user;
  if (payload.actorType === 'USER') {
    user = await prisma.user.findUnique({ where: { id: payload.actorId } });
  } else {
    if (!payload.actorId) {
      return next(new AppError('Invalid token: actorId is missing.', httpStatus.UNAUTHORIZED));
    }
    user = await prisma.customerAccount.findUnique({ where: { id: payload.actorId } });
  }

  if (!user) {
    return next(new AppError('User not found', httpStatus.UNAUTHORIZED));
  }

  req.actor = {
    id: user.id,
    actorId: payload.actorId,
    role: 'role' in user ? (user as any).role : undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
    gamingCenterId: 'gamingCenterId' in user ? (user as any).gamingCenterId : undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
    actorType: payload.actorType,
    sessionId: payload.sessionId as string | undefined,
  };
  next();
};
