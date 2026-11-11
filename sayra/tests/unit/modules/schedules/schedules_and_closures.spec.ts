import { describe, it, expect } from '@jest/globals';
import { validateOperatingHours } from '../../../../src/modules/reservation/reservation.validation';
import AppError from '../../../../src/common/errors/AppError';

describe('Schedules and Operating Hours Validation', () => {
  const timeZone = 'Asia/Tehran';

  it('should accept reservation within normal operating hours', () => {
    // 2026-10-10 is a Saturday (dayOfWeek = 6)
    // 14:00 to 16:00 in Asia/Tehran (+03:30) => UTC 10:30 to 12:30
    const start = new Date('2026-10-10T10:30:00Z');
    const end = new Date('2026-10-10T12:30:00Z');

    expect(() => {
      validateOperatingHours(start, end, {
        openingTime: '09:00',
        closingTime: '23:00',
        timeZone,
      });
    }).not.toThrow();
  });

  it('should reject reservation outside operating hours', () => {
    // 08:00 to 10:00 in Asia/Tehran => UTC 04:30 to 06:30 (opens at 09:00)
    const start = new Date('2026-10-10T04:30:00Z');
    const end = new Date('2026-10-10T06:30:00Z');

    expect(() => {
      validateOperatingHours(start, end, {
        openingTime: '09:00',
        closingTime: '23:00',
        timeZone,
      });
    }).toThrow(AppError);
  });

  it('should reject reservation on a closed day', () => {
    // 2026-10-09 is Friday (dayOfWeek = 5)
    // Closed on Friday
    const start = new Date('2026-10-09T10:30:00Z');
    const end = new Date('2026-10-09T12:30:00Z');

    expect(() => {
      validateOperatingHours(start, end, {
        openingTime: '09:00',
        closingTime: '23:00',
        closedDays: [5],
        timeZone,
      });
    }).toThrow('Center is closed on the selected day.');
  });

  it('should respect custom dayOfWeek schedule overrides', () => {
    // 2026-10-10 (Saturday, dayOfWeek = 6) has custom schedule 14:00 to 20:00
    // Request for 10:00 to 12:00 in Tehran (UTC 06:30 to 08:30)
    const start = new Date('2026-10-10T06:30:00Z');
    const end = new Date('2026-10-10T08:30:00Z');

    expect(() => {
      validateOperatingHours(start, end, {
        openingTime: '09:00',
        closingTime: '23:00',
        schedules: [
          {
            dayOfWeek: 6,
            startTime: '14:00',
            endTime: '20:00',
            isClosed: false,
          },
        ],
        timeZone,
      });
    }).toThrow(AppError);

    // Request for 15:00 to 17:00 in Tehran (UTC 11:30 to 13:30) should succeed
    const validStart = new Date('2026-10-10T11:30:00Z');
    const validEnd = new Date('2026-10-10T13:30:00Z');
    expect(() => {
      validateOperatingHours(validStart, validEnd, {
        openingTime: '09:00',
        closingTime: '23:00',
        schedules: [
          {
            dayOfWeek: 6,
            startTime: '14:00',
            endTime: '20:00',
            isClosed: false,
          },
        ],
        timeZone,
      });
    }).not.toThrow();
  });

  it('should support overnight shifts crossing midnight (e.g. 18:00 to 03:00)', () => {
    // 2026-10-10 23:00 to 2026-10-11 02:00 in Tehran
    // UTC: 2026-10-10T19:30:00Z to 2026-10-10T22:30:00Z
    const start = new Date('2026-10-10T19:30:00Z');
    const end = new Date('2026-10-10T22:30:00Z');

    expect(() => {
      validateOperatingHours(start, end, {
        openingTime: '18:00',
        closingTime: '03:00',
        timeZone,
      });
    }).not.toThrow();
  });

  it('should reject reservation overlapping with exceptional closure', () => {
    const start = new Date('2026-10-10T10:30:00Z');
    const end = new Date('2026-10-10T12:30:00Z');

    expect(() => {
      validateOperatingHours(start, end, {
        openingTime: '09:00',
        closingTime: '23:00',
        closures: [
          {
            startDate: new Date('2026-10-10T08:00:00Z'),
            endDate: new Date('2026-10-10T14:00:00Z'),
            reason: 'Renovation',
          },
        ],
        timeZone,
      });
    }).toThrow('Center is closed: Renovation');
  });
});
