import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { ADMIN_CONSTANTS } from '../config/admin.constants';
import { PlatformAdminUserContext } from './admin.types';
import { prisma } from '../../config/prisma';
import logger from '../../config/logger';
import { isSessionRevokedInCache } from '../../common/middleware/auth';

const TRAVERSAL_SEGMENT_RE = /(\.\.|%2e%2e|%2e\.|\.%2e)/i;

/**
 * Checks whether an AdminJS context belongs to an active, MFA-verified PlatformAdmin superuser.
 */
export function hasValidPlatformAdminAccess(context?: { currentAdmin?: PlatformAdminUserContext | null }): boolean {
  const currentAdmin = context?.currentAdmin;
  return Boolean(
    currentAdmin &&
      currentAdmin.id &&
      currentAdmin.isSuperuser === true &&
      currentAdmin.mfaVerified === true
  );
}

/**
 * Resolves the normalized request pathname without query strings or path traversal sequences.
 */
function getNormalizedAdminPath(req: Request): string | null {
  const reqPath = typeof req.path === 'string' ? req.path : (req.originalUrl || '/');
  const rawPathname = `${req.baseUrl || ''}${reqPath}`.split('?')[0] || '/';
  if (TRAVERSAL_SEGMENT_RE.test(rawPathname) || rawPathname.includes('\\')) {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPathname);
  } catch {
    return null;
  }

  if (TRAVERSAL_SEGMENT_RE.test(decoded) || decoded.includes('\0') || decoded.includes('\\')) {
    return null;
  }

  return path.posix.normalize(decoded);
}

/**
 * Server-side route authorization middleware for the Platform Admin Panel.
 * Ensures the session contains an authenticated, superuser, MFA-verified, and active PlatformAdmin
 * with completed mandatory TOTP 2FA setup.
 */
export async function requireAdminSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const adminUser = req.session?.adminUser as PlatformAdminUserContext | undefined;

  // Allow only exact auth routes and strictly read-only static asset paths without query-string bypasses
  const loginPath = `${ADMIN_CONSTANTS.ROOT_PATH}/login`;
  const sessionPath = `${ADMIN_CONSTANTS.ROOT_PATH}/session`;
  const logoutPath = `${ADMIN_CONSTANTS.ROOT_PATH}/logout`;
  const normalizedPath = getNormalizedAdminPath(req);
  const method = req.method.toUpperCase();
  const isSafeReadMethod = method === 'GET' || method === 'HEAD';

  const isAuthRoute =
    normalizedPath !== null &&
    ((isSafeReadMethod && normalizedPath === loginPath) ||
      (method === 'POST' && normalizedPath === sessionPath) ||
      ((isSafeReadMethod || method === 'POST') && normalizedPath === logoutPath));

  const isAssetRoute =
    isSafeReadMethod &&
    normalizedPath !== null &&
    (normalizedPath.startsWith(`${ADMIN_CONSTANTS.ROOT_PATH}/frontend/assets/`) ||
      normalizedPath === `${ADMIN_CONSTANTS.ROOT_PATH}/admin.css` ||
      normalizedPath === `${ADMIN_CONSTANTS.ROOT_PATH}/admin.js`);

  if (isAuthRoute || isAssetRoute) {
    return next();
  }

  if (!adminUser || !adminUser.id || !adminUser.isSuperuser || adminUser.mfaVerified !== true) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      res.status(401).json({ error: 'Unauthorized: MFA-verified PlatformAdmin session required' });
      return;
    }
    res.redirect(loginPath);
    return;
  }

  if (adminUser.sessionId && (await isSessionRevokedInCache(adminUser.sessionId))) {
    if (req.session) {
      req.session.destroy(() => {
        // ignore destroy errors
      });
    }
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      res.status(401).json({ error: 'Unauthorized: Session has been revoked' });
      return;
    }
    res.redirect(loginPath);
    return;
  }

  try {
    const currentAdmin = await prisma.platformAdmin.findUnique({
      where: { id: adminUser.id },
      select: {
        id: true,
        isActive: true,
        isSuperuser: true,
        totpEnabled: true,
        totpSetupCompleted: true,
      },
    });

    if (
      !currentAdmin ||
      !currentAdmin.isActive ||
      !currentAdmin.isSuperuser ||
      !currentAdmin.totpEnabled ||
      !currentAdmin.totpSetupCompleted
    ) {
      logger.warn(
        { adminId: adminUser.id },
        'Revoking AdminJS session for disabled, non-superuser, or non-2FA PlatformAdmin'
      );
      if (req.session) {
        req.session.destroy(() => {
          // ignore destroy errors
        });
      }
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        res.status(403).json({
          error: 'Forbidden: Account is inactive, lacks privileges, or 2FA setup is incomplete',
        });
        return;
      }
      res.redirect(loginPath);
      return;
    }
  } catch (err) {
    logger.error({ err, adminId: adminUser.id }, 'Error verifying PlatformAdmin session status against DB');
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      res.status(500).json({ error: 'Internal Server Error during session validation' });
      return;
    }
    res.redirect(loginPath);
    return;
  }

  next();
}
