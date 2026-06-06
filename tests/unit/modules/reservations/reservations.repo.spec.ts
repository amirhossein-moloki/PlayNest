import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { ReservationStatus } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

describe('ReservationRepo', () => {
  const gamingCenterId = 'gc-1';

  const stationMock = prismaMock.gameStation /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const userMock = prismaMock.user /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const gcMock = prismaMock.gamingCenter /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const shiftMock = prismaMock.staffShift /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const resMock = prismaMock.reservation /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const accountMock = prismaMock.customerAccount /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const profileMock = prismaMock.customerProfile /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const settingsMock = prismaMock.settings /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;

  describe('findStation', () => {
    it('should find a station', async () => {
      const id = 's-1';
      const mockStation = { id, gamingCenterId, isActive: true };
      stationMock.findFirst.mockResolvedValue(mockStation);

      const result = await ReservationRepo.findStation(id, gamingCenterId, true);
      expect(result).toEqual(mockStation);
      expect(stationMock.findFirst).toHaveBeenCalledWith({
        where: { id, gamingCenterId, isActive: true },
      });
    });
  });

  describe('findStaff', () => {
    it('should find staff with station skills', async () => {
      const id = 'u-1';
      const stationId = 'st-1';
      const mockStaff = { id };
      userMock.findFirst.mockResolvedValue(mockStaff);

      const result = await ReservationRepo.findStaff(id, gamingCenterId, stationId);
      expect(result).toEqual(mockStaff);
      expect(userMock.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          id,
          gamingCenterId,
          stationSkills: { some: { stationId } },
        }),
      }));
    });
  });

  describe('findOverlappingReservation', () => {
    it('should find overlapping reservation', async () => {
      const staffId = 'u-1';
      const startTime = new Date('2023-01-01T10:00:00Z');
      const endTime = new Date('2023-01-01T11:00:00Z');
      resMock.findFirst.mockResolvedValue({ id: 'res-1' });

      const result = await ReservationRepo.findOverlappingReservation(gamingCenterId, staffId, startTime, endTime);
      expect(result).toEqual({ id: 'res-1' });
      expect(resMock.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          staffId,
          status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.COMPLETED] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        }),
      }));
    });
  });

  describe('updateReservation', () => {
    it('should update and return the reservation', async () => {
      const id = 'res-1';
      const data = { status: ReservationStatus.COMPLETED };
      resMock.updateMany.mockResolvedValue({ count: 1 });
      const mockRes = { id, ...data };
      resMock.findUnique.mockResolvedValue(mockRes);

      const result = await ReservationRepo.updateReservation(id, gamingCenterId, data);
      expect(result).toEqual(mockRes);
      expect(resMock.updateMany).toHaveBeenCalledWith({
        where: { id, gamingCenterId },
        data,
      });
    });

    it('should return null if no reservation updated', async () => {
      resMock.updateMany.mockResolvedValue({ count: 0 });
      const result = await ReservationRepo.updateReservation('res-1', gamingCenterId, {});
      expect(result).toBeNull();
    });
  });

  describe('transaction', () => {
    it('should use prisma transaction', async () => {
      (prismaMock /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).$transaction.mockResolvedValue('success');
      const result = await ReservationRepo.transaction(async (tx) => 'success');
      expect(result).toBe('success');
      expect((prismaMock /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).$transaction).toHaveBeenCalled();
    });
  });

  describe('Other operations', () => {
    it('findGamingCenterWithSettings', async () => {
      gcMock.findUnique.mockResolvedValue({ id: gamingCenterId });
      await ReservationRepo.findGamingCenterWithSettings(gamingCenterId);
      expect(gcMock.findUnique).toHaveBeenCalled();
    });

    it('findGamingCenterBySlugWithSettings', async () => {
      gcMock.findUnique.mockResolvedValue({ id: gamingCenterId });
      await ReservationRepo.findGamingCenterBySlugWithSettings('slug');
      expect(gcMock.findUnique).toHaveBeenCalled();
    });

    it('findStaffShift', async () => {
      shiftMock.findFirst.mockResolvedValue({ id: 'shift-1' });
      await ReservationRepo.findStaffShift(gamingCenterId, 'u-1', 1);
      expect(shiftMock.findFirst).toHaveBeenCalled();
    });

    it('findCustomerAccountByPhone', async () => {
      accountMock.findUnique.mockResolvedValue({ id: 'c-1' });
      await ReservationRepo.findCustomerAccountByPhone('phone');
      expect(accountMock.findUnique).toHaveBeenCalled();
    });

    it('createCustomerAccount', async () => {
      accountMock.create.mockResolvedValue({ id: 'c-1' });
      await ReservationRepo.createCustomerAccount({ phone: 'phone' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      expect(accountMock.create).toHaveBeenCalled();
    });

    it('findCustomerProfile', async () => {
      profileMock.findUnique.mockResolvedValue({ id: 'cp-1' });
      await ReservationRepo.findCustomerProfile(gamingCenterId, 'ca-1');
      expect(profileMock.findUnique).toHaveBeenCalled();
    });

    it('createCustomerProfile', async () => {
      profileMock.create.mockResolvedValue({ id: 'cp-1' });
      await ReservationRepo.createCustomerProfile({ gamingCenterId, customerAccountId: 'ca-1' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      expect(profileMock.create).toHaveBeenCalled();
    });

    it('createReservation', async () => {
      resMock.create.mockResolvedValue({ id: 'res-1' });
      await ReservationRepo.createReservation({} /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      expect(resMock.create).toHaveBeenCalled();
    });

    it('findReservationById', async () => {
      resMock.findFirst.mockResolvedValue({ id: 'res-1' });
      await ReservationRepo.findReservationById('res-1', gamingCenterId);
      expect(resMock.findFirst).toHaveBeenCalled();
    });

    it('findManyReservation', async () => {
      resMock.findMany.mockResolvedValue([]);
      await ReservationRepo.findManyReservation({}, 0, 10, {});
      expect(resMock.findMany).toHaveBeenCalled();
    });

    it('countReservation', async () => {
      resMock.count.mockResolvedValue(0);
      await ReservationRepo.countReservation({});
      expect(resMock.count).toHaveBeenCalled();
    });

    it('updateReservationWithInclude', async () => {
      resMock.updateMany.mockResolvedValue({ count: 1 });
      resMock.findUnique.mockResolvedValue({ id: 'res-1' });
      await ReservationRepo.updateReservationWithInclude('res-1', gamingCenterId, {}, {});
      expect(resMock.updateMany).toHaveBeenCalled();
      expect(resMock.findUnique).toHaveBeenCalled();
    });

    it('findSettings', async () => {
      settingsMock.findUnique.mockResolvedValue({ id: 's-1' });
      await ReservationRepo.findSettings(gamingCenterId);
      expect(settingsMock.findUnique).toHaveBeenCalled();
    });
  });
});
