import { Worker, Job } from 'bullmq';
import { SMS_QUEUE_NAME } from '../queues';
import { env } from '../../config/env';
import { SmsStation } from '../../modules/notifications/sms.station';
import { SmsJobData } from '../producers/sms.producer';
import logger from '../../config/logger';
import { requestContext } from '../../common/context/request-context';
import { Metrics } from '../../common/metrics/metrics';

export const smsWorker = new Worker(
  SMS_QUEUE_NAME,
  async (job: Job<SmsJobData>) => {
    const { mobile, templateId, parameters, correlationId } = job.data;

    return requestContext.run({ correlationId, requestId: job.id }, async () => {
      logger.info({ msg: 'Processing SMS job', jobId: job.id, mobile, templateId });

      try {
        await SmsStation.sendTemplateSms(mobile, templateId, parameters);
      } catch (error) {
        Metrics.recordWorkerError(SMS_QUEUE_NAME, error instanceof Error ? error.message : String(error));
        logger.error({ msg: 'SMS job failed', jobId: job.id, error });
        throw error;
      }
    });
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
