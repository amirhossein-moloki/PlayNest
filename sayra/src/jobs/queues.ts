import { Queue } from 'bullmq';
import { defaultQueueOptions } from '../config/bullmq';
import logger from '../config/logger';

export const SMS_QUEUE_NAME = 'sms-notifications';
export const ANALYTICS_QUEUE_NAME = 'analytics-sync';
export const CMS_SYNC_MEDIA_QUEUE_NAME = 'cms-sync-media';
export const REMINDERS_QUEUE_NAME = 'reservation-reminders';
export const NOTIFICATIONS_QUEUE_NAME = 'notifications-dispatch';
export const INTEGRATION_WEBHOOK_QUEUE_NAME = 'integration-webhooks';

export const smsQueue = new Queue(SMS_QUEUE_NAME, defaultQueueOptions);
export const analyticsQueue = new Queue(ANALYTICS_QUEUE_NAME, defaultQueueOptions);
export const cmsSyncMediaQueue = new Queue(CMS_SYNC_MEDIA_QUEUE_NAME, defaultQueueOptions);
export const remindersQueue = new Queue(REMINDERS_QUEUE_NAME, defaultQueueOptions);
export const notificationsQueue = new Queue(NOTIFICATIONS_QUEUE_NAME, defaultQueueOptions);
export const integrationWebhookQueue = new Queue(INTEGRATION_WEBHOOK_QUEUE_NAME, defaultQueueOptions);

// Prevent unhandled error events during Redis downtime
const queues = [
  smsQueue,
  analyticsQueue,
  cmsSyncMediaQueue,
  remindersQueue,
  notificationsQueue,
  integrationWebhookQueue,
];
for (const queue of queues) {
  if (queue && typeof queue.on === 'function') {
    queue.on('error', (err) => {
      logger.warn({ msg: `BullMQ Queue error on ${queue.name}`, error: err instanceof Error ? err.message : String(err) });
    });
  }
}

export const closeQueues = async (): Promise<void> => {
  await Promise.allSettled(
    queues.map((q) => (q && typeof q.close === 'function' ? q.close() : Promise.resolve()))
  );
};
