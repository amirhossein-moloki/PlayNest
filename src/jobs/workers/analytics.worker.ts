import { Worker, Job } from 'bullmq';
import { ANALYTICS_QUEUE_NAME } from '../queues';
import { env } from '../../config/env';
import { AnalyticsRepo } from '../../modules/analytics/analytics.repo';
import { AnalyticsSyncJobData } from '../producers/analytics.producer';
import logger from '../../config/logger';

export const analyticsWorker = new Worker(
  ANALYTICS_QUEUE_NAME,
  async (job: Job<AnalyticsSyncJobData>) => {
    const { type, entityId } = job.data;
    logger.info({ msg: 'Processing Analytics sync job', jobId: job.id, type, entityId });

    try {
      switch (type) {
        case 'BOOKING':
          await AnalyticsRepo.syncAllStatsForBooking(entityId);
          break;
        case 'PAYMENT':
          await AnalyticsRepo.syncAllStatsForPayment(entityId);
          break;
        case 'REVIEW':
          await AnalyticsRepo.syncAllStatsForReview(entityId);
          break;
      }
    } catch (error) {
      logger.error({ msg: 'Analytics sync job failed', jobId: job.id, error });
      throw error;
    }
  },
  {
    connection: {
      url: env.REDIS_URL,
    },
  }
);
