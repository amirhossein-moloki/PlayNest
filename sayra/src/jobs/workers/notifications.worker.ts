import { Worker, Job } from 'bullmq';
import { NOTIFICATIONS_QUEUE_NAME } from '../queues';
import { env } from '../../config/env';
import { NotificationStation } from '../../modules/notifications/notifications.station';
import { NotificationJobData } from '../producers/notifications.producer';
import logger from '../../config/logger';
import { requestContext } from '../../common/context/request-context';
import { Metrics } from '../../common/metrics/metrics';

export const notificationsWorker = new Worker<NotificationJobData>(
  NOTIFICATIONS_QUEUE_NAME,
  async (job: Job<NotificationJobData>) => {
    const { logId, correlationId } = job.data;

    return requestContext.run({ correlationId, requestId: job.id }, async () => {
      logger.info({ msg: 'Processing notification dispatch job', jobId: job.id, logId });

      try {
        const result = await NotificationStation.dispatchNotificationLog(logId);
        return result;
      } catch (error) {
        Metrics.recordWorkerError(
          NOTIFICATIONS_QUEUE_NAME,
          error instanceof Error ? error.message : String(error)
        );
        logger.error({ msg: 'Notification job failed', jobId: job.id, logId, error });
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

notificationsWorker.on('completed', (job) => {
  logger.info({ msg: 'Notification dispatch job completed', jobId: job.id });
});

notificationsWorker.on('failed', (job, err) => {
  logger.error({ msg: 'Notification dispatch job failed', jobId: job?.id, error: err });
});

notificationsWorker.on('error', (err) => {
  logger.warn({
    msg: 'Notifications Worker connection error (Redis may be offline)',
    error: err instanceof Error ? err.message : String(err),
  });
});
