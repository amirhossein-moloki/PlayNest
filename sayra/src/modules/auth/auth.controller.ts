import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { authService } from './auth.station';
import { AuthRepository } from './auth.repository';
import { UpdateProfileInput } from './auth.validators';
import AppError from '../../common/errors/AppError';
import { invalidateActorCache } from '../../common/middleware/auth';
import httpStatus from 'http-status';

export const login = async (req: Request, res: Response) => {
  const { phone, password, gamingCenterId } = req.body;

  const result = await authService.loginUser(phone, password, gamingCenterId);

  res.ok(result);
};

export const loginPlatformAdmin = async (req: Request, res: Response) => {
  const { phone, password } = req.body;
  const result = await authService.loginPlatformAdmin(phone, password);
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
  const result = await authService.requestUserOtp(phone);
  res.ok(result);
};

export const verifyUserOtp = async (req: Request, res: Response) => {
  const { phone, code } = req.body;
  const result = await authService.verifyUserOtp(phone, code);
  res.ok(result);
};

export const requestCustomerOtp = async (req: Request, res: Response) => {
  const { phone } = req.body;
  const result = await authService.requestCustomerOtp(phone);
  res.ok(result);
};

export const verifyCustomerOtp = async (req: Request, res: Response) => {
  const { phone, code } = req.body;
  await authService.verifyCustomerOtp(phone, code);
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
  const result = await authService.refreshAuthToken(refreshToken);
  res.ok(result);
};

export const logout = async (req: Request, res: Response) => {
  // Assuming session ID is available on req.actor after authentication middleware
  const sessionId = req.actor?.sessionId;
  if (!sessionId) {
    throw new AppError('Session not found', httpStatus.UNAUTHORIZED);
  }
  const result = await authService.logout(sessionId);
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
        username: null,
        profile: req.actorProfile.adminProfile,
      });
    }
    const adminId = req.actor.id || req.actor.actorId || '';
    const admin = await AuthRepository.findPlatformAdminById(adminId);
    if (admin) {
      const { passwordHash: _passwordHash, ...safeAdmin } = admin; void _passwordHash;
      return res.ok({
        ...req.actor,
        username: null,
        profile: safeAdmin,
      });
    }
    return res.ok({
      ...req.actor,
      username: null,
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
