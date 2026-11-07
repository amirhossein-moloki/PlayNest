/* eslint-disable @typescript-eslint/no-explicit-any */
import { AdminStationBridge } from '../services/admin-station-bridge';
import logger from '../../config/logger';

export function buildReservationActions(): Record<string, any> {
  return {
    new: { isAccessible: false, isVisible: false },
    edit: { isAccessible: false, isVisible: false },
    delete: { isAccessible: false, isVisible: false },
    bulkDelete: { isAccessible: false, isVisible: false },

    cancelReservation: {
      actionType: 'record',
      icon: 'XCircle',
      isVisible: (context: any) => {
        const status = context.record?.params?.status;
        return status === 'PENDING' || status === 'CONFIRMED';
      },
      handler: async (request: any, response: any, context: any) => {
        const { record, currentAdmin } = context;
        const reservationId = record.params.id;
        const gamingCenterId = record.params.gamingCenterId;

        if (request.method === 'post') {
          const reason = request.payload?.reason || 'Cancelled by Super Administrator';
          try {
            await AdminStationBridge.cancelReservation(
              gamingCenterId,
              reservationId,
              reason,
              {
                platformAdminId: currentAdmin.id,
              }
            );

            return {
              record: record.toJSON(currentAdmin),
              notice: {
                message: `Reservation ${reservationId} successfully canceled via domain service.`,
                type: 'success',
              },
            };
          } catch (err: any) {
            logger.error({ err, reservationId }, 'AdminJS: Cancel reservation failed');
            return {
              record: record.toJSON(currentAdmin),
              notice: {
                message: err.message || 'Failed to cancel reservation.',
                type: 'error',
              },
            };
          }
        }

        return {
          record: record.toJSON(currentAdmin),
        };
      },
    },

    confirmReservation: {
      actionType: 'record',
      icon: 'CheckCircle',
      isVisible: (context: any) => {
        const status = context.record?.params?.status;
        return status === 'PENDING';
      },
      handler: async (request: any, response: any, context: any) => {
        const { record, currentAdmin } = context;
        const reservationId = record.params.id;
        const gamingCenterId = record.params.gamingCenterId;

        try {
          await AdminStationBridge.confirmReservation(gamingCenterId, reservationId, {
            platformAdminId: currentAdmin.id,
          });

          return {
            record: record.toJSON(currentAdmin),
            notice: {
              message: `Reservation ${reservationId} confirmed successfully.`,
              type: 'success',
            },
          };
        } catch (err: any) {
          logger.error({ err, reservationId }, 'AdminJS: Confirm reservation failed');
          return {
            record: record.toJSON(currentAdmin),
            notice: {
              message: err.message || 'Failed to confirm reservation.',
              type: 'error',
            },
          };
        }
      },
    },

    startReservation: {
      actionType: 'record',
      icon: 'Play',
      isVisible: (context: any) => {
        const status = context.record?.params?.status;
        return status === 'CONFIRMED';
      },
      handler: async (request: any, response: any, context: any) => {
        const { record, currentAdmin } = context;
        const reservationId = record.params.id;
        const gamingCenterId = record.params.gamingCenterId;

        try {
          await AdminStationBridge.startReservation(gamingCenterId, reservationId, {
            platformAdminId: currentAdmin.id,
          });

          return {
            record: record.toJSON(currentAdmin),
            notice: {
              message: `Reservation ${reservationId} session started.`,
              type: 'success',
            },
          };
        } catch (err: any) {
          logger.error({ err, reservationId }, 'AdminJS: Start reservation failed');
          return {
            record: record.toJSON(currentAdmin),
            notice: {
              message: err.message || 'Failed to start reservation session.',
              type: 'error',
            },
          };
        }
      },
    },

    completeReservation: {
      actionType: 'record',
      icon: 'CheckSquare',
      isVisible: (context: any) => {
        const status = context.record?.params?.status;
        return status === 'IN_PROGRESS';
      },
      handler: async (request: any, response: any, context: any) => {
        const { record, currentAdmin } = context;
        const reservationId = record.params.id;
        const gamingCenterId = record.params.gamingCenterId;

        try {
          await AdminStationBridge.completeReservation(gamingCenterId, reservationId, {
            platformAdminId: currentAdmin.id,
          });

          return {
            record: record.toJSON(currentAdmin),
            notice: {
              message: `Reservation ${reservationId} marked completed.`,
              type: 'success',
            },
          };
        } catch (err: any) {
          logger.error({ err, reservationId }, 'AdminJS: Complete reservation failed');
          return {
            record: record.toJSON(currentAdmin),
            notice: {
              message: err.message || 'Failed to complete reservation.',
              type: 'error',
            },
          };
        }
      },
    },

    markNoShow: {
      actionType: 'record',
      icon: 'UserX',
      isVisible: (context: any) => {
        const status = context.record?.params?.status;
        return status === 'CONFIRMED';
      },
      handler: async (request: any, response: any, context: any) => {
        const { record, currentAdmin } = context;
        const reservationId = record.params.id;
        const gamingCenterId = record.params.gamingCenterId;

        try {
          await AdminStationBridge.markNoShow(gamingCenterId, reservationId, {
            platformAdminId: currentAdmin.id,
          });

          return {
            record: record.toJSON(currentAdmin),
            notice: {
              message: `Reservation ${reservationId} marked as No-Show.`,
              type: 'success',
            },
          };
        } catch (err: any) {
          logger.error({ err, reservationId }, 'AdminJS: Mark no-show failed');
          return {
            record: record.toJSON(currentAdmin),
            notice: {
              message: err.message || 'Failed to mark reservation as no-show.',
              type: 'error',
            },
          };
        }
      },
    },
  };
}
