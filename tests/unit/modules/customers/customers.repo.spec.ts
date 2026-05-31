import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import * as CustomersRepo from '../../../../src/modules/customers/customers.repo';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('CustomersRepo', () => {
  const profileMock = prismaMock.customerProfile as any;
  const accountMock = prismaMock.customerAccount as any;
  const gamingCenterId = 'gc-1';

  describe('findManyProfiles', () => {
    it('should return paginated profiles', async () => {
      profileMock.findMany.mockResolvedValue([{ id: 'cp-1', customerAccount: { id: 'ca-1' } }]);
      profileMock.count.mockResolvedValue(1);

      const result = await CustomersRepo.findManyProfiles(gamingCenterId, { page: 1, limit: 10 });
      expect(result.customers).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should apply search filter', async () => {
      profileMock.findMany.mockResolvedValue([]);
      profileMock.count.mockResolvedValue(0);

      await CustomersRepo.findManyProfiles(gamingCenterId, { search: 'John', page: 1, limit: 10 });
      expect(profileMock.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ displayName: { contains: 'John', mode: 'insensitive' } })
          ])
        })
      }));
    });
  });

  describe('findProfileById', () => {
    it('should find profile by id', async () => {
      profileMock.findFirst.mockResolvedValue({ id: 'cp-1' });
      await CustomersRepo.findProfileById(gamingCenterId, 'cp-1');
      expect(profileMock.findFirst).toHaveBeenCalled();
    });
  });

  describe('findProfileByAccountId', () => {
    it('should find profile by account id', async () => {
      profileMock.findUnique.mockResolvedValue({ id: 'cp-1' });
      await CustomersRepo.findProfileByAccountId(gamingCenterId, 'ca-1');
      expect(profileMock.findUnique).toHaveBeenCalled();
    });
  });

  describe('createProfile', () => {
    it('should create profile', async () => {
      profileMock.create.mockResolvedValue({ id: 'cp-1' });
      await CustomersRepo.createProfile({ gamingCenterId, customerAccountId: 'ca-1' });
      expect(profileMock.create).toHaveBeenCalled();
    });
  });

  describe('upsertCustomerAccount', () => {
    it('should upsert account', async () => {
      accountMock.upsert.mockResolvedValue({ id: 'ca-1', phone: '0912' });
      await CustomersRepo.upsertCustomerAccount('0912', 'John Doe');
      expect(accountMock.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { phone: '0912' }
      }));
    });
  });

  describe('updateProfile', () => {
    it('should update and return profile', async () => {
      profileMock.updateMany.mockResolvedValue({ count: 1 });
      profileMock.findUnique.mockResolvedValue({ id: 'cp-1' });
      await CustomersRepo.updateProfile('cp-1', gamingCenterId, { note: 'new note' });
      expect(profileMock.updateMany).toHaveBeenCalled();
      expect(profileMock.findUnique).toHaveBeenCalled();
    });
  });

  describe('deleteProfile', () => {
    it('should delete if belongs to GC', async () => {
      profileMock.findFirst.mockResolvedValue({ id: 'cp-1' });
      profileMock.delete.mockResolvedValue({ id: 'cp-1' });
      await CustomersRepo.deleteProfile('cp-1', gamingCenterId);
      expect(profileMock.delete).toHaveBeenCalled();
    });

    it('should return null if not found', async () => {
      profileMock.findFirst.mockResolvedValue(null);
      const result = await CustomersRepo.deleteProfile('cp-1', gamingCenterId);
      expect(result).toBeNull();
    });
  });
});
