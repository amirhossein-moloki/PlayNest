import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { prismaMock } from '../mocks/prisma';
import { AnalyticsIngestionService } from '../../src/modules/analytics/analyticsIngestionService';

describe('AnalyticsIngestionService Unit Tests', () => {
  let service: AnalyticsIngestionService;

  beforeEach(() => {
    service = new AnalyticsIngestionService();
    jest.clearAllMocks();
  });

  describe('getWatermark', () => {
    it('should return existing watermark if present in DB', async () => {
      const mockDate = new Date('2026-01-01T00:00:00.000Z');
      (prismaMock as any).analyticsWatermark.findUnique.mockResolvedValue({
        entity: 'Reservation',
        lastIngestedAt: mockDate,
      });

      const result = await service.getWatermark('Reservation');
      expect(result).toEqual(mockDate);
      expect((prismaMock as any).analyticsWatermark.findUnique).toHaveBeenCalledWith({
        where: { entity: 'Reservation' },
      });
    });

    it('should initialize default epoch watermark if absent in DB', async () => {
      (prismaMock as any).analyticsWatermark.findUnique.mockResolvedValue(null);
      (prismaMock as any).analyticsWatermark.create.mockResolvedValue({
        entity: 'Reservation',
        lastIngestedAt: new Date('1970-01-01T00:00:00.000Z'),
      });

      const result = await service.getWatermark('Reservation');
      expect(result.toISOString()).toBe('1970-01-01T00:00:00.000Z');
      expect((prismaMock as any).analyticsWatermark.create).toHaveBeenCalled();
    });
  });

  describe('updateWatermark', () => {
    it('should upsert the watermark timestamp and source ID idempotently', async () => {
      const newWatermark = new Date('2026-12-10T12:00:00.000Z');
      (prismaMock as any).analyticsWatermark.upsert.mockResolvedValue({});

      await service.updateWatermark('Reservation', newWatermark, 'res_123');

      expect((prismaMock as any).analyticsWatermark.upsert).toHaveBeenCalledWith({
        where: { entity: 'Reservation' },
        update: {
          lastIngestedAt: newWatermark,
          lastSourceId: 'res_123',
        },
        create: {
          entity: 'Reservation',
          lastIngestedAt: newWatermark,
          lastSourceId: 'res_123',
        },
      });
    });
  });

  describe('ingestEntity - Reservation', () => {
    it('should query reservations within lookback window and upsert records into AnalyticsReservation', async () => {
      const mockWatermark = new Date('2026-12-10T10:00:00.000Z');
      (prismaMock as any).analyticsWatermark.findUnique.mockResolvedValue({
        entity: 'Reservation',
        lastIngestedAt: mockWatermark,
      });

      (prismaMock as any).analyticsIngestionRun.create.mockResolvedValue({ id: 'run_1' });
      (prismaMock as any).analyticsIngestionRun.update.mockResolvedValue({});

      const mockSourceReservation = {
        id: 'res_001',
        gamingCenterId: 'gc_001',
        customerAccountId: 'cust_001',
        stationId: 'st_001',
        startTime: new Date('2026-12-10T11:00:00.000Z'),
        endTime: new Date('2026-12-10T12:00:00.000Z'),
        totalHours: 1.0,
        totalPrice: 100,
        discountAmount: 0,
        paymentState: 'PAID',
        status: 'CONFIRMED',
        source: 'ONLINE',
        createdAt: new Date('2026-12-10T10:30:00.000Z'),
        updatedAt: new Date('2026-12-10T10:35:00.000Z'),
      };

      (prismaMock as any).reservation.findMany.mockResolvedValue([mockSourceReservation]);
      (prismaMock as any).analyticsReservation.upsert.mockResolvedValue({});
      (prismaMock as any).analyticsWatermark.upsert.mockResolvedValue({});

      const stats = await service.ingestEntity('Reservation', { lookbackMinutes: 120 });

      expect(stats).toEqual({ recordsRead: 1, recordsIngested: 1 });
      expect((prismaMock as any).analyticsReservation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res_001' },
          create: expect.objectContaining({
            id: 'res_001',
            gamingCenterId: 'gc_001',
            paymentState: 'PAID',
          }),
        })
      );
      expect((prismaMock as any).analyticsIngestionRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run_1' },
          data: expect.objectContaining({
            status: 'SUCCESS',
            recordsRead: 1,
            recordsIngested: 1,
          }),
        })
      );
    });
  });
});
