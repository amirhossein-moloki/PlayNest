import { Worker, Job } from 'bullmq';
import { REMINDERS_QUEUE_NAME } from '../queues';
import { env } from '../../config/env';
import logger from '../../config/logger';
import { requestContext } from '../../common/context/request-context';
import { Metrics } from '../../common/metrics/metrics';
import { processReservationRemindersBatch } from '../../modules/reservation/reservation.reminders';
import { NotificationStation } from '../../modules/notifications/notifications.station';
import { ReservationReminderJobData } from '../producers/reservationReminders.producer';

export class ReservationRemindersWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private processing = false;
  private pollIntervalMs: number;
  private batchSize: number;
  private leadTimeMinutes: number;
  private enabled: boolean;
  public bullWorker: Worker<ReservationReminderJobData> | null = null;

  constructor(options?: {
    pollIntervalMs?: number;
    batchSize?: number;
    leadTimeMinutes?: number;
    enabled?: boolean;
  }) {
    this.pollIntervalMs = options?.pollIntervalMs ?? env.RESERVATION_REMINDER_POLL_INTERVAL_MS;
    this.batchSize = options?.batchSize ?? env.RESERVATION_REMINDER_BATCH_SIZE;
    this.leadTimeMinutes = options?.leadTimeMinutes ?? env.RESERVATION_REMINDER_LEAD_TIME_MINUTES;
    this.enabled = options?.enabled ?? env.RESERVATION_REMINDER_ENABLED;
  }

  public start(): void {
    if (this.running) return;

    if (!this.enabled) {
      logger.info('Reservation Reminders Worker is disabled via configuration.');
      return;
    }

    this.running = true;
    logger.info({
      msg: 'Reservation Reminders Worker started',
      pollIntervalMs: this.pollIntervalMs,
      batchSize: this.batchSize,
      leadTimeMinutes: this.leadTimeMinutes,
    });

    try {
      this.bullWorker = new Worker<ReservationReminderJobData>(
        REMINDERS_QUEUE_NAME,
        async (job: Job<ReservationReminderJobData>) => {
          const { reservationId, correlationId } = job.data;
          return requestContext.run({ correlationId, requestId: job.id }, async () => {
            logger.info({ msg: 'Processing reminder job via BullMQ', jobId: job.id, reservationId });
            await this.tick();
          });
        },
        {
          connection: { url: env.REDIS_URL },
        }
      );

      this.bullWorker.on('completed', (job) => {
        logger.info({ msg: 'Reminder job completed', jobId: job.id });
      });

      this.bullWorker.on('failed', (job, err) => {
        logger.error({ msg: 'Reminder job failed', jobId: job?.id, error: err });
      });
    } catch (err) {
      logger.warn({ msg: 'BullMQ queue connection warning in Reminders Worker', error: err });
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

    logger.info('Reservation Reminders Worker stopped.');
  }

  public isRunning(): boolean {
    return this.running;
  }

  public async tick(now?: Date) {
    if (this.processing) {
      return { candidateCount: 0, scheduledCount: 0, skippedCount: 0, outboxProcessed: 0 };
    }
    this.processing = true;

    try {
      const reminderResult = await processReservationRemindersBatch({
        leadTimeMinutes: this.leadTimeMinutes,
        batchSize: this.batchSize,
        now,
      });

      const outboxResult = await NotificationStation.processPendingNotificationLogs(
        this.batchSize,
        now
      );

      if (reminderResult.scheduledCount > 0 || outboxResult.processed > 0) {
        logger.info({
          msg: 'Reservation reminders tick completed',
          candidateCount: reminderResult.candidateCount,
          scheduledCount: reminderResult.scheduledCount,
          skippedCount: reminderResult.skippedCount,
          outboxProcessed: outboxResult.processed,
          outboxSuccess: outboxResult.success,
          outboxFailed: outboxResult.failed,
        });
      }

      return {
        ...reminderResult,
        outboxProcessed: outboxResult.processed,
      };
    } catch (error) {
      Metrics.recordWorkerError(
        REMINDERS_QUEUE_NAME,
        error instanceof Error ? error.message : String(error)
      );
      logger.error({
        msg: 'Error during reservation reminders worker tick',
        error,
      });
      return { candidateCount: 0, scheduledCount: 0, skippedCount: 0, outboxProcessed: 0 };
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

export const reservationRemindersWorker = new ReservationRemindersWorker();
