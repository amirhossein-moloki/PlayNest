import crypto from 'crypto';
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
import { CachedActorProfile } from '../../types/express';

const AUTH_CACHE_TTL_SECONDS = 60;

export const getActorCacheKey = (actorId: string, actorType: string): string => {
  return `auth:actor:${actorType}:${actorId}`;
};

export const getRevokedSessionKey = (sessionId: string): string => {
  return `auth:revoked_session:${sessionId}`;
};

function extractCookieFromHeader(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    if (part.slice(0, eqIndex).trim() === name) {
      return part.slice(eqIndex + 1).trim();
    }
  }
  return null;
}

export function verifySignedSessionCookie(rawCookie: string, secret: string): string | null {
  if (!rawCookie || typeof rawCookie !== 'string' || !secret) return null;

  let decoded = rawCookie;
  try {
    decoded = decodeURIComponent(rawCookie);
  } catch {
    decoded = rawCookie;
  }

  if (!decoded.startsWith('s:')) {
    return null;
  }

  const signedPayload = decoded.slice(2);
  const lastDotIndex = signedPayload.lastIndexOf('.');
  if (lastDotIndex <= 0) {
    return null;
  }

  const sessionId = signedPayload.slice(0, lastDotIndex);
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(sessionId)
    .digest('base64')
    .replace(/=+$/, '');
  const expectedFull = `${sessionId}.${expectedSig}`;
  const expectedBuf = Buffer.from(expectedFull, 'utf8');
  const actualBuf = Buffer.from(signedPayload, 'utf8');
  if (expectedBuf.length !== actualBuf.length) {
    return null;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf) ? sessionId : null;
}

export const markSessionRevokedInCache = async (
  sessionId: string,
  ttlSeconds = 3600
): Promise<void> => {
  if (!sessionId) return;
  try {
    await redis.set(getRevokedSessionKey(sessionId), '1', 'EX', ttlSeconds);
  } catch (error) {
    logger.error({ error, sessionId }, 'Failed to mark session as revoked in Redis');
  }
};

export const markSessionsRevokedInCache = async (
  sessionIds: string[],
  ttlSeconds = 7 * 24 * 3600
): Promise<void> => {
  await Promise.all(
    sessionIds
      .filter((id) => typeof id === 'string' && id.length > 0)
      .map((id) => markSessionRevokedInCache(id, ttlSeconds))
  );
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
  totpEnabled?: boolean;
  totpSetupCompleted?: boolean;
  username?: string | null;
  profile?: CachedActorProfile;
}

function extractActorProfile(actorType: SessionActorType, user: Record<string, unknown>): CachedActorProfile | undefined {
  if (actorType === 'PLATFORM_ADMIN') {
    const safeAdmin: Record<string, unknown> = {
      id: user.id,
      username: typeof user.username === 'string' ? user.username : null,
      fullName: user.fullName,
      phone: user.phone ?? null,
      email: user.email ?? null,
      isActive: user.isActive,
      isSuperuser: user.isSuperuser,
      totpEnabled: Boolean(user.totpEnabled),
      totpSetupCompleted: Boolean(user.totpSetupCompleted),
      totpEnabledAt: user.totpEnabledAt ?? null,
      totpLastUsedAt: user.totpLastUsedAt ?? null,
      lastLogin: user.lastLogin ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    return { adminProfile: safeAdmin };
  }
  if (actorType === 'USER' && ('username' in user || 'fullName' in user || 'email' in user)) {
    return {
      username: typeof user.username === 'string' && user.username.trim() !== '' ? user.username : null,
      fullName: typeof user.fullName === 'string' ? user.fullName : null,
      email: typeof user.email === 'string' ? user.email : null,
    };
  }
  return undefined;
}

export async function isSessionRevokedInCache(sessionId?: string): Promise<boolean> {
  if (!sessionId) return false;
  try {
    const val = await redis.get(getRevokedSessionKey(sessionId));
    return Boolean(val);
  } catch {
    return false;
  }
}

async function verifyPlatformAdminSessionRecord(
  sessionId: string | undefined,
  actorId: string
): Promise<boolean> {
  if (!sessionId) return false;
  const sessionDelegate = (prisma as unknown as {
    session?: {
      findUnique?: (args: {
        where: { id: string };
        select?: Record<string, boolean>;
      }) => Promise<{
        id: string;
        actorId: string;
        actorType: SessionActorType;
        revokedAt: Date | null;
        expiresAt: Date;
        mfaVerifiedAt?: Date | null;
      } | null>;
    };
  }).session;

  if (!sessionDelegate || typeof sessionDelegate.findUnique !== 'function') {
    return true;
  }

  const sessionRecord = await sessionDelegate.findUnique({
    where: { id: sessionId },
  });

  if (!sessionRecord) {
    return false;
  }
  if (sessionRecord.actorType !== SessionActorType.PLATFORM_ADMIN || sessionRecord.actorId !== actorId) {
    return false;
  }
  if (sessionRecord.revokedAt) {
    return false;
  }
  if (sessionRecord.expiresAt && new Date(sessionRecord.expiresAt) <= new Date()) {
    return false;
  }
  if (!sessionRecord.mfaVerifiedAt) {
    return false;
  }
  return true;
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  let actorId: string | undefined;
  let actorType: SessionActorType | undefined;
  let sessionId: string | undefined;
  let usedBearerAuth = false;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token, env.JWT_ACCESS_SECRET);
    if (!payload || !payload.actorId) {
      return next(new AppError('Invalid or expired token', httpStatus.UNAUTHORIZED));
    }
    if (payload.tokenType && payload.tokenType !== 'ACCESS') {
      return next(new AppError('Invalid token type', httpStatus.UNAUTHORIZED));
    }
    if (payload.actorType === SessionActorType.PLATFORM_ADMIN && payload.mfaVerified !== true) {
      return next(
        new AppError('Two-factor verification is required.', httpStatus.UNAUTHORIZED, {
          code: 'TOTP_VERIFICATION_REQUIRED',
        })
      );
    }
    actorId = payload.actorId;
    actorType = payload.actorType;
    sessionId = payload.sessionId;
    usedBearerAuth = true;
  } else {
    // Check if an AdminJS session cookie is present for fallback authentication (must be HMAC-signed)
    const signedCookieValue = req.signedCookies?.[ADMIN_CONSTANTS.SESSION_COOKIE_NAME];
    const rawCookieValue =
      (typeof req.cookies?.[ADMIN_CONSTANTS.SESSION_COOKIE_NAME] === 'string'
        ? req.cookies[ADMIN_CONSTANTS.SESSION_COOKIE_NAME]
        : null) || extractCookieFromHeader(req.headers?.cookie, ADMIN_CONSTANTS.SESSION_COOKIE_NAME);
    let adminSessionId: string | null = null;
    if (typeof signedCookieValue === 'string' && signedCookieValue.length > 0) {
      adminSessionId = signedCookieValue.startsWith('s:')
        ? signedCookieValue.slice(2).split('.')[0]
        : signedCookieValue;
    } else if (rawCookieValue) {
      adminSessionId = verifySignedSessionCookie(
        rawCookieValue,
        ADMIN_CONSTANTS.SESSION_SECRET
      );
    }

    if (adminSessionId) {
      try {
        const redisSessionKey = `${ADMIN_CONSTANTS.SESSION_PREFIX}${adminSessionId}`;
        const sessionDataRaw = await redis.get(redisSessionKey);
        if (sessionDataRaw) {
          const sessionObj = JSON.parse(sessionDataRaw);
          const adminUser = sessionObj?.adminUser;
          if (
            adminUser &&
            adminUser.id &&
            adminUser.isSuperuser === true &&
            adminUser.mfaVerified === true
          ) {
            actorId = adminUser.id;
            actorType = SessionActorType.PLATFORM_ADMIN;
            sessionId = adminUser.sessionId || adminSessionId;
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

  if (sessionId && (await isSessionRevokedInCache(sessionId))) {
    return next(
      new AppError('Session has been revoked', httpStatus.UNAUTHORIZED, {
        code: 'SESSION_REVOKED',
      })
    );
  }

  if (actorType === SessionActorType.PLATFORM_ADMIN) {
    if (usedBearerAuth) {
      const sessionValid = await verifyPlatformAdminSessionRecord(sessionId, actorId);
      if (!sessionValid) {
        return next(
          new AppError('Session is invalid or has been revoked', httpStatus.UNAUTHORIZED, {
            code: 'SESSION_REVOKED',
          })
        );
      }
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

    if (cachedActor.actorType === SessionActorType.PLATFORM_ADMIN) {
      if (cachedActor.isSuperuser !== true) {
        return next(
          new AppError('Forbidden: PLATFORM_ADMIN access required.', httpStatus.FORBIDDEN)
        );
      }
      if (cachedActor.totpEnabled !== true || cachedActor.totpSetupCompleted !== true) {
        return next(
          new AppError('Two-factor authentication setup is required.', httpStatus.FORBIDDEN, {
            code: 'TOTP_SETUP_REQUIRED',
          })
        );
      }
    }

    req.actor = {
      id: cachedActor.id,
      actorId: cachedActor.actorId,
      role: cachedActor.role,
      gamingCenterId: cachedActor.gamingCenterId,
      actorType: cachedActor.actorType,
      sessionId: sessionId as string | undefined,
      isSuperuser: cachedActor.isSuperuser,
      ...(cachedActor.actorType === SessionActorType.PLATFORM_ADMIN
        ? { mfaVerified: true, username: cachedActor.username ?? null }
        : {}),
    };
    if (cachedActor.profile) {
      req.actorProfile = cachedActor.profile;
    }
    return next();
  }

  // 3. Cache Miss - Query database
  let user;
  let isSuperuser = false;
  let totpEnabled = false;
  let totpSetupCompleted = false;
  let adminUsername: string | null | undefined;

  if (actorType === 'PLATFORM_ADMIN') {
    const admin = await prisma.platformAdmin.findUnique({ where: { id: actorId } });
    if (!admin) {
      return next(new AppError('User not found', httpStatus.UNAUTHORIZED));
    }
    if (admin.isActive === false) {
      return next(new AppError('User account is deactivated', httpStatus.UNAUTHORIZED));
    }
    isSuperuser = admin.isSuperuser ?? true;
    if (!isSuperuser) {
      return next(new AppError('Forbidden: PLATFORM_ADMIN access required.', httpStatus.FORBIDDEN));
    }
    totpEnabled = Boolean(admin.totpEnabled);
    totpSetupCompleted = Boolean(admin.totpSetupCompleted);
    if (!totpEnabled || !totpSetupCompleted) {
      return next(
        new AppError('Two-factor authentication setup is required.', httpStatus.FORBIDDEN, {
          code: 'TOTP_SETUP_REQUIRED',
        })
      );
    }
    adminUsername = admin.username ?? null;
    user = admin;
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
  const profile = extractActorProfile(actorType, user as unknown as Record<string, unknown>);

  const actorData: CachedActor = {
    id: user.id,
    actorId,
    role,
    gamingCenterId,
    actorType,
    isActive: true,
    ...(isSuperuser ? { isSuperuser: true } : {}),
    ...(actorType === 'PLATFORM_ADMIN'
      ? { totpEnabled, totpSetupCompleted, username: adminUsername ?? null }
      : {}),
    ...(profile ? { profile } : {}),
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
    ...(actorType === 'PLATFORM_ADMIN'
      ? { mfaVerified: true, username: adminUsername ?? null }
      : {}),
  };
  if (profile) {
    req.actorProfile = profile;
  }

  next();
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  let actorId: string | undefined;
  let actorType: SessionActorType | undefined;
  let sessionId: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token, env.JWT_ACCESS_SECRET);
    if (
      payload &&
      payload.actorId &&
      payload.actorType &&
      (!payload.tokenType || payload.tokenType === 'ACCESS')
    ) {
      if (payload.actorType === SessionActorType.PLATFORM_ADMIN && payload.mfaVerified !== true) {
        return next();
      }
      actorId = payload.actorId;
      actorType = payload.actorType;
      sessionId = payload.sessionId;
    }
  }

  if (!actorId || !actorType) {
    return next();
  }

  if (actorType === SessionActorType.PLATFORM_ADMIN) {
    if (await isSessionRevokedInCache(sessionId)) {
      return next();
    }
    const sessionValid = await verifyPlatformAdminSessionRecord(sessionId, actorId);
    if (!sessionValid) {
      return next();
    }
  }

  const cacheKey = getActorCacheKey(actorId, actorType);
  let cachedActor: CachedActor | null = null;

  try {
    const rawData = await redis.get(cacheKey);
    if (rawData) {
      cachedActor = JSON.parse(rawData) as CachedActor;
    }
  } catch (error) {
    logger.warn({ error, actorId }, 'Redis read error in optionalAuth');
  }

  if (cachedActor) {
    const isAdminAllowed =
      cachedActor.actorType !== SessionActorType.PLATFORM_ADMIN ||
      (cachedActor.isSuperuser === true &&
        cachedActor.totpEnabled === true &&
        cachedActor.totpSetupCompleted === true);

    if (cachedActor.isActive !== false && isAdminAllowed) {
      req.actor = {
        id: cachedActor.id,
        actorId: cachedActor.actorId,
        role: cachedActor.role,
        gamingCenterId: cachedActor.gamingCenterId,
        actorType: cachedActor.actorType,
        sessionId: sessionId as string | undefined,
        isSuperuser: cachedActor.isSuperuser,
        ...(cachedActor.actorType === SessionActorType.PLATFORM_ADMIN
          ? { mfaVerified: true, username: cachedActor.username ?? null }
          : {}),
      };
      if (cachedActor.profile) {
        req.actorProfile = cachedActor.profile;
      }
    }
    return next();
  }

  // Cache Miss - Query database
  let user;
  let isSuperuser = false;
  let totpEnabled = false;
  let totpSetupCompleted = false;
  let adminUsername: string | null | undefined;
  try {
    if (actorType === 'PLATFORM_ADMIN') {
      const admin = await prisma.platformAdmin.findUnique({ where: { id: actorId } });
      if (
        admin &&
        admin.isActive !== false &&
        (admin.isSuperuser ?? true) &&
        admin.totpEnabled === true &&
        admin.totpSetupCompleted === true
      ) {
        user = admin;
        isSuperuser = admin.isSuperuser ?? true;
        totpEnabled = true;
        totpSetupCompleted = true;
        adminUsername = admin.username ?? null;
      }
    } else if (actorType === 'USER') {
      const foundUser = await prisma.user.findUnique({ where: { id: actorId } });
      if (foundUser) {
        const isActive = 'isActive' in foundUser ? (foundUser as { isActive?: boolean }).isActive !== false : true;
        if (isActive) {
          user = foundUser;
        }
      }
    } else {
      user = await prisma.customerAccount.findUnique({ where: { id: actorId } });
    }

    if (user) {
      const role = 'role' in user ? (user as { role?: UserRole }).role : (isSuperuser ? UserRole.ADMIN : undefined);
      const gamingCenterId = 'gamingCenterId' in user ? (user as { gamingCenterId?: string }).gamingCenterId : undefined;
      const profile = extractActorProfile(actorType, user as unknown as Record<string, unknown>);

      const actorData: CachedActor = {
        id: user.id,
        actorId,
        role,
        gamingCenterId,
        actorType,
        isActive: true,
        ...(isSuperuser ? { isSuperuser: true } : {}),
        ...(actorType === 'PLATFORM_ADMIN'
          ? { totpEnabled, totpSetupCompleted, username: adminUsername ?? null }
          : {}),
        ...(profile ? { profile } : {}),
      };

      try {
        await redis.set(cacheKey, JSON.stringify(actorData), 'EX', AUTH_CACHE_TTL_SECONDS);
      } catch (error) {
        logger.warn({ error, actorId }, 'Redis write error in optionalAuth');
      }

      req.actor = {
        id: user.id,
        actorId,
        role,
        gamingCenterId,
        actorType,
        sessionId: sessionId as string | undefined,
        isSuperuser: isSuperuser ? true : undefined,
        ...(actorType === 'PLATFORM_ADMIN'
          ? { mfaVerified: true, username: adminUsername ?? null }
          : {}),
      };
      if (profile) {
        req.actorProfile = profile;
      }
    }
  } catch (dbErr) {
    logger.warn({ dbErr, actorId }, 'DB query error in optionalAuth');
  }

  return next();
};
