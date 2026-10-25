import logger from '../../config/logger';
import { waitlistStation } from '../../modules/waitlist/waitlist.station';

export class WaitlistExpiryWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private processing = false;
  private pollIntervalMs: number;
  private batchSize: number;

  constructor(options?: { pollIntervalMs?: number; batchSize?: number }) {
    this.pollIntervalMs = options?.pollIntervalMs ?? 60000; // default 1 min
    this.batchSize = options?.batchSize ?? 50;
  }

  public start(): void {
    if (this.running) return;

    this.running = true;
    logger.info({
      msg: 'Waitlist Expiry Worker started',
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

    logger.info('Waitlist Expiry Worker stopped.');
  }

  public isRunning(): boolean {
    return this.running;
  }

  public async tick(now?: Date) {
    if (this.processing) return { expiredOffersCount: 0, expiredEntriesCount: 0 };
    this.processing = true;

    try {
      const result = await waitlistStation.processExpiryBatch({
        batchSize: this.batchSize,
        now,
      });

      if (result.expiredOffersCount > 0 || result.expiredEntriesCount > 0) {
        logger.info({
          msg: 'Waitlist expiry tick completed',
          expiredOffersCount: result.expiredOffersCount,
          expiredEntriesCount: result.expiredEntriesCount,
        });
      }
      return result;
    } catch (error) {
      logger.error({
        msg: 'Error during waitlist expiry worker tick',
        error,
      });
      return { expiredOffersCount: 0, expiredEntriesCount: 0 };
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

export const waitlistExpiryWorker = new WaitlistExpiryWorker();
