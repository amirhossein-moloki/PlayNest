/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../../config/prisma';
import logger from '../../config/logger';

export const ANALYTICS_ENTITIES = [
  'Tenant',
  'Customer',
  'Station',
  'Reservation',
  'GamingSession',
  'Payment',
  'LedgerEntry',
  'Refund',
] as const;

export type AnalyticsEntity = (typeof ANALYTICS_ENTITIES)[number];

export interface IngestionOptions {
  lookbackMinutes?: number;
  batchSize?: number;
}

export class AnalyticsIngestionService {
  private defaultLookbackMinutes = 120; // 2 hours
  private defaultBatchSize = 500;

  /**
   * Get or initialize the watermark for a given entity.
   */
  async getWatermark(entity: AnalyticsEntity): Promise<Date> {
    const watermark = await (prisma as any).analyticsWatermark.findUnique({
      where: { entity },
    });

    if (watermark) {
      return watermark.lastIngestedAt;
    }

    const initialDate = new Date('1970-01-01T00:00:00.000Z');
    await (prisma as any).analyticsWatermark.create({
      data: {
        entity,
        lastIngestedAt: initialDate,
      },
    });

    return initialDate;
  }

  /**
   * Update the watermark for a given entity.
   */
  async updateWatermark(entity: AnalyticsEntity, newWatermark: Date, lastSourceId?: string): Promise<void> {
    await (prisma as any).analyticsWatermark.upsert({
      where: { entity },
      update: {
        lastIngestedAt: newWatermark,
        lastSourceId: lastSourceId || null,
      },
      create: {
        entity,
        lastIngestedAt: newWatermark,
        lastSourceId: lastSourceId || null,
      },
    });
  }

  /**
   * Execute an ingestion cycle for all entities in dependency order.
   */
  async runIngestionCycle(options?: IngestionOptions): Promise<Record<string, { recordsRead: number; recordsIngested: number; status: string }>> {
    const results: Record<string, { recordsRead: number; recordsIngested: number; status: string }> = {};

    for (const entity of ANALYTICS_ENTITIES) {
      try {
        const stats = await this.ingestEntity(entity, options);
        results[entity] = { ...stats, status: 'SUCCESS' };
      } catch (error: unknown) {
        logger.error({ error, entity }, `Analytics ingestion failed for entity ${entity}`);
        results[entity] = { recordsRead: 0, recordsIngested: 0, status: 'FAILED' };
      }
    }

    return results;
  }

  /**
   * Ingest changes for a single entity incrementally using chunked batch pagination.
   */
  async ingestEntity(entity: AnalyticsEntity, options?: IngestionOptions) {
    const startTime = Date.now();
    const lookback = options?.lookbackMinutes ?? this.defaultLookbackMinutes;
    const batchSize = options?.batchSize ?? this.defaultBatchSize;
    const watermarkBefore = await this.getWatermark(entity);

    // Apply lookback window
    const searchCutoff = new Date(watermarkBefore.getTime() - lookback * 60 * 1000);

    const run = await (prisma as any).analyticsIngestionRun.create({
      data: {
        entity,
        status: 'IN_PROGRESS',
        watermarkBefore,
        startedAt: new Date(),
      },
    });

    let recordsRead = 0;
    let recordsIngested = 0;
    let maxUpdatedAt = watermarkBefore;
    let lastCursorId: string | undefined = undefined;
    let hasMore = true;

    try {
      while (hasMore) {
        let batch: any[] = [];

        const cursorOptions = lastCursorId ? { cursor: { id: lastCursorId }, skip: 1 } : {};

        switch (entity) {
        case 'Tenant': {
          batch = await (prisma as any).gamingCenter.findMany({
            where: { updatedAt: { gte: searchCutoff } },
            orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
            ...cursorOptions,
            take: batchSize,
          });
          break;
        }
        case 'Customer': {
          batch = await (prisma as any).customerAccount.findMany({
            where: { updatedAt: { gte: searchCutoff } },
            include: { profiles: true },
            orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
            ...cursorOptions,
            take: batchSize,
          });
          break;
        }
        case 'Station': {
          batch = await (prisma as any).gameStation.findMany({
            where: { updatedAt: { gte: searchCutoff } },
            orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
            ...cursorOptions,
            take: batchSize,
          });
          break;
        }
        case 'Reservation': {
          batch = await (prisma as any).reservation.findMany({
            where: { updatedAt: { gte: searchCutoff } },
            orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
            ...cursorOptions,
            take: batchSize,
          });
          break;
        }
        case 'GamingSession': {
          batch = await (prisma as any).gamingSession.findMany({
            where: { updatedAt: { gte: searchCutoff } },
            include: { reservation: true },
            orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
            ...cursorOptions,
            take: batchSize,
          });
          break;
        }
        case 'Payment': {
          batch = await (prisma as any).payment.findMany({
            where: { updatedAt: { gte: searchCutoff } },
            orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
            ...cursorOptions,
            take: batchSize,
          });
          break;
        }
        case 'LedgerEntry': {
          batch = await (prisma as any).ledgerEntry.findMany({
            where: { createdAt: { gte: searchCutoff } },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            ...cursorOptions,
            take: batchSize,
          });
          break;
        }
        case 'Refund': {
          batch = await (prisma as any).refund.findMany({
            where: { updatedAt: { gte: searchCutoff } },
            orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
            ...cursorOptions,
            take: batchSize,
          });
          break;
        }
        }

        if (!batch || batch.length === 0) {
          hasMore = false;
          break;
        }

        recordsRead += batch.length;
        lastCursorId = batch[batch.length - 1].id;

        for (const item of batch) {
          const itemUpdated = item.updatedAt || item.createdAt;
          if (itemUpdated > maxUpdatedAt) {
            maxUpdatedAt = itemUpdated;
          }

          switch (entity) {
          case 'Tenant':
            await (prisma as any).analyticsTenant.upsert({
              where: { id: item.id },
              update: {
                name: item.name,
                slug: item.slug,
                isActive: item.isActive,
                pcCount: item.pcCount,
                consoleCount: item.consoleCount,
                hourlyRate: item.hourlyRate,
                sourceUpdatedAt: item.updatedAt,
                ingestedAt: new Date(),
              },
              create: {
                id: item.id,
                name: item.name,
                slug: item.slug,
                isActive: item.isActive,
                pcCount: item.pcCount,
                consoleCount: item.consoleCount,
                hourlyRate: item.hourlyRate,
                sourceCreatedAt: item.createdAt,
                sourceUpdatedAt: item.updatedAt,
              },
            });
            break;

          case 'Customer': {
            const primaryTenantId = item.profiles?.[0]?.gamingCenterId || null;
            await (prisma as any).analyticsCustomer.upsert({
              where: { id: item.id },
              update: {
                gamingCenterId: primaryTenantId,
                phone: item.phone,
                fullName: item.fullName,
                walletBalance: item.walletBalance,
                sourceUpdatedAt: item.updatedAt,
                ingestedAt: new Date(),
              },
              create: {
                id: item.id,
                gamingCenterId: primaryTenantId,
                phone: item.phone,
                fullName: item.fullName,
                walletBalance: item.walletBalance,
                sourceCreatedAt: item.createdAt,
                sourceUpdatedAt: item.updatedAt,
              },
            });
            break;
          }

          case 'Station':
            await (prisma as any).analyticsStation.upsert({
              where: { id: item.id },
              update: {
                gamingCenterId: item.gamingCenterId,
                name: item.name,
                stationType: item.stationType,
                isVip: item.isVip,
                hourlyPrice: item.hourlyPrice,
                isActive: item.isActive,
                sourceUpdatedAt: item.updatedAt,
                ingestedAt: new Date(),
              },
              create: {
                id: item.id,
                gamingCenterId: item.gamingCenterId,
                name: item.name,
                stationType: item.stationType,
                isVip: item.isVip,
                hourlyPrice: item.hourlyPrice,
                isActive: item.isActive,
                sourceCreatedAt: item.createdAt,
                sourceUpdatedAt: item.updatedAt,
              },
            });
            break;

          case 'Reservation':
            await (prisma as any).analyticsReservation.upsert({
              where: { id: item.id },
              update: {
                gamingCenterId: item.gamingCenterId,
                customerAccountId: item.customerAccountId,
                stationId: item.stationId,
                startTime: item.startTime,
                endTime: item.endTime,
                totalHours: item.totalHours,
                totalPrice: item.totalPrice,
                discountAmount: item.discountAmount,
                paymentState: item.paymentState,
                status: item.status,
                source: item.source,
                sourceUpdatedAt: item.updatedAt,
                ingestedAt: new Date(),
              },
              create: {
                id: item.id,
                gamingCenterId: item.gamingCenterId,
                customerAccountId: item.customerAccountId,
                stationId: item.stationId,
                startTime: item.startTime,
                endTime: item.endTime,
                totalHours: item.totalHours,
                totalPrice: item.totalPrice,
                discountAmount: item.discountAmount,
                paymentState: item.paymentState,
                status: item.status,
                source: item.source,
                sourceCreatedAt: item.createdAt,
                sourceUpdatedAt: item.updatedAt,
              },
            });
            break;

          case 'GamingSession':
            await (prisma as any).analyticsGamingSession.upsert({
              where: { id: item.id },
              update: {
                gamingCenterId: item.reservation?.gamingCenterId || null,
                reservationId: item.reservationId,
                stationId: item.stationId,
                startTime: item.startTime,
                endTime: item.endTime,
                actualHours: item.actualHours,
                status: item.status,
                pausedMinutes: item.pausedMinutes,
                sourceUpdatedAt: item.updatedAt,
                ingestedAt: new Date(),
              },
              create: {
                id: item.id,
                gamingCenterId: item.reservation?.gamingCenterId || null,
                reservationId: item.reservationId,
                stationId: item.stationId,
                startTime: item.startTime,
                endTime: item.endTime,
                actualHours: item.actualHours,
                status: item.status,
                pausedMinutes: item.pausedMinutes,
                sourceCreatedAt: item.createdAt,
                sourceUpdatedAt: item.updatedAt,
              },
            });
            break;

          case 'Payment':
            await (prisma as any).analyticsPayment.upsert({
              where: { id: item.id },
              update: {
                gamingCenterId: item.gamingCenterId,
                reservationId: item.reservationId,
                amount: item.amount,
                currency: item.currency,
                provider: item.provider,
                status: item.status,
                method: item.method,
                paidAt: item.paidAt,
                sourceUpdatedAt: item.updatedAt,
                ingestedAt: new Date(),
              },
              create: {
                id: item.id,
                gamingCenterId: item.gamingCenterId,
                reservationId: item.reservationId,
                amount: item.amount,
                currency: item.currency,
                provider: item.provider,
                status: item.status,
                method: item.method,
                paidAt: item.paidAt,
                sourceCreatedAt: item.createdAt,
                sourceUpdatedAt: item.updatedAt,
              },
            });
            break;

          case 'LedgerEntry':
            await (prisma as any).analyticsLedgerEntry.upsert({
              where: { id: item.id },
              update: {
                gamingCenterId: item.gamingCenterId,
                paymentId: item.paymentId,
                refundId: item.refundId,
                entryType: item.entryType,
                amount: item.amount,
                currency: item.currency,
                ingestedAt: new Date(),
              },
              create: {
                id: item.id,
                gamingCenterId: item.gamingCenterId,
                paymentId: item.paymentId,
                refundId: item.refundId,
                entryType: item.entryType,
                amount: item.amount,
                currency: item.currency,
                sourceCreatedAt: item.createdAt,
              },
            });
            break;

          case 'Refund':
            await (prisma as any).analyticsRefund.upsert({
              where: { id: item.id },
              update: {
                gamingCenterId: item.gamingCenterId,
                paymentId: item.paymentId,
                amount: item.amount,
                currency: item.currency,
                status: item.status,
                processedAt: item.processedAt,
                sourceUpdatedAt: item.updatedAt,
                ingestedAt: new Date(),
              },
              create: {
                id: item.id,
                gamingCenterId: item.gamingCenterId,
                paymentId: item.paymentId,
                amount: item.amount,
                currency: item.currency,
                status: item.status,
                processedAt: item.processedAt,
                sourceCreatedAt: item.createdAt,
                sourceUpdatedAt: item.updatedAt,
              },
            });
            break;
          }

          recordsIngested++;
        }

        if (batch.length < batchSize) {
          hasMore = false;
        }
      }

      // Advance watermark if new data was processed
      if (maxUpdatedAt > watermarkBefore) {
        await this.updateWatermark(entity, maxUpdatedAt);
      }

      const durationMs = Date.now() - startTime;
      await (prisma as any).analyticsIngestionRun.update({
        where: { id: run.id },
        data: {
          status: 'SUCCESS',
          completedAt: new Date(),
          recordsRead,
          recordsIngested,
          durationMs,
          watermarkAfter: maxUpdatedAt > watermarkBefore ? maxUpdatedAt : watermarkBefore,
        },
      });

      return { recordsRead, recordsIngested };
    } catch (error: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      await (prisma as any).analyticsIngestionRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          recordsRead,
          recordsIngested,
          durationMs,
          errorMessage,
        },
      });
      throw error;
    }
  }
}

export const analyticsIngestionService = new AnalyticsIngestionService();
