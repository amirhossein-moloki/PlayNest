import { Request, Response } from 'express';
import { authService } from './auth.station';
import { AuthRepository } from './auth.repository';
import AppError from '../../common/errors/AppError';
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

export const me = async (req: Request, res: Response) => {
  if (req.actor?.actorType === 'PLATFORM_ADMIN') {
    const adminId = req.actor.id || req.actor.actorId || '';
    const admin = await AuthRepository.findPlatformAdminById(adminId);
    if (admin) {
      const { passwordHash: _passwordHash, ...safeAdmin } = admin; void _passwordHash;
      return res.ok({
        ...req.actor,
        profile: safeAdmin,
      });
    }
  }
  // The user/customer object should be attached to the request by the auth middleware
  res.ok(req.actor);
};
