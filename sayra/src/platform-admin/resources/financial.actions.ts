/* eslint-disable @typescript-eslint/no-explicit-any */
import { AdminStationBridge } from '../services/admin-station-bridge';
import logger from '../../config/logger';

export function buildRefundActions(): Record<string, any> {
  return {
    new: { isAccessible: false, isVisible: false },
    edit: { isAccessible: false, isVisible: false },
    delete: { isAccessible: false, isVisible: false },
    bulkDelete: { isAccessible: false, isVisible: false },

    retryRefund: {
      actionType: 'record',
      icon: 'RotateCw',
      isVisible: (context: any) => {
        const status = context.record?.params?.status;
        return status === 'FAILED' || status === 'PENDING';
      },
      handler: async (request: any, response: any, context: any) => {
        const { record, currentAdmin } = context;
        const refundId = record.params.id;

        try {
          const result = await AdminStationBridge.retryRefund(refundId, {
            platformAdminId: currentAdmin.id,
          });

          return {
            record: record.toJSON(currentAdmin),
            notice: {
              message: `Refund ${refundId} retry initiated successfully. Result ID: ${result?.id || 'pending'}`,
              type: 'success',
            },
          };
        } catch (err: any) {
          logger.error({ err, refundId }, 'AdminJS: Retry refund failed');
          return {
            record: record.toJSON(currentAdmin),
            notice: {
              message: err.message || 'Failed to retry refund.',
              type: 'error',
            },
          };
        }
      },
    },
  };
}

export function buildPaymentActions(): Record<string, any> {
  return {
    new: { isAccessible: false, isVisible: false },
    edit: { isAccessible: false, isVisible: false },
    delete: { isAccessible: false, isVisible: false },
    bulkDelete: { isAccessible: false, isVisible: false },

    reconcilePayment: {
      actionType: 'record',
      icon: 'ShieldCheck',
      handler: async (request: any, response: any, context: any) => {
        const { record, currentAdmin } = context;
        const paymentId = record.params.id;
        const gamingCenterId = record.params.gamingCenterId;

        try {
          const result = await AdminStationBridge.reconcilePayment(gamingCenterId, paymentId, {
            platformAdminId: currentAdmin.id,
          });

          return {
            record: record.toJSON(currentAdmin),
            notice: {
              message: `Reconciliation status: ${result.status}. ${result.discrepancies?.length ? result.discrepancies.join('; ') : 'No discrepancies found.'}`,
              type: result.status === 'MATCHED' ? 'success' : 'warning',
            },
          };
        } catch (err: any) {
          logger.error({ err, paymentId }, 'AdminJS: Reconcile payment failed');
          return {
            record: record.toJSON(currentAdmin),
            notice: {
              message: err.message || 'Failed to reconcile payment.',
              type: 'error',
            },
          };
        }
      },
    },
  };
}
