import { Router } from 'express';
import {
  login,
  refresh,
  logout,
  me,
  requestUserOtp,
  verifyUserOtp,
  loginUserWithOtp,
  requestCustomerOtp,
  verifyCustomerOtp
} from './auth.controller';
import { validate } from '../../common/middleware/validate';
import {
  loginSchema,
  refreshSchema,
  requestOtpSchema,
  verifyOtpSchema,
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

// --- User OTP Flow ---
router.post('/user/otp/request', validate(requestOtpSchema), asyncHandler(requestUserOtp));
router.post('/user/otp/verify', validate(verifyOtpSchema), asyncHandler(verifyUserOtp));
router.post('/user/login/otp', validate(loginWithOtpSchema), asyncHandler(loginUserWithOtp));

// --- Customer OTP Flow ---
router.post('/customer/otp/request', validate(requestOtpSchema), asyncHandler(requestCustomerOtp));
router.post('/customer/otp/verify', validate(verifyOtpSchema), asyncHandler(verifyCustomerOtp));

// --- Classic Login ---
router.post('/login', validate(loginSchema), asyncHandler(login));
router.post('/refresh', validate(refreshSchema), asyncHandler(refresh));


// --- Protected ---
router.post('/logout', authMiddleware, asyncHandler(logout));
router.get('/me', authMiddleware, asyncHandler(me));

export default router;
