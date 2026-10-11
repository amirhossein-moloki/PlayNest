import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { getAvailableSlots, internal_calculateStaffSlotsForDay } from '../../../../src/modules/availability/availability.station';
import { AvailabilityRepo } from '../../../../src/modules/availability/availability.repo';
import AppError from '../../../../src/common/errors/AppError';
import httpStatus from 'http-status';

jest.mock('../../../../src/modules/availability/availability.repo');

const MockedAvailabilityRepo = AvailabilityRepo as jest.Mocked<typeof AvailabilityRepo>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('AvailabilitystationStation', () => {
  const gamingCenterSlug = 'my-gamingCenter';
  const stationId = 'st-1';
  const gamingCenterId = 'gc-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAvailableSlots', () => {
    it('should throw NOT_FOUND if station not found', async () => {
      MockedAvailabilityRepo.findStationWithGamingCenter.mockResolvedValue(null);
      await expect(getAvailableSlots({ gamingCenterSlug, stationId, startDate: new Date(), endDate: new Date() }))
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
      MockedAvailabilityRepo.findReservation.mockResolvedValue([]);

      const result = await getAvailableSlots({ gamingCenterSlug, stationId, startDate, endDate });
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('internal_calculateStaffSlotsForDay', () => {
    const staff = { id: 'u-1', fullName: 'Staff 1' };
    const staffShift = { startTime: '09:00', endTime: '12:00' };
    const day = new Date('2023-01-02');
    const timeZone = 'UTC';
    const stationDuration = 60;

    it('should return slots when there are no reservations', () => {
      const slots = internal_calculateStaffSlotsForDay(staff, staffShift, day, timeZone, [], stationDuration);
      expect(slots.length).toBe(9);
    });
  });
});
