import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { SessionActorType } from '@prisma/client';
import { generateAccessToken } from './auth.tokens';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { invalidateActorCache } from '../../common/middleware/auth';

const hashToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const SessionService = {
  /**
   * Create a new session and issue access & refresh tokens.
   */
  async createSession(actorId: string, actorType: SessionActorType, roles: string[] = []) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Raw refresh token
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawRefreshToken);

    const session = await prisma.session.create({
      data: {
        actorId,
        actorType,
        tokenHash,
        expiresAt,
      },
    });

    const payload = {
      sub: actorId,
      actorId,
      actorType,
      roles,
      sessionId: session.id,
    };

    const accessToken = generateAccessToken(payload);

    return {
      session,
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken, // raw token returned to client once
      },
    };
  },

  /**
   * Rotate refresh token to prevent replay attacks.
   */
  async rotateRefreshToken(rawToken: string) {
    const tokenHash = hashToken(rawToken);

    const session = await prisma.session.findUnique({
      where: { tokenHash },
    });

    if (!session || session.revokedAt) {
      throw new AppError('Session is invalid or has been revoked', httpStatus.UNAUTHORIZED);
    }

    if (new Date() > session.expiresAt) {
      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new AppError('Refresh token has expired', httpStatus.UNAUTHORIZED);
    }

    // Rotate: Revoke the used session or rotate tokenHash
    const newRawRefreshToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = hashToken(newRawRefreshToken);

    await prisma.session.update({
      where: { id: session.id },
      data: {
        tokenHash: newTokenHash,
      },
    });

    // Resolve roles based on actorType
    let roles: string[] = [];
    if (session.actorType === SessionActorType.USER) {
      const user = await prisma.user.findUnique({
        where: { id: session.actorId },
        select: { role: true },
      });
      if (user?.role) {
        roles = [user.role];
      }
    } else if (session.actorType === SessionActorType.CUSTOMER) {
      roles = ['CUSTOMER'];
    } else if (session.actorType === SessionActorType.PLATFORM_ADMIN) {
      roles = ['ADMIN'];
    }

    const payload = {
      sub: session.actorId,
      actorId: session.actorId,
      actorType: session.actorType,
      roles,
      sessionId: session.id,
    };

    const newAccessToken = generateAccessToken(payload);

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
    };
  },

  /**
   * Revoke session and invalidate Redis actor cache.
   */
  async revokeSession(sessionId: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (session) {
      await invalidateActorCache(session.actorId, session.actorType);
      await prisma.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
    }

    return { message: 'Logged out successfully' };
  },
};
