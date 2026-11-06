/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSafeCrudResources } from './safe-crud.resources';
import { getReadOnlyResources, readOnlyActionsConfig } from './read-only.resources';
import { getPrismaModelTarget } from '../utils/model-access';
import { buildSensitivePropertiesConfiguration } from './resource.defaults';
import { ADMIN_NAVIGATION_GROUPS } from '../config/admin.navigation';

/**
 * Builds the complete explicit resource registry for Phase 1 according to the 12 IA Groups.
 * Only models intentionally configured are exposed.
 */
export function buildResourceRegistry(): any[] {
  // Core Domain Management models
  const coreResources = [
    // 🏢 Gaming Centers
    {
      resource: getPrismaModelTarget('GamingCenter'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.GAMING_CENTERS,
        actions: {
          new: { isAccessible: false, isVisible: false },
          delete: { isAccessible: false, isVisible: false },
          bulkDelete: { isAccessible: false, isVisible: false },
        },
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    // 👥 User Management
    {
      resource: getPrismaModelTarget('User'),
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
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    // 🎧 Support & Feedback
    {
      resource: getPrismaModelTarget('Ticket'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.SUPPORT_FEEDBACK,
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    // 🔔 Communications
    {
      resource: getPrismaModelTarget('NotificationLog'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.COMMUNICATIONS,
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
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
    ...getSafeCrudResources(),
  ];
}
