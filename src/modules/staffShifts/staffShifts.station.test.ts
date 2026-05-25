import * as shiftsService from './staffShifts.station';
import * as shiftsRepo from './staffShifts.repo';
import * as userRepo from '../users/users.repo';
import AppError from '../../common/errors/AppError';
import { UpsertShiftsInput } from './staffShifts.validators';
import { UserRole } from '@prisma/client';

// Mock repositories
jest.mock('./staffShifts.repo');
jest.mock('../users/users.repo');

const mockedShiftsRepo = shiftsRepo as jest.Mocked<typeof shiftsRepo>;
const mockedUserRepo = userRepo as jest.Mocked<typeof userRepo>;

describe('ShiftsService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('upsertShifts', () => {
    const gamingCenterId = 'gamingCenter-id-1';
    const userId = 'user-id-1';
    const shiftsInput: UpsertShiftsInput = [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true },
    ];
    const mockUser = {
      id: userId,
      gamingCenterId: gamingCenterId,
      fullName: 'Test User',
      phone: '1234567890',
      passwordHash: 'hashedpassword',
      phoneVerifiedAt: new Date(),
      role: UserRole.STAFF,
      isActive: true,
      isPublic: false,
      publicName: null,
      bio: null,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should successfully upsert staffShifts if the user exists', async () => {
      // Arrange
      mockedUserRepo.findUserById.mockResolvedValue(mockUser);
      // Corrected the mock return value to be an array of staffShifts
      mockedShiftsRepo.upsertShifts.mockResolvedValue(shiftsInput.map(s => ({ ...s, id: 'staffShift-id', gamingCenterId, userId, createdAt: new Date(), updatedAt: new Date() })) as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      // Act
      const result = await shiftsService.upsertShifts(gamingCenterId, userId, shiftsInput);

      // Assert
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(shiftsInput.length);
      expect(mockedUserRepo.findUserById).toHaveBeenCalledWith(gamingCenterId, userId);
      expect(mockedShiftsRepo.upsertShifts).toHaveBeenCalledWith(gamingCenterId, userId, shiftsInput);
    });

    it('should throw an AppError if the user does not exist', async () => {
      // Arrange
      mockedUserRepo.findUserById.mockResolvedValue(null);

      // Act & Assert
      await expect(shiftsService.upsertShifts(gamingCenterId, userId, shiftsInput))
        .rejects.toThrow(new AppError('User not found', 404));

      expect(mockedUserRepo.findUserById).toHaveBeenCalledWith(gamingCenterId, userId);
      expect(mockedShiftsRepo.upsertShifts).not.toHaveBeenCalled();
    });
  });
});
