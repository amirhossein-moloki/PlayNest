import { Job, Worker } from 'bullmq';
import { INTEGRATION_WEBHOOK_QUEUE_NAME } from '../queues';
import { env } from '../../config/env';
import logger from '../../config/logger';
import { requestContext, runWithSystemContext } from '../../common/context/request-context';
import { withDistributedLock } from '../../common/utils/distributedLock';
import { IntegrationWebhookJobData } from '../producers/integrationWebhook.producer';
import {
  dispatchOutboxEvent,
  processPendingOutboxEvents,
} from '../../modules/integrations/webhook.dispatcher';

export class IntegrationWebhookWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private processing = false;
  private pollIntervalMs: number;
  private batchSize: number;
  private enabled: boolean;
  public bullWorker: Worker<IntegrationWebhookJobData> | null = null;

  constructor(options?: {
    pollIntervalMs?: number;
    batchSize?: number;
    enabled?: boolean;
  }) {
    this.pollIntervalMs = options?.pollIntervalMs ?? env.INTEGRATION_OUTBOX_POLL_INTERVAL_MS;
    this.batchSize = options?.batchSize ?? env.INTEGRATION_OUTBOX_BATCH_SIZE;
    this.enabled = options?.enabled ?? env.INTEGRATION_OUTBOX_ENABLED;
  }

  public start(): void {
    if (this.running) return;
    if (!this.enabled) {
      logger.info('Integration Webhook Worker is disabled via configuration.');
      return;
    }

    this.running = true;
    logger.info({
      msg: 'Integration Webhook Worker started',
      pollIntervalMs: this.pollIntervalMs,
      batchSize: this.batchSize,
    });

    try {
      this.bullWorker = new Worker<IntegrationWebhookJobData>(
        INTEGRATION_WEBHOOK_QUEUE_NAME,
        async (job: Job<IntegrationWebhookJobData>) => {
          const { outboxEventId, correlationId } = job.data;
          return requestContext.run({ correlationId, requestId: job.id }, async () => {
            await dispatchOutboxEvent(outboxEventId);
          });
        },
        {
          connection: { url: env.REDIS_URL },
        }
      );

      this.bullWorker.on('failed', (job, err) => {
        logger.error({ msg: 'Integration webhook job failed', jobId: job?.id, error: err });
      });

      this.bullWorker.on('error', (err) => {
        logger.warn({
          msg: 'BullMQ Integration Webhook Worker connection warning',
          error: err instanceof Error ? err.message : String(err),
        });
      });
    } catch (err) {
      logger.warn({ msg: 'Failed to attach BullMQ Integration Webhook Worker', error: err });
    }

    this.scheduleNextTick(0);
  }

  public async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.bullWorker) {
      await this.bullWorker.close();
      this.bullWorker = null;
    }
    while (this.processing) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    logger.info('Integration Webhook Worker stopped.');
  }

  public isRunning(): boolean {
    return this.running;
  }

  public async tick(now?: Date) {
    if (this.processing) {
      return { processed: 0, delivered: 0, failed: 0, deadLetter: 0 };
    }
    this.processing = true;

    try {
      const outcome = await withDistributedLock(
        'integration-outbox-sweeper',
        Math.max(this.pollIntervalMs * 2, env.WORKER_LOCK_TTL_MS),
        async () =>
          runWithSystemContext('IntegrationWebhookWorker', async () =>
            processPendingOutboxEvents(this.batchSize, now)
          )
      );
      return outcome.acquired && outcome.result
        ? outcome.result
        : { processed: 0, delivered: 0, failed: 0, deadLetter: 0 };
    } catch (error) {
      logger.error({
        msg: 'Error during integration outbox sweeper tick',
        error,
      });
      return { processed: 0, delivered: 0, failed: 0, deadLetter: 0 };
    } finally {
      this.processing = false;
    }
  }

  private scheduleNextTick(delayMs: number): void {
    if (!this.running) return;
    this.timer = setTimeout(async () => {
      await this.tick();
      if (this.running) {
        this.scheduleNextTick(this.pollIntervalMs);
      }
    }, delayMs);
  }
}

export const integrationWebhookWorker = new IntegrationWebhookWorker();
