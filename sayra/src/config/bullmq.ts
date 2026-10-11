import { QueueOptions } from 'bullmq';
import { env } from './env';

export const defaultQueueOptions: QueueOptions = {
  connection: {
    url: env.REDIS_URL,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: 1000,
  },
};
