import { AuthService } from './auth.station';
import { AuthRepository } from './auth.repository';
import argon2 from 'argon2';

// Mock the repository object
jest.mock('./auth.repository', () => ({
  AuthRepository: {
    findUserByPhone: jest.fn(),
    createSession: jest.fn(),
    findSessionByToken: jest.fn(),
    revokeSession: jest.fn(),
    findUsersWithSalons: jest.fn(),
  },
}));

jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('../notifications/sms.station');

describe('AuthService', () => {
  beforeEach(() => {
    process.env.SMSIR_OTP_TEMPLATE_ID = '123';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(AuthService).toBeDefined();
  });

  describe('loginUser', () => {
    it('should login a user with valid credentials', async () => {
      const mockUser = { id: 'user-1', passwordHash: 'hashed-pw' };
      (AuthRepository.findUserByPhone as jest.Mock).mockResolvedValue(mockUser);
      (AuthRepository.createSession as jest.Mock).mockResolvedValue({ id: 'session-1' });

      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await AuthService.loginUser('1234567890', 'password', 'gamingCenter-1');

      expect(result.user).toEqual(mockUser);
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
    });

    it('should throw UNAUTHORIZED for invalid password', async () => {
      const mockUser = { id: 'user-1', passwordHash: 'hashed-pw' };
      (AuthRepository.findUserByPhone as jest.Mock).mockResolvedValue(mockUser);

      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(AuthService.loginUser('1234567890', 'wrong', 'gamingCenter-1'))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('refreshAuthToken', () => {
    it('should return new access token for valid refresh token', async () => {
      const mockSession = {
        id: 'session-1',
        actorId: 'actor-1',
        actorType: 'USER',
        expiresAt: new Date(Date.now() + 10000)
      };
      (AuthRepository.findSessionByToken as jest.Mock).mockResolvedValue(mockSession);

      const result = await AuthService.refreshAuthToken('valid-token');

      expect(result).toHaveProperty('accessToken');
    });

    it('should throw if session is expired', async () => {
      const mockSession = {
        id: 'session-1',
        expiresAt: new Date(Date.now() - 10000)
      };
      (AuthRepository.findSessionByToken as jest.Mock).mockResolvedValue(mockSession);
      (AuthRepository.revokeSession as jest.Mock).mockResolvedValue(undefined);

      await expect(AuthService.refreshAuthToken('expired-token')).rejects.toThrow('Refresh token has expired');
    });
  });
});
