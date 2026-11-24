import { integrationWebhookQueue } from '../queues';
import { getRequestContext } from '../../common/context/request-context';
import logger from '../../config/logger';

export interface IntegrationWebhookJobData {
  outboxEventId: string;
  correlationId?: string;
}

export const queueIntegrationWebhookDispatch = async (
  outboxEventId: string,
  delayMs = 0
): Promise<boolean> => {
  try {
    const context = getRequestContext();
    await integrationWebhookQueue.add(
      'dispatch-integration-webhook',
      {
        outboxEventId,
        correlationId: context.correlationId,
      },
      {
        jobId: `integration-webhook:${outboxEventId}`,
        delay: delayMs > 0 ? delayMs : undefined,
      }
    );
    return true;
  } catch (error) {
    logger.warn({
      msg: 'Failed to enqueue integration webhook job to BullMQ',
      outboxEventId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};
