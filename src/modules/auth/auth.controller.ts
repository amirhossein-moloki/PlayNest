import { Request, Response } from 'express';
import { AuthService } from './auth.station';
import { SessionActorType } from '@prisma/client';

export const login = async (req: Request, res: Response) => {
  const { phone, password, actorType, gamingCenterId } = req.body;

  let result;
  if (actorType === SessionActorType.USER) {
    result = await AuthService.loginUser(phone, password, gamingCenterId);
  } else {
    result = await AuthService.loginCustomer(phone);
  }

  res.ok(result);
};

export const requestUserOtp = async (req: Request, res: Response) => {
  const { phone } = req.body;
  const result = await AuthService.requestUserOtp(phone);
  res.ok(result);
};

export const verifyUserOtp = async (req: Request, res: Response) => {
  const { phone, code } = req.body;
  const result = await AuthService.verifyUserOtp(phone, code);
  res.ok(result);
};

export const requestCustomerOtp = async (req: Request, res: Response) => {
  const { phone } = req.body;
  const result = await AuthService.requestCustomerOtp(phone);
  res.ok(result);
};

export const verifyCustomerOtp = async (req: Request, res: Response) => {
  const { phone, code } = req.body;
  const result = await AuthService.verifyCustomerOtp(phone, code);
  res.ok(result);
};

export const loginUserWithOtp = async (req: Request, res: Response) => {
  const { phone, gamingCenterId } = req.body;
  const result = await AuthService.loginUserWithOtp(phone, gamingCenterId);
  res.ok(result);
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const result = await AuthService.refreshAuthToken(refreshToken);
  res.ok(result);
};

export const logout = async (req: Request, res: Response) => {
  // Assuming session ID is available on req.actor after authentication middleware
  const sessionId = (req as any).actor?.sessionId; // eslint-disable-line @typescript-eslint/no-explicit-any
  const result = await AuthService.logout(sessionId);
  res.ok(result);
};

export const me = async (req: Request, res: Response) => {
  // The user/customer object should be attached to the request by the auth middleware
  const actor = (req as any).actor; // eslint-disable-line @typescript-eslint/no-explicit-any
  res.ok(actor);
};
