import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  getAvailableSlots,
  getWorkingIntervalsForDate,
  SLOT_DURATION_MINUTES,
} from '../../../../src/modules/availability/availability.station';
import { AvailabilityRepo } from '../../../../src/modules/availability/availability.repo';
import AppError from '../../../../src/common/errors/AppError';
import httpStatus from 'http-status';

jest.mock('../../../../src/modules/availability/availability.repo');

const MockedAvailabilityRepo = AvailabilityRepo as jest.Mocked<typeof AvailabilityRepo>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('AvailabilityStation 60-Minute Slots', () => {
  const gamingCenterSlug = 'test-center';
  const stationId = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
  const gamingCenterId = 'gc-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWorkingIntervalsForDate', () => {
    it('should return 24 hours when operating hours are not set or 24/7', () => {
      const intervals = getWorkingIntervalsForDate('2026-11-10', null, null, 'UTC');
      expect(intervals).toHaveLength(1);
      expect(intervals[0].start.toISOString()).toBe('2026-11-10T00:00:00.000Z');
      expect(intervals[0].end.toISOString()).toBe('2026-11-11T00:00:00.000Z');
    });

    it('should handle standard daytime shift correctly', () => {
      const intervals = getWorkingIntervalsForDate('2026-11-10', '10:00', '22:00', 'UTC');
      expect(intervals).toHaveLength(1);
      expect(intervals[0].start.toISOString()).toBe('2026-11-10T10:00:00.000Z');
      expect(intervals[0].end.toISOString()).toBe('2026-11-10T22:00:00.000Z');
    });

    it('should handle overnight shift across calendar boundaries', () => {
      // Overnight 18:00 to 02:00
      const intervals = getWorkingIntervalsForDate('2026-11-10', '18:00', '02:00', 'UTC');
      expect(intervals).toHaveLength(2);
      // Morning tail from previous night: 00:00 to 02:00
      expect(intervals[0].start.toISOString()).toBe('2026-11-10T00:00:00.000Z');
      expect(intervals[0].end.toISOString()).toBe('2026-11-10T02:00:00.000Z');
      // Evening part: 18:00 to 24:00 (end of day)
      expect(intervals[1].start.toISOString()).toBe('2026-11-10T18:00:00.000Z');
      expect(intervals[1].end.toISOString()).toBe('2026-11-11T00:00:00.000Z');
    });
  });

  describe('getAvailableSlots', () => {
    const baseStation = {
      id: stationId,
      name: 'PS5 Station 1',
      stationType: 'PLAYSTATION',
      hourlyPrice: 80000,
      isActive: true,
      gamingCenterId,
      gamingCenter: {
        id: gamingCenterId,
        name: 'Nexus Game Arena',
        slug: gamingCenterSlug,
        isActive: true,
        openingTime: '10:00',
        closingTime: '14:00',
        closedDays: [5], // Friday closed
        timezone: 'UTC',
        settings: {
          timeZone: 'UTC',
          workStartTime: '10:00',
          workEndTime: '14:00',
        },
      },
    };

    it('should throw NOT_FOUND if station does not exist', async () => {
      MockedAvailabilityRepo.findStationWithGamingCenter.mockResolvedValue(null);

      await expect(
        getAvailableSlots({
          gamingCenterSlug,
          stationId,
          date: '2026-11-10',
        })
      ).rejects.toThrow(new AppError('GameStation not found in this gamingCenter.', httpStatus.NOT_FOUND));
    });

    it('should throw FORBIDDEN if gaming center is inactive', async () => {
      const inactiveStation = {
        ...baseStation,
        gamingCenter: {
          ...baseStation.gamingCenter,
          isActive: false,
        },
      };
      MockedAvailabilityRepo.findStationWithGamingCenter.mockResolvedValue(inactiveStation as any);

      await expect(
        getAvailableSlots({
          gamingCenterSlug,
          stationId,
          date: '2026-11-10',
        })
      ).rejects.toThrow('GamingCenter is currently inactive.');
    });

    it('should generate exact 60-minute slots separated by 24h days', async () => {
      MockedAvailabilityRepo.findStationWithGamingCenter.mockResolvedValue(baseStation as any);
      MockedAvailabilityRepo.findStaffList.mockResolvedValue([]);
      MockedAvailabilityRepo.findShifts.mockResolvedValue([]);
      MockedAvailabilityRepo.findReservation.mockResolvedValue([]);
      MockedAvailabilityRepo.findMaintenances.mockResolvedValue([]);

      // Tuesday 2026-11-10, operating 10:00 to 14:00 (4 hours = 4 x 60-min slots)
      const results = await getAvailableSlots({
        gamingCenterSlug,
        stationId,
        date: '2026-11-10',
      });

      expect(results).toHaveLength(1);
      const dayResult = results[0];
      expect(dayResult.date).toBe('2026-11-10');
      expect(dayResult.station.id).toBe(stationId);
      expect(dayResult.gamingCenter.isOpen).toBe(true);
      expect(dayResult.slots).toHaveLength(4);

      // Check each slot is 60 minutes
      dayResult.slots.forEach((slot) => {
        expect(slot.durationMinutes).toBe(SLOT_DURATION_MINUTES);
        expect(slot.isAvailable).toBe(true);
        expect(slot.stationId).toBe(stationId);
      });

      expect(dayResult.slots[0].startTime).toBe('2026-11-10T10:00:00.000Z');
      expect(dayResult.slots[0].endTime).toBe('2026-11-10T11:00:00.000Z');
      expect(dayResult.slots[3].startTime).toBe('2026-11-10T13:00:00.000Z');
      expect(dayResult.slots[3].endTime).toBe('2026-11-10T14:00:00.000Z');
    });

    it('should generate slots correctly for non-UTC timezone like Asia/Tehran', async () => {
      const tehranStation = {
        ...baseStation,
        gamingCenter: {
          ...baseStation.gamingCenter,
          timezone: 'Asia/Tehran',
          openingTime: '10:00',
          closingTime: '23:00',
          settings: {
            timeZone: 'Asia/Tehran',
            workStartTime: '10:00',
            workEndTime: '23:00',
          },
        },
      };

      MockedAvailabilityRepo.findStationWithGamingCenter.mockResolvedValue(tehranStation as any);
      MockedAvailabilityRepo.findStaffList.mockResolvedValue([]);
      MockedAvailabilityRepo.findShifts.mockResolvedValue([]);
      MockedAvailabilityRepo.findReservation.mockResolvedValue([]);
      MockedAvailabilityRepo.findMaintenances.mockResolvedValue([]);

      const results = await getAvailableSlots({
        gamingCenterSlug,
        stationId,
        date: '2026-11-09',
      });

      expect(results).toHaveLength(1);
      const dayResult = results[0];
      expect(dayResult.date).toBe('2026-11-09');
      // 10:00 to 23:00 = 13 slots
      expect(dayResult.slots).toHaveLength(13);
      expect(dayResult.slots[0].startTime).toBe('2026-11-09T06:30:00.000Z');
      expect(dayResult.slots[0].endTime).toBe('2026-11-09T07:30:00.000Z');
      expect(dayResult.slots[12].startTime).toBe('2026-11-09T18:30:00.000Z');
      expect(dayResult.slots[12].endTime).toBe('2026-11-09T19:30:00.000Z');
    });

    it('should mark closed day as closed with empty slots', async () => {
      MockedAvailabilityRepo.findStationWithGamingCenter.mockResolvedValue(baseStation as any);
      MockedAvailabilityRepo.findStaffList.mockResolvedValue([]);
      MockedAvailabilityRepo.findShifts.mockResolvedValue([]);
      MockedAvailabilityRepo.findReservation.mockResolvedValue([]);
      MockedAvailabilityRepo.findMaintenances.mockResolvedValue([]);

      // 2026-11-13 is Friday (day 5), which is in closedDays [5]
      const results = await getAvailableSlots({
        gamingCenterSlug,
        stationId,
        date: '2026-11-13',
      });

      expect(results).toHaveLength(1);
      expect(results[0].gamingCenter.operatingHours.isClosedDay).toBe(true);
      expect(results[0].slots).toEqual([]);
    });

    it('should mark overlapping reservation slots as unavailable (RESERVED)', async () => {
      MockedAvailabilityRepo.findStationWithGamingCenter.mockResolvedValue(baseStation as any);
      MockedAvailabilityRepo.findStaffList.mockResolvedValue([]);
      MockedAvailabilityRepo.findShifts.mockResolvedValue([]);
      // Reservation from 11:00 to 12:00
      MockedAvailabilityRepo.findReservation.mockResolvedValue([
        {
          id: 'res-1',
          startTime: new Date('2026-11-10T11:00:00.000Z'),
          endTime: new Date('2026-11-10T12:00:00.000Z'),
          status: 'CONFIRMED',
        } as any,
      ]);
      MockedAvailabilityRepo.findMaintenances.mockResolvedValue([]);

      const results = await getAvailableSlots({
        gamingCenterSlug,
        stationId,
        date: '2026-11-10',
      });

      const slots = results[0].slots;
      expect(slots).toHaveLength(4);
      expect(slots[0].isAvailable).toBe(true); // 10:00-11:00
      expect(slots[1].isAvailable).toBe(false); // 11:00-12:00
      expect(slots[1].unavailableReason).toBe('RESERVED');
      expect(slots[2].isAvailable).toBe(true); // 12:00-13:00
      expect(slots[3].isAvailable).toBe(true); // 13:00-14:00
    });

    it('should mark overlapping maintenance as unavailable (MAINTENANCE)', async () => {
      MockedAvailabilityRepo.findStationWithGamingCenter.mockResolvedValue(baseStation as any);
      MockedAvailabilityRepo.findStaffList.mockResolvedValue([]);
      MockedAvailabilityRepo.findShifts.mockResolvedValue([]);
      MockedAvailabilityRepo.findReservation.mockResolvedValue([]);
      MockedAvailabilityRepo.findMaintenances.mockResolvedValue([
        {
          id: 'maint-1',
          startTime: new Date('2026-11-10T12:30:00.000Z'),
          endTime: new Date('2026-11-10T14:00:00.000Z'),
        } as any,
      ]);

      const results = await getAvailableSlots({
        gamingCenterSlug,
        stationId,
        date: '2026-11-10',
      });

      const slots = results[0].slots;
      expect(slots).toHaveLength(4);
      expect(slots[0].isAvailable).toBe(true);
      expect(slots[1].isAvailable).toBe(true);
      expect(slots[2].isAvailable).toBe(false); // 12:00-13:00 overlaps 12:30
      expect(slots[2].unavailableReason).toBe('MAINTENANCE');
      expect(slots[3].isAvailable).toBe(false); // 13:00-14:00 overlaps
      expect(slots[3].unavailableReason).toBe('MAINTENANCE');
    });

    it('should assign on-duty staff to slots when staff skills and shifts exist', async () => {
      const staffMember = { id: 'staff-1', fullName: 'Arman Rezaei' };
      MockedAvailabilityRepo.findStationWithGamingCenter.mockResolvedValue(baseStation as any);
      MockedAvailabilityRepo.findStaffList.mockResolvedValue([staffMember] as any);
      // Tuesday = 2
      MockedAvailabilityRepo.findShifts.mockResolvedValue([
        {
          userId: 'staff-1',
          dayOfWeek: 2,
          startTime: '10:00',
          endTime: '12:00',
          isActive: true,
        } as any,
      ]);
      MockedAvailabilityRepo.findReservation.mockResolvedValue([]);
      MockedAvailabilityRepo.findMaintenances.mockResolvedValue([]);

      const results = await getAvailableSlots({
        gamingCenterSlug,
        stationId,
        date: '2026-11-10',
      });

      const slots = results[0].slots;
      // 10:00-11:00 staff is on duty
      expect(slots[0].isAvailable).toBe(true);
      expect(slots[0].staff?.id).toBe('staff-1');

      // 11:00-12:00 staff is on duty
      expect(slots[1].isAvailable).toBe(true);
      expect(slots[1].staff?.id).toBe('staff-1');

      // 12:00-13:00 staff shift ended -> NO_STAFF
      expect(slots[2].isAvailable).toBe(false);
      expect(slots[2].unavailableReason).toBe('NO_STAFF');
    });
  });
});
