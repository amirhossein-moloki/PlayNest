import { Router } from 'express';
import {
  login,
  loginPlatformAdmin,
  refresh,
  logout,
  me,
  requestOtp,
  loginWithOtp,
  requestUserOtp,
  verifyUserOtp,
  loginUserWithOtp,
  requestCustomerOtp,
  verifyCustomerOtp
} from './auth.controller';
import { validate } from '../../common/middleware/validate';
import {
  loginSchema,
  platformAdminLoginSchema,
  refreshSchema,
  requestOtpSchema,
  verifyOtpSchema,
  otpLoginSchema,
  loginWithOtpSchema
} from './auth.validators';
import { authMiddleware } from '../../common/middleware/auth';
import { publicApiRateLimiter } from '../../common/middleware/rateLimit';
import { env } from '../../config/env';
import { asyncHandler } from '../../common/middleware/asyncHandler';

const router = Router();

if (env.NODE_ENV !== 'test') {
  router.use(publicApiRateLimiter);
}

// --- Unified OTP Authentication (Standard Endpoints) ---
router.post('/otp/request', validate(requestOtpSchema), asyncHandler(requestOtp));
router.post('/otp/login', validate(otpLoginSchema), asyncHandler(loginWithOtp));

// --- Deprecated Endpoints (Forwarding / Controlled Deprecation) ---
const deprecationWarning = (replacement: string) => (_req: unknown, res: { setHeader: (name: string, val: string) => void }, next: () => void) => {
  res.setHeader('X-API-Deprecation-Warning', `This endpoint is deprecated. Use ${replacement} instead.`);
  next();
};

// --- User OTP Flow (Deprecated) ---
router.post('/user/otp/request', deprecationWarning('/api/v1/auth/otp/request'), validate(requestOtpSchema), asyncHandler(requestUserOtp));
router.post('/user/otp/verify', deprecationWarning('/api/v1/auth/otp/login'), validate(verifyOtpSchema), asyncHandler(verifyUserOtp));
router.post('/user/login/otp', deprecationWarning('/api/v1/auth/otp/login'), validate(loginWithOtpSchema), asyncHandler(loginUserWithOtp));

// --- Customer OTP Flow (Deprecated) ---
router.post('/customer/otp/request', deprecationWarning('/api/v1/auth/otp/request'), validate(requestOtpSchema), asyncHandler(requestCustomerOtp));
router.post('/customer/otp/verify', deprecationWarning('/api/v1/auth/otp/login'), validate(verifyOtpSchema), asyncHandler(verifyCustomerOtp));

// --- Platform Admin Login ---
router.post('/platform-admin/login', validate(platformAdminLoginSchema), asyncHandler(loginPlatformAdmin));

// --- Classic Login ---
router.post('/login', validate(loginSchema), asyncHandler(login));
router.post('/refresh', validate(refreshSchema), asyncHandler(refresh));

// --- Protected ---
router.post('/logout', authMiddleware, asyncHandler(logout));
router.get('/me', authMiddleware, asyncHandler(me));

export default router;
