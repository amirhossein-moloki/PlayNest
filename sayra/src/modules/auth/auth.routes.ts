import { Router } from 'express';
import {
  login,
  loginPlatformAdmin,
  refresh,
  logout,
  me,
  requestUserOtp,
  verifyUserOtp,
  loginUserWithOtp,
  requestCustomerOtp,
  verifyCustomerOtp,
  requestOtp,
  loginWithOtp
} from './auth.controller';
import { validate } from '../../common/middleware/validate';
import {
  loginSchema,
  platformAdminLoginSchema,
  refreshSchema,
  requestOtpSchema,
  verifyOtpSchema,
  loginWithOtpSchema,
  unifiedLoginOtpSchema
} from './auth.validators';
import { authMiddleware } from '../../common/middleware/auth';
import { publicApiRateLimiter } from '../../common/middleware/rateLimit';
import { env } from '../../config/env';
import { asyncHandler } from '../../common/middleware/asyncHandler';

const router = Router();

if (env.NODE_ENV !== 'test') {
  router.use(publicApiRateLimiter);
}

// --- Unified OTP Authentication Flow ---
router.post('/otp/request', validate(requestOtpSchema), asyncHandler(requestOtp));
router.post('/otp/login', validate(unifiedLoginOtpSchema), asyncHandler(loginWithOtp));

// --- Deprecated User OTP Flow (retained for backward compatibility) ---
router.post('/user/otp/request', validate(requestOtpSchema), asyncHandler(requestUserOtp));
router.post('/user/otp/verify', validate(verifyOtpSchema), asyncHandler(verifyUserOtp));
router.post('/user/login/otp', validate(loginWithOtpSchema), asyncHandler(loginUserWithOtp));

// --- Deprecated Customer OTP Flow (retained for backward compatibility) ---
router.post('/customer/otp/request', validate(requestOtpSchema), asyncHandler(requestCustomerOtp));
router.post('/customer/otp/verify', validate(verifyOtpSchema), asyncHandler(verifyCustomerOtp));

// --- Platform Admin Login ---
router.post('/platform-admin/login', validate(platformAdminLoginSchema), asyncHandler(loginPlatformAdmin));

// --- Classic Login ---
router.post('/login', validate(loginSchema), asyncHandler(login));
router.post('/refresh', validate(refreshSchema), asyncHandler(refresh));


// --- Protected ---
router.post('/logout', authMiddleware, asyncHandler(logout));
router.get('/me', authMiddleware, asyncHandler(me));

export default router;
