import { Worker, Job } from 'bullmq';
import { SMS_QUEUE_NAME } from '../queues';
import { env } from '../../config/env';
import { SmsService } from '../../modules/notifications/sms.station';
import { SmsJobData } from '../producers/sms.producer';
import logger from '../../config/logger';

export const smsWorker = new Worker(
  SMS_QUEUE_NAME,
  async (job: Job<SmsJobData>) => {
    const { mobile, templateId, parameters } = job.data;
    logger.info({ msg: 'Processing SMS job', jobId: job.id, mobile, templateId });

    try {
      await SmsService.sendTemplateSms(mobile, templateId, parameters);
    } catch (error) {
      logger.error({ msg: 'SMS job failed', jobId: job.id, error });
      throw error;
    }
  },
  {
    connection: {
      url: env.REDIS_URL,
    },
  }
);

smsWorker.on('completed', (job) => {
  logger.info({ msg: 'SMS job completed', jobId: job.id });
});

smsWorker.on('failed', (job, err) => {
  logger.error({ msg: 'SMS job failed', jobId: job?.id, error: err });
});
