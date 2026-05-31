import { describe, it, expect, jest } from '@jest/globals';
import { AuthService } from '../../../../src/modules/auth/auth.station';
import { AuthRepository } from '../../../../src/modules/auth/auth.repository';
import AppError from '../../../../src/common/errors/AppError';
import httpStatus from 'http-status';
import { UserFactory, SessionFactory } from '../../../../tests/factories/user.factory';
import { queueSms } from '../../../../src/jobs/producers/sms.producer';
import { User, Session, PhoneOtp, CustomerAccount, GamingCenter } from '@prisma/client';

jest.mock('../../../../src/modules/auth/auth.repository');
jest.mock('../../../../src/jobs/producers/sms.producer', () => ({
  queueSms: jest.fn(),
}));

// Mock argon2 for performance
jest.mock('argon2', () => ({
  hash: jest.fn().mockImplementation((val) => Promise.resolve(`h_${val}`)),
  verify: jest.fn().mockImplementation((hash, val) => Promise.resolve(hash === `h_${val}`)),
}));

const MockedAuthRepository = AuthRepository as jest.Mocked<typeof AuthRepository>;
const MockedQueueSms = queueSms as jest.MockedFunction<typeof queueSms>;

type UserWithGamingCenter = User & { gamingCenter: GamingCenter };

const T_PHONE = '09000000000';
const T_PASS = 'test';

describe('AuthService', () => {
  describe('loginUser', () => {
    it('should login successfully with valid credentials', async () => {
      const user = UserFactory.create({ passwordHash: `h_${T_PASS}` }) as User;
      const session = SessionFactory.create({ actorId: user.id }) as Session;

      MockedAuthRepository.findUserByPhone.mockResolvedValue(user);
      MockedAuthRepository.createSession.mockResolvedValue(session);

      const result = await AuthService.loginUser(T_PHONE, T_PASS, 'gc-id');

      expect(result.user).toEqual(user);
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
    });

    it('should throw UNAUTHORIZED if user not found', async () => {
      MockedAuthRepository.findUserByPhone.mockResolvedValue(null);

      await expect(AuthService.loginUser(T_PHONE, T_PASS, 'gc-id'))
        .rejects.toThrow(new AppError('Invalid credentials', httpStatus.UNAUTHORIZED));
    });

    it('should throw UNAUTHORIZED if password is invalid', async () => {
      const user = UserFactory.create({ passwordHash: `h_${T_PASS}` }) as User;
      MockedAuthRepository.findUserByPhone.mockResolvedValue(user);

      await expect(AuthService.loginUser(T_PHONE, 'wrong', 'gc-id'))
        .rejects.toThrow(new AppError('Invalid credentials', httpStatus.UNAUTHORIZED));
    });
  });

  describe('requestUserOtp', () => {
    it('should request OTP successfully', async () => {
      const users = [{ id: 'user-1', gamingCenter: { id: 'gc-1', name: 'GC 1' } }] as unknown as UserWithGamingCenter[];
      MockedAuthRepository.findUsersWithSalons.mockResolvedValue(users);
      MockedAuthRepository.createOtp.mockResolvedValue({} as PhoneOtp);

      const result = await AuthService.requestUserOtp(T_PHONE);

      expect(result.message).toContain(`OTP sent to ${T_PHONE}`);
      expect(MockedAuthRepository.createOtp).toHaveBeenCalled();
      expect(MockedQueueSms).toHaveBeenCalled();
    });

    it('should throw NOT_FOUND if no user associated with phone', async () => {
      MockedAuthRepository.findUsersWithSalons.mockResolvedValue([]);

      await expect(AuthService.requestUserOtp(T_PHONE))
        .rejects.toThrow(new AppError('No user found with this phone number.', httpStatus.NOT_FOUND));
    });
  });

  describe('verifyUserOtp', () => {
    it('should verify OTP and return gaming centers', async () => {
      const code = '123456';
      const codeHash = 'h_123456';
      const otp = { id: 'otp-id', codeHash } as PhoneOtp;
      const users = [{ id: 'user-1', gamingCenter: { id: 'gc-1', name: 'GC 1' } }] as unknown as UserWithGamingCenter[];

      MockedAuthRepository.findRecentOtp.mockResolvedValue(otp);
      MockedAuthRepository.consumeOtp.mockResolvedValue({} as PhoneOtp);
      MockedAuthRepository.markUserPhoneVerified.mockResolvedValue({ count: 1 });
      MockedAuthRepository.findUsersWithSalons.mockResolvedValue(users);

      const result = await AuthService.verifyUserOtp(T_PHONE, code);

      expect(result.gamingCenters).toEqual([{ id: 'gc-1', name: 'GC 1' }]);
      expect(MockedAuthRepository.consumeOtp).toHaveBeenCalledWith(otp.id);
    });

    it('should throw UNAUTHORIZED if OTP not found', async () => {
      MockedAuthRepository.findRecentOtp.mockResolvedValue(null);

      await expect(AuthService.verifyUserOtp(T_PHONE, '123456'))
        .rejects.toThrow(new AppError('Invalid or expired OTP.', httpStatus.UNAUTHORIZED));
    });

    it('should throw UNAUTHORIZED if OTP code is invalid', async () => {
      const otp = { id: 'otp-id', codeHash: 'h_valid' } as PhoneOtp;
      MockedAuthRepository.findRecentOtp.mockResolvedValue(otp);

      await expect(AuthService.verifyUserOtp(T_PHONE, 'wrong'))
        .rejects.toThrow(new AppError('Invalid or expired OTP.', httpStatus.UNAUTHORIZED));
    });
  });

  describe('requestCustomerOtp', () => {
    it('should request OTP successfully for customer', async () => {
      MockedAuthRepository.createOtp.mockResolvedValue({} as PhoneOtp);

      const result = await AuthService.requestCustomerOtp(T_PHONE);

      expect(result.message).toContain(`OTP sent to ${T_PHONE}`);
      expect(MockedAuthRepository.createOtp).toHaveBeenCalled();
    });
  });

  describe('verifyCustomerOtp', () => {
    it('should verify OTP for customer successfully', async () => {
      const code = '123456';
      const codeHash = 'h_123456';
      const otp = { id: 'otp-id', codeHash } as PhoneOtp;
      const customer = { id: 'cust-1', phoneVerifiedAt: null } as CustomerAccount;

      MockedAuthRepository.findRecentOtp.mockResolvedValue(otp);
      MockedAuthRepository.consumeOtp.mockResolvedValue({} as PhoneOtp);
      MockedAuthRepository.findCustomerByPhone.mockResolvedValue(customer);
      MockedAuthRepository.markCustomerPhoneVerified.mockResolvedValue({} as CustomerAccount);

      const result = await AuthService.verifyCustomerOtp(T_PHONE, code);

      expect(result.message).toBe('OTP verified successfully.');
      expect(MockedAuthRepository.markCustomerPhoneVerified).toHaveBeenCalledWith(customer.id);
    });
  });

  describe('loginUserWithOtp', () => {
    it('should login user with recently verified OTP', async () => {
      const gamingCenterId = 'gc-1';
      const user = UserFactory.create({ id: 'user-1', phone: T_PHONE }) as User;
      const session = SessionFactory.create({ actorId: user.id }) as Session;

      MockedAuthRepository.findRecentConsumedOtp.mockResolvedValue({} as PhoneOtp);
      MockedAuthRepository.findUserByPhone.mockResolvedValue(user);
      MockedAuthRepository.createSession.mockResolvedValue(session);

      const result = await AuthService.loginUserWithOtp(T_PHONE, gamingCenterId);

      expect(result.user).toEqual(user);
      expect(result.tokens).toHaveProperty('accessToken');
    });

    it('should throw UNAUTHORIZED if no recent OTP found', async () => {
      MockedAuthRepository.findRecentConsumedOtp.mockResolvedValue(null);

      await expect(AuthService.loginUserWithOtp(T_PHONE, 'gc-1'))
        .rejects.toThrow(new AppError('No recent OTP verification found. Please verify again.', httpStatus.UNAUTHORIZED));
    });

    it('should throw UNAUTHORIZED if user not found after OTP verification', async () => {
      MockedAuthRepository.findRecentConsumedOtp.mockResolvedValue({} as PhoneOtp);
      MockedAuthRepository.findUserByPhone.mockResolvedValue(null);

      await expect(AuthService.loginUserWithOtp(T_PHONE, 'gc-1'))
        .rejects.toThrow(new AppError('Invalid credentials for the selected gamingCenter.', httpStatus.UNAUTHORIZED));
    });
  });

  describe('loginCustomer', () => {
    it('should login or register customer successfully', async () => {
      const customer = { id: 'cust-1', phone: T_PHONE, phoneVerifiedAt: new Date() } as CustomerAccount;
      const session = SessionFactory.create({ actorId: customer.id, actorType: 'CUSTOMER' }) as Session;

      MockedAuthRepository.findCustomerByPhone.mockResolvedValue(customer);
      MockedAuthRepository.createSession.mockResolvedValue(session);

      const result = await AuthService.loginCustomer(T_PHONE);

      expect(result.customer).toEqual(customer);
      expect(result.tokens).toHaveProperty('accessToken');
    });

    it('should create new customer if not exists', async () => {
      const customer = { id: 'cust-1', phone: T_PHONE, phoneVerifiedAt: new Date() } as CustomerAccount;
      const session = SessionFactory.create({ actorId: customer.id, actorType: 'CUSTOMER' }) as Session;

      MockedAuthRepository.findCustomerByPhone.mockResolvedValue(null);
      MockedAuthRepository.createCustomer.mockResolvedValue(customer);
      MockedAuthRepository.createSession.mockResolvedValue(session);

      await AuthService.loginCustomer(T_PHONE);

      expect(MockedAuthRepository.createCustomer).toHaveBeenCalledWith(T_PHONE, expect.any(Date));
    });
  });

  describe('refreshAuthToken', () => {
    it('should refresh token successfully', async () => {
      const rToken = 't';
      const session = SessionFactory.create({ expiresAt: new Date(Date.now() + 10000) }) as Session;
      MockedAuthRepository.findSessionByToken.mockResolvedValue(session);

      const result = await AuthService.refreshAuthToken(rToken);

      expect(result).toHaveProperty('accessToken');
    });

    it('should throw UNAUTHORIZED if session not found', async () => {
      MockedAuthRepository.findSessionByToken.mockResolvedValue(null);

      await expect(AuthService.refreshAuthToken('inv'))
        .rejects.toThrow(new AppError('Session is invalid or has been revoked', httpStatus.UNAUTHORIZED));
    });

    it('should throw UNAUTHORIZED and revoke session if expired', async () => {
      const session = SessionFactory.create({ id: 'sess-1', expiresAt: new Date(Date.now() - 10000) }) as Session;
      MockedAuthRepository.findSessionByToken.mockResolvedValue(session);

      await expect(AuthService.refreshAuthToken('exp'))
        .rejects.toThrow(new AppError('Refresh token has expired', httpStatus.UNAUTHORIZED));
      expect(MockedAuthRepository.revokeSession).toHaveBeenCalledWith(session.id);
    });
  });

  describe('logout', () => {
    it('should revoke the session', async () => {
      const sessionId = 'session-id';
      MockedAuthRepository.revokeSession.mockResolvedValue({} as Session);

      const result = await AuthService.logout(sessionId);

      expect(MockedAuthRepository.revokeSession).toHaveBeenCalledWith(sessionId);
      expect(result.message).toBe('Logged out successfully');
    });
  });
});
