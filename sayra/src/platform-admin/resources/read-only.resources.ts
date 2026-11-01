/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPrismaModelTarget } from '../utils/model-access';
import { buildSensitivePropertiesConfiguration } from './resource.defaults';

/**
 * Common configuration for read-only resources:
 * Allows list and show, disables new, edit, delete, and bulkDelete.
 */
const readOnlyActionsConfig = {
  new: { isAccessible: false, isVisible: false },
  edit: { isAccessible: false, isVisible: false },
  delete: { isAccessible: false, isVisible: false },
  bulkDelete: { isAccessible: false, isVisible: false },
};

/**
 * Sensitive operational, financial, and audit models that must remain STRICTLY READ-ONLY.
 * No direct write operations (create, update, delete) are permitted.
 */
export function getReadOnlyResources(): any[] {
  return [
    {
      resource: getPrismaModelTarget('Reservation'),
      options: {
        navigation: {
          name: 'Operations',
          icon: 'Calendar',
        },
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('GroupBooking'),
      options: {
        navigation: {
          name: 'Operations',
          icon: 'Users',
        },
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('Payment'),
      options: {
        navigation: {
          name: 'Finance',
          icon: 'DollarSign',
        },
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('Refund'),
      options: {
        navigation: {
          name: 'Finance',
          icon: 'CornerUpLeft',
        },
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('LedgerEntry'),
      options: {
        navigation: {
          name: 'Finance',
          icon: 'BookOpen',
        },
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('WalletTransaction'),
      options: {
        navigation: {
          name: 'Finance',
          icon: 'CreditCard',
        },
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('AuditLog'),
      options: {
        navigation: {
          name: 'Security',
          icon: 'Shield',
        },
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
  ];
}
