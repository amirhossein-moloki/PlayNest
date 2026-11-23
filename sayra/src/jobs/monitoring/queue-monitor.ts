import { smsQueue, analyticsQueue } from '../queues';
import { Metrics } from '../../common/metrics/metrics';
import logger from '../../config/logger';

export async function monitorQueueDepths() {
  try {
    const smsCount = await smsQueue.getWaitingCount();
    const analyticsCount = await analyticsQueue.getWaitingCount();

    Metrics.recordQueueDepth('sms-notifications', smsCount);
    Metrics.recordQueueDepth('analytics-sync', analyticsCount);

    if (smsCount > 1000 || analyticsCount > 1000) {
      logger.warn({ smsCount, analyticsCount }, 'High queue depth detected');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to monitor queue depths');
  }
}

let monitorIntervalHandle: NodeJS.Timeout | null = null;

export function startQueueMonitor(intervalMs = 60000): void {
  if (process.env.NODE_ENV === 'test' || monitorIntervalHandle) {
    return;
  }
  monitorIntervalHandle = setInterval(() => {
    void monitorQueueDepths();
  }, intervalMs);
  if (typeof monitorIntervalHandle.unref === 'function') {
    monitorIntervalHandle.unref();
  }
}

export function stopQueueMonitor(): void {
  if (monitorIntervalHandle) {
    clearInterval(monitorIntervalHandle);
    monitorIntervalHandle = null;
  }
}
