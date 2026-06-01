import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import { AuthRepository } from '../../../../src/modules/auth/auth.repository';
import { SessionActorType } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('AuthRepository', () => {
  const phone = '09123456789';
  const gamingCenterId = 'gc-1';

  const userMock = prismaMock.user /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const customerMock = prismaMock.customerAccount /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const otpMock = prismaMock.phoneOtp /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const sessionMock = prismaMock.session /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;

  describe('findUserByPhone', () => {
    it('should find a user by phone and gamingCenterId', async () => {
      const mockUser = { id: 'u-1', phone, gamingCenterId };
      userMock.findFirst.mockResolvedValue(mockUser);

      const result = await AuthRepository.findUserByPhone(phone, gamingCenterId);
      expect(result).toEqual(mockUser);
      expect(userMock.findFirst).toHaveBeenCalledWith({ where: { phone, gamingCenterId } });
    });
  });

  describe('findCustomerByPhone', () => {
    it('should find a customer by phone', async () => {
      const mockCustomer = { id: 'c-1', phone };
      customerMock.findFirst.mockResolvedValue(mockCustomer);

      const result = await AuthRepository.findCustomerByPhone(phone);
      expect(result).toEqual(mockCustomer);
      expect(customerMock.findFirst).toHaveBeenCalledWith({ where: { phone } });
    });
  });

  describe('createCustomer', () => {
    it('should create a customer account', async () => {
      const mockCustomer = { id: 'c-1', phone, phoneVerifiedAt: null };
      customerMock.create.mockResolvedValue(mockCustomer);

      const result = await AuthRepository.createCustomer(phone);
      expect(result).toEqual(mockCustomer);
      expect(customerMock.create).toHaveBeenCalledWith({ data: { phone, phoneVerifiedAt: undefined } });
    });
  });

  describe('markCustomerPhoneVerified', () => {
    it('should update phoneVerifiedAt for customer', async () => {
      const id = 'c-1';
      customerMock.update.mockResolvedValue({ id });

      await AuthRepository.markCustomerPhoneVerified(id);
      expect(customerMock.update).toHaveBeenCalledWith({
        where: { id },
        data: { phoneVerifiedAt: expect.any(Date) },
      });
    });
  });

  describe('markUserPhoneVerified', () => {
    it('should update phoneVerifiedAt for users with given phone', async () => {
      userMock.updateMany.mockResolvedValue({ count: 1 });

      await AuthRepository.markUserPhoneVerified(phone);
      expect(userMock.updateMany).toHaveBeenCalledWith({
        where: { phone },
        data: { phoneVerifiedAt: expect.any(Date) },
      });
    });
  });

  describe('createOtp', () => {
    it('should create a phone OTP', async () => {
      const data = { phone, purpose: 'LOGIN' /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any, codeHash: 'hash', expiresAt: new Date() };
      otpMock.create.mockResolvedValue(data);

      const result = await AuthRepository.createOtp(data);
      expect(result).toEqual(data);
      expect(otpMock.create).toHaveBeenCalledWith({ data });
    });
  });

  describe('findRecentOtp', () => {
    it('should find the most recent unconsumed and unexpired OTP', async () => {
      const purpose = 'LOGIN' /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
      const mockOtp = { id: 'o-1', phone, purpose };
      otpMock.findFirst.mockResolvedValue(mockOtp);

      const result = await AuthRepository.findRecentOtp(phone, purpose);
      expect(result).toEqual(mockOtp);
      expect(otpMock.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          phone,
          purpose,
          consumedAt: null,
          expiresAt: { gt: expect.any(Date) },
        }),
      }));
    });
  });

  describe('findRecentConsumedOtp', () => {
    it('should find a recently consumed OTP', async () => {
      const purpose = 'LOGIN' /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
      const window = new Date();
      const mockOtp = { id: 'o-1', phone, purpose };
      otpMock.findFirst.mockResolvedValue(mockOtp);

      const result = await AuthRepository.findRecentConsumedOtp(phone, purpose, window);
      expect(result).toEqual(mockOtp);
      expect(otpMock.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          phone,
          purpose,
          consumedAt: { gte: window },
        }),
      }));
    });
  });

  describe('consumeOtp', () => {
    it('should mark an OTP as consumed', async () => {
      const id = 'o-1';
      otpMock.update.mockResolvedValue({ id });

      await AuthRepository.consumeOtp(id);
      expect(otpMock.update).toHaveBeenCalledWith({
        where: { id },
        data: { consumedAt: expect.any(Date) },
      });
    });
  });

  describe('findUsersWithSalons', () => {
    it('should find users and include their gaming centers', async () => {
      const mockUsers = [{ id: 'u-1', gamingCenter: { id: 'gc-1' } }];
      userMock.findMany.mockResolvedValue(mockUsers);

      const result = await AuthRepository.findUsersWithSalons(phone);
      expect(result).toEqual(mockUsers);
      expect(userMock.findMany).toHaveBeenCalledWith({
        where: { phone },
        include: { gamingCenter: true },
      });
    });
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const actorId = 'u-1';
      const actorType = SessionActorType.USER;
      const tokenHash = 'token-hash';
      const expiresAt = new Date();

      const mockSession = { id: 's-1', actorId, actorType, tokenHash, expiresAt };
      sessionMock.create.mockResolvedValue(mockSession);

      const result = await AuthRepository.createSession(actorId, actorType, tokenHash, expiresAt);
      expect(result).toEqual(mockSession);
      expect(sessionMock.create).toHaveBeenCalledWith({
        data: { actorId, actorType, tokenHash, expiresAt },
      });
    });
  });

  describe('findSessionByToken', () => {
    it('should find a session by token hash', async () => {
      const tokenHash = 'token-hash';
      const mockSession = { id: 's-1', tokenHash };
      sessionMock.findUnique.mockResolvedValue(mockSession);

      const result = await AuthRepository.findSessionByToken(tokenHash);
      expect(result).toEqual(mockSession);
      expect(sessionMock.findUnique).toHaveBeenCalledWith({ where: { tokenHash } });
    });
  });

  describe('revokeSession', () => {
    it('should mark a session as revoked', async () => {
      const sessionId = 's-1';
      sessionMock.update.mockResolvedValue({ id: sessionId });

      await AuthRepository.revokeSession(sessionId);
      expect(sessionMock.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
