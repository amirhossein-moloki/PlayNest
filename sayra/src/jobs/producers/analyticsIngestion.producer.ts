import { Queue } from 'bullmq';
import redis from '../../config/redis';
import { QUEUE_NAME } from '../workers/analyticsIngestion.worker';

export const analyticsIngestionQueue = new Queue(QUEUE_NAME, {
  connection: redis,
});

export const scheduleAnalyticsIngestion = async (cronPattern: string = '0 * * * *') => {
  await analyticsIngestionQueue.add(
    'run-analytics-ingestion',
    {},
    {
      repeat: {
        pattern: cronPattern,
      },
      jobId: 'repeatable-analytics-ingestion',
    }
  );
};
