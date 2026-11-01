/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPrismaModelTarget } from '../utils/model-access';
import { buildSensitivePropertiesConfiguration } from './resource.defaults';

/**
 * Verified low-risk configuration and CMS resources where direct CRUD operations are safe.
 * Inspects: Category, Tag, SiteSettings
 */
export function getSafeCrudResources(): any[] {
  return [
    {
      resource: getPrismaModelTarget('Category'),
      options: {
        navigation: {
          name: 'Content Management',
          icon: 'Folder',
        },
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
        navigation: {
          name: 'Content Management',
          icon: 'Tag',
        },
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
        navigation: {
          name: 'Content Management',
          icon: 'Settings',
        },
        properties: {
          ...buildSensitivePropertiesConfiguration(),
          id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          createdAt: { isVisible: { list: true, show: true, edit: false, filter: true } },
          updatedAt: { isVisible: { list: false, show: true, edit: false, filter: false } },
        },
      },
    },
  ];
}
