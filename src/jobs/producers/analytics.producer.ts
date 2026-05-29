import { analyticsQueue } from '../queues';

export interface AnalyticsSyncJobData {
  type: 'BOOKING' | 'PAYMENT' | 'REVIEW';
  entityId: string;
}

export const queueAnalyticsSync = async (data: AnalyticsSyncJobData) => {
  await analyticsQueue.add('sync-analytics', data);
};
