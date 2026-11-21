import { notificationsQueue } from '../queues';
import { getRequestContext } from '../../common/context/request-context';
import logger from '../../config/logger';

export interface NotificationJobData {
  logId: string;
  correlationId?: string;
}

export const queueNotificationDispatch = async (logId: string, delayMs = 0): Promise<boolean> => {
  try {
    const context = getRequestContext();
    await notificationsQueue.add(
      'dispatch-notification',
      {
        logId,
        correlationId: context.correlationId,
      },
      {
        jobId: `notif:${logId}`,
        delay: delayMs > 0 ? delayMs : undefined,
      }
    );
    return true;
  } catch (error) {
    logger.warn({
      msg: 'Failed to enqueue notification job to BullMQ (falling back to transactional outbox recovery)',
      logId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};
