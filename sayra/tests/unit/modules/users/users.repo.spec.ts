import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import * as UsersRepo from '../../../../src/modules/users/users.repo';
import { UserRole } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('UsersRepository', () => {
  const gamingCenterId = 'gc-1';
  const userMock = prismaMock.user /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;

  describe('createUser', () => {
    it('should create a user successfully', async () => {
      const userInput = {
        fullName: 'John Doe',
        phone: '09123456789',
        role: UserRole.STAFF,
      };
      const mockUser = { id: 'u-1', gamingCenterId, ...userInput, isActive: true, createdAt: new Date(), updatedAt: new Date() };

      userMock.create.mockResolvedValue(mockUser);

      const result = await UsersRepo.createUser(gamingCenterId, userInput);

      expect(result).toEqual(mockUser);
      expect(userMock.create).toHaveBeenCalledWith({
        data: {
          gamingCenterId,
          ...userInput,
        },
      });
    });
  });

  describe('softDeleteUser', () => {
    it('should mark a user as inactive', async () => {
      const userId = 'u-1';
      userMock.updateMany.mockResolvedValue({ count: 1 });

      const result = await UsersRepo.softDeleteUser(gamingCenterId, userId);

      expect(result.count).toBe(1);
      expect(userMock.updateMany).toHaveBeenCalledWith({
        where: { id: userId, gamingCenterId },
        data: { isActive: false },
      });
    });
  });

  describe('findUserById', () => {
    it('should return a user if found', async () => {
      const userId = 'u-1';
      const mockUser = { id: userId, gamingCenterId, fullName: 'John Doe' };
      userMock.findFirst.mockResolvedValue(mockUser);

      const result = await UsersRepo.findUserById(gamingCenterId, userId);

      expect(result).toEqual(mockUser);
      expect(userMock.findFirst).toHaveBeenCalledWith({
        where: { id: userId, gamingCenterId },
      });
    });

    it('should return null if user not found', async () => {
      userMock.findFirst.mockResolvedValue(null);
      const result = await UsersRepo.findUserById(gamingCenterId, 'non-existent');
      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user fields', async () => {
      const userId = 'u-1';
      const updateData = { fullName: 'Jane Doe' };
      userMock.updateMany.mockResolvedValue({ count: 1 });

      const result = await UsersRepo.updateUser(gamingCenterId, userId, updateData);

      expect(result.count).toBe(1);
      expect(userMock.updateMany).toHaveBeenCalledWith({
        where: { id: userId, gamingCenterId },
        data: updateData,
      });
    });
  });

  describe('listUsersByGamingCenter', () => {
    it('should return paginated users with default filters', async () => {
      const mockUsers = [{ id: 'u-1' }, { id: 'u-2' }];
      const mockCount = 2;

      userMock.findMany.mockResolvedValue(mockUsers);
      userMock.count.mockResolvedValue(mockCount);

      const query = { page: 1, limit: 10 };
      const result = await UsersRepo.listUsersByGamingCenter(gamingCenterId, query);

      expect(result.data).toEqual(mockUsers);
      expect(result.meta.total).toBe(mockCount);
      expect(userMock.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { gamingCenterId, isActive: true },
        skip: 0,
        take: 10,
      }));
    });

    it('should use provided isActive filter', async () => {
      userMock.findMany.mockResolvedValue([]);
      userMock.count.mockResolvedValue(0);

      await UsersRepo.listUsersByGamingCenter(gamingCenterId, { page: 1, limit: 10, isActive: false });

      expect(userMock.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ isActive: false }),
      }));
    });

    it('should use provided isPublic filter', async () => {
      userMock.findMany.mockResolvedValue([]);
      userMock.count.mockResolvedValue(0);

      await UsersRepo.listUsersByGamingCenter(gamingCenterId, { page: 1, limit: 10, isPublic: true });

      expect(userMock.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ isPublic: true }),
      }));
    });

    it('should apply search filter', async () => {
      userMock.findMany.mockResolvedValue([]);
      userMock.count.mockResolvedValue(0);

      const query = { page: 1, limit: 10, search: 'John' };
      await UsersRepo.listUsersByGamingCenter(gamingCenterId, query);

      expect(userMock.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { fullName: { contains: 'John', mode: 'insensitive' } },
            { phone: { contains: 'John', mode: 'insensitive' } },
          ],
        }),
      }));
    });

    it('should filter by role', async () => {
      userMock.findMany.mockResolvedValue([]);
      userMock.count.mockResolvedValue(0);

      const query = { page: 1, limit: 10, role: UserRole.MANAGER };
      await UsersRepo.listUsersByGamingCenter(gamingCenterId, query);

      expect(userMock.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ role: UserRole.MANAGER }),
      }));
    });

    it('should filter by stationId (skills)', async () => {
      userMock.findMany.mockResolvedValue([]);
      userMock.count.mockResolvedValue(0);

      const query = { page: 1, limit: 10, stationId: 'station-1' };
      await UsersRepo.listUsersByGamingCenter(gamingCenterId, query);

      expect(userMock.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          stationSkills: {
            some: { stationId: 'station-1' },
          },
        }),
      }));
    });

    it('should apply custom sorting', async () => {
      userMock.findMany.mockResolvedValue([]);
      userMock.count.mockResolvedValue(0);

      const query = { page: 1, limit: 10, sortBy: 'fullName', sortOrder: 'desc' as const };
      await UsersRepo.listUsersByGamingCenter(gamingCenterId, query);

      expect(userMock.findMany).toHaveBeenCalledWith(expect.objectContaining({
        orderBy: { fullName: 'desc' },
      }));
    });
  });
});
