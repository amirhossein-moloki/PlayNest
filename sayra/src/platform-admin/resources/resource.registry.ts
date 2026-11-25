/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSafeCrudResources } from './safe-crud.resources';
import { getReadOnlyResources } from './read-only.resources';
import { getPrismaModelTarget } from '../utils/model-access';
import { buildSensitivePropertiesConfiguration } from './resource.defaults';
import { ADMIN_NAVIGATION_GROUPS } from '../config/admin.navigation';
import { STATION_TYPE_AVAILABLE_VALUES } from '../../common/utils/station-type';
import { hasValidPlatformAdminAccess } from '../auth/admin.authorization';

const BUILTIN_ADMINJS_ACTIONS = ['list', 'show', 'search', 'new', 'edit', 'delete', 'bulkDelete'];

/**
 * Attaches defense-in-depth `isAccessible` MFA/superuser guards to all non-disabled AdminJS resource actions.
 */
function applyResourceAccessGuards(resources: any[]): any[] {
  return resources.map((entry) => {
    const existingActions = entry.options?.actions || {};
    const guardedActions: Record<string, any> = { ...existingActions };
    const actionNames = new Set([...BUILTIN_ADMINJS_ACTIONS, ...Object.keys(existingActions)]);

    for (const actionName of actionNames) {
      const actionConfig = existingActions[actionName] || {};
      if (actionConfig.isAccessible === false) {
        guardedActions[actionName] = actionConfig;
        continue;
      }

      const originalIsAccessible = actionConfig.isAccessible;
      guardedActions[actionName] = {
        ...actionConfig,
        isAccessible:
          typeof originalIsAccessible === 'function'
            ? (context: any) => hasValidPlatformAdminAccess(context) && Boolean(originalIsAccessible(context))
            : hasValidPlatformAdminAccess,
      };
    }

    return {
      ...entry,
      options: {
        ...entry.options,
        actions: guardedActions,
      },
    };
  });
}

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
        properties: {
          ...buildSensitivePropertiesConfiguration(),
          totpEnabled: { isVisible: { list: true, show: true, edit: false, filter: true } },
          totpSetupCompleted: { isVisible: { list: true, show: true, edit: false, filter: true } },
          totpEnabledAt: { isVisible: { list: false, show: true, edit: false, filter: false } },
          totpLastUsedAt: { isVisible: { list: false, show: true, edit: false, filter: false } },
          totpFailedAttempts: { isVisible: { list: false, show: true, edit: false, filter: false } },
          totpLockedUntil: { isVisible: { list: false, show: true, edit: false, filter: false } },
          failedLoginAttempts: { isVisible: { list: false, show: true, edit: false, filter: false } },
          lockedUntil: { isVisible: { list: false, show: true, edit: false, filter: false } },
        },
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
          stationType: { availableValues: STATION_TYPE_AVAILABLE_VALUES },
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

  return applyResourceAccessGuards([
    ...coreResources,
    ...getReadOnlyResources(),
    ...getSafeCrudResources(components),
  ]);
}
