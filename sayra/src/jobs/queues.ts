import { Queue } from 'bullmq';
import { defaultQueueOptions } from '../config/bullmq';

export const SMS_QUEUE_NAME = 'sms-notifications';
export const ANALYTICS_QUEUE_NAME = 'analytics-sync';
export const CMS_SYNC_MEDIA_QUEUE_NAME = 'cms-sync-media';

export const smsQueue = new Queue(SMS_QUEUE_NAME, defaultQueueOptions);
export const analyticsQueue = new Queue(ANALYTICS_QUEUE_NAME, defaultQueueOptions);
export const cmsSyncMediaQueue = new Queue(CMS_SYNC_MEDIA_QUEUE_NAME, defaultQueueOptions);
