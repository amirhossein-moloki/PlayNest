import { Request, Response, NextFunction } from 'express';
import { ADMIN_CONSTANTS } from '../config/admin.constants';
import { PlatformAdminUserContext } from './admin.types';
import { prisma } from '../../config/prisma';
import logger from '../../config/logger';

/**
 * Server-side route authorization middleware for the Platform Admin Panel.
 * Ensures the session contains an authenticated, superuser, and currently active PlatformAdmin.
 * Verifies account active status to immediately sever access if an account is suspended/deactivated.
 */
export async function requireAdminSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const adminUser = req.session?.adminUser as PlatformAdminUserContext | undefined;

  // Allow login page, static assets, and auth submission routes
  const loginPath = `${ADMIN_CONSTANTS.ROOT_PATH}/login`;
  const logoutPath = `${ADMIN_CONSTANTS.ROOT_PATH}/logout`;
  const isAuthRoute =
    req.originalUrl === loginPath ||
    req.originalUrl.startsWith(`${loginPath}/`) ||
    req.originalUrl === logoutPath;
  const isAssetRoute =
    req.originalUrl.includes('/frontend/assets/') ||
    req.originalUrl.includes('/admin.css') ||
    req.originalUrl.includes('/admin.js');

  if (isAuthRoute || isAssetRoute) {
    return next();
  }

  if (!adminUser || !adminUser.id || !adminUser.isSuperuser) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      res.status(401).json({ error: 'Unauthorized: PlatformAdmin session required' });
      return;
    }
    res.redirect(loginPath);
    return;
  }

  try {
    // Re-verify in DB that the PlatformAdmin is still active and superuser
    const currentAdmin = await prisma.platformAdmin.findUnique({
      where: { id: adminUser.id },
      select: { id: true, isActive: true, isSuperuser: true },
    });

    if (!currentAdmin || !currentAdmin.isActive || !currentAdmin.isSuperuser) {
      logger.warn({ adminId: adminUser.id }, 'Revoking session for disabled or non-superuser PlatformAdmin');
      if (req.session) {
        req.session.destroy(() => {
          // ignore destroy errors
        });
      }
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        res.status(403).json({ error: 'Forbidden: Account is inactive or privileges revoked' });
        return;
      }
      res.redirect(loginPath);
      return;
    }
  } catch (err) {
    logger.error({ err, adminId: adminUser.id }, 'Error verifying PlatformAdmin session status against DB');
    // Continue if DB check fails transiently or deny depending on policy, but security dictates denying on failure
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      res.status(500).json({ error: 'Internal Server Error during session validation' });
      return;
    }
    res.redirect(loginPath);
    return;
  }

  next();
}
