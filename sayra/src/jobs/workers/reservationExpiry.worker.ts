import logger from '../../config/logger';
import { env } from '../../config/env';
import { reservationStation } from '../../modules/reservation/reservation.station';

export class ReservationExpiryWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private processing = false;
  private pollIntervalMs: number;
  private batchSize: number;
  private enabled: boolean;

  constructor(options?: { pollIntervalMs?: number; batchSize?: number; enabled?: boolean }) {
    this.pollIntervalMs = options?.pollIntervalMs ?? env.RESERVATION_EXPIRY_POLL_INTERVAL_MS;
    this.batchSize = options?.batchSize ?? env.RESERVATION_EXPIRY_BATCH_SIZE;
    this.enabled = options?.enabled ?? env.RESERVATION_EXPIRY_ENABLED;
  }

  public start(): void {
    if (this.running) return;

    if (!this.enabled) {
      logger.info('Reservation Expiry Worker is disabled via configuration.');
      return;
    }

    this.running = true;
    logger.info({
      msg: 'Reservation Expiry Worker started',
      pollIntervalMs: this.pollIntervalMs,
      batchSize: this.batchSize,
    });

    this.scheduleNextTick(0);
  }

  public async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    while (this.processing) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    logger.info('Reservation Expiry Worker stopped.');
  }

  public isRunning(): boolean {
    return this.running;
  }

  public async tick(now?: Date) {
    if (this.processing) return { candidatesFound: 0, expiredCount: 0, skippedCount: 0, failedCount: 0 };
    this.processing = true;

    try {
      const result = await reservationStation.processExpiryBatch({
        batchSize: this.batchSize,
        now,
      });

      if (result.candidatesFound > 0) {
        logger.info({
          msg: 'Reservation expiry tick completed',
          candidatesFound: result.candidatesFound,
          expiredCount: result.expiredCount,
          skippedCount: result.skippedCount,
          failedCount: result.failedCount,
        });
      }
      return result;
    } catch (error) {
      logger.error({
        msg: 'Error during reservation expiry worker tick',
        error,
      });
      return { candidatesFound: 0, expiredCount: 0, skippedCount: 0, failedCount: 1 };
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

export const reservationExpiryWorker = new ReservationExpiryWorker();
