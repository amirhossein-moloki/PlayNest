/* eslint-disable @typescript-eslint/no-explicit-any */
import logger from '../../config/logger';
import { prisma } from '../../config/prisma';
import { runWithSystemContext } from '../../common/context/request-context';

export class AdvertisementExpiryWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private processing = false;
  private pollIntervalMs: number;
  private batchSize: number;
  private enabled: boolean;

  constructor(options?: { pollIntervalMs?: number; batchSize?: number; enabled?: boolean }) {
    this.pollIntervalMs = options?.pollIntervalMs ?? 30000;
    this.batchSize = options?.batchSize ?? 100;
    this.enabled = options?.enabled ?? true;
  }

  public start(): void {
    if (this.running) return;

    if (!this.enabled) {
      logger.info('Advertisement Expiry Worker is disabled via configuration.');
      return;
    }

    this.running = true;
    logger.info({
      msg: 'Advertisement Expiry Worker started',
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

    logger.info('Advertisement Expiry Worker stopped.');
  }

  public isRunning(): boolean {
    return this.running;
  }

  public async tick(now: Date = new Date()) {
    if (this.processing) return { activatedCount: 0, expiredCount: 0, errorCount: 0 };
    this.processing = true;

    const result = {
      activatedCount: 0,
      expiredCount: 0,
      errorCount: 0,
    };

    try {
      return await runWithSystemContext('AdvertisementExpiryWorker', async () => {
        // 1. Activate approved ads whose startDate has arrived
        const toActivate = await (prisma as any).advertisementRequest.findMany({
          where: {
            status: 'APPROVED',
            deletedAt: null,
            startDate: { lte: now },
            OR: [
              { endDate: null },
              { endDate: { gte: now } },
            ],
          },
          take: this.batchSize,
          select: { id: true },
        });

        if (toActivate.length > 0) {
          const ids = toActivate.map((a: { id: string }) => a.id);
          const updateRes = await (prisma as any).advertisementRequest.updateMany({
            where: { id: { in: ids } },
            data: { status: 'ACTIVE' },
          });
          result.activatedCount = updateRes.count;
        }

        // 2. Expire active or approved ads whose endDate has passed
        const toExpire = await (prisma as any).advertisementRequest.findMany({
          where: {
            status: { in: ['APPROVED', 'ACTIVE'] },
            deletedAt: null,
            endDate: { lt: now },
          },
          take: this.batchSize,
          select: { id: true },
        });

        if (toExpire.length > 0) {
          const ids = toExpire.map((a: { id: string }) => a.id);
          const updateRes = await (prisma as any).advertisementRequest.updateMany({
            where: { id: { in: ids } },
            data: { status: 'EXPIRED' },
          });
          result.expiredCount = updateRes.count;
        }

        if (result.activatedCount > 0 || result.expiredCount > 0) {
          logger.info({
            msg: 'Advertisement lifecycle tick completed',
            ...result,
          });
        }

        return result;
      });
    } catch (error) {
      result.errorCount++;
      logger.error({ msg: 'Error during advertisement expiry worker tick', error });
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

export const advertisementExpiryWorker = new AdvertisementExpiryWorker();
