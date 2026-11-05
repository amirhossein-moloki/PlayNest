import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import { gamingCenterRepository, checkIsOpen, transformGamingCenter } from '../../../../src/modules/gamingCenter/gamingCenter.repository';

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
    it('should find by id and isActive and transform', async () => {
      gcMock.findFirst.mockResolvedValue({
        id: 'center_10',
        name: 'کافی گیم نت آرشا',
        isActive: true,
        slug: 'arsha-cafe-game-net',
        description: 'مرکز نمونه',
        pcCount: 10,
        consoleCount: 4,
        hourlyRate: 70000,
        openingTime: '10:00',
        closingTime: '23:00',
        createdAt: new Date(),
        updatedAt: new Date(),
        addresses: [],
        stations: [
          { id: 'st-1', stationType: 'PC', name: 'PC-1' },
          { id: 'st-2', stationType: 'PLAYSTATION', name: 'PS5-Console' },
        ],
        ratings: [
          { rating: 5, comment: 'عالی', status: 'PUBLISHED' },
          { rating: 4, comment: 'خوب', status: 'PUBLISHED' },
        ],
        settings: null,
      });

      const result = await gamingCenterRepository.findById('center_10');
      expect(gcMock.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { id: 'center_10' },
            { slug: 'center_10' },
          ],
          isActive: true,
        },
        include: {
          addresses: true,
          stations: true,
          ratings: true,
          settings: true,
          manager: true,
        },
      });

      expect(result).toBeDefined();
      expect(result?.pc).toBe(true);
      expect(result?.ps5).toBe(true);
      expect(result?.ps4).toBe(false);
      expect(result?.xbox).toBe(false);
      expect(result?.raiting).toBe(4.5);
      expect(result?.comment_count).toBe(2);
      expect(typeof result?.is_open).toBe('boolean');
    });

    it('should find by slug and isActive and transform', async () => {
      gcMock.findFirst.mockResolvedValue({
        id: 'center_10',
        name: 'کافی گیم نت آرشا',
        isActive: true,
        slug: 'arsha-cafe-game-net',
        description: 'مرکز نمونه',
        pcCount: 10,
        consoleCount: 4,
        hourlyRate: 70000,
        openingTime: '10:00',
        closingTime: '23:00',
        createdAt: new Date(),
        updatedAt: new Date(),
        addresses: [],
        stations: [],
        ratings: [],
        settings: null,
      });

      const result = await gamingCenterRepository.findById('arsha-cafe-game-net');
      expect(gcMock.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { id: 'arsha-cafe-game-net' },
            { slug: 'arsha-cafe-game-net' },
          ],
          isActive: true,
        },
        include: {
          addresses: true,
          stations: true,
          ratings: true,
          settings: true,
          manager: true,
        },
      });

      expect(result).toBeDefined();
      expect(result?.slug).toBe('arsha-cafe-game-net');
    });

    it('should return null when not found', async () => {
      gcMock.findFirst.mockResolvedValue(null);
      const result = await gamingCenterRepository.findById('missing');
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return paginated results with calculated fields', async () => {
      gcMock.findMany.mockResolvedValue([
        {
          id: 'center_10',
          name: 'کافی گیم نت آرشا',
          isActive: true,
          slug: 'arsha-cafe-game-net',
          description: 'مرکز نمونه برای محیط تست PlayNest؛ اطلاعات عملیاتی تولیدشده مصنوعی است.',
          pcCount: 10,
          consoleCount: 4,
          hourlyRate: 70000,
          openingTime: '10:00',
          closingTime: '23:00',
          createdAt: new Date('2026-11-01T22:08:38.760Z'),
          updatedAt: new Date('2026-11-01T22:08:38.760Z'),
          addresses: [
            {
              id: 'address_10',
              gamingCenterId: 'center_10',
              title: null,
              province: 'آذربایجان شرقی',
              city: 'تبریز',
              district: 'باغمیشه',
              addressLine: 'تبریز، باغمیشه، محدوده امیرکبیر',
              lat: null,
              lng: null,
              isPrimary: true,
              createdAt: new Date('2026-11-01T22:08:38.896Z'),
              updatedAt: new Date('2026-11-01T22:08:38.896Z'),
            },
          ],
          stations: [
            { id: 'st-1', stationType: 'PLAYSTATION', name: 'PS4-Pro' },
            { id: 'st-2', stationType: 'PC', name: 'PC-VIP' },
          ],
          ratings: [
            { rating: 5, comment: 'Great', status: 'PUBLISHED' },
            { rating: 4, comment: 'Nice', status: 'PUBLISHED' },
          ],
          settings: null,
        },
      ]);
      gcMock.count.mockResolvedValue(1);

      const res = await gamingCenterRepository.findAll({ page: 1, limit: 10 });
      expect(gcMock.findMany).toHaveBeenCalled();
      expect(res.data.length).toBe(1);
      const item = res.data[0];
      expect(item.id).toBe('center_10');
      expect(item.name).toBe('کافی گیم نت آرشا');
      expect(item.pcCount).toBe(10);
      expect(item.consoleCount).toBe(4);
      expect(item.pc).toBe(true);
      expect(item.ps4).toBe(true);
      expect(item.ps5).toBe(false);
      expect(item.xbox).toBe(false);
      expect(item.hourlyRate).toBe(70000);
      expect(item.raiting).toBe(4.5);
      expect(item.comment_count).toBe(2);
      expect(typeof item.is_open).toBe('boolean');
      expect(item.addresses.length).toBe(1);
    });

    it('should apply filters, city and game', async () => {
      gcMock.findMany.mockResolvedValue([]);
      gcMock.count.mockResolvedValue(0);
      await gamingCenterRepository.findAll({ page: 1, limit: 10, search: 'GC', city: 'Tehran', game: 'FIFA 24' });
      expect(gcMock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
            addresses: expect.objectContaining({ some: { city: expect.objectContaining({ contains: 'Tehran' }) } }),
            games: { has: 'FIFA 24' },
          }),
        })
      );
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
      gcMock.findFirst.mockResolvedValue({ id: 'gc-1' });
      await gamingCenterRepository.findBySlug('slug');
      expect(gcMock.findFirst).toHaveBeenCalledWith({
        where: { slug: 'slug', isActive: true },
      });
    });
  });

  describe('softDelete', () => {
    it('should mark as inactive', async () => {
      gcMock.update.mockResolvedValue({ id: 'gc-1' });
      await gamingCenterRepository.softDelete('gc-1');
      expect(gcMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        })
      );
    });
  });

  describe('checkIsOpen helper', () => {
    it('should return true if opening or closing time is missing', () => {
      expect(checkIsOpen(null, null)).toBe(true);
      expect(checkIsOpen('10:00', null)).toBe(true);
    });

    it('should correctly evaluate daytime schedules', () => {
      const nowDuring = new Date('2026-11-02T10:00:00Z'); // 13:30 Tehran time
      expect(checkIsOpen('10:00', '23:00', 'UTC', nowDuring)).toBe(true);

      const nowAfter = new Date('2026-11-02T23:30:00Z');
      expect(checkIsOpen('10:00', '23:00', 'UTC', nowAfter)).toBe(false);
    });

    it('should correctly evaluate overnight schedules', () => {
      const nowMidnight = new Date('2026-11-02T01:00:00Z');
      expect(checkIsOpen('14:00', '03:00', 'UTC', nowMidnight)).toBe(true);

      const nowMorning = new Date('2026-11-02T08:00:00Z');
      expect(checkIsOpen('14:00', '03:00', 'UTC', nowMorning)).toBe(false);
    });
  });

  describe('transformGamingCenter helper', () => {
    it('should handle zero ratings properly', () => {
      const transformed = transformGamingCenter({
        id: 'gc-empty',
        name: 'Empty Center',
        isActive: true,
        slug: 'empty',
        description: null,
        pcCount: 0,
        consoleCount: 0,
        hourlyRate: 50000,
        openingTime: null,
        closingTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        addresses: [],
        stations: [],
        ratings: [],
        settings: null,
      } as any);

      expect(transformed.raiting).toBe(0);
      expect(transformed.comment_count).toBe(0);
      expect(transformed.pc).toBe(false);
      expect(transformed.ps4).toBe(false);
      expect(transformed.ps5).toBe(false);
      expect(transformed.xbox).toBe(false);
      expect(transformed.is_open).toBe(true);
    });
  });
});
