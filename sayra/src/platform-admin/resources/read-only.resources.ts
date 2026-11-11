/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPrismaModelTarget } from '../utils/model-access';
import { buildSensitivePropertiesConfiguration } from './resource.defaults';
import { ADMIN_NAVIGATION_GROUPS } from '../config/admin.navigation';
import { buildReservationActions } from './reservation.actions';
import { buildPaymentActions, buildRefundActions } from './financial.actions';

/**
 * Common configuration for read-only resources:
 * Allows list and show, disables new, edit, delete, and bulkDelete.
 */
export const readOnlyActionsConfig = {
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
        navigation: ADMIN_NAVIGATION_GROUPS.BOOKINGS_OPERATIONS,
        actions: buildReservationActions(),
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('WithdrawalRequest'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.FINANCE_BILLING,
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('ReservationHistory'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.BOOKINGS_OPERATIONS,
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('StationMaintenance'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.STATIONS_CATALOG,
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('GroupBooking'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.BOOKINGS_OPERATIONS,
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('Payment'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.FINANCE_BILLING,
        actions: buildPaymentActions(),
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('Refund'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.FINANCE_BILLING,
        actions: buildRefundActions(),
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('CommissionPolicy'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.FINANCE_BILLING,
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('Earning'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.FINANCE_BILLING,
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('ReconciliationRecord'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.FINANCE_BILLING,
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('LedgerEntry'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.FINANCE_BILLING,
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('WalletTransaction'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.FINANCE_BILLING,
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
    {
      resource: getPrismaModelTarget('AuditLog'),
      options: {
        navigation: ADMIN_NAVIGATION_GROUPS.SYSTEM_GOVERNANCE,
        actions: readOnlyActionsConfig,
        properties: buildSensitivePropertiesConfiguration(),
      },
    },
  ];
}
