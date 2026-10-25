import { Worker, Job } from 'bullmq';
import redis from '../../config/redis';
import logger from '../../config/logger';
import { analyticsIngestionService } from '../../modules/analytics/analyticsIngestionService';

export const QUEUE_NAME = 'analytics-ingestion';

export const analyticsIngestionWorker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    logger.info(`Starting analytics ingestion worker job: ${job.id}`);
    const result = await analyticsIngestionService.runIngestionCycle();
    logger.info({ result }, `Completed analytics ingestion worker job: ${job.id}`);
    return result;
  },
  {
    connection: redis,
    concurrency: 1, // Ensure single execution at a time to prevent overlapping ingestion runs
  }
);

analyticsIngestionWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error({ jobId: job?.id, err }, 'Analytics ingestion worker job failed');
});
