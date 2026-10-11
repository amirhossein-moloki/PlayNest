
import { Prisma } from '@prisma/client';
import logger from './logger';

/**
 * Models that MUST always have a gamingCenterId filter.
 */
const TENANT_MODELS = new Set([
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
]);

/**
 * Models that MUST always have a customerAccountId filter (Global CRM).
 */
const GLOBAL_CRM_MODELS = new Set([
  'CustomerProfile', // Also has gamingCenterId
  'WalletTransaction',
  'Membership'
]);

export const tenantGuardExtension = Prisma.defineExtension({
  name: 'tenantGuard',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // Only check read/update/delete operations
        const isRead = ['findUnique', 'findFirst', 'findMany', 'aggregate', 'count', 'groupBy'].includes(operation);
        const isWrite = ['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(operation);

        if (isRead || isWrite) {
          const where = (args as { where?: Record<string, unknown> }).where || {};

          if (TENANT_MODELS.has(model)) {
            if (!where.gamingCenterId && !where.gamingCenter) {
              // We log a warning instead of throwing to avoid breaking existing legitimate cross-tenant admin logic (if any exists)
              // but it highlights areas that need repository hardening.
              logger.warn(
                { model, operation, args },
                `Potential missing gamingCenterId filter on tenant-scoped model: ${model}.${operation}`
              );
            }
          } else if (GLOBAL_CRM_MODELS.has(model)) {
            if (!where.customerAccountId && !where.customerAccount && (model !== 'CustomerProfile' || !where.gamingCenterId)) {
              logger.warn(
                { model, operation, args },
                `Potential missing customerAccountId/gamingCenterId filter on CRM model: ${model}.${operation}`
              );
            }
          }
        }

        return query(args);
      },
    },
  },
});
