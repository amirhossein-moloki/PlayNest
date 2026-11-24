import argon2 from 'argon2';
import crypto from 'crypto';
import httpStatus from 'http-status';
import {
  PlatformAdminAuthenticatorStatus,
  PlatformAdminChallengePurpose,
  SessionActorType,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import redis from '../../config/redis';
import logger from '../../config/logger';
import { env } from '../../config/env';
import AppError from '../../common/errors/AppError';
import { invalidateActorCache, markSessionRevokedInCache } from '../../common/middleware/auth';
import { AdminAuditService } from '../../platform-admin/services/admin-audit.service';
import { ADMIN_CONSTANTS } from '../../platform-admin/config/admin.constants';
import {
  generatePlatformAdminAccessToken,
  generatePlatformAdminChallengeToken,
  parseDurationToMs,
  verifyPlatformAdminChallengeToken,
} from './auth.tokens';
import {
  buildOtpAuthUri,
  decryptTotpSecret,
  encryptTotpSecret,
  formatManualEntryKey,
  generateRecoveryCodes,
  generateTotpQrCode,
  generateTotpSecret,
  hashRecoveryCode,
  RECOVERY_CODE_COUNT,
  resolveTotpMasterKey,
  TOTP_DEFAULT_WINDOW,
  TOTP_DIGITS,
  TOTP_PERIOD_SECONDS,
  verifyRecoveryCodeHash,
  verifyTotpCode,
} from './totp.crypto';
import {
  DEFAULT_ADMIN_REFRESH_TTL_MS,
  LOCKOUT_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  MAX_FAILED_TOTP_ATTEMPTS,
  PENDING_DEVICE_TTL_MS,
  PLATFORM_ADMIN_AUDIT_ACTIONS,
  sanitizeAuthenticatorDevice,
  sanitizePlatformAdmin,
} from './platform-admin-auth.constants';

// Pre-computed Argon2id dummy hash to equalize login timing when username does not exist
const DUMMY_ARGON2_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHQxMjM0NTY3OA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export interface RequestContextMeta {
  ip?: string;
  userAgent?: string;
}

const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

function getRefreshTtlMs(): number {
  return parseDurationToMs(env.PLATFORM_ADMIN_REFRESH_EXPIRES_IN, DEFAULT_ADMIN_REFRESH_TTL_MS);
}

function getRefreshTtlSeconds(): number {
  return Math.max(60, Math.ceil(getRefreshTtlMs() / 1000));
}

function getChallengeTtlSeconds(): number {
  return env.PLATFORM_ADMIN_CHALLENGE_TTL_SECONDS || 300;
}

function getSetupTtlSeconds(): number {
  return env.PLATFORM_ADMIN_SETUP_TTL_SECONDS || 600;
}

function getTotpIssuer(): string {
  return (env.PLATFORM_ADMIN_TOTP_ISSUER || 'PlayNest').trim();
}

function resolveAccountLabel(admin: {
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  id: string;
}): string {
  return admin.username || admin.email || admin.phone || admin.id;
}

async function purgeAdminJsSessionsForAdmin(adminId: string): Promise<void> {
  if (typeof redis.scan !== 'function') {
    return;
  }

  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${ADMIN_CONSTANTS.SESSION_PREFIX}*`,
        'COUNT',
        100
      );
      cursor = nextCursor;

      for (const key of keys) {
        const raw = await redis.get(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as { adminUser?: { id?: string } };
          if (parsed?.adminUser?.id === adminId) {
            await redis.del(key);
          }
        } catch {
          // ignore malformed session entry
        }
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.warn({ err, adminId }, 'Failed to purge AdminJS Redis sessions');
  }
}

async function recordAudit(params: {
  platformAdminId?: string;
  action: string;
  entityId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  context?: RequestContextMeta;
}) {
  await AdminAuditService.logAdminEvent({
    platformAdminId: params.platformAdminId,
    action: params.action,
    entity: 'PlatformAdmin',
    entityId: params.entityId,
    oldData: params.oldData,
    newData: params.newData,
    ipAddress: params.context?.ip,
    userAgent: params.context?.userAgent,
  });
}

async function findPlatformAdminByIdentifier(identifier: string) {
  const clean = identifier.trim();
  return prisma.platformAdmin.findFirst({
    where: {
      OR: [
        { username: { equals: clean, mode: 'insensitive' } },
        { phone: clean },
        { email: { equals: clean, mode: 'insensitive' } },
      ],
    },
    include: {
      authenticators: {
        where: { status: PlatformAdminAuthenticatorStatus.ACTIVE },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      },
    },
  });
}

async function verifyAndConsumeTotpAcrossDevices(params: {
  admin: {
    id: string;
    totpSecretEncrypted: string | null;
    totpLastUsedStep: number | null;
    authenticators?: Array<{
      id: string;
      secretEncrypted: string;
      lastUsedStep: number | null;
      status: PlatformAdminAuthenticatorStatus;
    }>;
  };
  code: string;
}): Promise<{
  matched: boolean;
  replayed: boolean;
  deviceId?: string;
  matchedStep?: number;
}> {
  const activeDevices = (params.admin.authenticators || []).filter(
    (d) => d.status === PlatformAdminAuthenticatorStatus.ACTIVE
  );

  let sawReplay = false;

  for (const device of activeDevices) {
    const plainSecret = decryptTotpSecret(device.secretEncrypted, params.admin.id);
    const result = verifyTotpCode(plainSecret, params.code, {
      window: TOTP_DEFAULT_WINDOW,
      lastUsedStep: device.lastUsedStep ?? params.admin.totpLastUsedStep ?? null,
    });

    if (result.valid && result.matchedStep !== undefined) {
      return {
        matched: true,
        replayed: false,
        deviceId: device.id,
        matchedStep: result.matchedStep,
      };
    }

    if (result.replayed) {
      sawReplay = true;
    }
  }

  // Fallback for migrated/legacy single-secret records without authenticator rows
  if (activeDevices.length === 0 && params.admin.totpSecretEncrypted) {
    const plainSecret = decryptTotpSecret(params.admin.totpSecretEncrypted, params.admin.id);
    const result = verifyTotpCode(plainSecret, params.code, {
      window: TOTP_DEFAULT_WINDOW,
      lastUsedStep: params.admin.totpLastUsedStep ?? null,
    });

    if (result.valid && result.matchedStep !== undefined) {
      return {
        matched: true,
        replayed: false,
        matchedStep: result.matchedStep,
      };
    }

    if (result.replayed) {
      sawReplay = true;
    }
  }

  return { matched: false, replayed: sawReplay };
}

async function incrementAdminTotpFailure(
  adminId: string,
  currentFailedCount: number,
  challengeId?: string
): Promise<void> {
  const nextCount = currentFailedCount + 1;
  const shouldLock = nextCount >= MAX_FAILED_TOTP_ATTEMPTS;

  await prisma.platformAdmin.update({
    where: { id: adminId },
    data: {
      totpFailedAttempts: nextCount,
      ...(shouldLock ? { totpLockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) } : {}),
    },
  });

  if (challengeId) {
    await prisma.platformAdminChallenge.updateMany({
      where: { id: challengeId, consumedAt: null },
      data: { attempts: { increment: 1 } },
    });
  }
}

async function reauthenticateWithPasswordAndTotp(params: {
  adminId: string;
  currentPassword: string;
  code?: string;
  recoveryCode?: string;
  allowRecoveryCode?: boolean;
  context?: RequestContextMeta;
}) {
  const admin = await prisma.platformAdmin.findUnique({
    where: { id: params.adminId },
    include: {
      authenticators: {
        where: { status: PlatformAdminAuthenticatorStatus.ACTIVE },
      },
    },
  });

  if (!admin || !admin.isActive || !admin.isSuperuser) {
    throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
  }

  if (admin.totpLockedUntil && admin.totpLockedUntil > new Date()) {
    throw new AppError(
      'Too many failed two-factor attempts. Please try again later.',
      httpStatus.TOO_MANY_REQUESTS,
      { code: 'TOTP_LOCKED' }
    );
  }

  const passwordOk = await argon2.verify(admin.passwordHash, params.currentPassword);
  if (!passwordOk) {
    await recordAudit({
      platformAdminId: admin.id,
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.TOTP_VERIFICATION_FAILED,
      entityId: admin.id,
      newData: { stage: 'reauthentication', reason: 'INVALID_PASSWORD' },
      context: params.context,
    });
    throw new AppError('Invalid credentials.', httpStatus.UNAUTHORIZED);
  }

  if (!admin.totpEnabled || !admin.totpSetupCompleted) {
    return { admin, usedRecoveryCode: false, matchedStep: undefined as number | undefined };
  }

  if (params.code) {
    const check = await verifyAndConsumeTotpAcrossDevices({ admin, code: params.code });
    if (!check.matched) {
      await incrementAdminTotpFailure(admin.id, admin.totpFailedAttempts || 0);
      await recordAudit({
        platformAdminId: admin.id,
        action: PLATFORM_ADMIN_AUDIT_ACTIONS.TOTP_VERIFICATION_FAILED,
        entityId: admin.id,
        newData: {
          stage: 'reauthentication',
          reason: check.replayed ? 'REPLAY_DETECTED' : 'INVALID_TOTP_CODE',
        },
        context: params.context,
      });
      throw new AppError(
        check.replayed
          ? 'This verification code has already been used. Wait for the next code.'
          : 'Invalid two-factor authentication code.',
        httpStatus.UNAUTHORIZED,
        { code: check.replayed ? 'TOTP_REPLAY' : 'INVALID_TOTP_CODE' }
      );
    }

    const now = new Date();
    if (check.deviceId && check.matchedStep !== undefined) {
      const updated = await prisma.platformAdminAuthenticator.updateMany({
        where: {
          id: check.deviceId,
          status: PlatformAdminAuthenticatorStatus.ACTIVE,
          OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: check.matchedStep } }],
        },
        data: { lastUsedAt: now, lastUsedStep: check.matchedStep },
      });
      if (updated.count !== 1) {
        throw new AppError(
          'This verification code has already been used. Wait for the next code.',
          httpStatus.UNAUTHORIZED,
          { code: 'TOTP_REPLAY' }
        );
      }
    }

    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: {
        totpLastUsedAt: now,
        totpLastUsedStep: check.matchedStep ?? admin.totpLastUsedStep,
        totpFailedAttempts: 0,
        totpLockedUntil: null,
      },
    });

    return { admin, usedRecoveryCode: false, matchedStep: check.matchedStep };
  }

  if (params.allowRecoveryCode && params.recoveryCode) {
    const codes = await prisma.platformAdminRecoveryCode.findMany({
      where: { platformAdminId: admin.id, usedAt: null, revokedAt: null },
    });

    const matchedCode = codes.find((rc) => verifyRecoveryCodeHash(params.recoveryCode!, rc.codeHash));
    if (!matchedCode) {
      await incrementAdminTotpFailure(admin.id, admin.totpFailedAttempts || 0);
      await recordAudit({
        platformAdminId: admin.id,
        action: PLATFORM_ADMIN_AUDIT_ACTIONS.TOTP_VERIFICATION_FAILED,
        entityId: admin.id,
        newData: { stage: 'reauthentication', reason: 'INVALID_RECOVERY_CODE' },
        context: params.context,
      });
      throw new AppError('Invalid recovery code.', httpStatus.UNAUTHORIZED);
    }

    const consumed = await prisma.platformAdminRecoveryCode.updateMany({
      where: { id: matchedCode.id, usedAt: null, revokedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new AppError('Recovery code has already been used.', httpStatus.UNAUTHORIZED);
    }

    await recordAudit({
      platformAdminId: admin.id,
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.RECOVERY_CODE_USED,
      entityId: admin.id,
      newData: { stage: 'reauthentication', recoveryCodeId: matchedCode.id },
      context: params.context,
    });

    return { admin, usedRecoveryCode: true, matchedStep: undefined };
  }

  throw new AppError(
    'Two-factor verification code is required.',
    httpStatus.BAD_REQUEST,
    { code: 'TOTP_CODE_REQUIRED' }
  );
}

export const PlatformAdminAuthService = {
  /**
   * Step 1 of Platform Admin Authentication:
   * Verifies username (or legacy phone/email) + password and returns ONLY a short-lived
   * challengeToken (2FA enabled) or setupToken (mandatory initial 2FA setup).
   * Never issues access or refresh tokens directly.
   */
  async login(identifier: string, password: string, context?: RequestContextMeta) {
    // Fail-closed: verify TOTP cryptography subsystem is operational before allowing admin auth
    resolveTotpMasterKey();

    const cleanIdentifier = (identifier || '').trim();
    const admin = await findPlatformAdminByIdentifier(cleanIdentifier);

    if (!admin) {
      // Constant-time mitigation against account enumeration
      try {
        await argon2.verify(DUMMY_ARGON2_HASH, password);
      } catch {
        // ignore dummy verification errors
      }
      await recordAudit({
        action: PLATFORM_ADMIN_AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
        entityId: 'unknown',
        newData: { reason: 'INVALID_CREDENTIALS' },
        context,
      });
      throw new AppError('Invalid credentials', httpStatus.UNAUTHORIZED);
    }

    const now = new Date();
    if (admin.lockedUntil && admin.lockedUntil > now) {
      await recordAudit({
        platformAdminId: admin.id,
        action: PLATFORM_ADMIN_AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
        entityId: admin.id,
        newData: { reason: 'ACCOUNT_LOCKED' },
        context,
      });
      throw new AppError(
        'Too many failed login attempts. Account temporarily locked.',
        httpStatus.TOO_MANY_REQUESTS,
        { code: 'ADMIN_ACCOUNT_LOCKED' }
      );
    }

    const isPasswordValid = admin.passwordHash
      ? await argon2.verify(admin.passwordHash, password)
      : false;

    if (!isPasswordValid || !admin.isActive || !admin.isSuperuser) {
      const nextFailures = (admin.failedLoginAttempts || 0) + 1;
      const shouldLock = nextFailures >= MAX_FAILED_LOGIN_ATTEMPTS;

      await prisma.platformAdmin.update({
        where: { id: admin.id },
        data: {
          failedLoginAttempts: nextFailures,
          ...(shouldLock ? { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) } : {}),
        },
      });

      await recordAudit({
        platformAdminId: admin.id,
        action: PLATFORM_ADMIN_AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
        entityId: admin.id,
        newData: {
          reason: !admin.isActive
            ? 'ACCOUNT_INACTIVE'
            : !admin.isSuperuser
              ? 'NOT_SUPERUSER'
              : 'INVALID_PASSWORD',
          failedAttempts: nextFailures,
        },
        context,
      });

      throw new AppError('Invalid credentials', httpStatus.UNAUTHORIZED);
    }

    if (admin.failedLoginAttempts > 0 || admin.lockedUntil) {
      await prisma.platformAdmin.update({
        where: { id: admin.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const hasConfiguredTotp =
      admin.totpEnabled === true &&
      admin.totpSetupCompleted === true &&
      ((admin.authenticators && admin.authenticators.length > 0) ||
        Boolean(admin.totpSecretEncrypted));

    const purpose = hasConfiguredTotp
      ? PlatformAdminChallengePurpose.TOTP_VERIFY
      : PlatformAdminChallengePurpose.TOTP_SETUP;
    const ttlSeconds = hasConfiguredTotp ? getChallengeTtlSeconds() : getSetupTtlSeconds();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const nonce = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(nonce);

    const challenge = await prisma.platformAdminChallenge.create({
      data: {
        platformAdminId: admin.id,
        purpose,
        tokenHash,
        maxAttempts: MAX_FAILED_TOTP_ATTEMPTS,
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
        expiresAt,
      },
    });

    const ephemeralToken = generatePlatformAdminChallengeToken(
      {
        challengeId: challenge.id,
        actorId: admin.id,
        actorType: 'PLATFORM_ADMIN',
        purpose: hasConfiguredTotp ? 'TOTP_VERIFY' : 'TOTP_SETUP',
        nonce,
      },
      ttlSeconds
    );

    const safeAdmin = sanitizePlatformAdmin(admin as unknown as Record<string, unknown>);

    if (hasConfiguredTotp) {
      return {
        status: 'TOTP_REQUIRED' as const,
        requiresTwoFactor: true,
        requiresTwoFactorSetup: false,
        challengeToken: ephemeralToken,
        expiresIn: ttlSeconds,
        admin: safeAdmin,
      };
    }

    return {
      status: 'TOTP_SETUP_REQUIRED' as const,
      requiresTwoFactor: true,
      requiresTwoFactorSetup: true,
      setupToken: ephemeralToken,
      challengeToken: ephemeralToken,
      expiresIn: ttlSeconds,
      admin: safeAdmin,
    };
  },

  /**
   * Step 2 of Platform Admin Authentication:
   * Verifies 6-digit RFC 6238 TOTP code OR single-use Recovery Code against an active TOTP_VERIFY challenge.
   * Only upon success issues a full Platform Admin session, accessToken, and refreshToken.
   */
  async verifyTwoFactor(
    input: { challengeToken: string; code?: string; recoveryCode?: string },
    context?: RequestContextMeta
  ) {
    resolveTotpMasterKey();

    const decoded = verifyPlatformAdminChallengeToken(input.challengeToken);
    if (!decoded || decoded.purpose !== 'TOTP_VERIFY') {
      throw new AppError('Invalid or expired 2FA challenge.', httpStatus.UNAUTHORIZED, {
        code: 'INVALID_2FA_CHALLENGE',
      });
    }

    const challenge = await prisma.platformAdminChallenge.findUnique({
      where: { id: decoded.challengeId },
    });

    const now = new Date();
    if (
      !challenge ||
      challenge.platformAdminId !== decoded.actorId ||
      challenge.purpose !== PlatformAdminChallengePurpose.TOTP_VERIFY ||
      challenge.tokenHash !== hashToken(decoded.nonce) ||
      challenge.consumedAt !== null ||
      challenge.expiresAt <= now
    ) {
      throw new AppError('Invalid or expired 2FA challenge.', httpStatus.UNAUTHORIZED, {
        code: 'INVALID_2FA_CHALLENGE',
      });
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      throw new AppError(
        'Maximum verification attempts exceeded for this login challenge.',
        httpStatus.TOO_MANY_REQUESTS,
        { code: 'TOTP_CHALLENGE_EXHAUSTED' }
      );
    }

    const admin = await prisma.platformAdmin.findUnique({
      where: { id: decoded.actorId },
      include: {
        authenticators: {
          where: { status: PlatformAdminAuthenticatorStatus.ACTIVE },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!admin || !admin.isActive || !admin.isSuperuser) {
      throw new AppError('Invalid credentials', httpStatus.UNAUTHORIZED);
    }

    if (!admin.totpEnabled || !admin.totpSetupCompleted) {
      throw new AppError('Two-factor authentication setup is required.', httpStatus.FORBIDDEN, {
        code: 'TOTP_SETUP_REQUIRED',
      });
    }

    if (admin.totpLockedUntil && admin.totpLockedUntil > now) {
      throw new AppError(
        'Two-factor verification temporarily locked due to repeated failures.',
        httpStatus.TOO_MANY_REQUESTS,
        { code: 'TOTP_LOCKED' }
      );
    }

    let usedRecoveryCode = false;
    let remainingRecoveryCodes: number | undefined;
    let matchedDeviceId: string | undefined;
    let matchedStep: number | undefined;
    let matchedRecoveryCodeId: string | undefined;

    if (input.code) {
      const verifyRes = await verifyAndConsumeTotpAcrossDevices({ admin, code: input.code });
      if (!verifyRes.matched || verifyRes.matchedStep === undefined) {
        await incrementAdminTotpFailure(admin.id, admin.totpFailedAttempts || 0, challenge.id);
        await recordAudit({
          platformAdminId: admin.id,
          action: PLATFORM_ADMIN_AUDIT_ACTIONS.TOTP_VERIFICATION_FAILED,
          entityId: admin.id,
          newData: {
            method: 'TOTP',
            reason: verifyRes.replayed ? 'REPLAY_DETECTED' : 'INVALID_OR_EXPIRED_CODE',
          },
          context,
        });
        throw new AppError(
          verifyRes.replayed
            ? 'TOTP code has already been used. Please wait for a new code.'
            : 'Invalid or expired two-factor authentication code.',
          httpStatus.UNAUTHORIZED,
          { code: verifyRes.replayed ? 'TOTP_REPLAY' : 'INVALID_TOTP_CODE' }
        );
      }
      matchedDeviceId = verifyRes.deviceId;
      matchedStep = verifyRes.matchedStep;
    } else if (input.recoveryCode) {
      const availableCodes = await prisma.platformAdminRecoveryCode.findMany({
        where: {
          platformAdminId: admin.id,
          usedAt: null,
          revokedAt: null,
        },
      });
      const matchedRecord = availableCodes.find((rc) =>
        verifyRecoveryCodeHash(input.recoveryCode!, rc.codeHash)
      );
      if (!matchedRecord) {
        await incrementAdminTotpFailure(admin.id, admin.totpFailedAttempts || 0, challenge.id);
        await recordAudit({
          platformAdminId: admin.id,
          action: PLATFORM_ADMIN_AUDIT_ACTIONS.TOTP_VERIFICATION_FAILED,
          entityId: admin.id,
          newData: { method: 'RECOVERY_CODE', reason: 'INVALID_RECOVERY_CODE' },
          context,
        });
        throw new AppError('Invalid recovery code.', httpStatus.UNAUTHORIZED, {
          code: 'INVALID_RECOVERY_CODE',
        });
      }
      usedRecoveryCode = true;
      matchedRecoveryCodeId = matchedRecord.id;
    } else {
      throw new AppError(
        'A 6-digit TOTP code or recovery code is required.',
        httpStatus.BAD_REQUEST
      );
    }

    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = hashToken(rawRefreshToken);
    const sessionExpiresAt = new Date(Date.now() + getRefreshTtlMs());

    const txResult = await prisma.$transaction(async (tx) => {
      const challengeClaim = await tx.platformAdminChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (challengeClaim.count !== 1) {
        throw new AppError('Invalid or expired 2FA challenge.', httpStatus.UNAUTHORIZED, {
          code: 'INVALID_2FA_CHALLENGE',
        });
      }

      if (matchedDeviceId && matchedStep !== undefined) {
        const deviceClaim = await tx.platformAdminAuthenticator.updateMany({
          where: {
            id: matchedDeviceId,
            status: PlatformAdminAuthenticatorStatus.ACTIVE,
            OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: matchedStep } }],
          },
          data: {
            lastUsedAt: now,
            lastUsedStep: matchedStep,
          },
        });
        if (deviceClaim.count !== 1) {
          throw new AppError(
            'TOTP code has already been used. Please wait for a new code.',
            httpStatus.UNAUTHORIZED,
            { code: 'TOTP_REPLAY' }
          );
        }
      }

      if (matchedRecoveryCodeId) {
        const codeClaim = await tx.platformAdminRecoveryCode.updateMany({
          where: {
            id: matchedRecoveryCodeId,
            usedAt: null,
            revokedAt: null,
          },
          data: { usedAt: now },
        });
        if (codeClaim.count !== 1) {
          throw new AppError('Recovery code has already been used.', httpStatus.UNAUTHORIZED, {
            code: 'INVALID_RECOVERY_CODE',
          });
        }
      }

      const updatedAdmin =
        !matchedDeviceId && !usedRecoveryCode && matchedStep !== undefined
          ? await (async () => {
            const adminClaim = await tx.platformAdmin.updateMany({
              where: {
                id: admin.id,
                OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: matchedStep } }],
              },
              data: {
                lastLogin: now,
                totpFailedAttempts: 0,
                totpLockedUntil: null,
                totpLastUsedAt: now,
                totpLastUsedStep: matchedStep,
              },
            });
            if (adminClaim.count !== 1) {
              throw new AppError(
                'TOTP code has already been used. Please wait for a new code.',
                httpStatus.UNAUTHORIZED,
                { code: 'TOTP_REPLAY' }
              );
            }
            return (await tx.platformAdmin.findUnique({ where: { id: admin.id } }))!;
          })()
          : await tx.platformAdmin.update({
            where: { id: admin.id },
            data: {
              lastLogin: now,
              totpFailedAttempts: 0,
              totpLockedUntil: null,
              ...(!usedRecoveryCode
                ? {
                  totpLastUsedAt: now,
                  ...(matchedStep !== undefined ? { totpLastUsedStep: matchedStep } : {}),
                }
                : {}),
            },
          });

      const session = await tx.session.create({
        data: {
          actorId: admin.id,
          actorType: SessionActorType.PLATFORM_ADMIN,
          tokenHash: refreshTokenHash,
          expiresAt: sessionExpiresAt,
          mfaVerifiedAt: now,
          ipAddress: context?.ip,
          userAgent: context?.userAgent,
          lastUsedAt: now,
        },
      });

      const remaining = usedRecoveryCode
        ? await tx.platformAdminRecoveryCode.count({
          where: { platformAdminId: admin.id, usedAt: null, revokedAt: null },
        })
        : undefined;

      return { updatedAdmin, session, remaining };
    });

    remainingRecoveryCodes = txResult.remaining;

    await invalidateActorCache(admin.id, SessionActorType.PLATFORM_ADMIN);

    if (usedRecoveryCode) {
      await recordAudit({
        platformAdminId: admin.id,
        action: PLATFORM_ADMIN_AUDIT_ACTIONS.RECOVERY_CODE_USED,
        entityId: admin.id,
        newData: {
          recoveryCodeId: matchedRecoveryCodeId,
          remainingRecoveryCodes,
        },
        context,
      });
    }

    await recordAudit({
      platformAdminId: admin.id,
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.ADMIN_LOGIN_SUCCESS,
      entityId: admin.id,
      newData: {
        method: usedRecoveryCode ? 'RECOVERY_CODE' : 'TOTP',
        deviceId: matchedDeviceId ?? null,
        sessionId: txResult.session.id,
      },
      context,
    });

    const accessToken = generatePlatformAdminAccessToken({
      sessionId: txResult.session.id,
      actorId: admin.id,
    });

    return {
      admin: sanitizePlatformAdmin(txResult.updatedAdmin as unknown as Record<string, unknown>),
      accessToken,
      refreshToken: rawRefreshToken,
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
      },
      sessionId: txResult.session.id,
      usedRecoveryCode,
      ...(remainingRecoveryCodes !== undefined ? { remainingRecoveryCodes } : {}),
    };
  },

  /**
   * Starts TOTP 2FA setup either via a mandatory initial setupToken OR via an authenticated
   * admin adding/replacing an authenticator device (with password + current TOTP re-authentication).
   * Pending secrets NEVER enable 2FA until verified by confirmTwoFactorSetup.
   */
  async startTwoFactorSetup(
    input: {
      setupToken?: string;
      authenticatedAdminId?: string;
      currentPassword?: string;
      currentTotpCode?: string;
      label?: string;
      mode?: 'INITIAL' | 'ADD' | 'REPLACE';
    },
    context?: RequestContextMeta
  ) {
    resolveTotpMasterKey();

    let admin: {
      id: string;
      username: string | null;
      email: string | null;
      phone: string | null;
      isActive: boolean;
      isSuperuser: boolean;
      totpEnabled: boolean;
      totpSetupCompleted: boolean;
    };
    let setupMode: 'INITIAL' | 'ADD' | 'REPLACE';

    if (input.setupToken) {
      const decoded = verifyPlatformAdminChallengeToken(input.setupToken);
      if (!decoded || decoded.purpose !== 'TOTP_SETUP') {
        throw new AppError('Invalid or expired 2FA setup session.', httpStatus.UNAUTHORIZED, {
          code: 'INVALID_2FA_SETUP_SESSION',
        });
      }

      const challenge = await prisma.platformAdminChallenge.findUnique({
        where: { id: decoded.challengeId },
      });
      const now = new Date();
      if (
        !challenge ||
        challenge.platformAdminId !== decoded.actorId ||
        challenge.purpose !== PlatformAdminChallengePurpose.TOTP_SETUP ||
        challenge.tokenHash !== hashToken(decoded.nonce) ||
        challenge.consumedAt !== null ||
        challenge.expiresAt <= now
      ) {
        throw new AppError('Invalid or expired 2FA setup session.', httpStatus.UNAUTHORIZED, {
          code: 'INVALID_2FA_SETUP_SESSION',
        });
      }

      const found = await prisma.platformAdmin.findUnique({
        where: { id: decoded.actorId },
      });
      if (!found || !found.isActive || !found.isSuperuser) {
        throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
      }
      if (found.totpEnabled && found.totpSetupCompleted) {
        throw new AppError(
          'Two-factor authentication is already enabled. Please sign in with your authenticator.',
          httpStatus.CONFLICT
        );
      }

      admin = found;
      setupMode = 'INITIAL';
    } else if (input.authenticatedAdminId) {
      if (!input.currentPassword) {
        throw new AppError('Current password is required to manage authenticators.', httpStatus.BAD_REQUEST);
      }
      const reauth = await reauthenticateWithPasswordAndTotp({
        adminId: input.authenticatedAdminId,
        currentPassword: input.currentPassword,
        code: input.currentTotpCode,
        allowRecoveryCode: false,
        context,
      });
      admin = reauth.admin;
      setupMode = input.mode === 'REPLACE' ? 'REPLACE' : 'ADD';
    } else {
      throw new AppError('Setup token or authenticated session is required.', httpStatus.UNAUTHORIZED);
    }

    const plainSecret = generateTotpSecret(20);
    const encryptedSecret = encryptTotpSecret(plainSecret, admin.id);
    const issuer = getTotpIssuer();
    const accountName = resolveAccountLabel(admin);
    const label = (input.label || (setupMode === 'ADD' ? 'Secondary Authenticator' : 'Primary Authenticator')).trim();
    const now = new Date();
    const pendingExpiresAt = new Date(Date.now() + PENDING_DEVICE_TTL_MS);

    const pendingDevice = await prisma.$transaction(async (tx) => {
      const device = await tx.platformAdminAuthenticator.create({
        data: {
          platformAdminId: admin.id,
          label,
          issuer,
          secretEncrypted: encryptedSecret,
          status: PlatformAdminAuthenticatorStatus.PENDING,
          isPrimary: false,
          pendingExpiresAt,
        },
      });

      if (setupMode === 'INITIAL' || setupMode === 'REPLACE') {
        await tx.platformAdmin.update({
          where: { id: admin.id },
          data: {
            totpPendingSecretEncrypted: encryptedSecret,
            totpPendingCreatedAt: now,
          },
        });
      }

      return device;
    });

    const otpauthUrl = buildOtpAuthUri({
      secret: plainSecret,
      accountName,
      issuer,
    });
    const qr = await generateTotpQrCode(otpauthUrl);

    await recordAudit({
      platformAdminId: admin.id,
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.TOTP_SETUP_STARTED,
      entityId: admin.id,
      newData: {
        mode: setupMode,
        deviceId: pendingDevice.id,
        label: pendingDevice.label,
      },
      context,
    });

    return {
      deviceId: pendingDevice.id,
      label: pendingDevice.label,
      mode: setupMode,
      secret: plainSecret,
      manualEntryKey: formatManualEntryKey(plainSecret),
      otpauthUrl,
      qrCodeDataUrl: qr.dataUrl,
      qrCodeSvg: qr.svg,
      issuer,
      accountName,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD_SECONDS,
      algorithm: 'SHA1',
      expiresIn: Math.floor(PENDING_DEVICE_TTL_MS / 1000),
    };
  },

  /**
   * Confirms a pending TOTP device using a 6-digit code from Google/Microsoft Authenticator.
   * - INITIAL mode: activates mandatory 2FA, generates 10 hashed recovery codes (shown once),
   *   consumes the setup challenge, and issues a full Platform Admin session.
   * - ADD mode: promotes the new pending authenticator as an active secondary device.
   * - REPLACE mode: revokes old active devices and promotes the new device as primary.
   */
  async confirmTwoFactorSetup(
    input: {
      setupToken?: string;
      authenticatedAdminId?: string;
      deviceId?: string;
      code: string;
      mode?: 'INITIAL' | 'ADD' | 'REPLACE';
    },
    context?: RequestContextMeta
  ) {
    resolveTotpMasterKey();

    let adminId: string;
    let challengeId: string | undefined;
    let confirmMode: 'INITIAL' | 'ADD' | 'REPLACE';

    if (input.setupToken) {
      const decoded = verifyPlatformAdminChallengeToken(input.setupToken);
      if (!decoded || decoded.purpose !== 'TOTP_SETUP') {
        throw new AppError('Invalid or expired 2FA setup session.', httpStatus.UNAUTHORIZED, {
          code: 'INVALID_2FA_SETUP_SESSION',
        });
      }

      const challenge = await prisma.platformAdminChallenge.findUnique({
        where: { id: decoded.challengeId },
      });
      const now = new Date();
      if (
        !challenge ||
        challenge.platformAdminId !== decoded.actorId ||
        challenge.purpose !== PlatformAdminChallengePurpose.TOTP_SETUP ||
        challenge.tokenHash !== hashToken(decoded.nonce) ||
        challenge.consumedAt !== null ||
        challenge.expiresAt <= now
      ) {
        throw new AppError('Invalid or expired 2FA setup session.', httpStatus.UNAUTHORIZED, {
          code: 'INVALID_2FA_SETUP_SESSION',
        });
      }
      if (challenge.attempts >= challenge.maxAttempts) {
        throw new AppError(
          'Maximum setup verification attempts exceeded.',
          httpStatus.TOO_MANY_REQUESTS,
          { code: 'TOTP_CHALLENGE_EXHAUSTED' }
        );
      }

      adminId = decoded.actorId;
      challengeId = challenge.id;
      confirmMode = 'INITIAL';
    } else if (input.authenticatedAdminId) {
      adminId = input.authenticatedAdminId;
      confirmMode = input.mode === 'REPLACE' ? 'REPLACE' : 'ADD';
    } else {
      throw new AppError('Setup token or authenticated session is required.', httpStatus.UNAUTHORIZED);
    }

    const admin = await prisma.platformAdmin.findUnique({ where: { id: adminId } });
    if (!admin || !admin.isActive || !admin.isSuperuser) {
      throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
    }

    const now = new Date();
    const pendingDevice = input.deviceId
      ? await prisma.platformAdminAuthenticator.findFirst({
        where: {
          id: input.deviceId,
          platformAdminId: admin.id,
          status: PlatformAdminAuthenticatorStatus.PENDING,
        },
      })
      : await prisma.platformAdminAuthenticator.findFirst({
        where: {
          platformAdminId: admin.id,
          status: PlatformAdminAuthenticatorStatus.PENDING,
        },
        orderBy: { createdAt: 'desc' },
      });

    if (!pendingDevice) {
      throw new AppError(
        'No pending authenticator enrollment found. Please start 2FA setup again.',
        httpStatus.BAD_REQUEST,
        { code: 'NO_PENDING_AUTHENTICATOR' }
      );
    }

    if (pendingDevice.pendingExpiresAt && pendingDevice.pendingExpiresAt <= now) {
      throw new AppError(
        'Pending authenticator enrollment has expired. Please generate a new QR code.',
        httpStatus.BAD_REQUEST,
        { code: 'PENDING_AUTHENTICATOR_EXPIRED' }
      );
    }

    const plainSecret = decryptTotpSecret(pendingDevice.secretEncrypted, admin.id);
    const verifyRes = verifyTotpCode(plainSecret, input.code, { window: TOTP_DEFAULT_WINDOW });

    if (!verifyRes.valid || verifyRes.matchedStep === undefined) {
      await incrementAdminTotpFailure(admin.id, admin.totpFailedAttempts || 0, challengeId);
      await recordAudit({
        platformAdminId: admin.id,
        action: PLATFORM_ADMIN_AUDIT_ACTIONS.TOTP_VERIFICATION_FAILED,
        entityId: admin.id,
        newData: {
          stage: 'setup_confirm',
          mode: confirmMode,
          deviceId: pendingDevice.id,
          reason: 'INVALID_TOTP_CODE',
        },
        context,
      });
      throw new AppError(
        'Invalid verification code. Please check your authenticator app and try again.',
        httpStatus.UNAUTHORIZED,
        { code: 'INVALID_TOTP_CODE' }
      );
    }

    const matchedStep = verifyRes.matchedStep;

    if (confirmMode === 'INITIAL') {
      const plainRecoveryCodes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
      const hashedRecoveryCodes = plainRecoveryCodes.map((c) => hashRecoveryCode(c));
      const rawRefreshToken = crypto.randomBytes(32).toString('hex');
      const refreshTokenHash = hashToken(rawRefreshToken);
      const sessionExpiresAt = new Date(Date.now() + getRefreshTtlMs());

      const result = await prisma.$transaction(async (tx) => {
        if (challengeId) {
          const challengeClaim = await tx.platformAdminChallenge.updateMany({
            where: {
              id: challengeId,
              consumedAt: null,
              expiresAt: { gt: now },
            },
            data: { consumedAt: now },
          });
          if (challengeClaim.count !== 1) {
            throw new AppError('Invalid or expired 2FA setup session.', httpStatus.UNAUTHORIZED, {
              code: 'INVALID_2FA_SETUP_SESSION',
            });
          }
        }

        // Revoke any stale pending devices other than the confirmed one
        await tx.platformAdminAuthenticator.updateMany({
          where: {
            platformAdminId: admin.id,
            status: PlatformAdminAuthenticatorStatus.PENDING,
            id: { not: pendingDevice.id },
          },
          data: { status: PlatformAdminAuthenticatorStatus.REVOKED },
        });

        const activeDevice = await tx.platformAdminAuthenticator.update({
          where: { id: pendingDevice.id },
          data: {
            status: PlatformAdminAuthenticatorStatus.ACTIVE,
            isPrimary: true,
            verifiedAt: now,
            lastUsedAt: now,
            lastUsedStep: matchedStep,
            pendingExpiresAt: null,
          },
        });

        // Revoke any old unrevoked recovery codes before inserting fresh ones
        await tx.platformAdminRecoveryCode.updateMany({
          where: { platformAdminId: admin.id, revokedAt: null },
          data: { revokedAt: now },
        });

        await tx.platformAdminRecoveryCode.createMany({
          data: hashedRecoveryCodes.map((codeHash) => ({
            platformAdminId: admin.id,
            codeHash,
          })),
        });

        const updatedAdmin = await tx.platformAdmin.update({
          where: { id: admin.id },
          data: {
            totpSecretEncrypted: pendingDevice.secretEncrypted,
            totpPendingSecretEncrypted: null,
            totpPendingCreatedAt: null,
            totpEnabled: true,
            totpSetupCompleted: true,
            totpEnabledAt: now,
            totpLastUsedAt: now,
            totpLastUsedStep: matchedStep,
            totpFailedAttempts: 0,
            totpLockedUntil: null,
            lastLogin: now,
          },
        });

        const session = await tx.session.create({
          data: {
            actorId: admin.id,
            actorType: SessionActorType.PLATFORM_ADMIN,
            tokenHash: refreshTokenHash,
            expiresAt: sessionExpiresAt,
            mfaVerifiedAt: now,
            ipAddress: context?.ip,
            userAgent: context?.userAgent,
            lastUsedAt: now,
          },
        });

        return { activeDevice, updatedAdmin, session };
      });

      await invalidateActorCache(admin.id, SessionActorType.PLATFORM_ADMIN);

      await recordAudit({
        platformAdminId: admin.id,
        action: PLATFORM_ADMIN_AUDIT_ACTIONS.TOTP_SETUP_COMPLETED,
        entityId: admin.id,
        newData: {
          mode: 'INITIAL',
          deviceId: result.activeDevice.id,
          label: result.activeDevice.label,
          recoveryCodesGenerated: plainRecoveryCodes.length,
        },
        context,
      });

      await recordAudit({
        platformAdminId: admin.id,
        action: PLATFORM_ADMIN_AUDIT_ACTIONS.ADMIN_LOGIN_SUCCESS,
        entityId: admin.id,
        newData: {
          method: 'TOTP_INITIAL_SETUP',
          deviceId: result.activeDevice.id,
          sessionId: result.session.id,
        },
        context,
      });

      const accessToken = generatePlatformAdminAccessToken({
        sessionId: result.session.id,
        actorId: admin.id,
      });

      return {
        admin: sanitizePlatformAdmin(result.updatedAdmin as unknown as Record<string, unknown>),
        accessToken,
        refreshToken: rawRefreshToken,
        tokens: {
          accessToken,
          refreshToken: rawRefreshToken,
        },
        sessionId: result.session.id,
        recoveryCodes: plainRecoveryCodes,
        device: sanitizeAuthenticatorDevice(result.activeDevice as unknown as Record<string, unknown>),
      };
    }

    if (confirmMode === 'REPLACE') {
      const activeDevice = await prisma.$transaction(async (tx) => {
        await tx.platformAdminAuthenticator.updateMany({
          where: {
            platformAdminId: admin.id,
            status: PlatformAdminAuthenticatorStatus.ACTIVE,
          },
          data: {
            status: PlatformAdminAuthenticatorStatus.REVOKED,
            isPrimary: false,
          },
        });

        const promoted = await tx.platformAdminAuthenticator.update({
          where: { id: pendingDevice.id },
          data: {
            status: PlatformAdminAuthenticatorStatus.ACTIVE,
            isPrimary: true,
            verifiedAt: now,
            lastUsedAt: now,
            lastUsedStep: matchedStep,
            pendingExpiresAt: null,
          },
        });

        await tx.platformAdmin.update({
          where: { id: admin.id },
          data: {
            totpSecretEncrypted: pendingDevice.secretEncrypted,
            totpPendingSecretEncrypted: null,
            totpPendingCreatedAt: null,
            totpEnabled: true,
            totpSetupCompleted: true,
            totpLastUsedAt: now,
            totpLastUsedStep: matchedStep,
            totpFailedAttempts: 0,
            totpLockedUntil: null,
          },
        });

        return promoted;
      });

      await invalidateActorCache(admin.id, SessionActorType.PLATFORM_ADMIN);

      await recordAudit({
        platformAdminId: admin.id,
        action: PLATFORM_ADMIN_AUDIT_ACTIONS.AUTHENTICATOR_REPLACED,
        entityId: admin.id,
        newData: {
          newDeviceId: activeDevice.id,
          label: activeDevice.label,
        },
        context,
      });

      return {
        replaced: true,
        totpEnabled: true,
        device: sanitizeAuthenticatorDevice(activeDevice as unknown as Record<string, unknown>),
      };
    }

    // ADD mode (multi-device authenticator enrollment)
    const activeDevice = await prisma.$transaction(async (tx) => {
      const existingActiveCount = await tx.platformAdminAuthenticator.count({
        where: {
          platformAdminId: admin.id,
          status: PlatformAdminAuthenticatorStatus.ACTIVE,
        },
      });

      const promoted = await tx.platformAdminAuthenticator.update({
        where: { id: pendingDevice.id },
        data: {
          status: PlatformAdminAuthenticatorStatus.ACTIVE,
          isPrimary: existingActiveCount === 0,
          verifiedAt: now,
          lastUsedAt: now,
          lastUsedStep: matchedStep,
          pendingExpiresAt: null,
        },
      });

      await tx.platformAdmin.update({
        where: { id: admin.id },
        data: {
          ...(existingActiveCount === 0
            ? {
              totpSecretEncrypted: pendingDevice.secretEncrypted,
              totpEnabled: true,
              totpSetupCompleted: true,
              totpEnabledAt: admin.totpEnabledAt ?? now,
            }
            : {}),
          totpLastUsedAt: now,
          totpLastUsedStep: matchedStep,
        },
      });

      return promoted;
    });

    await invalidateActorCache(admin.id, SessionActorType.PLATFORM_ADMIN);

    await recordAudit({
      platformAdminId: admin.id,
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.TOTP_SETUP_COMPLETED,
      entityId: admin.id,
      newData: {
        mode: 'ADD',
        deviceId: activeDevice.id,
        label: activeDevice.label,
      },
      context,
    });

    return {
      totpEnabled: true,
      device: sanitizeAuthenticatorDevice(activeDevice as unknown as Record<string, unknown>),
    };
  },

  /**
   * Returns 2FA status, activation timestamp, connected authenticators, recovery code balance,
   * and active session count for Security Settings UI.
   */
  async getTwoFactorStatus(adminId: string) {
    const admin = await prisma.platformAdmin.findUnique({ where: { id: adminId } });
    if (!admin) {
      throw new AppError('Platform admin not found', httpStatus.NOT_FOUND);
    }

    const [devices, recoveryCodesRemaining, activeSessionsCount] = await Promise.all([
      prisma.platformAdminAuthenticator.findMany({
        where: {
          platformAdminId: adminId,
          status: PlatformAdminAuthenticatorStatus.ACTIVE,
        },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.platformAdminRecoveryCode.count({
        where: {
          platformAdminId: adminId,
          usedAt: null,
          revokedAt: null,
        },
      }),
      prisma.session.count({
        where: {
          actorType: SessionActorType.PLATFORM_ADMIN,
          actorId: adminId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    return {
      totpEnabled: Boolean(admin.totpEnabled),
      totpSetupCompleted: Boolean(admin.totpSetupCompleted),
      totpEnabledAt: admin.totpEnabledAt ?? null,
      totpLastUsedAt: admin.totpLastUsedAt ?? null,
      devices: devices.map((d) => sanitizeAuthenticatorDevice(d as unknown as Record<string, unknown>)),
      recoveryCodesRemaining,
      activeSessionsCount,
    };
  },

  /**
   * Removes an enrolled secondary authenticator device after re-authentication.
   * Refuses to remove the last active authenticator (admin must use Replace or Disable).
   */
  async removeAuthenticatorDevice(
    adminId: string,
    deviceId: string,
    currentPassword: string,
    code: string,
    context?: RequestContextMeta
  ) {
    await reauthenticateWithPasswordAndTotp({
      adminId,
      currentPassword,
      code,
      allowRecoveryCode: false,
      context,
    });

    const activeDevices = await prisma.platformAdminAuthenticator.findMany({
      where: {
        platformAdminId: adminId,
        status: PlatformAdminAuthenticatorStatus.ACTIVE,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    const target = activeDevices.find((d) => d.id === deviceId);
    if (!target) {
      throw new AppError('Authenticator device not found.', httpStatus.NOT_FOUND);
    }

    if (activeDevices.length <= 1) {
      throw new AppError(
        'Cannot remove your only active authenticator device. Use Replace Authenticator or Disable 2FA instead.',
        httpStatus.BAD_REQUEST,
        { code: 'LAST_AUTHENTICATOR_CANNOT_BE_REMOVED' }
      );
    }

    const fallbackPrimary = activeDevices.find((d) => d.id !== deviceId);

    await prisma.$transaction(async (tx) => {
      await tx.platformAdminAuthenticator.update({
        where: { id: deviceId },
        data: { status: PlatformAdminAuthenticatorStatus.REVOKED, isPrimary: false },
      });

      if (target.isPrimary && fallbackPrimary) {
        await tx.platformAdminAuthenticator.update({
          where: { id: fallbackPrimary.id },
          data: { isPrimary: true },
        });
        await tx.platformAdmin.update({
          where: { id: adminId },
          data: { totpSecretEncrypted: fallbackPrimary.secretEncrypted },
        });
      }
    });

    await recordAudit({
      platformAdminId: adminId,
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.AUTHENTICATOR_REMOVED,
      entityId: adminId,
      newData: { deviceId, label: target.label },
      context,
    });

    return { removed: true, deviceId };
  },

  /**
   * Regenerates 10 fresh single-use recovery codes after password + TOTP re-authentication,
   * immediately revoking all previous unused codes.
   */
  async regenerateRecoveryCodes(
    adminId: string,
    currentPassword: string,
    code: string,
    context?: RequestContextMeta
  ) {
    resolveTotpMasterKey();

    await reauthenticateWithPasswordAndTotp({
      adminId,
      currentPassword,
      code,
      allowRecoveryCode: false,
      context,
    });

    const plainCodes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
    const hashedCodes = plainCodes.map((c) => hashRecoveryCode(c));
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.platformAdminRecoveryCode.updateMany({
        where: { platformAdminId: adminId, revokedAt: null },
        data: { revokedAt: now },
      });

      await tx.platformAdminRecoveryCode.createMany({
        data: hashedCodes.map((codeHash) => ({
          platformAdminId: adminId,
          codeHash,
        })),
      });
    });

    await recordAudit({
      platformAdminId: adminId,
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.RECOVERY_CODES_REGENERATED,
      entityId: adminId,
      newData: { count: plainCodes.length },
      context,
    });

    return {
      recoveryCodes: plainCodes,
      count: plainCodes.length,
    };
  },

  /**
   * Disables 2FA after re-authentication and immediately revokes all active PlatformAdmin
   * sessions so mandatory 2FA setup will be enforced on the next login.
   */
  async disableTwoFactor(
    adminId: string,
    currentPassword: string,
    codeOrRecovery: { code?: string; recoveryCode?: string },
    context?: RequestContextMeta
  ) {
    await reauthenticateWithPasswordAndTotp({
      adminId,
      currentPassword,
      code: codeOrRecovery.code,
      recoveryCode: codeOrRecovery.recoveryCode,
      allowRecoveryCode: true,
      context,
    });

    const now = new Date();
    const activeSessions = await prisma.session.findMany({
      where: {
        actorType: SessionActorType.PLATFORM_ADMIN,
        actorId: adminId,
        revokedAt: null,
      },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.platformAdmin.update({
        where: { id: adminId },
        data: {
          totpEnabled: false,
          totpSetupCompleted: false,
          totpSecretEncrypted: null,
          totpPendingSecretEncrypted: null,
          totpPendingCreatedAt: null,
          totpEnabledAt: null,
        },
      });

      await tx.platformAdminAuthenticator.updateMany({
        where: {
          platformAdminId: adminId,
          status: { not: PlatformAdminAuthenticatorStatus.REVOKED },
        },
        data: {
          status: PlatformAdminAuthenticatorStatus.REVOKED,
          isPrimary: false,
        },
      });

      await tx.platformAdminRecoveryCode.updateMany({
        where: { platformAdminId: adminId, revokedAt: null },
        data: { revokedAt: now },
      });

      await tx.session.updateMany({
        where: {
          actorType: SessionActorType.PLATFORM_ADMIN,
          actorId: adminId,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
    });

    await Promise.all([
      invalidateActorCache(adminId, SessionActorType.PLATFORM_ADMIN),
      purgeAdminJsSessionsForAdmin(adminId),
      ...activeSessions.map((s) => markSessionRevokedInCache(s.id, getRefreshTtlSeconds())),
    ]);

    await recordAudit({
      platformAdminId: adminId,
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.TOTP_DISABLED,
      entityId: adminId,
      newData: { revokedSessionsCount: activeSessions.length },
      context,
    });

    await recordAudit({
      platformAdminId: adminId,
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.ADMIN_SESSION_REVOKED,
      entityId: adminId,
      newData: { reason: 'TOTP_DISABLED', revokedSessionsCount: activeSessions.length },
      context,
    });

    return {
      disabled: true,
      sessionsRevoked: true,
      message:
        'Two-factor authentication has been disabled and all active sessions were revoked. Mandatory 2FA setup is required on your next login.',
    };
  },

  /**
   * Rotates a PlatformAdmin refresh token and issues a new short-lived access token.
   */
  async refreshSession(rawRefreshToken: string, context?: RequestContextMeta) {
    if (!rawRefreshToken) {
      throw new AppError('Refresh token is required', httpStatus.UNAUTHORIZED);
    }

    const oldTokenHash = hashToken(rawRefreshToken);
    const session = await prisma.session.findUnique({ where: { tokenHash: oldTokenHash } });

    if (!session || session.revokedAt || session.actorType !== SessionActorType.PLATFORM_ADMIN) {
      throw new AppError('Session is invalid or has been revoked', httpStatus.UNAUTHORIZED);
    }

    const now = new Date();
    if (now > session.expiresAt) {
      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: now },
      });
      await markSessionRevokedInCache(session.id);
      throw new AppError('Refresh token has expired', httpStatus.UNAUTHORIZED);
    }

    if (!session.mfaVerifiedAt) {
      throw new AppError('Session has not completed two-factor verification', httpStatus.UNAUTHORIZED, {
        code: 'TOTP_VERIFICATION_REQUIRED',
      });
    }

    const admin = await prisma.platformAdmin.findUnique({ where: { id: session.actorId } });
    if (!admin || !admin.isActive || !admin.isSuperuser) {
      await prisma.session.update({ where: { id: session.id }, data: { revokedAt: now } });
      await markSessionRevokedInCache(session.id);
      throw new AppError('Account is deactivated or unauthorized', httpStatus.UNAUTHORIZED);
    }

    if (!admin.totpEnabled || !admin.totpSetupCompleted) {
      throw new AppError('Two-factor authentication setup is required.', httpStatus.FORBIDDEN, {
        code: 'TOTP_SETUP_REQUIRED',
      });
    }

    const newRawRefreshToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + getRefreshTtlMs());

    const rotated = await prisma.session.updateMany({
      where: {
        id: session.id,
        tokenHash: oldTokenHash,
        revokedAt: null,
      },
      data: {
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
        lastUsedAt: now,
        ...(context?.ip ? { ipAddress: context.ip } : {}),
        ...(context?.userAgent ? { userAgent: context.userAgent } : {}),
      },
    });

    if (rotated.count !== 1) {
      throw new AppError('Refresh token has already been used or revoked', httpStatus.UNAUTHORIZED);
    }

    const accessToken = generatePlatformAdminAccessToken({
      sessionId: session.id,
      actorId: admin.id,
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      tokens: {
        accessToken,
        refreshToken: newRawRefreshToken,
      },
    };
  },

  async logoutSession(sessionId: string, adminId: string, context?: RequestContextMeta) {
    const now = new Date();
    await prisma.session.updateMany({
      where: {
        id: sessionId,
        actorId: adminId,
        actorType: SessionActorType.PLATFORM_ADMIN,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    await Promise.all([
      markSessionRevokedInCache(sessionId, getRefreshTtlSeconds()),
      invalidateActorCache(adminId, SessionActorType.PLATFORM_ADMIN),
    ]);

    await recordAudit({
      platformAdminId: adminId,
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.ADMIN_SESSION_REVOKED,
      entityId: adminId,
      newData: { sessionId, scope: 'SINGLE' },
      context,
    });

    return { message: 'Logged out successfully' };
  },

  async listSessions(adminId: string, currentSessionId?: string) {
    const sessions = await prisma.session.findMany({
      where: {
        actorType: SessionActorType.PLATFORM_ADMIN,
        actorId: adminId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        mfaVerifiedAt: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return sessions.map((s) => ({
      ...s,
      isCurrent: Boolean(currentSessionId && s.id === currentSessionId),
    }));
  },

  async revokeAllSessions(adminId: string, context?: RequestContextMeta) {
    const now = new Date();
    const activeSessions = await prisma.session.findMany({
      where: {
        actorType: SessionActorType.PLATFORM_ADMIN,
        actorId: adminId,
        revokedAt: null,
      },
      select: { id: true },
    });

    await prisma.session.updateMany({
      where: {
        actorType: SessionActorType.PLATFORM_ADMIN,
        actorId: adminId,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    await Promise.all([
      invalidateActorCache(adminId, SessionActorType.PLATFORM_ADMIN),
      purgeAdminJsSessionsForAdmin(adminId),
      ...activeSessions.map((s) => markSessionRevokedInCache(s.id, getRefreshTtlSeconds())),
    ]);

    await recordAudit({
      platformAdminId: adminId,
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.ADMIN_SESSION_REVOKED,
      entityId: adminId,
      newData: { scope: 'ALL', revokedCount: activeSessions.length },
      context,
    });

    return {
      revokedCount: activeSessions.length,
      message: 'All platform administrator sessions have been revoked.',
    };
  },
};
