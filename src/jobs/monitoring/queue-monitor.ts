import { smsQueue } from '../queues';
import { Metrics } from '../../common/metrics/metrics';
import logger from '../../config/logger';

export async function monitorQueueDepths() {
  try {
    const smsCount = await smsQueue.getWaitingCount();

    Metrics.recordQueueDepth('sms-notifications', smsCount);

    if (smsCount > 1000) {
      logger.warn({ smsCount }, 'High queue depth detected');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to monitor queue depths');
  }
}

// Start monitoring interval
if (process.env.NODE_ENV !== 'test') {
  setInterval(monitorQueueDepths, 60000); // Every minute
}
