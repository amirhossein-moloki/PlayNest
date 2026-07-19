import { smsWorker } from './sms.worker';
import { analyticsWorker } from './analytics.worker';
import { cmsSyncMediaWorker } from './cmsSyncMedia.worker';
import logger from '../../config/logger';
import '../monitoring/queue-monitor';

export const initWorkers = () => {
  logger.info('Initializing BullMQ workers...');

  smsWorker.on('ready', () => logger.info('SMS Worker ready'));
  analyticsWorker.on('ready', () => logger.info('Analytics Worker ready'));
  cmsSyncMediaWorker.on('ready', () => logger.info('CMS Sync Media Worker ready'));

  // Workers start automatically upon instantiation,
  // but we export this to ensure they are loaded.
};
