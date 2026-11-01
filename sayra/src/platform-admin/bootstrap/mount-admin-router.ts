/* eslint-disable @typescript-eslint/no-explicit-any */
import { Express } from 'express';
import { AdminJSPackages } from './load-adminjs';
import { registerPrismaAdapter } from './register-adapter';
import { getComponentLoader } from '../components/component.loader';
import { buildAdminOptions } from '../config/admin.config';
import { ADMIN_CONSTANTS } from '../config/admin.constants';
import { authenticatePlatformAdmin } from '../auth/admin.authenticate';
import { createAdminSessionOptions } from '../auth/admin.session';
import logger from '../../config/logger';

let adminJSInstance: any = null;

export async function mountAdminRouter(app: Express, packages: AdminJSPackages): Promise<any> {
  const { AdminJS, AdminJSExpress, ComponentLoader } = packages;

  // 1. Register Prisma Adapter once
  registerPrismaAdapter(packages);

  // 2. Initialize ComponentLoader and custom Dashboard
  const { componentLoader, dashboardComponentId } = await getComponentLoader(ComponentLoader);

  // 3. Build AdminJS configuration
  const adminOptions = buildAdminOptions({
    componentLoader,
    dashboardComponentId,
  });

  adminJSInstance = new AdminJS(adminOptions);

  // 4. Session and Authentication configuration
  const sessionOptions = createAdminSessionOptions();

  const authOptions = {
    authenticate: async (emailOrPhone: string, password: string, context?: any) => {
      const adminUser = await authenticatePlatformAdmin(emailOrPhone, password, {
        ip: context?.req?.ip,
        userAgent: context?.req?.headers?.['user-agent'],
      });

      return adminUser;
    },
    cookieName: ADMIN_CONSTANTS.SESSION_COOKIE_NAME,
    cookiePassword: ADMIN_CONSTANTS.COOKIE_SECRET,
  };

  // 5. Build authenticated AdminJS router (this automatically sets up session, login, logout, and protected routes)
  const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    adminJSInstance,
    authOptions,
    null,
    sessionOptions
  );

  // 6. Mount AdminJS router
  app.use(ADMIN_CONSTANTS.ROOT_PATH, adminRouter);

  logger.info(
    `AdminJS successfully mounted at ${ADMIN_CONSTANTS.ROOT_PATH} [Platform Admin Only]`
  );

  return adminJSInstance;
}

export function getAdminJS(): any {
  return adminJSInstance;
}
