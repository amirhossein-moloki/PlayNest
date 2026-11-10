import logger from '../../config/logger';
import { env } from '../../config/env';
import { BookingHoldRepo } from '../../modules/booking-hold/booking-hold.repo';
import { BookingHoldStatus, PaymentStatus } from '@prisma/client';
import { runWithSystemContext } from '../../common/context/request-context';

export class BookingHoldExpiryWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private processing = false;
  private pollIntervalMs: number;
  private batchSize: number;
  private enabled: boolean;

  constructor(options?: { pollIntervalMs?: number; batchSize?: number; enabled?: boolean }) {
    this.pollIntervalMs = options?.pollIntervalMs ?? (env.RESERVATION_EXPIRY_POLL_INTERVAL_MS || 10000);
    this.batchSize = options?.batchSize ?? (env.RESERVATION_EXPIRY_BATCH_SIZE || 50);
    this.enabled = options?.enabled ?? true;
  }

  public start(): void {
    if (this.running) return;

    if (!this.enabled) {
      logger.info('Booking Hold Expiry Worker is disabled via configuration.');
      return;
    }

    this.running = true;
    logger.info({
      msg: 'Booking Hold Expiry Worker started',
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

    logger.info('Booking Hold Expiry Worker stopped.');
  }

  public isRunning(): boolean {
    return this.running;
  }

  public async tick(now: Date = new Date()) {
    if (this.processing) return { candidatesFound: 0, expiredCount: 0, skippedCount: 0, failedCount: 0 };
    this.processing = true;

    const result = {
      candidatesFound: 0,
      expiredCount: 0,
      skippedCount: 0,
      failedCount: 0,
    };

    try {
      return await runWithSystemContext('BookingHoldExpiryWorker', async () => {
        const candidates = await BookingHoldRepo.findExpiredActiveHolds(now, this.batchSize);
        result.candidatesFound = candidates.length;

        for (const hold of candidates) {
          try {
            await BookingHoldRepo.transaction(async (tx) => {
              // 1. Lock hold row
              const lockedHold = await BookingHoldRepo.findHoldForUpdate(hold.id, tx);
              if (!lockedHold || lockedHold.status !== BookingHoldStatus.ACTIVE) {
                result.skippedCount++;
                return;
              }

              // Double-check: Never expire hold if payment is PAID
              if (lockedHold.payment && lockedHold.payment.status === PaymentStatus.PAID) {
                result.skippedCount++;
                return;
              }

              // 2. Mark hold EXPIRED
              await tx.bookingHold.update({
                where: { id: lockedHold.id },
                data: { status: BookingHoldStatus.EXPIRED },
              });

              // 3. Mark unpaid payment FAILED/CANCELED if exists
              if (lockedHold.payment && lockedHold.payment.status !== PaymentStatus.PAID) {
                await tx.payment.update({
                  where: { id: lockedHold.payment.id },
                  data: {
                    status: PaymentStatus.CANCELED,
                    failureReason: 'Booking hold expired before payment completion',
                  },
                });
              }

              result.expiredCount++;
            });
          } catch (itemError) {
            result.failedCount++;
            logger.error({ msg: 'Failed to expire booking hold', holdId: hold.id, error: itemError });
          }
        }

        if (result.candidatesFound > 0) {
          logger.info({
            msg: 'Booking hold expiry tick completed',
            ...result,
          });
        }

        return result;
      });
    } catch (error) {
      logger.error({ msg: 'Error during booking hold expiry worker tick', error });
      return result;
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

export const bookingHoldExpiryWorker = new BookingHoldExpiryWorker();
