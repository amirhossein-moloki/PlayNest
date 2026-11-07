/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPrismaModelTarget } from '../utils/model-access';
import { buildSensitivePropertiesConfiguration } from './resource.defaults';

/**
 * Verified low-risk configuration and CMS resources where direct CRUD operations are safe.
 * Inspects: Category, Tag, SiteSettings
 */
import { ADMIN_NAVIGATION_GROUPS } from '../config/admin.navigation';

export function getSafeCrudResources(): any[] {
  return [
    {
      resource: getPrismaModelTarget('Category'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.CONTENT_PORTAL,
        properties: {
          ...buildSensitivePropertiesConfiguration(),
          id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          createdAt: { isVisible: { list: true, show: true, edit: false, filter: true } },
          updatedAt: { isVisible: { list: false, show: true, edit: false, filter: false } },
        },
      },
    },
    {
      resource: getPrismaModelTarget('Tag'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.CONTENT_PORTAL,
        properties: {
          ...buildSensitivePropertiesConfiguration(),
          id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          createdAt: { isVisible: { list: true, show: true, edit: false, filter: true } },
          updatedAt: { isVisible: { list: false, show: true, edit: false, filter: false } },
        },
      },
    },
    {
      resource: getPrismaModelTarget('SiteSettings'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.CONTENT_PORTAL,
        properties: {
          ...buildSensitivePropertiesConfiguration(),
          id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          createdAt: { isVisible: { list: true, show: true, edit: false, filter: true } },
          updatedAt: { isVisible: { list: false, show: true, edit: false, filter: false } },
        },
      },
    },
    {
      resource: getPrismaModelTarget('DeviceCatalog'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.STATIONS_CATALOG,
        properties: {
          ...buildSensitivePropertiesConfiguration(),
          id: { isVisible: { list: true, show: true, edit: false, filter: true } },
        },
      },
    },
    {
      resource: getPrismaModelTarget('GameCatalog'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.STATIONS_CATALOG,
        properties: {
          ...buildSensitivePropertiesConfiguration(),
          id: { isVisible: { list: true, show: true, edit: false, filter: true } },
        },
      },
    },
  ];
}
