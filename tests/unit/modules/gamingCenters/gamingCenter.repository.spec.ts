import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import { gamingCenterRepository } from '../../../../src/modules/gamingCenter/gamingCenter.repository';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('GamingCenterRepository', () => {
  const gcMock = prismaMock.gamingCenter /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;

  describe('create', () => {
    it('should create a gaming center', async () => {
      gcMock.create.mockResolvedValue({ id: 'gc-1', name: 'GC 1' });
      await gamingCenterRepository.create({ name: 'GC 1', slug: 'gc-1' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      expect(gcMock.create).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find by id and isActive', async () => {
      gcMock.findUnique.mockResolvedValue({ id: 'gc-1' });
      await gamingCenterRepository.findById('gc-1');
      expect(gcMock.findUnique).toHaveBeenCalledWith({ where: { id: 'gc-1', isActive: true } });
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      gcMock.findMany.mockResolvedValue([]);
      gcMock.count.mockResolvedValue(0);
      await gamingCenterRepository.findAll({ page: 1, limit: 10 });
      expect(gcMock.findMany).toHaveBeenCalled();
    });

    it('should apply filters, city and game', async () => {
      gcMock.findMany.mockResolvedValue([]);
      gcMock.count.mockResolvedValue(0);
      await gamingCenterRepository.findAll({ page: 1, limit: 10, search: 'GC', city: 'Tehran', game: 'FIFA 24' });
      expect(gcMock.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
          addresses: expect.objectContaining({ some: { city: expect.objectContaining({ contains: 'Tehran' }) } }),
          games: { has: 'FIFA 24' }
        })
      }));
    });
  });

  describe('update', () => {
    it('should update GC', async () => {
      gcMock.update.mockResolvedValue({ id: 'gc-1' });
      await gamingCenterRepository.update('gc-1', { name: 'New Name' });
      expect(gcMock.update).toHaveBeenCalled();
    });
  });

  describe('findBySlug', () => {
    it('should find by slug', async () => {
      gcMock.findUnique.mockResolvedValue({ id: 'gc-1' });
      await gamingCenterRepository.findBySlug('slug');
      expect(gcMock.findUnique).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should mark as inactive', async () => {
      gcMock.update.mockResolvedValue({ id: 'gc-1' });
      await gamingCenterRepository.softDelete('gc-1');
      expect(gcMock.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { isActive: false }
      }));
    });
  });
});
