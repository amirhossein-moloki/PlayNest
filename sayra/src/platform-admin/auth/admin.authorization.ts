import { Request, Response, NextFunction } from 'express';
import { ADMIN_CONSTANTS } from '../config/admin.constants';
import { PlatformAdminUserContext } from './admin.types';

/**
 * Server-side route authorization middleware for the Platform Admin Panel.
 * Ensures the session contains an authenticated and active PlatformAdmin.
 */
export function requireAdminSession(req: Request, res: Response, next: NextFunction): void {
  const adminUser = req.session?.adminUser as PlatformAdminUserContext | undefined;

  // Allow login page, static assets, and auth submission routes
  const loginPath = `${ADMIN_CONSTANTS.ROOT_PATH}/login`;
  const isAuthRoute = req.originalUrl === loginPath || req.originalUrl.startsWith(`${loginPath}/`);
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

  next();
}
