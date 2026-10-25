import { describe, it, expect } from '@jest/globals';
import {
  validateLeadTime,
  validateOperatingHours,
  validateStationAvailability,
  validateStaffShiftHours,
  resolveValidTimeZone,
} from '../../../../src/modules/reservation/reservation.validation';
import AppError from '../../../../src/common/errors/AppError';
import { addMinutes } from 'date-fns';

describe('Operational Reservation Validation Rules', () => {
  describe('validateLeadTime', () => {
    it('should throw LEAD_TIME_TOO_SHORT if start time is less than lead time in advance', () => {
      const now = new Date('2026-12-01T10:00:00Z');
      const startTime = addMinutes(now, 15); // 15 mins in advance, requirement is 30 mins

      expect(() => validateLeadTime(startTime, 30, now)).toThrow(AppError);
      try {
        validateLeadTime(startTime, 30, now);
      } catch (err: unknown) {
        const error = err as AppError;
        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('LEAD_TIME_TOO_SHORT');
      }
    });

    it('should pass if start time satisfies minimum lead time requirement', () => {
      const now = new Date('2026-12-01T10:00:00Z');
      const startTime = addMinutes(now, 35); // 35 mins in advance >= 30 mins

      expect(() => validateLeadTime(startTime, 30, now)).not.toThrow();
    });

    it('should support configurable lead time minutes', () => {
      const now = new Date('2026-12-01T10:00:00Z');
      const startTime = addMinutes(now, 45);

      expect(() => validateLeadTime(startTime, 60, now)).toThrow(AppError);
      expect(() => validateLeadTime(startTime, 15, now)).not.toThrow();
    });
  });

  describe('resolveValidTimeZone', () => {
    it('should return valid timezone strings unchanged', () => {
      expect(resolveValidTimeZone('Asia/Tehran')).toBe('Asia/Tehran');
      expect(resolveValidTimeZone('America/New_York')).toBe('America/New_York');
      expect(resolveValidTimeZone('UTC')).toBe('UTC');
    });

    it('should fallback to UTC for invalid or empty timezone strings', () => {
      expect(resolveValidTimeZone('Invalid/Timezone')).toBe('UTC');
      expect(resolveValidTimeZone(null)).toBe('UTC');
      expect(resolveValidTimeZone(undefined)).toBe('UTC');
    });
  });

  describe('validateOperatingHours', () => {
    it('should allow reservations strictly within same-day operating hours', () => {
      const startTime = new Date('2026-12-01T10:00:00Z');
      const endTime = new Date('2026-12-01T12:00:00Z');

      expect(() => validateOperatingHours(startTime, endTime, '09:00', '23:00', 'UTC')).not.toThrow();
    });

    it('should reject reservations starting before opening time', () => {
      const startTime = new Date('2026-12-01T08:30:00Z');
      const endTime = new Date('2026-12-01T10:00:00Z');

      expect(() => validateOperatingHours(startTime, endTime, '09:00', '23:00', 'UTC')).toThrow(AppError);
      try {
        validateOperatingHours(startTime, endTime, '09:00', '23:00', 'UTC');
      } catch (err: unknown) {
        const error = err as AppError;
        expect(error.statusCode).toBe(409);
        expect(error.code).toBe('CENTER_CLOSED');
      }
    });

    it('should reject reservations ending after closing time', () => {
      const startTime = new Date('2026-12-01T22:00:00Z');
      const endTime = new Date('2026-12-01T23:30:00Z');

      expect(() => validateOperatingHours(startTime, endTime, '09:00', '23:00', 'UTC')).toThrow(AppError);
      try {
        validateOperatingHours(startTime, endTime, '09:00', '23:00', 'UTC');
      } catch (err: unknown) {
        const error = err as AppError;
        expect(error.statusCode).toBe(409);
        expect(error.code).toBe('CENTER_CLOSED');
      }
    });

    it('should correctly interpret operating hours in non-UTC site timezone (e.g. Asia/Tehran)', () => {
      const startTime = new Date('2026-12-01T06:00:00Z'); // 09:30 Tehran
      const endTime = new Date('2026-12-01T08:00:00Z');   // 11:30 Tehran

      expect(() => validateOperatingHours(startTime, endTime, '09:00', '23:00', 'Asia/Tehran')).not.toThrow();
    });

    it('should support overnight / day-crossing operating hours (e.g. 18:00 to 02:00 next day)', () => {
      const startTimeEve = new Date('2026-12-01T20:00:00Z');
      const endTimeEve = new Date('2026-12-01T22:00:00Z');
      expect(() => validateOperatingHours(startTimeEve, endTimeEve, '18:00', '02:00', 'UTC')).not.toThrow();

      const startTimeMorn = new Date('2026-12-02T00:30:00Z');
      const endTimeMorn = new Date('2026-12-02T01:30:00Z');
      expect(() => validateOperatingHours(startTimeMorn, endTimeMorn, '18:00', '02:00', 'UTC')).not.toThrow();

      const startTimeOut = new Date('2026-12-01T12:00:00Z');
      const endTimeOut = new Date('2026-12-01T14:00:00Z');
      expect(() => validateOperatingHours(startTimeOut, endTimeOut, '18:00', '02:00', 'UTC')).toThrow(AppError);
    });

    it('should reject long or multi-hour reservations spanning across overnight closures', () => {
      // Overnight shift 18:00 to 02:00 next day.
      // Reservation starting at 01:00 (1 AM) and ending 19 hours later at 20:00 (8 PM) crosses closed hours (02:00 to 18:00).
      const startTimeLong = new Date('2026-12-02T01:00:00Z');
      const endTimeLong = new Date('2026-12-02T20:00:00Z');

      expect(() => validateOperatingHours(startTimeLong, endTimeLong, '18:00', '02:00', 'UTC')).toThrow(AppError);
      try {
        validateOperatingHours(startTimeLong, endTimeLong, '18:00', '02:00', 'UTC');
      } catch (err: unknown) {
        const error = err as AppError;
        expect(error.statusCode).toBe(409);
        expect(error.code).toBe('CENTER_CLOSED');
      }
    });

    it('should allow 24/7 operations if operating hours are omitted', () => {
      const startTime = new Date('2026-12-01T03:00:00Z');
      const endTime = new Date('2026-12-01T05:00:00Z');

      expect(() => validateOperatingHours(startTime, endTime, null, null, 'UTC')).not.toThrow();
    });
  });

  describe('validateStationAvailability', () => {
    const activeStation = { id: 'st-1', name: 'PC 01', isActive: true };

    it('should pass for active station with no maintenance windows', () => {
      expect(() => validateStationAvailability(activeStation, [])).not.toThrow();
    });

    it('should throw STATION_INACTIVE if station is null or inactive', () => {
      expect(() => validateStationAvailability(null, [])).toThrow(AppError);
      expect(() => validateStationAvailability({ ...activeStation, isActive: false }, [])).toThrow(AppError);
    });

    it('should throw STATION_UNDER_MAINTENANCE if overlapping maintenance window exists', () => {
      const maintenances = [
        { id: 'm-1', startTime: new Date('2026-12-01T10:00:00Z'), endTime: new Date('2026-12-01T14:00:00Z'), reason: 'Hardware upgrade' },
      ];

      expect(() => validateStationAvailability(activeStation, maintenances)).toThrow(AppError);
      try {
        validateStationAvailability(activeStation, maintenances);
      } catch (err: unknown) {
        const error = err as AppError;
        expect(error.statusCode).toBe(409);
        expect(error.code).toBe('STATION_UNDER_MAINTENANCE');
      }
    });
  });

  describe('validateStaffShiftHours', () => {
    it('should throw SLOT_NOT_AVAILABLE if staff shift is missing or time is outside shift', () => {
      const startTime = new Date('2026-12-01T06:00:00Z');
      const endTime = new Date('2026-12-01T08:00:00Z');
      const shift = { startTime: '09:00', endTime: '18:00' };

      expect(() => validateStaffShiftHours(null, startTime, endTime, 'UTC')).toThrow(AppError);
      expect(() => validateStaffShiftHours(shift, startTime, endTime, 'UTC')).toThrow(AppError);
    });

    it('should pass if time falls strictly inside staff shift hours', () => {
      const startTime = new Date('2026-12-01T10:00:00Z');
      const endTime = new Date('2026-12-01T12:00:00Z');
      const shift = { startTime: '09:00', endTime: '18:00' };

      expect(() => validateStaffShiftHours(shift, startTime, endTime, 'UTC')).not.toThrow();
    });
  });
});
