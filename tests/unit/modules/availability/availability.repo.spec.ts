import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import { AvailabilityRepo } from '../../../../src/modules/availability/availability.repo';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('AvailabilityRepo', () => {
  const stationMock = prismaMock.gameStation /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const userMock = prismaMock.user /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const shiftMock = prismaMock.staffShift /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const resMock = prismaMock.reservation /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;

  it('findStationWithGamingCenter', async () => {
    stationMock.findFirst.mockResolvedValue({ id: 's-1' });
    await AvailabilityRepo.findStationWithGamingCenter('s-1', 'slug');
    expect(stationMock.findFirst).toHaveBeenCalled();
  });

  it('findStaff', async () => {
    userMock.findFirst.mockResolvedValue({ id: 'u-1' });
    await AvailabilityRepo.findStaff('u-1', 'gc-1', 's-1');
    expect(userMock.findFirst).toHaveBeenCalled();
  });

  it('findStaffList', async () => {
    userMock.findMany.mockResolvedValue([]);
    await AvailabilityRepo.findStaffList('gc-1', 's-1');
    expect(userMock.findMany).toHaveBeenCalled();
  });

  it('findShifts', async () => {
    shiftMock.findMany.mockResolvedValue([]);
    await AvailabilityRepo.findShifts('gc-1', ['u-1']);
    expect(shiftMock.findMany).toHaveBeenCalled();
  });

  it('findReservation', async () => {
    resMock.findMany.mockResolvedValue([]);
    await AvailabilityRepo.findReservation('gc-1', ['u-1'], new Date(), new Date());
    expect(resMock.findMany).toHaveBeenCalled();
  });
});
