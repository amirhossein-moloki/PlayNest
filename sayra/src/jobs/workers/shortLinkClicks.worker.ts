import { Job, Worker } from 'bullmq';
import { SHORT_LINK_CLICKS_QUEUE_NAME } from '../queues';
import { env } from '../../config/env';
import logger from '../../config/logger';
import { ClickAnalyticsService } from '../../modules/short-links/clickAnalytics.service';
import { ShortLinkClickEventJobData } from '../../modules/short-links/shortLinks.types';

export const shortLinkClicksWorker = new Worker<ShortLinkClickEventJobData>(
  SHORT_LINK_CLICKS_QUEUE_NAME,
  async (job: Job<ShortLinkClickEventJobData>) => {
    await ClickAnalyticsService.processClickEvent(job.data);
  },
  {
    connection: {
      url: env.REDIS_URL,
    },
    concurrency: 10,
  }
);

shortLinkClicksWorker.on('failed', (job: Job<ShortLinkClickEventJobData> | undefined, err: Error) => {
  logger.error({
    msg: 'ShortLink click worker job failed',
    jobId: job?.id,
    shortLinkId: job?.data?.shortLinkId,
    error: err.message,
  });
});
