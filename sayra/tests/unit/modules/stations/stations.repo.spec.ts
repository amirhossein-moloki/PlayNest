import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import * as StationRepo from '../../../../src/modules/station/station.repo';
import { GameStationType } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('StationRepo', () => {
  const gamingCenterId = 'gc-1';
  const stationMock = prismaMock.gameStation /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;

  describe('createStation', () => {
    it('should create a station successfully', async () => {
      const data = { name: 'Station 1', hourlyPrice: 100, stationType: GameStationType.PC };
      const mockStation = { id: 's-1', gamingCenterId, ...data };
      stationMock.create.mockResolvedValue(mockStation);

      const result = await StationRepo.createStation(gamingCenterId, data /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      expect(result).toEqual(mockStation);
      expect(stationMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Station 1', gamingCenterId }),
      });
    });
  });

  describe('findStationById', () => {
    it('should find a station by ID', async () => {
      const mockStation = { id: 's-1', gamingCenterId, name: 'Station 1' };
      stationMock.findFirst.mockResolvedValue(mockStation);

      const result = await StationRepo.findStationById('s-1', gamingCenterId);
      expect(result).toEqual(mockStation);
      expect(stationMock.findFirst).toHaveBeenCalledWith({
        where: { id: 's-1', gamingCenterId },
      });
    });
  });

  describe('findStationsByGamingCenterId', () => {
    it('should return paginated station', async () => {
      stationMock.findMany.mockResolvedValue([{ id: 's-1' }]);
      stationMock.count.mockResolvedValue(1);

      const result = await StationRepo.findStationsByGamingCenterId(gamingCenterId, { page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply filters', async () => {
      stationMock.findMany.mockResolvedValue([]);
      stationMock.count.mockResolvedValue(0);

      await StationRepo.findStationsByGamingCenterId(gamingCenterId, {
        page: 1,
        limit: 10,
        search: 'Pro',
        minPrice: 50,
        maxPrice: 200,
        isVip: true,
        staffId: 'u-1'
      });

      expect(stationMock.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: 'Pro', mode: 'insensitive' },
          hourlyPrice: { gte: 50, lte: 200 },
          isVip: true,
          staffSkills: { some: { userId: 'u-1' } }
        }),
      }));
    });

    it('should use provided isActive filter', async () => {
      stationMock.findMany.mockResolvedValue([]);
      stationMock.count.mockResolvedValue(0);

      await StationRepo.findStationsByGamingCenterId(gamingCenterId, { page: 1, limit: 10, isActive: false });
      expect(stationMock.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ isActive: false }),
      }));
    });

    it('should apply custom sorting', async () => {
      stationMock.findMany.mockResolvedValue([]);
      stationMock.count.mockResolvedValue(0);

      await StationRepo.findStationsByGamingCenterId(gamingCenterId, { page: 1, limit: 10, sortBy: 'name', sortOrder: 'asc' });
      expect(stationMock.findMany).toHaveBeenCalledWith(expect.objectContaining({
        orderBy: { name: 'asc' },
      }));
    });
  });

  describe('updateStation', () => {
    it('should update and return station', async () => {
      stationMock.updateMany.mockResolvedValue({ count: 1 });
      stationMock.findFirst.mockResolvedValue({ id: 's-1', name: 'Updated' });

      const result = await StationRepo.updateStation('s-1', gamingCenterId, { name: 'Updated' });
      expect(result.name).toBe('Updated');
      expect(stationMock.updateMany).toHaveBeenCalled();
    });
  });

  describe('deactivateStation', () => {
    it('should mark station as inactive', async () => {
      stationMock.updateMany.mockResolvedValue({ count: 1 });
      stationMock.findFirst.mockResolvedValue({ id: 's-1', isActive: false });

      const result = await StationRepo.deactivateStation('s-1', gamingCenterId);
      expect(result.isActive).toBe(false);
      expect(stationMock.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: { isActive: false }
      }));
    });
  });
});
