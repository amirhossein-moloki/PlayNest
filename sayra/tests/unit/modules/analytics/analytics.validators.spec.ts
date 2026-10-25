import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: prismaMock,
}));

import { AnalyticsQuerySchema, resolveTimezoneAndBoundaries } from '../../../../src/modules/analytics/analytics.validators';

/* eslint-disable @typescript-eslint/no-explicit-any */

const settingsMock = prismaMock.settings as any;

describe('Analytics Validators & Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AnalyticsQuerySchema', () => {
    it('should validate valid start and end dates', () => {
      const input = {
        query: {
          startDate: '2026-01-01',
          endDate: '2026-01-15',
          currency: 'IRR',
        },
      };

      const parsed = AnalyticsQuerySchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.query.currency).toBe('IRR');
      }
    });

    it('should reject when startDate is greater than endDate', () => {
      const input = {
        query: {
          startDate: '2026-02-01',
          endDate: '2026-01-01',
        },
      };

      const parsed = AnalyticsQuerySchema.safeParse(input);
      expect(parsed.success).toBe(false);
    });

    it('should reject when date range exceeds 365 days', () => {
      const input = {
        query: {
          startDate: '2025-01-01',
          endDate: '2026-06-01',
        },
      };

      const parsed = AnalyticsQuerySchema.safeParse(input);
      expect(parsed.success).toBe(false);
    });
  });

  describe('resolveTimezoneAndBoundaries', () => {
    it('should convert local date boundaries to UTC based on configured site timezone', async () => {
      settingsMock.findUnique.mockResolvedValue({
        timeZone: 'Asia/Tehran',
      });

      const startDate = new Date('2026-01-01T00:00:00Z');
      const endDate = new Date('2026-01-02T00:00:00Z');

      const result = await resolveTimezoneAndBoundaries('gc-1', startDate, endDate);

      expect(result.timeZone).toBe('Asia/Tehran');
      expect(result.dayStart).toBeInstanceOf(Date);
      expect(result.dayEnd).toBeInstanceOf(Date);
      expect(result.dayEnd.getTime()).toBeGreaterThan(result.dayStart.getTime());
    });

    it('should default to UTC if settings timeZone is absent', async () => {
      settingsMock.findUnique.mockResolvedValue(null);

      const startDate = new Date('2026-01-01T00:00:00Z');
      const endDate = new Date('2026-01-02T00:00:00Z');

      const result = await resolveTimezoneAndBoundaries('gc-1', startDate, endDate);

      expect(result.timeZone).toBe('UTC');
    });
  });
});
