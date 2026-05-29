import { smsWorker } from './sms.worker';
import { analyticsWorker } from './analytics.worker';

export const initWorkers = () => {
  console.log('Initializing BullMQ workers...');

  smsWorker.on('ready', () => console.log('SMS Worker ready'));
  analyticsWorker.on('ready', () => console.log('Analytics Worker ready'));

  // Workers start automatically upon instantiation,
  // but we export this to ensure they are loaded.
};
