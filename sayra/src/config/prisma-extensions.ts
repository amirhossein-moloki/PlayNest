import { Prisma } from '@prisma/client';
import logger from './logger';

/**
 * Models that MUST always have a gamingCenterId filter.
 */
export const TENANT_MODELS = new Set([
  'User',
  'GameStation',
  'StaffShift',
  'Reservation',
  'Payment',
  'Rating',
  'CommissionPolicy',
  'Earning',
  'EarningPayment',
  'SiteSettings',
  'Page',
  'PageSection',
  'Media',
  'SocialLink',
  'Address',
  'GamingCenterAnalytics',
  'StaffAnalytics',
  'StationAnalytics',
  'Tournament',
  'GamingCenterVerification',
  'AdvertisementRequest',
]);

/**
 * Models that MUST always have a customerAccountId filter (Global CRM).
 */
export const GLOBAL_CRM_MODELS = new Set([
  'CustomerProfile', // Also has gamingCenterId
  'WalletTransaction',
  'Membership'
]);

import { getRequestContext } from '../common/context/request-context';

/**
 * Checks whether any of the target filter keys are present anywhere in the where clause,
 * including nested compound unique constraints (e.g. gamingCenterId_userId_dayOfWeek) or AND/OR blocks.
 */
export function hasFilterKey(where: unknown, targetKeys: string[]): boolean {
  if (!where || typeof where !== 'object') return false;

  const queue: unknown[] = [where];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      for (const item of current) {
        if (item && typeof item === 'object') queue.push(item);
      }
      continue;
    }

    const obj = current as Record<string, unknown>;
    for (const key of targetKeys) {
      if (obj[key] !== undefined && obj[key] !== null) {
        return true;
      }
    }

    for (const val of Object.values(obj)) {
      if (val && typeof val === 'object') {
        queue.push(val);
      }
    }
  }

  return false;
}

export async function processTenantGuardOperation(params: {
  model: string;
  operation: string;
  args: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  query: (args: any) => Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}) {
  const { model, operation, args, query } = params;
  const isRead = ['findUnique', 'findFirst', 'findMany', 'aggregate', 'count', 'groupBy'].includes(operation);
  const isWrite = ['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(operation);

  if (isRead || isWrite) {
    const where = (args as { where?: Record<string, unknown> }).where || {};
    const context = getRequestContext();

    // If operation is explicitly executing in an internal authorized system context, log structured audit and allow
    if (context.isSystemContext) {
      logger.debug(
        {
          model,
          operation,
          systemJobName: context.systemJobName,
          correlationId: context.correlationId,
        },
        `Authorized cross-tenant system operation executed: ${model}.${operation}`
      );
      return query(args);
    }

    if (TENANT_MODELS.has(model)) {
      const hasTenantFilter = hasFilterKey(where, ['gamingCenterId', 'gamingCenter']);
      if (!hasTenantFilter) {
        logger.warn(
          {
            model,
            operation,
            activeTenantId: context.gamingCenterId || null,
            requestId: context.requestId || null,
            args,
          },
          `Potential missing gamingCenterId filter on tenant-scoped model: ${model}.${operation}`
        );
      }
    } else if (GLOBAL_CRM_MODELS.has(model)) {
      const hasCrmFilter = hasFilterKey(where, ['customerAccountId', 'customerAccount']);
      const hasTenantFilter = model === 'CustomerProfile' ? hasFilterKey(where, ['gamingCenterId', 'gamingCenter']) : false;

      if (!hasCrmFilter && !hasTenantFilter) {
        logger.warn(
          {
            model,
            operation,
            activeTenantId: context.gamingCenterId || null,
            requestId: context.requestId || null,
            args,
          },
          `Potential missing customerAccountId/gamingCenterId filter on CRM model: ${model}.${operation}`
        );
      }
    }
  }

  return query(args);
}

export const tenantGuardExtension = Prisma.defineExtension({
  name: 'tenantGuard',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        return processTenantGuardOperation({ model, operation, args, query });
      },
    },
  },
});
