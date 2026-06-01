import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import * as StaffShiftsRepo from '../../../../src/modules/staffShifts/staffShifts.repo';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('StaffShiftsRepo', () => {
  const shiftMock = prismaMock.staffShift /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;

  it('findShiftsByUserId', async () => {
    shiftMock.findMany.mockResolvedValue([]);
    await StaffShiftsRepo.findShiftsByUserId('gc-1', 'u-1');
    expect(shiftMock.findMany).toHaveBeenCalled();
  });

  it('upsertShifts', async () => {
    (prismaMock /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).$transaction.mockResolvedValue([]);
    await StaffShiftsRepo.upsertShifts('gc-1', 'u-1', [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true }]);
    expect((prismaMock /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).$transaction).toHaveBeenCalled();
  });
});
