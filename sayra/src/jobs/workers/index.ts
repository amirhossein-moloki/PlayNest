import { smsWorker } from './sms.worker';
import { notificationsWorker } from './notifications.worker';
import { analyticsWorker } from './analytics.worker';
import { analyticsIngestionWorker } from './analyticsIngestion.worker';
import { cmsSyncMediaWorker } from './cmsSyncMedia.worker';
import { reservationExpiryWorker } from './reservationExpiry.worker';
import { waitlistExpiryWorker } from './waitlistExpiry.worker';
import { bookingHoldExpiryWorker } from './bookingHoldExpiry.worker';
import { advertisementExpiryWorker } from './advertisementExpiry.worker';
import { reservationRemindersWorker } from './reservationReminders.worker';
import logger from '../../config/logger';
import { startQueueMonitor, stopQueueMonitor } from '../monitoring/queue-monitor';

let workersInitialized = false;

export const initWorkers = () => {
  if (workersInitialized) return;
  workersInitialized = true;

  logger.info('Initializing background workers...');

  smsWorker.on('ready', () => logger.info('SMS Worker ready'));
  notificationsWorker.on('ready', () => logger.info('Notifications Worker ready'));
  analyticsWorker.on('ready', () => logger.info('Analytics Worker ready'));
  analyticsIngestionWorker.on('ready', () => logger.info('Analytics Ingestion Worker ready'));
  cmsSyncMediaWorker.on('ready', () => logger.info('CMS Sync Media Worker ready'));

  reservationRemindersWorker.start();
  reservationExpiryWorker.start();
  waitlistExpiryWorker.start();
  bookingHoldExpiryWorker.start();
  advertisementExpiryWorker.start();
  startQueueMonitor();
};

export const stopWorkers = async () => {
  workersInitialized = false;
  stopQueueMonitor();
  await Promise.allSettled([
    advertisementExpiryWorker.stop(),
    reservationExpiryWorker.stop(),
    reservationRemindersWorker.stop(),
    waitlistExpiryWorker.stop(),
    bookingHoldExpiryWorker.stop(),
    notificationsWorker.close(),
    smsWorker.close(),
    analyticsWorker.close(),
    analyticsIngestionWorker.close(),
    cmsSyncMediaWorker.close(),
  ]);
};
