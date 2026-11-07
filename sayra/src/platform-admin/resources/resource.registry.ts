/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSafeCrudResources } from './safe-crud.resources';
import { getReadOnlyResources } from './read-only.resources';
import { getPrismaModelTarget } from '../utils/model-access';
import { buildSensitivePropertiesConfiguration } from './resource.defaults';
import { ADMIN_NAVIGATION_GROUPS } from '../config/admin.navigation';

/**
 * Builds the complete explicit resource registry for Phase 1 according to the 12 IA Groups.
 * Only models intentionally configured are exposed.
 */
export function buildResourceRegistry(components?: { coverImageComponentId?: string }): any[] {
  // Core Domain Management models
  const coreResources = [
    // 🏢 Gaming Centers
    {
      resource: getPrismaModelTarget('GamingCenter'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.GAMING_CENTERS,
        actions: {
          delete: { isAccessible: false, isVisible: false },
          bulkDelete: { isAccessible: false, isVisible: false },
        },
        properties: {
          ...buildSensitivePropertiesConfiguration(),
          id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          createdAt: { isVisible: { list: true, show: true, edit: false, filter: true } },
          updatedAt: { isVisible: { list: false, show: true, edit: false, filter: false } },
        },
      },
    },
    // 👥 User Management
    {
      resource: getPrismaModelTarget('User'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.USER_MANAGEMENT,
        actions: {
          delete: { isAccessible: false, isVisible: false },
          bulkDelete: { isAccessible: false, isVisible: false },
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
      resource: getPrismaModelTarget('PlatformAdmin'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.USER_MANAGEMENT,
        actions: {
          new: { isAccessible: false, isVisible: false },
          delete: { isAccessible: false, isVisible: false },
          bulkDelete: { isAccessible: false, isVisible: false },
        },
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    // 🎮 Stations & Catalog
    {
      resource: getPrismaModelTarget('GameStation'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.STATIONS_CATALOG,
        actions: {
          delete: { isAccessible: false, isVisible: false },
          bulkDelete: { isAccessible: false, isVisible: false },
        },
        properties: {
          ...buildSensitivePropertiesConfiguration(),
          id: { isVisible: { list: true, show: true, edit: false, filter: true } },
          createdAt: { isVisible: { list: true, show: true, edit: false, filter: true } },
          updatedAt: { isVisible: { list: false, show: true, edit: false, filter: false } },
        },
      },
    },
    // ⚙️ System & Governance
    {
      resource: getPrismaModelTarget('PlatformSetting'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.SYSTEM_GOVERNANCE,
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
    ...coreResources,
    ...getReadOnlyResources(),
    ...getSafeCrudResources(components),
  ];
}
