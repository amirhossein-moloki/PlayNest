import { describe, it, expect } from '@jest/globals';
import {
  closeForNextHoursSchema,
  createClosureSchema,
  getClosuresSchema,
  getPublicClosuresSchema,
  MAX_TEMPORARY_CLOSURE_HOURS,
  resolveClosureDurationMinutes,
} from '../../../../src/modules/closures/closures.validators';

describe('Closures Validators', () => {
  const gamingCenterId = 'gc-center-1';
  const gamingCenterSlug = 'arsha-cafe';

  describe('resolveClosureDurationMinutes', () => {
    it('returns null when no duration field is provided', () => {
      expect(resolveClosureDurationMinutes({})).toBeNull();
    });

    it('resolves hours, durationHours, minutes, and combined hours+minutes', () => {
      expect(resolveClosureDurationMinutes({ hours: 9 })).toBe(540);
      expect(resolveClosureDurationMinutes({ durationHours: 2.5 })).toBe(150);
      expect(resolveClosureDurationMinutes({ minutes: 45 })).toBe(45);
      expect(resolveClosureDurationMinutes({ hours: 1, durationMinutes: 30 })).toBe(90);
    });
  });

  describe('closeForNextHoursSchema', () => {
    it('accepts hours, durationHours, minutes, durationMinutes, and replaceActive', () => {
      expect(
        closeForNextHoursSchema.safeParse({
          params: { gamingCenterId },
          body: { hours: 9, reason: 'Private event' },
        }).success
      ).toBe(true);

      expect(
        closeForNextHoursSchema.safeParse({
          params: { gamingCenterId },
          body: { durationHours: 2.5, replaceActive: true },
        }).success
      ).toBe(true);

      expect(
        closeForNextHoursSchema.safeParse({
          params: { gamingCenterId },
          body: { hours: 1, minutes: 30 },
        }).success
      ).toBe(true);

      expect(
        closeForNextHoursSchema.safeParse({
          params: { gamingCenterId },
          body: { durationMinutes: 45 },
        }).success
      ).toBe(true);
    });

    it('rejects empty body, zero/negative durations, above max hours, and mismatched aliases', () => {
      expect(
        closeForNextHoursSchema.safeParse({
          params: { gamingCenterId },
          body: {},
        }).success
      ).toBe(false);

      expect(
        closeForNextHoursSchema.safeParse({
          params: { gamingCenterId },
          body: { hours: 0 },
        }).success
      ).toBe(false);

      expect(
        closeForNextHoursSchema.safeParse({
          params: { gamingCenterId },
          body: { hours: -1 },
        }).success
      ).toBe(false);

      expect(
        closeForNextHoursSchema.safeParse({
          params: { gamingCenterId },
          body: { hours: MAX_TEMPORARY_CLOSURE_HOURS + 1 },
        }).success
      ).toBe(false);

      expect(
        closeForNextHoursSchema.safeParse({
          params: { gamingCenterId },
          body: { hours: MAX_TEMPORARY_CLOSURE_HOURS, minutes: 1 },
        }).success
      ).toBe(false);

      expect(
        closeForNextHoursSchema.safeParse({
          params: { gamingCenterId },
          body: { hours: 2, durationHours: 3 },
        }).success
      ).toBe(false);
    });
  });

  describe('createClosureSchema', () => {
    it('accepts explicit startDate and endDate when startDate < endDate', () => {
      const result = createClosureSchema.safeParse({
        params: { gamingCenterId },
        body: {
          title: 'Holiday',
          reason: 'Public holiday',
          startDate: '2026-11-10T09:00:00.000Z',
          endDate: '2026-11-10T18:00:00.000Z',
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects explicit range when startDate >= endDate', () => {
      const result = createClosureSchema.safeParse({
        params: { gamingCenterId },
        body: {
          startDate: '2026-11-10T18:00:00.000Z',
          endDate: '2026-11-10T09:00:00.000Z',
        },
      });
      expect(result.success).toBe(false);
    });

    it('accepts duration-based creation with hours without endDate', () => {
      const result = createClosureSchema.safeParse({
        params: { gamingCenterId },
        body: {
          hours: 9,
          reason: 'Emergency maintenance',
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects mixing endDate with hours or providing endDate without startDate', () => {
      expect(
        createClosureSchema.safeParse({
          params: { gamingCenterId },
          body: {
            startDate: '2026-11-10T09:00:00.000Z',
            endDate: '2026-11-10T18:00:00.000Z',
            hours: 9,
          },
        }).success
      ).toBe(false);

      expect(
        createClosureSchema.safeParse({
          params: { gamingCenterId },
          body: {
            endDate: '2026-11-10T18:00:00.000Z',
          },
        }).success
      ).toBe(false);

      expect(
        createClosureSchema.safeParse({
          params: { gamingCenterId },
          body: {},
        }).success
      ).toBe(false);
    });
  });

  describe('getClosuresSchema & getPublicClosuresSchema', () => {
    it('preprocesses string true/false for activeOnly and upcomingOnly', () => {
      const priv = getClosuresSchema.parse({
        params: { gamingCenterId },
        query: { activeOnly: 'true', upcomingOnly: 'false' },
      });
      expect(priv.query?.activeOnly).toBe(true);
      expect(priv.query?.upcomingOnly).toBe(false);

      const pub = getPublicClosuresSchema.parse({
        params: { gamingCenterSlug },
        query: { activeOnly: 'true' },
      });
      expect(pub.query?.activeOnly).toBe(true);
    });
  });
});
