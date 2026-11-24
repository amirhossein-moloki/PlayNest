/* eslint-disable @typescript-eslint/no-explicit-any */
import express, { Express } from 'express';
import session from 'express-session';
import { AdminJSPackages } from './load-adminjs';
import { registerPrismaAdapter } from './register-adapter';
import { getComponentLoader } from '../components/component.loader';
import { buildAdminOptions } from '../config/admin.config';
import { ADMIN_CONSTANTS } from '../config/admin.constants';
import { createAdminSessionOptions } from '../auth/admin.session';
import { requireAdminSession } from '../auth/admin.authorization';
import { platformAdminAuthPageTemplate } from '../../modules/platform-admin/platform-admin-auth-ui.templates';
import { authMiddleware } from '../../common/middleware/auth';
import { requirePlatformAdmin } from '../../common/middleware/requirePlatformAdmin';
import { prisma } from '../../config/prisma';
import { AdminAuditService } from '../services/admin-audit.service';
import { PLATFORM_ADMIN_AUDIT_ACTIONS } from '../../modules/auth/platform-admin-auth.constants';
import logger from '../../config/logger';

let adminJSInstance: any = null;

export async function mountAdminRouter(app: Express, packages: AdminJSPackages): Promise<any> {
  const { AdminJS, AdminJSExpress, ComponentLoader } = packages;

  // 1. Register Prisma Adapter once
  registerPrismaAdapter(packages);

  // 2. Initialize ComponentLoader and custom Dashboard & Property Components
  const { componentLoader, dashboardComponentId, coverImageComponentId } = await getComponentLoader(ComponentLoader);

  // 3. Build AdminJS configuration
  const adminOptions = buildAdminOptions({
    componentLoader,
    dashboardComponentId,
    coverImageComponentId,
  });

  adminJSInstance = new AdminJS(adminOptions);

  // 4. Custom MFA-enforced Router replacing AdminJS's password-only login form
  const router = express.Router();
  const sessionOptions = createAdminSessionOptions();
  router.use(session(sessionOptions) as any);

  // Mandatory 2FA Login & Initial Setup page for AdminJS Console
  router.get('/login', (_req, res) => {
    res.type('html').send(
      platformAdminAuthPageTemplate({
        redirectTo: ADMIN_CONSTANTS.ROOT_PATH,
        mode: 'adminjs',
      })
    );
  });

  // Exchanges a verified MFA-completed PlatformAdmin JWT for an HttpOnly AdminJS Redis session
  router.post(
    '/session',
    authMiddleware,
    requirePlatformAdmin,
    async (req, res, next) => {
      try {
        if (!req.actor || req.actor.actorType !== 'PLATFORM_ADMIN' || !req.actor.mfaVerified) {
          res.status(401).json({ error: 'MFA verification required' });
          return;
        }

        const admin = await prisma.platformAdmin.findUnique({
          where: { id: req.actor.id },
          select: {
            id: true,
            username: true,
            email: true,
            phone: true,
            fullName: true,
            isActive: true,
            isSuperuser: true,
            totpEnabled: true,
            totpSetupCompleted: true,
          },
        });

        if (
          !admin ||
          !admin.isActive ||
          !admin.isSuperuser ||
          !admin.totpEnabled ||
          !admin.totpSetupCompleted
        ) {
          res.status(403).json({ error: 'Forbidden: 2FA setup required' });
          return;
        }

        // Prevent session fixation by regenerating session ID upon MFA elevation
        req.session.regenerate((regenErr) => {
          if (regenErr) {
            return next(regenErr);
          }

          req.session.adminUser = {
            id: admin.id,
            username: admin.username,
            email: admin.email,
            phone: admin.phone,
            fullName: admin.fullName,
            isSuperuser: true,
            mfaVerified: true,
            sessionId: req.actor?.sessionId,
            title: 'Platform Administrator',
          };

          req.session.save((saveErr) => {
            if (saveErr) {
              return next(saveErr);
            }
            res.status(200).json({ ok: true, redirectTo: ADMIN_CONSTANTS.ROOT_PATH });
          });
        });
      } catch (err) {
        next(err);
      }
    }
  );

  const handleLogout: express.RequestHandler = async (req, res) => {
    const adminId = req.session?.adminUser?.id;
    if (adminId) {
      await AdminAuditService.logAdminEvent({
        platformAdminId: adminId,
        action: PLATFORM_ADMIN_AUDIT_ACTIONS.ADMIN_SESSION_REVOKED,
        entity: 'PlatformAdmin',
        entityId: adminId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        newData: { surface: 'ADMINJS_PANEL', scope: 'LOGOUT' },
      });
    }
    if (req.session) {
      req.session.destroy(() => {
        res.clearCookie(ADMIN_CONSTANTS.SESSION_COOKIE_NAME, { path: '/' });
        res.redirect(`${ADMIN_CONSTANTS.ROOT_PATH}/login`);
      });
    } else {
      res.clearCookie(ADMIN_CONSTANTS.SESSION_COOKIE_NAME, { path: '/' });
      res.redirect(`${ADMIN_CONSTANTS.ROOT_PATH}/login`);
    }
  };

  router.get('/logout', handleLogout);
  router.post('/logout', handleLogout);

  // Protect all AdminJS routes with mandatory MFA session enforcement
  router.use(requireAdminSession);

  // Mount AdminJS UI & API routes onto the protected router
  AdminJSExpress.buildRouter(adminJSInstance, router);

  // 5. Attach to pre-registered slot in app.ts so it runs before 404/error handlers
  if (app.locals?.hasPlatformAdminSlot) {
    app.locals.platformAdminRouter = router;
  } else {
    app.use(ADMIN_CONSTANTS.ROOT_PATH, router);
  }

  logger.info(
    `AdminJS successfully mounted at ${ADMIN_CONSTANTS.ROOT_PATH} [Platform Admin Only - Mandatory 2FA]`
  );

  return adminJSInstance;
}

export function getAdminJS(): any {
  return adminJSInstance;
}
