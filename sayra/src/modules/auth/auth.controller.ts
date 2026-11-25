import { Request, Response } from 'express';
import { Prisma, SessionActorType } from '@prisma/client';
import { authService } from './auth.station';
import { AuthRepository } from './auth.repository';
import { UpdateProfileInput } from './auth.validators';
import AppError from '../../common/errors/AppError';
import { invalidateActorCache } from '../../common/middleware/auth';
import httpStatus from 'http-status';
import { PlatformAdminAuthService } from './platform-admin-auth.service';
import {
  DEFAULT_ADMIN_REFRESH_TTL_MS,
  PLATFORM_ADMIN_REFRESH_COOKIE_NAME,
  sanitizePlatformAdmin,
} from './platform-admin-auth.constants';
import { parseDurationToMs } from './auth.tokens';
import { env } from '../../config/env';

function extractRequestMeta(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim();
  return {
    ip: req.ip || forwardedIp || req.socket?.remoteAddress,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

function setPlatformAdminRefreshCookie(res: Response, refreshToken: string) {
  const maxAge = parseDurationToMs(
    env.PLATFORM_ADMIN_REFRESH_EXPIRES_IN,
    DEFAULT_ADMIN_REFRESH_TTL_MS
  );
  res.cookie(PLATFORM_ADMIN_REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge,
    path: '/api/v1/auth',
  });
}

function clearPlatformAdminRefreshCookie(res: Response) {
  res.clearCookie(PLATFORM_ADMIN_REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
  });
}

export const login = async (req: Request, res: Response) => {
  const { phone, password, gamingCenterId } = req.body;

  const result = await authService.loginUser(phone, password, gamingCenterId);

  res.ok(result);
};

export const loginPlatformAdmin = async (req: Request, res: Response) => {
  const { username, phone, password } = req.body;
  const identifier = (username || phone || '').trim();
  const result = await authService.loginPlatformAdmin(identifier, password, extractRequestMeta(req));
  res.ok(result);
};

function stripRefreshTokenFromPayload<T extends Record<string, any>>(payload: T): Record<string, any> {
  if (!payload || typeof payload !== 'object') return payload;
  const { refreshToken: _rt, tokens, ...rest } = payload;
  void _rt;
  if (tokens && typeof tokens === 'object') {
    const { refreshToken: _nestedRt, ...safeTokens } = tokens as Record<string, unknown>;
    void _nestedRt;
    return { ...rest, tokens: safeTokens };
  }
  return rest;
}

export const verifyPlatformAdminTwoFactor = async (req: Request, res: Response) => {
  const { challengeToken, code, recoveryCode } = req.body;
  const result = await PlatformAdminAuthService.verifyTwoFactor(
    { challengeToken, code, recoveryCode },
    extractRequestMeta(req)
  );
  setPlatformAdminRefreshCookie(res, result.refreshToken);
  res.ok(stripRefreshTokenFromPayload(result));
};

export const setupPlatformAdminTwoFactor = async (req: Request, res: Response) => {
  const { setupToken, currentPassword, currentTotpCode, label, mode } = req.body || {};
  const authenticatedAdminId =
    req.actor?.actorType === SessionActorType.PLATFORM_ADMIN && req.actor.mfaVerified
      ? req.actor.id
      : undefined;

  const result = await PlatformAdminAuthService.startTwoFactorSetup(
    {
      setupToken,
      authenticatedAdminId,
      currentPassword,
      currentTotpCode,
      label,
      mode,
    },
    extractRequestMeta(req)
  );
  res.ok(result);
};

export const confirmPlatformAdminTwoFactor = async (req: Request, res: Response) => {
  const { setupToken, deviceId, code, mode } = req.body;
  const authenticatedAdminId =
    req.actor?.actorType === SessionActorType.PLATFORM_ADMIN && req.actor.mfaVerified
      ? req.actor.id
      : undefined;

  const result = await PlatformAdminAuthService.confirmTwoFactorSetup(
    {
      setupToken,
      authenticatedAdminId,
      deviceId,
      code,
      mode,
    },
    extractRequestMeta(req)
  );

  if ('refreshToken' in result && typeof result.refreshToken === 'string') {
    setPlatformAdminRefreshCookie(res, result.refreshToken);
    res.ok(stripRefreshTokenFromPayload(result));
    return;
  }
  res.ok(result);
};

export const getPlatformAdminTwoFactorStatus = async (req: Request, res: Response) => {
  if (!req.actor || req.actor.actorType !== SessionActorType.PLATFORM_ADMIN) {
    throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
  }
  const result = await PlatformAdminAuthService.getTwoFactorStatus(req.actor.id);
  res.ok(result);
};

export const removePlatformAdminAuthenticatorDevice = async (req: Request, res: Response) => {
  if (!req.actor || req.actor.actorType !== SessionActorType.PLATFORM_ADMIN) {
    throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
  }
  const { deviceId } = req.params;
  const { currentPassword, code } = req.body;
  const result = await PlatformAdminAuthService.removeAuthenticatorDevice(
    req.actor.id,
    deviceId,
    currentPassword,
    code,
    extractRequestMeta(req)
  );
  res.ok(result);
};

export const regeneratePlatformAdminRecoveryCodes = async (req: Request, res: Response) => {
  if (!req.actor || req.actor.actorType !== SessionActorType.PLATFORM_ADMIN) {
    throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
  }
  const { currentPassword, code } = req.body;
  const result = await PlatformAdminAuthService.regenerateRecoveryCodes(
    req.actor.id,
    currentPassword,
    code,
    extractRequestMeta(req)
  );
  res.ok(result);
};

export const disablePlatformAdminTwoFactor = async (req: Request, res: Response) => {
  if (!req.actor || req.actor.actorType !== SessionActorType.PLATFORM_ADMIN) {
    throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
  }
  const { currentPassword, code, recoveryCode } = req.body;
  const result = await PlatformAdminAuthService.disableTwoFactor(
    req.actor.id,
    currentPassword,
    { code, recoveryCode },
    extractRequestMeta(req)
  );
  clearPlatformAdminRefreshCookie(res);
  res.ok(result);
};

export const refreshPlatformAdminSession = async (req: Request, res: Response) => {
  const cookieToken = req.cookies?.[PLATFORM_ADMIN_REFRESH_COOKIE_NAME];
  const rawToken = req.body?.refreshToken || cookieToken;
  if (!rawToken || typeof rawToken !== 'string') {
    throw new AppError('Refresh token is required', httpStatus.UNAUTHORIZED);
  }
  const result = await PlatformAdminAuthService.refreshSession(rawToken, extractRequestMeta(req));
  setPlatformAdminRefreshCookie(res, result.refreshToken);
  res.ok(stripRefreshTokenFromPayload(result));
};

export const logoutPlatformAdmin = async (req: Request, res: Response) => {
  if (!req.actor || req.actor.actorType !== SessionActorType.PLATFORM_ADMIN) {
    throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
  }
  const sessionId = req.actor.sessionId;
  if (sessionId) {
    await PlatformAdminAuthService.logoutSession(sessionId, req.actor.id, extractRequestMeta(req));
  }
  clearPlatformAdminRefreshCookie(res);
  res.ok({ message: 'Logged out successfully' });
};

export const listPlatformAdminSessions = async (req: Request, res: Response) => {
  if (!req.actor || req.actor.actorType !== SessionActorType.PLATFORM_ADMIN) {
    throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
  }
  const sessions = await PlatformAdminAuthService.listSessions(req.actor.id, req.actor.sessionId);
  res.ok({ sessions });
};

export const revokeAllPlatformAdminSessions = async (req: Request, res: Response) => {
  if (!req.actor || req.actor.actorType !== SessionActorType.PLATFORM_ADMIN) {
    throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
  }
  const result = await PlatformAdminAuthService.revokeAllSessions(req.actor.id, extractRequestMeta(req));
  clearPlatformAdminRefreshCookie(res);
  res.ok(result);
};

/**
 * Unified OTP Request: POST /api/v1/auth/otp/request
 */
export const requestOtp = async (req: Request, res: Response) => {
  const { phone } = req.body;
  const metadata = {
    ip: req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
  const result = await authService.requestOtpUnified(phone, metadata);
  res.ok(result);
};

/**
 * Unified OTP Login: POST /api/v1/auth/otp/login
 */
export const loginWithOtp = async (req: Request, res: Response) => {
  const { phone, otp } = req.body;
  const metadata = {
    ip: req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
  };
  const result = await authService.loginWithOtpUnified(phone, otp, metadata);
  res.ok(result);
};

export const requestUserOtp = async (req: Request, res: Response) => {
  const { phone } = req.body;
  const result = await authService.requestUserOtp(phone, extractRequestMeta(req));
  res.ok(result);
};

export const verifyUserOtp = async (req: Request, res: Response) => {
  const { phone, code } = req.body;
  const result = await authService.verifyUserOtp(phone, code, extractRequestMeta(req));
  res.ok(result);
};

export const requestCustomerOtp = async (req: Request, res: Response) => {
  const { phone } = req.body;
  const result = await authService.requestCustomerOtp(phone, extractRequestMeta(req));
  res.ok(result);
};

export const verifyCustomerOtp = async (req: Request, res: Response) => {
  const { phone, code } = req.body;
  await authService.verifyCustomerOtp(phone, code, extractRequestMeta(req));
  const result = await authService.loginCustomer(phone);
  res.ok(result);
};

export const loginUserWithOtp = async (req: Request, res: Response) => {
  const { phone, gamingCenterId } = req.body;
  const result = await authService.loginUserWithOtp(phone, gamingCenterId);
  res.ok(result);
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const result = await authService.refreshAuthToken(refreshToken, extractRequestMeta(req));
  if ('admin' in result && 'refreshToken' in result && typeof result.refreshToken === 'string') {
    setPlatformAdminRefreshCookie(res, result.refreshToken);
    res.ok(stripRefreshTokenFromPayload(result));
    return;
  }
  res.ok(result);
};

export const logout = async (req: Request, res: Response) => {
  // Assuming session ID is available on req.actor after authentication middleware
  const sessionId = req.actor?.sessionId;
  if (!sessionId) {
    throw new AppError('Session not found', httpStatus.UNAUTHORIZED);
  }
  const result = await authService.logout(sessionId, extractRequestMeta(req));
  if (req.actor?.actorType === SessionActorType.PLATFORM_ADMIN) {
    clearPlatformAdminRefreshCookie(res);
  }
  res.ok(result);
};

export function splitFullName(fullName: string | null | undefined): { firstName: string | null; lastName: string | null } {
  if (!fullName) return { firstName: null, lastName: null };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') {
    return { firstName: null, lastName: null };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

export const me = async (req: Request, res: Response) => {
  if (!req.actor) {
    throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
  }

  if (req.actor.actorType === 'PLATFORM_ADMIN') {
    if (req.actorProfile?.adminProfile) {
      return res.ok({
        ...req.actor,
        username: req.actorProfile.adminProfile.username ?? req.actor.username ?? null,
        profile: req.actorProfile.adminProfile,
      });
    }
    const adminId = req.actor.id || req.actor.actorId || '';
    const admin = await AuthRepository.findPlatformAdminById(adminId);
    if (admin) {
      const safeAdmin = sanitizePlatformAdmin(admin as unknown as Record<string, unknown>);
      return res.ok({
        ...req.actor,
        username: safeAdmin.username,
        profile: safeAdmin,
      });
    }
    return res.ok({
      ...req.actor,
      username: req.actor.username ?? null,
    });
  }

  if (req.actor.actorType === 'USER') {
    const userId = req.actor.id || req.actor.actorId || '';
    let username: string | null = null;
    let firstName: string | null = null;
    let lastName: string | null = null;
    let fullName: string | null = null;
    let email: string | null = null;

    if (req.actorProfile) {
      username =
        typeof req.actorProfile.username === 'string' && req.actorProfile.username.trim() !== ''
          ? req.actorProfile.username
          : null;
      fullName = req.actorProfile.fullName ?? null;
      const split = splitFullName(fullName);
      firstName = split.firstName;
      lastName = split.lastName;
      email = req.actorProfile.email ?? null;
    } else if (userId) {
      const user = await AuthRepository.findUserById(userId);
      if (user) {
        if (typeof user.username === 'string' && user.username.trim() !== '') {
          username = user.username;
        }
        fullName = user.fullName;
        const split = splitFullName(user.fullName);
        firstName = split.firstName;
        lastName = split.lastName;
        email = user.email ?? null;
      }
    }
    return res.ok({
      ...req.actor,
      username,
      ...(fullName !== null ? { fullName, firstName, lastName } : {}),
      ...(email !== null ? { email } : {}),
    });
  }

  // CUSTOMER or any other actor type
  res.ok({
    ...req.actor,
    username: null,
  });
};

export const updateMe = async (req: Request, res: Response) => {
  if (!req.actor) {
    throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
  }

  const actorId = req.actor.id || req.actor.actorId || '';
  const { actorType } = req.actor;
  const body = req.body as UpdateProfileInput;

  if (actorType === 'USER') {
    const existingUser = await AuthRepository.findUserById(actorId);
    if (!existingUser) {
      throw new AppError('User not found', httpStatus.NOT_FOUND);
    }

    if (body.username && body.username.toLowerCase() !== existingUser.username?.toLowerCase()) {
      const duplicateUser = await AuthRepository.findUserByUsername(body.username, actorId);
      if (duplicateUser) {
        throw new AppError('Username is already taken.', httpStatus.CONFLICT, {
          code: 'USERNAME_ALREADY_EXISTS',
        });
      }
    }

    let resolvedFullName = existingUser.fullName;
    if (body.fullName !== undefined) {
      resolvedFullName = body.fullName.trim();
    } else if (body.firstName !== undefined || body.lastName !== undefined) {
      const { firstName: currentFirst, lastName: currentLast } = splitFullName(existingUser.fullName);
      const newFirst = body.firstName !== undefined ? body.firstName.trim() : (currentFirst || '');
      const newLast = body.lastName !== undefined ? body.lastName.trim() : (currentLast || '');
      resolvedFullName = [newFirst, newLast].filter(Boolean).join(' ');
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (body.username !== undefined) updateData.username = body.username;
    if (resolvedFullName !== existingUser.fullName) updateData.fullName = resolvedFullName;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.bio !== undefined) updateData.bio = body.bio;
    if (body.avatarUrl !== undefined) updateData.avatarUrl = body.avatarUrl;
    if (body.publicName !== undefined) updateData.publicName = body.publicName;
    if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;

    const updatedUser = await AuthRepository.updateUser(actorId, updateData);
    await invalidateActorCache(actorId, 'USER');
    const { firstName, lastName } = splitFullName(updatedUser.fullName);

    return res.ok({
      id: updatedUser.id,
      actorId: updatedUser.id,
      username: updatedUser.username ?? null,
      fullName: updatedUser.fullName,
      firstName,
      lastName,
      email: updatedUser.email ?? null,
      phone: updatedUser.phone,
      role: updatedUser.role,
      gamingCenterId: updatedUser.gamingCenterId,
      actorType: req.actor.actorType,
      isPublic: updatedUser.isPublic,
      publicName: updatedUser.publicName ?? null,
      bio: updatedUser.bio ?? null,
      avatarUrl: updatedUser.avatarUrl ?? null,
    });
  }

  if (actorType === 'CUSTOMER') {
    const existingCustomer = await AuthRepository.findCustomerById(actorId);
    if (!existingCustomer) {
      throw new AppError('Customer account not found', httpStatus.NOT_FOUND);
    }

    let resolvedFullName = existingCustomer.fullName || '';
    if (body.fullName !== undefined) {
      resolvedFullName = body.fullName.trim();
    } else if (body.firstName !== undefined || body.lastName !== undefined) {
      const { firstName: currentFirst, lastName: currentLast } = splitFullName(existingCustomer.fullName);
      const newFirst = body.firstName !== undefined ? body.firstName.trim() : (currentFirst || '');
      const newLast = body.lastName !== undefined ? body.lastName.trim() : (currentLast || '');
      resolvedFullName = [newFirst, newLast].filter(Boolean).join(' ');
    }

    const updatedCustomer = await AuthRepository.updateCustomerAccount(actorId, {
      fullName: resolvedFullName || null,
    });
    await invalidateActorCache(actorId, 'CUSTOMER');
    const { firstName, lastName } = splitFullName(updatedCustomer.fullName);

    return res.ok({
      id: updatedCustomer.id,
      actorId: updatedCustomer.id,
      username: null,
      fullName: updatedCustomer.fullName,
      firstName,
      lastName,
      phone: updatedCustomer.phone,
      actorType: req.actor.actorType,
    });
  }

  throw new AppError('Unsupported actor type for profile update', httpStatus.BAD_REQUEST);
};
