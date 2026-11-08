import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';
import { verifyToken } from '../../modules/auth/auth.tokens';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import redis from '../../config/redis';
import logger from '../../config/logger';
import { SessionActorType, UserRole } from '@prisma/client';
import { ADMIN_CONSTANTS } from '../../platform-admin/config/admin.constants';

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
  actorType: SessionActorType;
  isActive?: boolean;
  isSuperuser?: boolean;
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  let actorId: string | undefined;
  let actorType: SessionActorType | undefined;
  let sessionId: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token, env.JWT_ACCESS_SECRET);
    if (!payload || !payload.actorId) {
      return next(new AppError('Invalid or expired token', httpStatus.UNAUTHORIZED));
    }
    actorId = payload.actorId;
    actorType = payload.actorType;
    sessionId = payload.sessionId;
  } else {
    // Check if an AdminJS session cookie is present for fallback authentication
    const rawCookie =
      req.signedCookies?.[ADMIN_CONSTANTS.SESSION_COOKIE_NAME] ||
      req.cookies?.[ADMIN_CONSTANTS.SESSION_COOKIE_NAME];

    if (rawCookie) {
      try {
        let adminSessionId = typeof rawCookie === 'string' ? rawCookie : String(rawCookie);
        // If cookie value is an unsigned cookie string with connect.sid format: s:sessId.signature
        if (adminSessionId.startsWith('s:')) {
          adminSessionId = adminSessionId.slice(2).split('.')[0];
        }

        const redisSessionKey = `${ADMIN_CONSTANTS.SESSION_PREFIX}${adminSessionId}`;
        const sessionDataRaw = await redis.get(redisSessionKey);
        if (sessionDataRaw) {
          const sessionObj = JSON.parse(sessionDataRaw);
          const adminUser = sessionObj?.adminUser;
          if (adminUser && adminUser.id) {
            actorId = adminUser.id;
            actorType = SessionActorType.PLATFORM_ADMIN;
            sessionId = adminSessionId;
          }
        }
      } catch (sessionErr) {
        logger.warn({ sessionErr }, 'Failed to parse AdminJS session for fallback auth');
      }
    }

    if (!actorId || !actorType) {
      return next(new AppError('Authorization header is missing or invalid', httpStatus.UNAUTHORIZED));
    }
  }

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
      isSuperuser: cachedActor.isSuperuser,
    };
    return next();
  }

  // 3. Cache Miss - Query database
  let user;
  let isSuperuser = false;
  if (actorType === 'PLATFORM_ADMIN') {
    const admin = await prisma.platformAdmin.findUnique({ where: { id: actorId } });
    if (!admin) {
      return next(new AppError('User not found', httpStatus.UNAUTHORIZED));
    }
    if (admin.isActive === false) {
      return next(new AppError('User account is deactivated', httpStatus.UNAUTHORIZED));
    }
    user = admin;
    isSuperuser = admin.isSuperuser ?? true;
  } else if (actorType === 'USER') {
    user = await prisma.user.findUnique({ where: { id: actorId } });
    if (!user) {
      return next(new AppError('User not found', httpStatus.UNAUTHORIZED));
    }
    const isActive = 'isActive' in user ? (user as { isActive?: boolean }).isActive !== false : true;
    if (!isActive) {
      return next(new AppError('User account is deactivated', httpStatus.UNAUTHORIZED));
    }
  } else {
    user = await prisma.customerAccount.findUnique({ where: { id: actorId } });
    if (!user) {
      return next(new AppError('User not found', httpStatus.UNAUTHORIZED));
    }
  }

  const role = 'role' in user ? (user as { role?: UserRole }).role : (isSuperuser ? UserRole.ADMIN : undefined);
  const gamingCenterId = 'gamingCenterId' in user ? (user as { gamingCenterId?: string }).gamingCenterId : undefined;

  const actorData: CachedActor = {
    id: user.id,
    actorId,
    role,
    gamingCenterId,
    actorType,
    isActive: true,
    ...(isSuperuser ? { isSuperuser: true } : {}),
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
    isSuperuser: isSuperuser ? true : undefined,
  };

  next();
};
