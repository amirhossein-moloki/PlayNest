import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { SessionActorType } from '@prisma/client';

export interface TokenPayload {
  sessionId: string;
  actorId: string;
  actorType: SessionActorType;
  tokenType?: 'ACCESS' | 'REFRESH';
  mfaVerified?: boolean;
  roles?: string[];
  sub?: string;
}

export interface PlatformAdminChallengePayload {
  challengeId: string;
  actorId: string;
  actorType: 'PLATFORM_ADMIN';
  purpose: 'TOTP_VERIFY' | 'TOTP_SETUP';
  nonce: string;
  tokenType: 'PLATFORM_ADMIN_CHALLENGE';
}

function getChallengeSecret(): string {
  const baseSecret = process.env.JWT_ACCESS_SECRET || env.JWT_ACCESS_SECRET;
  return crypto
    .createHmac('sha256', baseSecret)
    .update('playnest-platform-admin-2fa-challenge-v1')
    .digest('hex');
}

export function parseDurationToMs(duration: string | undefined, fallbackMs: number): number {
  if (!duration || typeof duration !== 'string') {
    return fallbackMs;
  }
  const match = duration.trim().match(/^(\d+)\s*(ms|s|m|h|d)$/i);
  if (!match) {
    return fallbackMs;
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
  case 'ms':
    return amount;
  case 's':
    return amount * 1000;
  case 'm':
    return amount * 60 * 1000;
  case 'h':
    return amount * 60 * 60 * 1000;
  case 'd':
    return amount * 24 * 60 * 60 * 1000;
  default:
    return fallbackMs;
  }
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const isPlatformAdmin = payload.actorType === SessionActorType.PLATFORM_ADMIN;
  const enrichedPayload: TokenPayload = {
    ...payload,
    tokenType: payload.tokenType ?? 'ACCESS',
    ...(isPlatformAdmin && payload.mfaVerified === undefined ? { mfaVerified: true } : {}),
  };

  return jwt.sign(enrichedPayload, env.JWT_ACCESS_SECRET as string, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expiresIn: (isPlatformAdmin ? env.PLATFORM_ADMIN_ACCESS_EXPIRES_IN || env.JWT_ACCESS_EXPIRES_IN : env.JWT_ACCESS_EXPIRES_IN) as any,
  });
};

export const generatePlatformAdminAccessToken = (params: {
  sessionId: string;
  actorId: string;
}): string => {
  const payload: TokenPayload = {
    sub: params.actorId,
    sessionId: params.sessionId,
    actorId: params.actorId,
    actorType: SessionActorType.PLATFORM_ADMIN,
    tokenType: 'ACCESS',
    mfaVerified: true,
    roles: ['ADMIN'],
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET as string, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expiresIn: (env.PLATFORM_ADMIN_ACCESS_EXPIRES_IN || '15m') as any,
  });
};

export const generatePlatformAdminChallengeToken = (
  payload: Omit<PlatformAdminChallengePayload, 'tokenType'>,
  expiresInSeconds: number
): string => {
  const fullPayload: PlatformAdminChallengePayload = {
    ...payload,
    tokenType: 'PLATFORM_ADMIN_CHALLENGE',
  };

  return jwt.sign(fullPayload, getChallengeSecret(), {
    expiresIn: expiresInSeconds,
  });
};

export const verifyPlatformAdminChallengeToken = (
  token: string
): PlatformAdminChallengePayload | null => {
  try {
    const decoded = jwt.verify(token, getChallengeSecret()) as PlatformAdminChallengePayload;
    if (
      !decoded ||
      decoded.tokenType !== 'PLATFORM_ADMIN_CHALLENGE' ||
      decoded.actorType !== 'PLATFORM_ADMIN' ||
      !decoded.challengeId ||
      !decoded.actorId ||
      !decoded.nonce
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET as string, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
  });
};

export const verifyToken = (token: string, secret: string): TokenPayload | null => {
  try {
    return jwt.verify(token, secret) as TokenPayload;
  } catch {
    return null;
  }
};
