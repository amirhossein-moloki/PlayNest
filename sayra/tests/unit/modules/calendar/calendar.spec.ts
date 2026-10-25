/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CalendarStation, resolveCalendarRangeBoundaries } from '../../../../src/modules/calendar/calendar.station';
import { CalendarRepo } from '../../../../src/modules/calendar/calendar.repo';
import { getCalendarQuerySchema } from '../../../../src/modules/calendar/calendar.dto';
import AppError from '../../../../src/common/errors/AppError';

jest.mock('../../../../src/modules/calendar/calendar.repo');

const MockedCalendarRepo = CalendarRepo as jest.Mocked<typeof CalendarRepo>;

describe('Calendar Unit Tests', () => {
  const gamingCenterId = 'clx0000000000000000000000';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveCalendarRangeBoundaries', () => {
    it('should parse plain YYYY-MM-DD dates in site timezone (Asia/Tehran)', () => {
      const timeZone = 'Asia/Tehran';
      const result = resolveCalendarRangeBoundaries('2026-12-01', '2026-12-05', timeZone);

      expect(result.rangeStartUtc).toBeInstanceOf(Date);
      expect(result.rangeEndUtc).toBeInstanceOf(Date);
      expect(result.rangeStartUtc.getTime()).toBeLessThan(result.rangeEndUtc.getTime());
      expect(result.rangeStartLocal).toContain('2026-12-01');
      expect(result.rangeEndLocal).toContain('2026-12-05');
    });

    it('should parse ISO datetime strings', () => {
      const timeZone = 'UTC';
      const result = resolveCalendarRangeBoundaries(
        '2026-12-01T08:00:00.000Z',
        '2026-12-05T18:00:00.000Z',
        timeZone
      );

      expect(result.rangeStartUtc.toISOString()).toBe('2026-12-01T08:00:00.000Z');
      expect(result.rangeEndUtc.toISOString()).toBe('2026-12-05T18:00:00.000Z');
    });

    it('should throw AppError if dateTo is before dateFrom', () => {
      expect(() => {
        resolveCalendarRangeBoundaries('2026-12-05', '2026-12-01', 'UTC');
      }).toThrow(AppError);
    });

    it('should throw AppError if date string is invalid', () => {
      expect(() => {
        resolveCalendarRangeBoundaries('invalid-date', '2026-12-05', 'UTC');
      }).toThrow(AppError);
    });
  });

  describe('getCalendarQuerySchema Validation', () => {
    it('should validate valid query parameters', () => {
      const validQuery = {
        params: { gamingCenterId },
        query: {
          dateFrom: '2026-12-01',
          dateTo: '2026-12-07',
          status: 'CONFIRMED',
          page: '1',
          pageSize: '50',
        },
      };

      const parsed = getCalendarQuerySchema.parse(validQuery);
      expect(parsed.query.dateFrom).toBe('2026-12-01');
      expect(parsed.query.dateTo).toBe('2026-12-07');
      expect(parsed.query.page).toBe(1);
      expect(parsed.query.pageSize).toBe(50);
    });

    it('should reject date range exceeding 31 days', () => {
      const invalidQuery = {
        params: { gamingCenterId },
        query: {
          dateFrom: '2026-01-01',
          dateTo: '2026-03-01', // 59 days
        },
      };

      expect(() => getCalendarQuerySchema.parse(invalidQuery)).toThrow();
    });
  });

  describe('CalendarStation.getAdminCalendar', () => {
    it('should fetch and format admin calendar data correctly', async () => {
      MockedCalendarRepo.findGamingCenterWithSettings.mockResolvedValue({
        id: gamingCenterId,
        name: 'Gaming Lounge',
        slug: 'gaming-lounge',
        settings: { timeZone: 'Asia/Tehran' },
      } as any);

      MockedCalendarRepo.findCalendarReservations.mockResolvedValue([
        {
          id: 'res-1',
          gamingCenterId,
          stationId: 'st-1',
          station: { name: 'PC-1', stationType: 'PC', isVip: true, hourlyPrice: 100, isActive: true },
          customerAccountId: 'cust-1',
          customerAccount: { fullName: 'Ali Reza', phone: '+989123456789' },
          customerProfile: { displayName: 'Ali' },
          staffId: 'staff-1',
          staff: { fullName: 'Staff One' },
          status: 'CONFIRMED',
          paymentState: 'PAID',
          totalHours: 2,
          totalPrice: 200,
          discountAmount: 0,
          groupBookingId: null,
          startTime: new Date('2026-12-01T10:00:00.000Z'),
          endTime: new Date('2026-12-01T12:00:00.000Z'),
          note: 'VIP test',
          createdAt: new Date(),
        } as any,
      ]);

      MockedCalendarRepo.countCalendarReservations.mockResolvedValue(1);

      MockedCalendarRepo.findCalendarMaintenances.mockResolvedValue([
        {
          id: 'maint-1',
          stationId: 'st-2',
          station: { name: 'PC-2', stationType: 'PC' },
          reason: 'Hardware upgrade',
          cost: 50,
          startTime: new Date('2026-12-02T08:00:00.000Z'),
          endTime: new Date('2026-12-02T12:00:00.000Z'),
          createdAt: new Date(),
        } as any,
      ]);

      MockedCalendarRepo.findCalendarStations.mockResolvedValue([
        { id: 'st-1', name: 'PC-1', stationType: 'PC', isVip: true, hourlyPrice: 100, isActive: true },
        { id: 'st-2', name: 'PC-2', stationType: 'PC', isVip: false, hourlyPrice: 80, isActive: true },
      ] as any);

      const result = await CalendarStation.getAdminCalendar(gamingCenterId, {
        dateFrom: '2026-12-01',
        dateTo: '2026-12-03',
        page: 1,
        pageSize: 50,
      });

      expect(result.site.timeZone).toBe('Asia/Tehran');
      expect(result.workstations).toHaveLength(2);
      expect(result.maintenances).toHaveLength(1);
      expect(result.reservations.data).toHaveLength(1);

      const res1 = result.reservations.data[0];
      expect(res1.id).toBe('res-1');
      expect(res1.stationName).toBe('PC-1');
      expect(res1.customerName).toBe('Ali Reza');
      expect(res1.startTimeLocal).toBeDefined();
      expect(res1.endTimeLocal).toBeDefined();
    });

    it('should throw AppError if gaming center is not found', async () => {
      MockedCalendarRepo.findGamingCenterWithSettings.mockResolvedValue(null);

      await expect(
        CalendarStation.getAdminCalendar(gamingCenterId, {
          dateFrom: '2026-12-01',
          dateTo: '2026-12-03',
        })
      ).rejects.toThrow(AppError);
    });
  });
});
