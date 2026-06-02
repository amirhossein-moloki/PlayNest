import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { getAvailableSlots, internal_calculateStaffSlotsForDay } from '../../../../src/modules/availability/availability.station';
import { AvailabilityRepo } from '../../../../src/modules/availability/availability.repo';
import AppError from '../../../../src/common/errors/AppError';
import httpStatus from 'http-status';

jest.mock('../../../../src/modules/availability/availability.repo');

const MockedAvailabilityRepo = AvailabilityRepo as jest.Mocked<typeof AvailabilityRepo>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('AvailabilityStationService', () => {
  const salonSlug = 'my-salon';
  const stationId = 'st-1';
  const gamingCenterId = 'gc-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAvailableSlots', () => {
    it('should throw NOT_FOUND if station not found', async () => {
      MockedAvailabilityRepo.findStationWithGamingCenter.mockResolvedValue(null);
      await expect(getAvailableSlots({ salonSlug, stationId, startDate: new Date(), endDate: new Date() }))
        .rejects.toThrow(new AppError('GameStation not found in this gamingCenter.', httpStatus.NOT_FOUND));
    });

    it('should generate slots for staff successfully', async () => {
      const station = { gamingCenterId, defaultDurationHours: 1, gamingCenter: { settings: { timeZone: 'UTC' } } };
      const staff = { id: 'u-1', fullName: 'Staff 1' };
      const shift = { userId: 'u-1', dayOfWeek: 1, startTime: '09:00', endTime: '11:00' };
      const startDate = new Date('2023-01-02'); // Monday
      const endDate = new Date('2023-01-02');

      MockedAvailabilityRepo.findStationWithGamingCenter.mockResolvedValue(station as any);
      MockedAvailabilityRepo.findStaffList.mockResolvedValue([staff] as any);
      MockedAvailabilityRepo.findShifts.mockResolvedValue([shift] as any);
      MockedAvailabilityRepo.findBookings.mockResolvedValue([]);

      const result = await getAvailableSlots({ salonSlug, stationId, startDate, endDate });
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('internal_calculateStaffSlotsForDay', () => {
    const staff = { id: 'u-1', fullName: 'Staff 1' };
    const staffShift = { startTime: '09:00', endTime: '12:00' };
    const day = new Date('2023-01-02');
    const timeZone = 'UTC';
    const serviceDuration = 60;

    it('should return slots when there are no bookings', () => {
      const slots = internal_calculateStaffSlotsForDay(staff, staffShift, day, timeZone, [], serviceDuration);
      expect(slots.length).toBe(9);
    });
  });
});
