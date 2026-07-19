import { Request, Response } from 'express';
import { authService } from './auth.station';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export const login = async (req: Request, res: Response) => {
  const { phone, password, gamingCenterId } = req.body;

  const result = await authService.loginUser(phone, password, gamingCenterId);

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
  // The user/customer object should be attached to the request by the auth middleware
  res.ok(req.actor);
};
