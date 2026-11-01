import argon2 from 'argon2';
import { prisma } from '../../config/prisma';
import logger from '../../config/logger';
import { PlatformAdminUserContext } from './admin.types';
import { AdminAuditService } from '../services/admin-audit.service';

/**
 * Dedicated authentication function for AdminJS session login.
 * Allows login via email or phone for PlatformAdmin users only.
 */
export async function authenticatePlatformAdmin(
  identifier: string,
  password: string,
  context?: { ip?: string; userAgent?: string }
): Promise<PlatformAdminUserContext | null> {
  try {
    if (!identifier || !password) {
      return null;
    }

    const cleanIdentifier = identifier.trim();

    // Query PlatformAdmin table directly using existing Prisma Client
    const admin = await prisma.platformAdmin.findFirst({
      where: {
        OR: [
          { email: cleanIdentifier },
          { phone: cleanIdentifier },
        ],
      },
    });

    if (!admin) {
      logger.warn({ identifier: cleanIdentifier }, 'PlatformAdmin login attempt failed: Admin not found');
      return null;
    }

    if (!admin.isActive) {
      logger.warn({ adminId: admin.id }, 'PlatformAdmin login rejected: Account inactive');
      return null;
    }

    if (!admin.isSuperuser) {
      logger.warn({ adminId: admin.id }, 'PlatformAdmin login rejected: Lacks platform superuser privileges');
      return null;
    }

    const isPasswordValid = await argon2.verify(admin.passwordHash, password);
    if (!isPasswordValid) {
      logger.warn({ adminId: admin.id }, 'PlatformAdmin login failed: Invalid password');
      return null;
    }

    // Update lastLogin timestamp
    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() },
    });

    await AdminAuditService.logAdminEvent({
      platformAdminId: admin.id,
      action: 'PLATFORM_ADMIN_PANEL_LOGIN',
      entity: 'PlatformAdmin',
      entityId: admin.id,
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
      newData: { timestamp: new Date().toISOString() },
    });

    logger.info({ adminId: admin.id, phone: admin.phone }, 'PlatformAdmin authenticated successfully for admin panel');

    return {
      id: admin.id,
      email: admin.email,
      phone: admin.phone,
      fullName: admin.fullName,
      isSuperuser: admin.isSuperuser,
      title: 'Platform Administrator',
    };
  } catch (err) {
    logger.error({ err }, 'Error during PlatformAdmin authentication');
    return null;
  }
}
