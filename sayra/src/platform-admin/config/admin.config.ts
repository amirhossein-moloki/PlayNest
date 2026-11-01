/* eslint-disable @typescript-eslint/no-explicit-any */
import { ADMIN_CONSTANTS } from './admin.constants';
import { buildResourceRegistry } from '../resources/resource.registry';
import { DashboardService } from '../dashboard/dashboard.service';

export interface AdminConfigOptions {
  componentLoader: any;
  dashboardComponentId: string;
}

export function buildAdminOptions(options: AdminConfigOptions): any {
  return {
    rootPath: ADMIN_CONSTANTS.ROOT_PATH,
    loginPath: `${ADMIN_CONSTANTS.ROOT_PATH}/login`,
    logoutPath: `${ADMIN_CONSTANTS.ROOT_PATH}/logout`,
    componentLoader: options.componentLoader,
    branding: {
      companyName: 'PlayNest Platform Admin',
      logo: false,
      withMadeWithLove: false,
    },
    locale: {
      language: 'en',
      translations: {
        labels: {
          loginWelcome: 'PlayNest Platform Administrator Login',
        },
        messages: {
          loginWelcome: 'Enter your Platform Administrator credentials to access the console.',
        },
      },
    },
    dashboard: {
      component: options.dashboardComponentId,
      handler: async () => {
        const metrics = await DashboardService.getPlatformMetrics();
        return metrics;
      },
    },
    resources: buildResourceRegistry(),
  };
}
