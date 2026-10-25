import { describe, it, expect } from '@jest/globals';
import { isIntervalOverlapping, isValidInterval } from '../../../../src/modules/reservation/reservation.overlap';

describe('Reservation Overlap Domain Unit Tests', () => {
  const baseStart = new Date('2026-11-01T10:00:00.000Z');
  const baseEnd = new Date('2026-11-01T12:00:00.000Z');

  describe('isValidInterval', () => {
    it('returns true for valid interval where startTime < endTime', () => {
      expect(isValidInterval({ startTime: baseStart, endTime: baseEnd })).toBe(true);
    });

    it('returns false when startTime is equal to endTime', () => {
      expect(isValidInterval({ startTime: baseStart, endTime: baseStart })).toBe(false);
    });

    it('returns false when startTime is after endTime', () => {
      expect(isValidInterval({ startTime: baseEnd, endTime: baseStart })).toBe(false);
    });

    it('returns false when timestamp is invalid', () => {
      expect(isValidInterval({ startTime: new Date('invalid'), endTime: baseEnd })).toBe(false);
    });
  });

  describe('isIntervalOverlapping (Half-Open Interval [Start, End))', () => {
    const existing = { startTime: baseStart, endTime: baseEnd }; // 10:00 - 12:00

    it('allows adjacent interval ending exactly when requested starts (08:00 - 10:00)', () => {
      const prior = {
        startTime: new Date('2026-11-01T08:00:00.000Z'),
        endTime: new Date('2026-11-01T10:00:00.000Z'),
      };
      expect(isIntervalOverlapping(existing, prior)).toBe(false);
    });

    it('allows adjacent interval starting exactly when requested ends (12:00 - 14:00)', () => {
      const subsequent = {
        startTime: new Date('2026-11-01T12:00:00.000Z'),
        endTime: new Date('2026-11-01T14:00:00.000Z'),
      };
      expect(isIntervalOverlapping(existing, subsequent)).toBe(false);
    });

    it('detects partial overlap at the beginning (09:00 - 11:00)', () => {
      const overlapStart = {
        startTime: new Date('2026-11-01T09:00:00.000Z'),
        endTime: new Date('2026-11-01T11:00:00.000Z'),
      };
      expect(isIntervalOverlapping(existing, overlapStart)).toBe(true);
    });

    it('detects partial overlap at the end (11:00 - 13:00)', () => {
      const overlapEnd = {
        startTime: new Date('2026-11-01T11:00:00.000Z'),
        endTime: new Date('2026-11-01T13:00:00.000Z'),
      };
      expect(isIntervalOverlapping(existing, overlapEnd)).toBe(true);
    });

    it('detects full containment when requested is inside existing (10:30 - 11:30)', () => {
      const inside = {
        startTime: new Date('2026-11-01T10:30:00.000Z'),
        endTime: new Date('2026-11-01T11:30:00.000Z'),
      };
      expect(isIntervalOverlapping(existing, inside)).toBe(true);
    });

    it('detects full containment when existing is inside requested (09:00 - 13:00)', () => {
      const enclosing = {
        startTime: new Date('2026-11-01T09:00:00.000Z'),
        endTime: new Date('2026-11-01T13:00:00.000Z'),
      };
      expect(isIntervalOverlapping(existing, enclosing)).toBe(true);
    });

    it('detects identical intervals (10:00 - 12:00)', () => {
      const identical = {
        startTime: baseStart,
        endTime: baseEnd,
      };
      expect(isIntervalOverlapping(existing, identical)).toBe(true);
    });
  });
});
