import argon2 from 'argon2';
import crypto from 'crypto';
import { AuthRepository } from './auth.repository';
import { generateAccessToken } from './auth.tokens';
import { OtpPurpose, SessionActorType } from '@prisma/client';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { env } from '../../config/env';
import { normalizePhone } from '../../common/utils/phone';
import redis from '../../config/redis';

const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCKOUT_SECONDS = 900; // 15 minutes

const getLoginLockKey = (gamingCenterId: string, phone: string) =>
  `auth:login_fail:${gamingCenterId}:${normalizePhone(phone)}`;

const sanitizeUser = <T extends Record<string, unknown>>(user: T): Omit<T, 'passwordHash'> => {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
};

const hashToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// OTP settings
const OTP_POST_VERIFICATION_WINDOW_MINUTES = 5; // How long a user has to login after verifying OTP

const createAndSaveSession = async (actorId: string, actorType: SessionActorType) => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // 1. Generate a secure, random refresh token.
  const refreshToken = crypto.randomBytes(32).toString('hex');

  // 2. Hash the refresh token for database storage.
  const tokenHash = hashToken(refreshToken);

  // 3. Create the session with the hashed token.
  const session = await AuthRepository.createSession(actorId, actorType, tokenHash, expiresAt);

  // 4. Create the access token.
  const payload = { sessionId: session.id, actorId, actorType };
  const accessToken = generateAccessToken(payload);

  // 5. Return the raw refresh token to the client. It's sent only once.
  return { accessToken, refreshToken };
};

export const authService = {
  async loginUser(phone: string, password: string, gamingCenterId: string) {
    const lockKey = getLoginLockKey(gamingCenterId, phone);
    let currentFailures = 0;
    try {
      const rawFails = await redis.get(lockKey);
      currentFailures = Number(rawFails) || 0;
    } catch {
      currentFailures = 0;
    }
    if (currentFailures >= LOGIN_MAX_FAILURES) {
      throw new AppError(
        'Too many failed login attempts. Please try again later.',
        httpStatus.TOO_MANY_REQUESTS,
        { code: 'ACCOUNT_LOCKED' }
      );
    }

    const user = await AuthRepository.findUserByPhone(phone, gamingCenterId);
    if (!user || !user.passwordHash) {
      try {
        await redis.set(lockKey, String(currentFailures + 1), 'EX', LOGIN_LOCKOUT_SECONDS);
      } catch {
        // ignore cache failure
      }
      throw new AppError('Invalid credentials', httpStatus.UNAUTHORIZED);
    }

    if (user.isActive === false) {
      throw new AppError('User account is deactivated', httpStatus.UNAUTHORIZED);
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      try {
        await redis.set(lockKey, String(currentFailures + 1), 'EX', LOGIN_LOCKOUT_SECONDS);
      } catch {
        // ignore cache failure
      }
      throw new AppError('Invalid credentials', httpStatus.UNAUTHORIZED);
    }

    try {
      await redis.del(lockKey);
    } catch {
      // ignore cache failure
    }

    const { accessToken, refreshToken } = await createAndSaveSession(user.id, 'USER');

    return {
      user: sanitizeUser(user as unknown as Record<string, unknown>),
      tokens: { accessToken, refreshToken },
    };
  },

  async loginPlatformAdmin(
    identifier: string,
    password: string,
    context?: { ip?: string; userAgent?: string }
  ) {
    const { PlatformAdminAuthService } = await import('./platform-admin-auth.service');
    return PlatformAdminAuthService.login(identifier, password, context);
  },

  /**
   * Requests a staff/manager OTP via OtpService with actor-type scoping and rate limiting.
   */
  async requestUserOtp(phone: string, metadata?: { ip?: string; userAgent?: string }) {
    const { OtpService } = await import('./otp.service');
    const normalizedPhone = normalizePhone(phone);
    return OtpService.requestOtp(normalizedPhone, OtpPurpose.LOGIN, metadata, SessionActorType.USER);
  },

  /**
   * Verifies a staff/manager OTP via OtpService enforcing max attempts, backoff, and atomic consumption.
   */
  async verifyUserOtp(phone: string, code: string, metadata?: { ip?: string }) {
    const { OtpService } = await import('./otp.service');
    const normalizedPhone = normalizePhone(phone);

    await OtpService.verifyAndConsumeOtp(normalizedPhone, code, OtpPurpose.LOGIN, metadata, SessionActorType.USER);
    await AuthRepository.markUserPhoneVerified(normalizedPhone);

    const users = await AuthRepository.findUsersWithGamingCenters(normalizedPhone);

    const gamingCenters = users.map(user => ({
      id: user.gamingCenter.id,
      name: user.gamingCenter.name,
    }));

    return { gamingCenters };
  },

  /**
   * Requests a customer OTP via OtpService with actor-type scoping and rate limiting.
   */
  async requestCustomerOtp(phone: string, metadata?: { ip?: string; userAgent?: string }) {
    const { OtpService } = await import('./otp.service');
    const normalizedPhone = normalizePhone(phone);
    return OtpService.requestOtp(normalizedPhone, OtpPurpose.LOGIN, metadata, SessionActorType.CUSTOMER);
  },

  /**
   * Verifies a customer OTP via OtpService enforcing max attempts, backoff, and atomic consumption.
   */
  async verifyCustomerOtp(phone: string, code: string, metadata?: { ip?: string }) {
    const { OtpService } = await import('./otp.service');
    const normalizedPhone = normalizePhone(phone);

    await OtpService.verifyAndConsumeOtp(normalizedPhone, code, OtpPurpose.LOGIN, metadata, SessionActorType.CUSTOMER);

    const customer = await AuthRepository.findCustomerByPhone(normalizedPhone);
    if (customer && !customer.phoneVerifiedAt) {
      await AuthRepository.markCustomerPhoneVerified(customer.id);
    }

    return { message: 'OTP verified successfully.' };
  },

  /**
   * Completes deprecated USER OTP login with strict single-use consumption and active account checks.
   */
  async loginUserWithOtp(phone: string, gamingCenterId: string) {
    const normalizedPhone = normalizePhone(phone);
    const verificationWindow = new Date(Date.now() - OTP_POST_VERIFICATION_WINDOW_MINUTES * 60 * 1000);
    const maxAttempts = Number(env.OTP_MAX_ATTEMPTS) || 5;

    const recentVerifiedOtp = await AuthRepository.findRecentConsumedOtp(
      normalizedPhone,
      OtpPurpose.LOGIN,
      verificationWindow,
      SessionActorType.USER
    );

    if (
      !recentVerifiedOtp ||
      (recentVerifiedOtp.attempts ?? 0) >= maxAttempts ||
      (recentVerifiedOtp.expiresAt &&
        recentVerifiedOtp.consumedAt &&
        recentVerifiedOtp.consumedAt > recentVerifiedOtp.expiresAt)
    ) {
      throw new AppError('No recent OTP verification found. Please verify again.', httpStatus.UNAUTHORIZED);
    }

    const user = await AuthRepository.findUserByPhone(normalizedPhone, gamingCenterId);
    if (!user || user.isActive === false) {
      throw new AppError('Invalid credentials for the selected gamingCenter.', httpStatus.UNAUTHORIZED);
    }

    const deletedOtp = await AuthRepository.deleteConsumedOtp(recentVerifiedOtp.id);
    if (!deletedOtp || deletedOtp.count === 0) {
      throw new AppError('OTP verification has already been used.', httpStatus.UNAUTHORIZED);
    }

    const { accessToken, refreshToken } = await createAndSaveSession(user.id, 'USER');

    return {
      user: sanitizeUser(user as unknown as Record<string, unknown>),
      tokens: { accessToken, refreshToken },
    };
  },

  async loginCustomer(phone: string) {
    const { getPhoneVariants } = await import('../../common/utils/phone');
    const { IdentityService } = await import('./identity.service');
    const { AuthorizationService } = await import('./authorization.service');
    const { SessionService } = await import('./session.service');

    const normalizedPhone = normalizePhone(phone);
    const variants = getPhoneVariants(phone);

    // Identify identity strictly from database across all phone representations
    const identity = await IdentityService.identifyByPhone(normalizedPhone);

    // If an active staff or manager account exists, authenticate as USER and NEVER create a CustomerAccount
    if (identity.actorType === 'USER' && identity.userAccounts.length > 0) {
      const primaryUser = identity.userAccounts[0];
      const authContext = AuthorizationService.resolveUserAuthorization(identity.userAccounts);
      await AuthRepository.markUserPhoneVerified(normalizedPhone);
      const { tokens } = await SessionService.createSession(primaryUser.id, SessionActorType.USER, authContext.roles);

      return {
        user: {
          id: primaryUser.id,
          phone: normalizedPhone,
          actorType: SessionActorType.USER,
          roles: authContext.roles,
          permissions: authContext.permissions,
          gamingCenters: authContext.gamingCenters,
        },
        tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
      };
    }

    let customer = await AuthRepository.findCustomerByPhone(normalizedPhone);
    if (!customer) {
      // Check customer account by variants as well
      const { prisma } = await import('../../config/prisma');
      const existingCustomer = await prisma.customerAccount.findFirst({
        where: { phone: { in: variants } },
      });
      if (existingCustomer) {
        customer = existingCustomer;
      }
    }

    if (!customer) {
      if (AuthRepository.upsertCustomerAccount) {
        customer = await AuthRepository.upsertCustomerAccount(normalizedPhone, new Date());
      }
      if (!customer && AuthRepository.createCustomer) {
        customer = await AuthRepository.createCustomer(normalizedPhone, new Date());
      }
      if (!customer) {
        const { UserProvisioningService } = await import('./user-provisioning.service');
        customer = await UserProvisioningService.provisionCustomer(normalizedPhone);
      }
    } else if (!customer.phoneVerifiedAt) {
      customer = await AuthRepository.markCustomerPhoneVerified(customer.id);
    }

    const { accessToken, refreshToken } = await createAndSaveSession(customer.id, 'CUSTOMER');

    return {
      customer,
      tokens: { accessToken, refreshToken },
    };
  },

  async refreshAuthToken(token: string, context?: { ip?: string; userAgent?: string }) {
    // The incoming token is the raw refresh token string.
    // 1. Hash the incoming token to find it in the database.
    const tokenHash = hashToken(token);

    // 2. Find the session.
    const session = await AuthRepository.findSessionByToken(tokenHash);
    if (!session || session.revokedAt) {
      throw new AppError('Session is invalid or has been revoked', httpStatus.UNAUTHORIZED);
    }

    // Platform Admin sessions enforce strict MFA verification & refresh token rotation
    if (session.actorType === SessionActorType.PLATFORM_ADMIN) {
      const { PlatformAdminAuthService } = await import('./platform-admin-auth.service');
      return PlatformAdminAuthService.refreshSession(token, context);
    }

    // 3. Check for expiration.
    if (new Date() > session.expiresAt) {
      const { markSessionRevokedInCache } = await import('../../common/middleware/auth');
      await markSessionRevokedInCache(session.id, 7 * 24 * 3600);
      await AuthRepository.revokeSession(session.id);
      throw new AppError('Refresh token has expired', httpStatus.UNAUTHORIZED);
    }

    // 4. Verify active user state for USER sessions (null means deleted user; undefined in automocks is ignored).
    if (session.actorType === SessionActorType.USER) {
      const user = await AuthRepository.findUserById(session.actorId);
      if (user === null || (user && user.isActive === false)) {
        const { invalidateActorCache, markSessionRevokedInCache } = await import('../../common/middleware/auth');
        await markSessionRevokedInCache(session.id, 7 * 24 * 3600);
        await invalidateActorCache(session.actorId, session.actorType);
        await AuthRepository.revokeSession(session.id);
        throw new AppError('User account is inactive or no longer exists', httpStatus.UNAUTHORIZED);
      }
    }

    // 5. Rotate refresh token & issue new access token.
    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = hashToken(newRefreshToken);
    if (typeof AuthRepository.rotateSessionToken === 'function') {
      await AuthRepository.rotateSessionToken(session.id, newTokenHash);
    }

    const newPayload = { sessionId: session.id, actorId: session.actorId, actorType: session.actorType };
    const accessToken = generateAccessToken(newPayload);

    return { accessToken, refreshToken: newRefreshToken };
  },

  async logout(sessionId: string, context?: { ip?: string; userAgent?: string }) {
    const { invalidateActorCache, markSessionRevokedInCache } = await import('../../common/middleware/auth');
    await markSessionRevokedInCache(sessionId, 7 * 24 * 3600);

    const session = await AuthRepository.findSessionById(sessionId);
    if (session) {
      if (session.actorType === SessionActorType.PLATFORM_ADMIN) {
        const { PlatformAdminAuthService } = await import('./platform-admin-auth.service');
        return PlatformAdminAuthService.logoutSession(sessionId, session.actorId, context);
      }
      await invalidateActorCache(session.actorId, session.actorType);
    }
    await AuthRepository.revokeSession(sessionId);
    return { message: 'Logged out successfully' };
  },

  /**
   * Unified OTP Request (A): POST /api/v1/auth/otp/request
   */
  async requestOtpUnified(phone: string, metadata?: { ip?: string; userAgent?: string }) {
    const { OtpService } = await import('./otp.service');
    const normalizedPhone = normalizePhone(phone);
    return OtpService.requestOtp(normalizedPhone, OtpPurpose.LOGIN, metadata);
  },

  /**
   * Unified OTP Login (B): POST /api/v1/auth/otp/login
   */
  async loginWithOtpUnified(phone: string, code: string, metadata?: { ip?: string }) {
    const { OtpService } = await import('./otp.service');
    const { IdentityService } = await import('./identity.service');
    const { UserProvisioningService } = await import('./user-provisioning.service');
    const { AuthorizationService } = await import('./authorization.service');
    const { SessionService } = await import('./session.service');

    const normalizedPhone = normalizePhone(phone);

    // 1-6: Verify OTP, enforce rate limits, attempts limit, Argon2 verification, atomic consumption
    await OtpService.verifyAndConsumeOtp(normalizedPhone, code, OtpPurpose.LOGIN, metadata);

    // 7-11: Identify identity and roles strictly from DB
    const identity = await IdentityService.identifyByPhone(normalizedPhone);

    let actorId = identity.primaryActorId;
    let actorType: SessionActorType = identity.actorType;
    let roles: string[] = [];
    let permissions: string[] = [];
    let gamingCenters: Array<{ id: string; name: string; role: string }> = [];

    if (identity.actorType === 'USER' && identity.userAccounts.length > 0) {
      actorType = SessionActorType.USER;
      actorId = identity.primaryActorId;
      const authContext = AuthorizationService.resolveUserAuthorization(identity.userAccounts);
      roles = authContext.roles;
      permissions = authContext.permissions;
      gamingCenters = authContext.gamingCenters;

      // Mark user phones verified
      await AuthRepository.markUserPhoneVerified(normalizedPhone);
    } else {
      // Customer path (either existing CustomerAccount or newly provisioned)
      actorType = SessionActorType.CUSTOMER;
      let customer = identity.customerAccount;
      if (!customer || identity.isNewCustomer) {
        customer = await UserProvisioningService.provisionCustomer(normalizedPhone);
      } else if (!customer.phoneVerifiedAt) {
        customer = await AuthRepository.markCustomerPhoneVerified(customer.id);
      }
      actorId = customer.id;
      const authContext = AuthorizationService.resolveCustomerAuthorization();
      roles = authContext.roles;
      permissions = authContext.permissions;
      gamingCenters = authContext.gamingCenters;
    }

    // 12-13: Create Session, issue access and refresh tokens
    const { tokens } = await SessionService.createSession(actorId, actorType, roles);

    // 14: Return standardized response
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: actorId,
        phone: normalizedPhone,
        actorType,
        roles,
        permissions,
        gamingCenters,
      },
    };
  }
};
