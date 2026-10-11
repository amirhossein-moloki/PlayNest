import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { env } from '../../../src/config/env';

import request from 'supertest';
import app from '../../../src/app';
import { AuthRepository } from '../../../src/modules/auth/auth.repository';
import * as argon2 from 'argon2';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';
import { prisma } from '../../../src/config/prisma';
import httpStatus from 'http-status';

jest.mock('../../../src/modules/auth/auth.repository');
jest.mock('argon2');
jest.mock('../../../src/jobs/producers/sms.producer');
jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
    customerAccount: { findUnique: jest.fn(), findFirst: jest.fn() },
    session: { findUnique: jest.fn(), update: jest.fn() },
    phoneOtp: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    gamingCenter: { findUnique: jest.fn() },
  }
}));

const MockedAuthRepository = AuthRepository as jest.Mocked<typeof AuthRepository>;
const MockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

describe('Authentication API', () => {
  const phone = '09123456789';
  const gamingCenterId = 'clp6u7o00000108msh9v8k7g5';
  const userId = 'user-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('OTP Flow', () => {
    it('should return 404 when requesting OTP for non-existent user', async () => {
      MockedAuthRepository.findUsersWithGamingCenters.mockResolvedValue([]);
      const res = await request(app).post('/api/v1/auth/user/otp/request').set('x-api-key', env.STATIC_API_KEY).send({ phone });
      expect(res.status).toBe(httpStatus.NOT_FOUND);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('No user found');
    });

    it('should return 401 when verifying with invalid/expired OTP', async () => {
      MockedAuthRepository.findRecentOtp.mockResolvedValue(null);
      const res = await request(app).post('/api/v1/auth/user/otp/verify').set('x-api-key', env.STATIC_API_KEY).send({ phone, code: '123456' });
      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
      expect(res.body.error.message).toBe('Invalid or expired OTP.');
    });

    it('should return 200 when verifying valid OTP', async () => {
      MockedAuthRepository.findRecentOtp.mockResolvedValue({ id: 'o1', codeHash: 'hashed' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedArgon2.verify.mockResolvedValue(true /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedAuthRepository.findUsersWithGamingCenters.mockResolvedValue([{ gamingCenter: { id: gamingCenterId, name: 'Center' } }] /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

      const res = await request(app).post('/api/v1/auth/user/otp/verify').set('x-api-key', env.STATIC_API_KEY).send({ phone, code: '123456' });
      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.data.gamingCenters).toBeDefined();
    });
  });

  describe('Classic Login', () => {
    it('should return 401 for invalid credentials', async () => {
      MockedAuthRepository.findUserByPhone.mockResolvedValue({ id: userId, passwordHash: 'h' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedArgon2.verify.mockResolvedValue(false /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

      const res = await request(app).post('/api/v1/auth/login').set('x-api-key', env.STATIC_API_KEY).send({ phone, password: 'wrong', gamingCenterId });
      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
    });

    it('should return 200 and tokens for valid credentials', async () => {
      MockedAuthRepository.findUserByPhone.mockResolvedValue({ id: userId, passwordHash: 'h' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedArgon2.verify.mockResolvedValue(true /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedAuthRepository.createSession.mockResolvedValue({ id: 's1' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

      const res = await request(app).post('/api/v1/auth/login').set('x-api-key', env.STATIC_API_KEY).send({ phone, password: 'correct', gamingCenterId });
      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.data.tokens).toBeDefined();
    });
  });

  describe('Authenticated Endpoints', () => {
    let token: string;
    beforeEach(() => {
      token = generateAccessToken({ sessionId: 's1', actorId: userId, actorType: 'USER' });
      (prisma.user.findUnique /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).mockResolvedValue({ id: userId, gamingCenterId, role: 'MANAGER' });
    });

    it('GET /auth/me should return actor profile', async () => {
      const res = await request(app).get('/api/v1/auth/me').set('x-api-key', env.STATIC_API_KEY).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(userId);
    });

    it('POST /auth/logout should revoke session', async () => {
      MockedAuthRepository.revokeSession.mockResolvedValue({ id: 's1' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      const res = await request(app).post('/api/v1/auth/logout').set('x-api-key', env.STATIC_API_KEY).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(MockedAuthRepository.revokeSession).toHaveBeenCalledWith('s1');
    });
  });
});
