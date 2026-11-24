import argon2 from 'argon2';
import { PlatformAdminAuthenticatorStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import logger from '../../config/logger';
import { PlatformAdminUserContext } from './admin.types';
import { AdminAuditService } from '../services/admin-audit.service';
import {
  decryptTotpSecret,
  resolveTotpMasterKey,
  TOTP_DEFAULT_WINDOW,
  verifyTotpCode,
} from '../../modules/auth/totp.crypto';
import { PLATFORM_ADMIN_AUDIT_ACTIONS } from '../../modules/auth/platform-admin-auth.constants';

/**
 * Dedicated authentication function for AdminJS panel access.
 * Enforces mandatory 2FA: identifier (username / email / phone) + password + 6-digit TOTP code.
 * Never permits password-only authentication or fallback when 2FA is not configured.
 */
export async function authenticatePlatformAdmin(
  identifier: string,
  password: string,
  totpCode?: string,
  context?: { ip?: string; userAgent?: string }
): Promise<PlatformAdminUserContext | null> {
  try {
    if (!identifier || !password || !totpCode) {
      return null;
    }

    // Fail closed if TOTP encryption service is not configured
    resolveTotpMasterKey();

    const cleanIdentifier = identifier.trim();

    const admin = await prisma.platformAdmin.findFirst({
      where: {
        OR: [
          { username: { equals: cleanIdentifier, mode: 'insensitive' } },
          { email: { equals: cleanIdentifier, mode: 'insensitive' } },
          { phone: cleanIdentifier },
        ],
      },
      include: {
        authenticators: {
          where: { status: PlatformAdminAuthenticatorStatus.ACTIVE },
        },
      },
    });

    if (!admin) {
      logger.warn({ identifier: cleanIdentifier }, 'PlatformAdmin panel login failed: Admin not found');
      await AdminAuditService.logAdminEvent({
        action: PLATFORM_ADMIN_AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
        entity: 'PlatformAdmin',
        entityId: 'unknown',
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
        newData: { surface: 'ADMINJS_PANEL', reason: 'INVALID_CREDENTIALS' },
      });
      return null;
    }

    if (!admin.isActive || !admin.isSuperuser) {
      logger.warn({ adminId: admin.id }, 'PlatformAdmin panel login rejected: Inactive or non-superuser');
      await AdminAuditService.logAdminEvent({
        platformAdminId: admin.id,
        action: PLATFORM_ADMIN_AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
        entity: 'PlatformAdmin',
        entityId: admin.id,
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
        newData: { surface: 'ADMINJS_PANEL', reason: 'ACCOUNT_DISABLED_OR_NOT_SUPERUSER' },
      });
      return null;
    }

    const isPasswordValid = await argon2.verify(admin.passwordHash, password);
    if (!isPasswordValid) {
      logger.warn({ adminId: admin.id }, 'PlatformAdmin panel login failed: Invalid password');
      await AdminAuditService.logAdminEvent({
        platformAdminId: admin.id,
        action: PLATFORM_ADMIN_AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
        entity: 'PlatformAdmin',
        entityId: admin.id,
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
        newData: { surface: 'ADMINJS_PANEL', reason: 'INVALID_PASSWORD' },
      });
      return null;
    }

    if (!admin.totpEnabled || !admin.totpSetupCompleted) {
      logger.warn({ adminId: admin.id }, 'PlatformAdmin panel login blocked: Mandatory 2FA setup not completed');
      await AdminAuditService.logAdminEvent({
        platformAdminId: admin.id,
        action: PLATFORM_ADMIN_AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
        entity: 'PlatformAdmin',
        entityId: admin.id,
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
        newData: { surface: 'ADMINJS_PANEL', reason: 'TOTP_SETUP_REQUIRED' },
      });
      return null;
    }

    const activeDevices = admin.authenticators || [];
    let matchedDeviceId: string | undefined;
    let matchedStep: number | undefined;
    let replayed = false;

    for (const device of activeDevices) {
      const secret = decryptTotpSecret(device.secretEncrypted, admin.id);
      const res = verifyTotpCode(secret, totpCode, {
        window: TOTP_DEFAULT_WINDOW,
        lastUsedStep: device.lastUsedStep ?? admin.totpLastUsedStep ?? null,
      });
      if (res.valid && res.matchedStep !== undefined) {
        matchedDeviceId = device.id;
        matchedStep = res.matchedStep;
        break;
      }
      if (res.replayed) replayed = true;
    }

    if (matchedStep === undefined && activeDevices.length === 0 && admin.totpSecretEncrypted) {
      const secret = decryptTotpSecret(admin.totpSecretEncrypted, admin.id);
      const res = verifyTotpCode(secret, totpCode, {
        window: TOTP_DEFAULT_WINDOW,
        lastUsedStep: admin.totpLastUsedStep ?? null,
      });
      if (res.valid && res.matchedStep !== undefined) {
        matchedStep = res.matchedStep;
      } else if (res.replayed) {
        replayed = true;
      }
    }

    if (matchedStep === undefined) {
      await AdminAuditService.logAdminEvent({
        platformAdminId: admin.id,
        action: PLATFORM_ADMIN_AUDIT_ACTIONS.TOTP_VERIFICATION_FAILED,
        entity: 'PlatformAdmin',
        entityId: admin.id,
        ipAddress: context?.ip,
        userAgent: context?.userAgent,
        newData: { surface: 'ADMINJS_PANEL', reason: replayed ? 'REPLAY_DETECTED' : 'INVALID_TOTP_CODE' },
      });
      return null;
    }

    const now = new Date();
    if (matchedDeviceId) {
      const claimed = await prisma.platformAdminAuthenticator.updateMany({
        where: {
          id: matchedDeviceId,
          status: PlatformAdminAuthenticatorStatus.ACTIVE,
          OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: matchedStep } }],
        },
        data: { lastUsedAt: now, lastUsedStep: matchedStep },
      });
      if (claimed.count !== 1) {
        return null;
      }
    }

    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: {
        lastLogin: now,
        totpLastUsedAt: now,
        totpLastUsedStep: matchedStep,
      },
    });

    await AdminAuditService.logAdminEvent({
      platformAdminId: admin.id,
      action: PLATFORM_ADMIN_AUDIT_ACTIONS.ADMIN_LOGIN_SUCCESS,
      entity: 'PlatformAdmin',
      entityId: admin.id,
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
      newData: { surface: 'ADMINJS_PANEL', method: 'TOTP', timestamp: now.toISOString() },
    });

    logger.info({ adminId: admin.id }, 'PlatformAdmin authenticated with TOTP for AdminJS panel');

    return {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      phone: admin.phone,
      fullName: admin.fullName,
      isSuperuser: admin.isSuperuser,
      mfaVerified: true,
      title: 'Platform Administrator',
    };
  } catch (err) {
    logger.error({ err }, 'Error during PlatformAdmin TOTP authentication');
    return null;
  }
}
