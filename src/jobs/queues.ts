import { Queue } from 'bullmq';
import { defaultQueueOptions } from '../config/bullmq';

export const SMS_QUEUE_NAME = 'sms-notifications';

export const smsQueue = new Queue(SMS_QUEUE_NAME, defaultQueueOptions);
