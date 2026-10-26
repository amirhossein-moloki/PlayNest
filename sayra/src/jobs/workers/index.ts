import { smsWorker } from './sms.worker';
import { analyticsWorker } from './analytics.worker';
import { analyticsIngestionWorker } from './analyticsIngestion.worker';
import { cmsSyncMediaWorker } from './cmsSyncMedia.worker';
import { reservationExpiryWorker } from './reservationExpiry.worker';
import { waitlistExpiryWorker } from './waitlistExpiry.worker';
import logger from '../../config/logger';
import '../monitoring/queue-monitor';

export const initWorkers = () => {
  logger.info('Initializing background workers...');

  smsWorker.on('ready', () => logger.info('SMS Worker ready'));
  analyticsWorker.on('ready', () => logger.info('Analytics Worker ready'));
  analyticsIngestionWorker.on('ready', () => logger.info('Analytics Ingestion Worker ready'));
  cmsSyncMediaWorker.on('ready', () => logger.info('CMS Sync Media Worker ready'));

  reservationExpiryWorker.start();
  waitlistExpiryWorker.start();
};

export const stopWorkers = async () => {
  await reservationExpiryWorker.stop();
  await waitlistExpiryWorker.stop();
  await smsWorker.close();
  await analyticsWorker.close();
  await analyticsIngestionWorker.close();
  await cmsSyncMediaWorker.close();
};
