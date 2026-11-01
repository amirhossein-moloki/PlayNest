/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSafeCrudResources } from './safe-crud.resources';
import { getReadOnlyResources } from './read-only.resources';
import { getPrismaModelTarget } from '../utils/model-access';
import { buildSensitivePropertiesConfiguration } from './resource.defaults';

/**
 * Builds the complete explicit resource registry for Phase 1.
 * Only models intentionally configured are exposed.
 */
export function buildResourceRegistry(): any[] {
  // Platform Management models
  const platformManagementResources = [
    {
      resource: getPrismaModelTarget('GamingCenter'),
      options: {
        navigation: {
          name: 'Platform Management',
          icon: 'Home',
        },
        actions: {
          new: { isAccessible: false, isVisible: false },
          delete: { isAccessible: false, isVisible: false },
          bulkDelete: { isAccessible: false, isVisible: false },
        },
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('User'),
      options: {
        navigation: {
          name: 'Platform Management',
          icon: 'User',
        },
        actions: {
          new: { isAccessible: false, isVisible: false },
          delete: { isAccessible: false, isVisible: false },
          bulkDelete: { isAccessible: false, isVisible: false },
        },
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('PlatformAdmin'),
      options: {
        navigation: {
          name: 'Platform Management',
          icon: 'UserCheck',
        },
        actions: {
          new: { isAccessible: false, isVisible: false },
          delete: { isAccessible: false, isVisible: false },
          bulkDelete: { isAccessible: false, isVisible: false },
        },
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
  ];

  return [
    ...platformManagementResources,
    ...getReadOnlyResources(),
    ...getSafeCrudResources(),
  ];
}
