import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createStaffMember, updateStaffMember, deleteStaffMember } from '../../../../src/modules/users/users.station';
import * as userRepo from '../../../../src/modules/users/users.repo';
import { gamingCenterStation } from '../../../../src/modules/gamingCenter/gamingCenter.station';
import { gamingCenterRepository } from '../../../../src/modules/gamingCenter/gamingCenter.repository';
import { SessionActorType, UserRole } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../../src/modules/users/users.repo');
jest.mock('../../../../src/modules/gamingCenter/gamingCenter.repository');
jest.mock('../../../../src/modules/audit/audit.station', () => ({
  auditService: {
    recordLog: jest.fn(),
    log: jest.fn(),
  },
}));
jest.mock('../../../../src/common/middleware/auth', () => ({
  invalidateActorCache: jest.fn(),
}));

const MockUserRepo = userRepo as jest.Mocked<typeof userRepo>;
const MockGamingCenterRepo = gamingCenterRepository as jest.Mocked<typeof gamingCenterRepository>;

describe('1-to-1 Manager & GamingCenter Business Constraints', () => {
  const gamingCenterId = 'center-100';
  const actor = { id: 'admin-1', actorType: SessionActorType.USER, role: UserRole.MANAGER };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createStaffMember (MANAGER role)', () => {
    it('should reject when gaming center already has a manager assigned in gamingCenter record', async () => {
      MockUserRepo.findGamingCenterManager.mockResolvedValue({ managerId: 'existing-mgr-id' });

      await expect(
        createStaffMember(gamingCenterId, { fullName: 'Second Mgr', phone: '09121111111', role: UserRole.MANAGER }, actor)
      ).rejects.toThrow('Each gaming center can only have one manager.');

      expect(MockUserRepo.createUser).not.toHaveBeenCalled();
    });

    it('should reject when gaming center already has an active manager in user records', async () => {
      MockUserRepo.findGamingCenterManager.mockResolvedValue({ managerId: null });
      MockUserRepo.findActiveManagerInCenter.mockResolvedValue({ id: 'u-mgr-1', fullName: 'Existing' } as any);

      await expect(
        createStaffMember(gamingCenterId, { fullName: 'Second Mgr', phone: '09121111111', role: UserRole.MANAGER }, actor)
      ).rejects.toThrow('Each gaming center can only have one manager.');

      expect(MockUserRepo.createUser).not.toHaveBeenCalled();
    });

    it('should reject when manager phone already manages another gaming center', async () => {
      MockUserRepo.findGamingCenterManager.mockResolvedValue({ managerId: null });
      MockUserRepo.findActiveManagerInCenter.mockResolvedValue(null);
      MockUserRepo.findManagerByPhone.mockResolvedValue({ id: 'other-user', phone: '09121111111', role: 'MANAGER' } as any);

      await expect(
        createStaffMember(gamingCenterId, { fullName: 'Multi Mgr', phone: '09121111111', role: UserRole.MANAGER }, actor)
      ).rejects.toThrow('A manager can only manage one gaming center.');

      expect(MockUserRepo.createUser).not.toHaveBeenCalled();
    });

    it('should succeed and link managerId to gaming center when no prior manager exists', async () => {
      MockUserRepo.findGamingCenterManager.mockResolvedValue({ managerId: null });
      MockUserRepo.findActiveManagerInCenter.mockResolvedValue(null);
      MockUserRepo.findManagerByPhone.mockResolvedValue(null);
      const createdUser = { id: 'new-mgr', fullName: 'Sole Mgr', phone: '09121111111', role: UserRole.MANAGER, gamingCenterId } as any;
      MockUserRepo.createUser.mockResolvedValue(createdUser);

      const res = await createStaffMember(gamingCenterId, { fullName: 'Sole Mgr', phone: '09121111111', role: UserRole.MANAGER }, actor);

      expect(res).toEqual(createdUser);
      expect(MockUserRepo.createUser).toHaveBeenCalled();
      expect(MockUserRepo.setGamingCenterManager).toHaveBeenCalledWith(gamingCenterId, 'new-mgr');
    });
  });

  describe('updateStaffMember (Role promotion to MANAGER)', () => {
    it('should reject promoting a staff member to MANAGER if center already has another manager', async () => {
      MockUserRepo.findUserById.mockResolvedValue({ id: 'staff-1', role: UserRole.STAFF, gamingCenterId } as any);
      MockUserRepo.findGamingCenterManager.mockResolvedValue({ managerId: 'mgr-current' });

      await expect(
        updateStaffMember(gamingCenterId, 'staff-1', { role: UserRole.MANAGER }, actor)
      ).rejects.toThrow('Each gaming center can only have one manager.');

      expect(MockUserRepo.updateUser).not.toHaveBeenCalled();
    });

    it('should reject promoting a staff member who already manages another gaming center', async () => {
      MockUserRepo.findUserById.mockResolvedValue({ id: 'staff-1', role: UserRole.STAFF, gamingCenterId } as any);
      MockUserRepo.findGamingCenterManager.mockResolvedValue({ managerId: null });
      MockUserRepo.findActiveManagerInCenter.mockResolvedValue(null);
      MockUserRepo.findOtherCenterManagedByUser.mockResolvedValue({ id: 'other-gc', managerId: 'staff-1' } as any);

      await expect(
        updateStaffMember(gamingCenterId, 'staff-1', { role: UserRole.MANAGER }, actor)
      ).rejects.toThrow('A manager can only manage one gaming center.');

      expect(MockUserRepo.updateUser).not.toHaveBeenCalled();
    });

    it('should clear managerId from center when a manager is demoted to STAFF', async () => {
      MockUserRepo.findUserById.mockResolvedValue({ id: 'mgr-1', role: UserRole.MANAGER, gamingCenterId } as any);

      await updateStaffMember(gamingCenterId, 'mgr-1', { role: UserRole.STAFF }, actor);

      expect(MockUserRepo.updateUser).toHaveBeenCalledWith(gamingCenterId, 'mgr-1', { role: UserRole.STAFF });
      expect(MockUserRepo.clearGamingCenterManager).toHaveBeenCalledWith(gamingCenterId, 'mgr-1');
    });
  });

  describe('deleteStaffMember', () => {
    it('should clear managerId from center when deleting the manager', async () => {
      MockUserRepo.findUserById.mockResolvedValue({ id: 'mgr-1', role: UserRole.MANAGER, gamingCenterId } as any);

      await deleteStaffMember(gamingCenterId, 'mgr-1', actor);

      expect(MockUserRepo.softDeleteUser).toHaveBeenCalledWith(gamingCenterId, 'mgr-1');
      expect(MockUserRepo.clearGamingCenterManager).toHaveBeenCalledWith(gamingCenterId, 'mgr-1');
    });
  });

  describe('gamingCenterStation.createGamingCenter (1-to-1 manager constraints)', () => {
    it('should reject when user already manages another gaming center', async () => {
      MockGamingCenterRepo.findBySlug.mockResolvedValue(null);
      MockGamingCenterRepo.findUserById.mockResolvedValue({
        id: 'user-1',
        fullName: 'Busy Manager',
        gamingCenterId: null,
        role: UserRole.MANAGER,
      } as any);

      const fakeTx = {
        gamingCenter: {
          findUnique: jest.fn().mockImplementation((args: any) => {
            if (args?.where?.managerId === 'user-1') {
              return Promise.resolve({ id: 'existing-center', managerId: 'user-1' });
            }
            return Promise.resolve(null);
          }),
        },
      };

      MockGamingCenterRepo.transaction.mockImplementation((cb: any) => cb(fakeTx));
      MockGamingCenterRepo.create.mockResolvedValue({ id: 'new-center', name: 'New', slug: 'new' } as any);

      await expect(
        gamingCenterStation.createGamingCenter({ name: 'New', slug: 'new', ownerId: 'user-1' } as any)
      ).rejects.toThrow('A manager can only manage one gaming center.');
    });
  });
});
