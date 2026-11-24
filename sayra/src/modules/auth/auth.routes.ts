import { Router } from 'express';
import {
  login,
  loginPlatformAdmin,
  verifyPlatformAdminTwoFactor,
  setupPlatformAdminTwoFactor,
  confirmPlatformAdminTwoFactor,
  getPlatformAdminTwoFactorStatus,
  removePlatformAdminAuthenticatorDevice,
  regeneratePlatformAdminRecoveryCodes,
  disablePlatformAdminTwoFactor,
  refreshPlatformAdminSession,
  logoutPlatformAdmin,
  listPlatformAdminSessions,
  revokeAllPlatformAdminSessions,
  refresh,
  logout,
  me,
  updateMe,
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
  platformAdminVerify2faSchema,
  platformAdminSetup2faSchema,
  platformAdminConfirm2faSchema,
  platformAdminReauth2faSchema,
  platformAdminDeleteDeviceSchema,
  platformAdminDisable2faSchema,
  platformAdminRefreshSchema,
  refreshSchema,
  requestOtpSchema,
  verifyOtpSchema,
  otpLoginSchema,
  loginWithOtpSchema,
  updateProfileSchema
} from './auth.validators';
import { authMiddleware, optionalAuth } from '../../common/middleware/auth';
import { requirePlatformAdmin } from '../../common/middleware/requirePlatformAdmin';
import {
  publicApiRateLimiter,
  platformAdminLoginRateLimiter,
  platformAdminTotpRateLimiter,
  platformAdminRefreshRateLimiter,
} from '../../common/middleware/rateLimit';
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

// --- Platform Admin Mandatory TOTP 2FA Authentication ---
router.post(
  '/platform-admin/login',
  platformAdminLoginRateLimiter,
  validate(platformAdminLoginSchema),
  asyncHandler(loginPlatformAdmin)
);
router.post(
  '/platform-admin/verify-2fa',
  platformAdminTotpRateLimiter,
  validate(platformAdminVerify2faSchema),
  asyncHandler(verifyPlatformAdminTwoFactor)
);
router.post(
  '/platform-admin/2fa/setup',
  platformAdminTotpRateLimiter,
  optionalAuth,
  validate(platformAdminSetup2faSchema),
  asyncHandler(setupPlatformAdminTwoFactor)
);
router.post(
  '/platform-admin/2fa/confirm',
  platformAdminTotpRateLimiter,
  optionalAuth,
  validate(platformAdminConfirm2faSchema),
  asyncHandler(confirmPlatformAdminTwoFactor)
);
router.get(
  '/platform-admin/2fa/status',
  authMiddleware,
  requirePlatformAdmin,
  asyncHandler(getPlatformAdminTwoFactorStatus)
);
router.delete(
  '/platform-admin/2fa/devices/:deviceId',
  platformAdminTotpRateLimiter,
  authMiddleware,
  requirePlatformAdmin,
  validate(platformAdminDeleteDeviceSchema),
  asyncHandler(removePlatformAdminAuthenticatorDevice)
);
router.post(
  '/platform-admin/2fa/recovery-codes/regenerate',
  platformAdminTotpRateLimiter,
  authMiddleware,
  requirePlatformAdmin,
  validate(platformAdminReauth2faSchema),
  asyncHandler(regeneratePlatformAdminRecoveryCodes)
);
router.post(
  '/platform-admin/2fa/disable',
  platformAdminTotpRateLimiter,
  authMiddleware,
  requirePlatformAdmin,
  validate(platformAdminDisable2faSchema),
  asyncHandler(disablePlatformAdminTwoFactor)
);
router.post(
  '/platform-admin/refresh',
  platformAdminRefreshRateLimiter,
  validate(platformAdminRefreshSchema),
  asyncHandler(refreshPlatformAdminSession)
);
router.post(
  '/platform-admin/logout',
  authMiddleware,
  requirePlatformAdmin,
  asyncHandler(logoutPlatformAdmin)
);
router.get(
  '/platform-admin/sessions',
  authMiddleware,
  requirePlatformAdmin,
  asyncHandler(listPlatformAdminSessions)
);
router.post(
  '/platform-admin/sessions/revoke-all',
  authMiddleware,
  requirePlatformAdmin,
  asyncHandler(revokeAllPlatformAdminSessions)
);

// --- Classic Login ---
router.post('/login', validate(loginSchema), asyncHandler(login));
router.post('/refresh', validate(refreshSchema), asyncHandler(refresh));

// --- Protected ---
router.post('/logout', authMiddleware, asyncHandler(logout));
router.get('/me', authMiddleware, asyncHandler(me));
router.patch('/me', authMiddleware, validate(updateProfileSchema), asyncHandler(updateMe));

export default router;
