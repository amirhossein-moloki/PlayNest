import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';
import { verifyToken } from '../../modules/auth/auth.tokens';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import redis from '../../config/redis';
import logger from '../../config/logger';
import { UserRole } from '@prisma/client';

const AUTH_CACHE_TTL_SECONDS = 60;

export const getActorCacheKey = (actorId: string, actorType: string): string => {
  return `auth:actor:${actorType}:${actorId}`;
};

export const invalidateActorCache = async (actorId: string, actorType: string): Promise<void> => {
  try {
    const cacheKey = getActorCacheKey(actorId, actorType);
    await redis.del(cacheKey);
  } catch (error) {
    logger.error({ error, actorId, actorType }, 'Failed to invalidate actor cache in Redis');
  }
};

interface CachedActor {
  id: string;
  actorId: string;
  role?: UserRole;
  gamingCenterId?: string;
  actorType: 'USER' | 'CUSTOMER';
  isActive?: boolean;
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authorization header is missing or invalid', httpStatus.UNAUTHORIZED));
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token, env.JWT_ACCESS_SECRET);
  if (!payload || !payload.actorId) {
    return next(new AppError('Invalid or expired token', httpStatus.UNAUTHORIZED));
  }

  const { actorId, actorType, sessionId } = payload;
  const cacheKey = getActorCacheKey(actorId, actorType);

  let cachedActor: CachedActor | null = null;

  // 1. Attempt Redis read
  try {
    const rawData = await redis.get(cacheKey);
    if (rawData) {
      cachedActor = JSON.parse(rawData) as CachedActor;
    }
  } catch (error) {
    logger.warn({ error, actorId }, 'Redis read error in authMiddleware, falling back to database');
  }

  // 2. Cache Hit validation
  if (cachedActor) {
    if (cachedActor.isActive === false) {
      return next(new AppError('User account is deactivated', httpStatus.UNAUTHORIZED));
    }

    req.actor = {
      id: cachedActor.id,
      actorId: cachedActor.actorId,
      role: cachedActor.role,
      gamingCenterId: cachedActor.gamingCenterId,
      actorType: cachedActor.actorType,
      sessionId: sessionId as string | undefined,
    };
    return next();
  }

  // 3. Cache Miss - Query database
  let user;
  if (actorType === 'USER') {
    user = await prisma.user.findUnique({ where: { id: actorId } });
  } else {
    user = await prisma.customerAccount.findUnique({ where: { id: actorId } });
  }

  if (!user) {
    return next(new AppError('User not found', httpStatus.UNAUTHORIZED));
  }

  const isActive = 'isActive' in user ? (user as { isActive?: boolean }).isActive !== false : true;
  if (!isActive) {
    return next(new AppError('User account is deactivated', httpStatus.UNAUTHORIZED));
  }

  const role = 'role' in user ? (user as { role?: UserRole }).role : undefined;
  const gamingCenterId = 'gamingCenterId' in user ? (user as { gamingCenterId?: string }).gamingCenterId : undefined;

  const actorData: CachedActor = {
    id: user.id,
    actorId,
    role,
    gamingCenterId,
    actorType,
    isActive,
  };

  // 4. Attempt Redis write (non-blocking errors)
  try {
    await redis.set(cacheKey, JSON.stringify(actorData), 'EX', AUTH_CACHE_TTL_SECONDS);
  } catch (error) {
    logger.warn({ error, actorId }, 'Redis write error in authMiddleware');
  }

  req.actor = {
    id: user.id,
    actorId,
    role,
    gamingCenterId,
    actorType,
    sessionId: sessionId as string | undefined,
  };

  next();
};
