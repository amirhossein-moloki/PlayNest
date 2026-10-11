import { analyticsQueue } from '../queues';
import { getRequestContext } from '../../common/context/request-context';

export interface AnalyticsSyncJobData {
  type: 'RESERVATION' | 'PAYMENT' | 'REVIEW';
  entityId: string;
  correlationId?: string;
}

export const queueAnalyticsSync = async (data: AnalyticsSyncJobData) => {
  const context = getRequestContext();
  await analyticsQueue.add('sync-analytics', {
    ...data,
    correlationId: context.correlationId,
  });
};
