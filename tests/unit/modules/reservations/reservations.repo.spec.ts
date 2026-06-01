import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import { ReservationsRepo } from '../../../../src/modules/reservations/reservations.repo';
import { ReservationStatus } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

describe('ReservationsRepo', () => {
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

      const result = await ReservationsRepo.findStation(id, gamingCenterId, true);
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

      const result = await ReservationsRepo.findStaff(id, gamingCenterId, stationId);
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
    it('should find overlapping reservations', async () => {
      const staffId = 'u-1';
      const startTime = new Date('2023-01-01T10:00:00Z');
      const endTime = new Date('2023-01-01T11:00:00Z');
      resMock.findFirst.mockResolvedValue({ id: 'res-1' });

      const result = await ReservationsRepo.findOverlappingReservation(gamingCenterId, staffId, startTime, endTime);
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

      const result = await ReservationsRepo.updateReservation(id, gamingCenterId, data);
      expect(result).toEqual(mockRes);
      expect(resMock.updateMany).toHaveBeenCalledWith({
        where: { id, gamingCenterId },
        data,
      });
    });

    it('should return null if no reservation updated', async () => {
      resMock.updateMany.mockResolvedValue({ count: 0 });
      const result = await ReservationsRepo.updateReservation('res-1', gamingCenterId, {});
      expect(result).toBeNull();
    });
  });

  describe('transaction', () => {
    it('should use prisma transaction', async () => {
      (prismaMock /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).$transaction.mockResolvedValue('success');
      const result = await ReservationsRepo.transaction(async (tx) => 'success');
      expect(result).toBe('success');
      expect((prismaMock /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).$transaction).toHaveBeenCalled();
    });
  });

  describe('Other operations', () => {
    it('findGamingCenterWithSettings', async () => {
      gcMock.findUnique.mockResolvedValue({ id: gamingCenterId });
      await ReservationsRepo.findGamingCenterWithSettings(gamingCenterId);
      expect(gcMock.findUnique).toHaveBeenCalled();
    });

    it('findGamingCenterBySlugWithSettings', async () => {
      gcMock.findUnique.mockResolvedValue({ id: gamingCenterId });
      await ReservationsRepo.findGamingCenterBySlugWithSettings('slug');
      expect(gcMock.findUnique).toHaveBeenCalled();
    });

    it('findStaffShift', async () => {
      shiftMock.findFirst.mockResolvedValue({ id: 'shift-1' });
      await ReservationsRepo.findStaffShift(gamingCenterId, 'u-1', 1);
      expect(shiftMock.findFirst).toHaveBeenCalled();
    });

    it('findCustomerAccountByPhone', async () => {
      accountMock.findUnique.mockResolvedValue({ id: 'c-1' });
      await ReservationsRepo.findCustomerAccountByPhone('phone');
      expect(accountMock.findUnique).toHaveBeenCalled();
    });

    it('createCustomerAccount', async () => {
      accountMock.create.mockResolvedValue({ id: 'c-1' });
      await ReservationsRepo.createCustomerAccount({ phone: 'phone' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      expect(accountMock.create).toHaveBeenCalled();
    });

    it('findCustomerProfile', async () => {
      profileMock.findUnique.mockResolvedValue({ id: 'cp-1' });
      await ReservationsRepo.findCustomerProfile(gamingCenterId, 'ca-1');
      expect(profileMock.findUnique).toHaveBeenCalled();
    });

    it('createCustomerProfile', async () => {
      profileMock.create.mockResolvedValue({ id: 'cp-1' });
      await ReservationsRepo.createCustomerProfile({ gamingCenterId, customerAccountId: 'ca-1' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      expect(profileMock.create).toHaveBeenCalled();
    });

    it('createReservation', async () => {
      resMock.create.mockResolvedValue({ id: 'res-1' });
      await ReservationsRepo.createReservation({} /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      expect(resMock.create).toHaveBeenCalled();
    });

    it('findReservationById', async () => {
      resMock.findFirst.mockResolvedValue({ id: 'res-1' });
      await ReservationsRepo.findReservationById('res-1', gamingCenterId);
      expect(resMock.findFirst).toHaveBeenCalled();
    });

    it('findManyReservations', async () => {
      resMock.findMany.mockResolvedValue([]);
      await ReservationsRepo.findManyReservations({}, 0, 10, {});
      expect(resMock.findMany).toHaveBeenCalled();
    });

    it('countReservations', async () => {
      resMock.count.mockResolvedValue(0);
      await ReservationsRepo.countReservations({});
      expect(resMock.count).toHaveBeenCalled();
    });

    it('updateReservationWithInclude', async () => {
      resMock.updateMany.mockResolvedValue({ count: 1 });
      resMock.findUnique.mockResolvedValue({ id: 'res-1' });
      await ReservationsRepo.updateReservationWithInclude('res-1', gamingCenterId, {}, {});
      expect(resMock.updateMany).toHaveBeenCalled();
      expect(resMock.findUnique).toHaveBeenCalled();
    });

    it('findSettings', async () => {
      settingsMock.findUnique.mockResolvedValue({ id: 's-1' });
      await ReservationsRepo.findSettings(gamingCenterId);
      expect(settingsMock.findUnique).toHaveBeenCalled();
    });
  });
});
