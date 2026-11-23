import { describe, it, expect } from '@jest/globals';
import {
  getAvailabilitySchema,
  MAX_AVAILABILITY_RANGE_DAYS,
} from '../../../../src/modules/availability/availability.validators';

describe('availability.validators', () => {
  const stationId = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';

  it('allows a date range up to MAX_AVAILABILITY_RANGE_DAYS (31 days)', () => {
    const startDate = '2026-11-01T00:00:00.000Z';
    const endDate = new Date(
      new Date(startDate).getTime() + MAX_AVAILABILITY_RANGE_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const parsed = getAvailabilitySchema.safeParse({
      params: { gamingCenterSlug: 'test-center' },
      query: { stationId, startDate, endDate },
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects a 32-day range and 365-day DoS range with max range message', () => {
    const startDate = '2026-11-01T00:00:00.000Z';
    const thirtyTwoDays = new Date(
      new Date(startDate).getTime() + (MAX_AVAILABILITY_RANGE_DAYS + 1) * 24 * 60 * 60 * 1000
    ).toISOString();
    const oneYear = new Date(
      new Date(startDate).getTime() + 365 * 24 * 60 * 60 * 1000
    ).toISOString();

    for (const endDate of [thirtyTwoDays, oneYear]) {
      const parsed = getAvailabilitySchema.safeParse({
        params: { gamingCenterSlug: 'test-center' },
        query: { stationId, startDate, endDate },
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((i) => i.message.includes('cannot exceed 31 days'))).toBe(true);
      }
    }
  });

  it('rejects endDate <= startDate', () => {
    const parsed = getAvailabilitySchema.safeParse({
      params: { gamingCenterSlug: 'test-center' },
      query: {
        stationId,
        startDate: '2026-11-10T00:00:00.000Z',
        endDate: '2026-11-10T00:00:00.000Z',
      },
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message === 'End date must be after start date')).toBe(true);
    }
  });
});
