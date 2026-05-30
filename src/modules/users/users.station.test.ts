import * as userService from './users.station';
import * as userRepo from './users.repo';
import { UserRole, SessionActorType } from '@prisma/client';
import AppError from '../../common/errors/AppError';
import { auditService } from '../audit/audit.station';

// Mock the user repository
jest.mock('./users.repo');
const mockedUserRepo = userRepo as jest.Mocked<typeof userRepo>;

// Mock audit station
jest.mock('../audit/audit.station', () => ({
  auditService: {
    recordLog: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('UserService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStaffMember', () => {
    it('should return a staff member if found', async () => {
      // Arrange
      const gamingCenterId = 'gamingCenter-id-1';
      const userId = 'user-id-1';
      const mockUser = {
        id: userId,
        gamingCenterId: gamingCenterId,
        fullName: 'Test User',
        phone: '1234567890',
        passwordHash: 'hashedpassword',
        phoneVerifiedAt: new Date(),
        role: UserRole.STAFF, // Added required field
        isActive: true,
        isPublic: false, // Added required field
        publicName: null, // Added required field
        bio: null, // Added required field
        avatarUrl: null, // Added required field
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedUserRepo.findUserById.mockResolvedValue(mockUser);

      // Act
      const result = await userService.getStaffMember(gamingCenterId, userId);

      // Assert
      expect(result).toEqual(mockUser);
      expect(mockedUserRepo.findUserById).toHaveBeenCalledWith(gamingCenterId, userId);
      expect(mockedUserRepo.findUserById).toHaveBeenCalledTimes(1);
    });

    it('should throw if staff member is not found', async () => {
      // Arrange
      const gamingCenterId = 'gamingCenter-id-1';
      const userId = 'user-id-not-found';

      mockedUserRepo.findUserById.mockResolvedValue(null);

      // Assert
      await expect(userService.getStaffMember(gamingCenterId, userId)).rejects.toThrow(
        new AppError('Staff member not found', 404)
      );
      expect(mockedUserRepo.findUserById).toHaveBeenCalledWith(gamingCenterId, userId);
      expect(mockedUserRepo.findUserById).toHaveBeenCalledTimes(1);
    });
  });

  describe('createStaffMember', () => {
    it('should create a staff member and record audit log', async () => {
      const gamingCenterId = 'gamingCenter-1';
      const data = { fullName: 'John Doe', phone: '123456789', role: UserRole.STAFF };
      const actor = { id: 'actor-1', actorType: SessionActorType.USER };
      const mockUser = { id: 'user-1', ...data, gamingCenterId, isActive: true, createdAt: new Date(), updatedAt: new Date(), passwordHash: 'hash', phoneVerifiedAt: null, isPublic: false, publicName: null, bio: null, avatarUrl: null };

      mockedUserRepo.createUser.mockResolvedValue(mockUser as never);

      const result = await userService.createStaffMember(gamingCenterId, data, actor);

      expect(result).toEqual(mockUser);
      expect(mockedUserRepo.createUser).toHaveBeenCalledWith(gamingCenterId, data);
      expect(auditService.recordLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'USER_CREATE',
        entityId: 'user-1',
      }));
    });
  });

  describe('getStaffList', () => {
    it('should return list of staff', async () => {
      const gamingCenterId = 'gamingCenter-1';
      const query = { page: 1, limit: 10 };
      const mockStaff = {
        data: [{ id: 'user-1', fullName: 'Staff 1' }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockedUserRepo.listUsersBySalon.mockResolvedValue(mockStaff as never);

      const result = await userService.getStaffList(gamingCenterId, query as never);

      expect(result).toEqual(mockStaff);
      expect(mockedUserRepo.listUsersBySalon).toHaveBeenCalledWith(gamingCenterId, query);
    });
  });

  describe('updateStaffMember', () => {
    it('should update a staff member and record audit log', async () => {
      const gamingCenterId = 'gamingCenter-1';
      const userId = 'user-1';
      const data = { fullName: 'Updated Name' };
      const actor = { id: 'actor-1', actorType: SessionActorType.USER };
      const existingUser = { id: userId, fullName: 'Old Name', gamingCenterId };
      const updatedUser = { id: userId, fullName: 'Updated Name', gamingCenterId };

      mockedUserRepo.findUserById.mockResolvedValueOnce(existingUser as never).mockResolvedValueOnce(updatedUser as never);
      mockedUserRepo.updateUser.mockResolvedValue(updatedUser as never);

      const result = await userService.updateStaffMember(gamingCenterId, userId, data, actor);

      expect(result).toEqual(updatedUser);
      expect(mockedUserRepo.updateUser).toHaveBeenCalledWith(gamingCenterId, userId, data);
      expect(auditService.recordLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'USER_UPDATE',
        entityId: userId,
      }));
    });

    it('should throw if user not found for update', async () => {
      mockedUserRepo.findUserById.mockResolvedValue(null);
      await expect(userService.updateStaffMember('s1', 'u1', {}, {id: 'a1', actorType: SessionActorType.USER}))
        .rejects.toThrow(new AppError('Staff member not found', 404));
    });
  });

  describe('deleteStaffMember', () => {
    it('should soft delete a staff member and record audit log', async () => {
      const gamingCenterId = 'gamingCenter-1';
      const userId = 'user-1';
      const actor = { id: 'actor-1', actorType: SessionActorType.USER };
      const existingUser = { id: userId, fullName: 'User 1', gamingCenterId };

      mockedUserRepo.findUserById.mockResolvedValue(existingUser as never);
      mockedUserRepo.softDeleteUser.mockResolvedValue({} as never);

      await userService.deleteStaffMember(gamingCenterId, userId, actor);

      expect(mockedUserRepo.softDeleteUser).toHaveBeenCalledWith(gamingCenterId, userId);
      expect(auditService.recordLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'USER_DELETE',
        entityId: userId,
      }));
    });

    it('should throw if user not found for delete', async () => {
      mockedUserRepo.findUserById.mockResolvedValue(null);
      await expect(userService.deleteStaffMember('s1', 'u1', {id: 'a1', actorType: SessionActorType.USER}))
        .rejects.toThrow(new AppError('Staff member not found', 404));
    });
  });
});
