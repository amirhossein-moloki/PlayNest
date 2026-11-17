import { describe, it, expect, jest, beforeEach } from '@jest/globals';

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
jest.mock('../../../src/config/redis', () => ({
  get: jest.fn().mockImplementation(() => Promise.resolve(null)),
  set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
  del: jest.fn().mockImplementation(() => Promise.resolve(1)),
}));
jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn().mockImplementation(() => Promise.resolve([])), updateMany: jest.fn() },
    customerAccount: { findUnique: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
    session: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    phoneOtp: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
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

  describe('User OTP Flow (Login / Auto-Register & Skip OTP)', () => {
    it('Scenario 1: Request OTP for new or existing user should succeed', async () => {
      MockedAuthRepository.createOtp.mockResolvedValue({ id: 'o1' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      const res = await request(app).post('/api/v1/auth/user/otp/request').send({ phone });
      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('OTP sent to');
    });

    it('Scenario 2: Return 401 when verifying with invalid/expired OTP', async () => {
      MockedAuthRepository.findRecentOtp.mockResolvedValue(null);
      const res = await request(app).post('/api/v1/auth/user/otp/verify').send({ phone, code: '123456' });
      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
      expect(res.body.error.message).toBe('Invalid or expired OTP.');
    });

    it('Scenario 3: Return 200 when verifying valid OTP for existing user', async () => {
      MockedAuthRepository.findRecentOtp.mockResolvedValue({ id: 'o1', codeHash: 'hashed' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedArgon2.verify.mockResolvedValue(true /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedAuthRepository.findUsersWithGamingCenters.mockResolvedValue([{ gamingCenter: { id: gamingCenterId, name: 'Center' } }] /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

      const res = await request(app).post('/api/v1/auth/user/otp/verify').send({ phone, code: '123456' });
      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.data.gamingCenters).toBeDefined();
    });

    it('Scenario 4: Returns empty gaming centers list if no staff user exists (no gaming center auto-creation)', async () => {
      MockedAuthRepository.findRecentOtp.mockResolvedValue({ id: 'o1', codeHash: 'hashed' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedArgon2.verify.mockResolvedValue(true /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedAuthRepository.findUsersWithGamingCenters.mockResolvedValue([]);

      const res = await request(app).post('/api/v1/auth/user/otp/verify').send({ phone, code: '123456' });
      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.data.gamingCenters).toEqual([]);
    });

    it('Scenario 5: User + SKIP_OTP=true with 000000', async () => {
      const { env } = await import('../../../src/config/env');
      const originalSkip = env.SKIP_OTP;
      (env as any).SKIP_OTP = true; /* eslint-disable-line @typescript-eslint/no-explicit-any */

      try {
        MockedAuthRepository.createOtp.mockResolvedValue({ id: 'o-user-skip' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
        MockedAuthRepository.findRecentOtp.mockResolvedValue({ id: 'o-user-skip', codeHash: 'hashed_000000' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
        MockedArgon2.verify.mockResolvedValue(true /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
        MockedAuthRepository.findUsersWithGamingCenters.mockResolvedValue([{ gamingCenter: { id: gamingCenterId, name: 'Center' } }] /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

        const reqRes = await request(app).post('/api/v1/auth/user/otp/request').send({ phone });
        expect(reqRes.status).toBe(httpStatus.OK);

        const verifyRes = await request(app).post('/api/v1/auth/user/otp/verify').send({ phone, code: '000000' });
        expect(verifyRes.status).toBe(httpStatus.OK);
        expect(verifyRes.body.data.gamingCenters).toBeDefined();
      } finally {
        (env as any).SKIP_OTP = originalSkip; /* eslint-disable-line @typescript-eslint/no-explicit-any */
      }
    });

    it('Scenario 6: User + SKIP_OTP=true rejects code other than 000000', async () => {
      const { env } = await import('../../../src/config/env');
      const originalSkip = env.SKIP_OTP;
      (env as any).SKIP_OTP = true; /* eslint-disable-line @typescript-eslint/no-explicit-any */

      try {
        const verifyRes = await request(app).post('/api/v1/auth/user/otp/verify').send({ phone, code: '123456' });
        expect(verifyRes.status).toBe(httpStatus.UNAUTHORIZED);
        expect(verifyRes.body.error.message).toBe('Invalid or expired OTP.');
      } finally {
        (env as any).SKIP_OTP = originalSkip; /* eslint-disable-line @typescript-eslint/no-explicit-any */
      }
    });

    it('Scenario 7: User + SKIP_OTP=false rejects 000000 when code is invalid', async () => {
      MockedAuthRepository.findRecentOtp.mockResolvedValue({ id: 'o-normal', codeHash: 'hashed_real_code' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedArgon2.verify.mockResolvedValue(false /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

      const verifyRes = await request(app).post('/api/v1/auth/user/otp/verify').send({ phone, code: '000000' });
      expect(verifyRes.status).toBe(httpStatus.UNAUTHORIZED);
      expect(verifyRes.body.error.message).toBe('Invalid or expired OTP.');
    });

    it('Scenario 8: User login with OTP succeeds with valid consumed OTP', async () => {
      MockedAuthRepository.findRecentConsumedOtp.mockResolvedValue({ id: 'o-consumed' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedAuthRepository.findUserByPhone.mockResolvedValue({ id: userId, phone: '+989123456789' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedAuthRepository.createSession.mockResolvedValue({ id: 's-user-otp' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

      const res = await request(app).post('/api/v1/auth/user/login/otp').send({ phone, gamingCenterId });
      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.data.tokens).toBeDefined();
    });

    it('Scenario 9: User login with OTP fails if no consumed OTP in window', async () => {
      MockedAuthRepository.findRecentConsumedOtp.mockResolvedValue(null);

      const res = await request(app).post('/api/v1/auth/user/login/otp').send({ phone, gamingCenterId });
      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
      expect(res.body.error.message).toContain('No recent OTP verification found');
    });

    it('Scenario 10: Validation error on invalid phone format', async () => {
      const res = await request(app).post('/api/v1/auth/user/otp/request').send({ phone: '123' });
      expect(res.status).toBe(httpStatus.BAD_REQUEST);
    });
  });

  describe('Customer OTP Flow (Login / Auto-Register & Skip OTP)', () => {
    const customerPhone = '09129998877';

    it('Scenario 1: Existing customer + SKIP_OTP=false', async () => {
      const existingCustomer = { id: 'cust-1', phone: customerPhone, phoneVerifiedAt: new Date() };
      MockedAuthRepository.createOtp.mockResolvedValue({ id: 'o1' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedAuthRepository.findRecentOtp.mockResolvedValue({ id: 'o1', codeHash: 'hashed_otp' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedArgon2.verify.mockResolvedValue(true /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedAuthRepository.consumeOtp.mockResolvedValue({ id: 'o1' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedAuthRepository.findCustomerByPhone.mockResolvedValue(existingCustomer /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedAuthRepository.createSession.mockResolvedValue({ id: 's-cust-1' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

      // Request OTP
      const reqRes = await request(app).post('/api/v1/auth/customer/otp/request').send({ phone: customerPhone });
      expect(reqRes.status).toBe(httpStatus.OK);

      // Verify OTP -> logs in existing customer
      const verifyRes = await request(app).post('/api/v1/auth/customer/otp/verify').send({ phone: customerPhone, code: '123456' });
      expect(verifyRes.status).toBe(httpStatus.OK);
      expect(verifyRes.body.data.customer.id).toBe(existingCustomer.id);
      expect(verifyRes.body.data.tokens).toBeDefined();
    });

    it('Scenario 2: New customer + SKIP_OTP=false', async () => {
      const newCustomer = { id: 'cust-new', phone: customerPhone, phoneVerifiedAt: new Date() };
      MockedAuthRepository.createOtp.mockResolvedValue({ id: 'o2' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedAuthRepository.findRecentOtp.mockResolvedValue({ id: 'o2', codeHash: 'hashed_otp' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedArgon2.verify.mockResolvedValue(true /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedAuthRepository.consumeOtp.mockResolvedValue({ id: 'o2' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedAuthRepository.findCustomerByPhone.mockResolvedValue(null);
      MockedAuthRepository.upsertCustomerAccount.mockResolvedValue(newCustomer /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedAuthRepository.createSession.mockResolvedValue({ id: 's-cust-new' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

      // Verify OTP -> automatically registers new customer and logs them in
      const verifyRes = await request(app).post('/api/v1/auth/customer/otp/verify').send({ phone: customerPhone, code: '123456' });
      expect(verifyRes.status).toBe(httpStatus.OK);
      expect(verifyRes.body.data.customer.id).toBe(newCustomer.id);
      expect(verifyRes.body.data.tokens).toBeDefined();
    });

    it('Scenario 3: Existing customer + SKIP_OTP=true + code 000000', async () => {
      const { env } = await import('../../../src/config/env');
      const originalSkip = env.SKIP_OTP;
      (env as any).SKIP_OTP = true; /* eslint-disable-line @typescript-eslint/no-explicit-any */

      try {
        const existingCustomer = { id: 'cust-skip', phone: customerPhone, phoneVerifiedAt: new Date() };
        MockedAuthRepository.createOtp.mockResolvedValue({ id: 'o3' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
        MockedAuthRepository.findRecentOtp.mockResolvedValue({ id: 'o3', codeHash: 'hashed_000000' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
        MockedArgon2.verify.mockResolvedValue(true /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
        MockedAuthRepository.consumeOtp.mockResolvedValue({ id: 'o3' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
        MockedAuthRepository.findCustomerByPhone.mockResolvedValue(existingCustomer /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
        MockedAuthRepository.createSession.mockResolvedValue({ id: 's-cust-skip' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

        const reqRes = await request(app).post('/api/v1/auth/customer/otp/request').send({ phone: customerPhone });
        expect(reqRes.status).toBe(httpStatus.OK);

        const verifyRes = await request(app).post('/api/v1/auth/customer/otp/verify').send({ phone: customerPhone, code: '000000' });
        expect(verifyRes.status).toBe(httpStatus.OK);
        expect(verifyRes.body.data.customer.id).toBe(existingCustomer.id);
        expect(verifyRes.body.data.tokens).toBeDefined();
      } finally {
        (env as any).SKIP_OTP = originalSkip; /* eslint-disable-line @typescript-eslint/no-explicit-any */
      }
    });

    it('Scenario 4: New customer + SKIP_OTP=true + code 000000', async () => {
      const { env } = await import('../../../src/config/env');
      const originalSkip = env.SKIP_OTP;
      (env as any).SKIP_OTP = true; /* eslint-disable-line @typescript-eslint/no-explicit-any */

      try {
        const newCustomer = { id: 'cust-new-skip', phone: customerPhone, phoneVerifiedAt: new Date() };
        MockedAuthRepository.createOtp.mockResolvedValue({ id: 'o4' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
        MockedAuthRepository.findRecentOtp.mockResolvedValue({ id: 'o4', codeHash: 'hashed_000000' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
        MockedArgon2.verify.mockResolvedValue(true /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
        MockedAuthRepository.consumeOtp.mockResolvedValue({ id: 'o4' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
        MockedAuthRepository.findCustomerByPhone.mockResolvedValue(null);
        MockedAuthRepository.upsertCustomerAccount.mockResolvedValue(newCustomer /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
        MockedAuthRepository.createSession.mockResolvedValue({ id: 's-cust-new-skip' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

        const verifyRes = await request(app).post('/api/v1/auth/customer/otp/verify').send({ phone: customerPhone, code: '000000' });
        expect(verifyRes.status).toBe(httpStatus.OK);
        expect(verifyRes.body.data.customer.id).toBe(newCustomer.id);
        expect(verifyRes.body.data.tokens).toBeDefined();
      } finally {
        (env as any).SKIP_OTP = originalSkip; /* eslint-disable-line @typescript-eslint/no-explicit-any */
      }
    });

    it('Scenario 5: Incorrect code in normal mode (SKIP_OTP=false)', async () => {
      MockedAuthRepository.findRecentOtp.mockResolvedValue({ id: 'o5', codeHash: 'hashed_otp' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedArgon2.verify.mockResolvedValue(false /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

      const res = await request(app).post('/api/v1/auth/customer/otp/verify').send({ phone: customerPhone, code: '111111' });
      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
      expect(res.body.error.message).toBe('Invalid or expired OTP.');
    });

    it('Scenario 6: Incorrect code in Skip OTP mode (code !== 000000)', async () => {
      const { env } = await import('../../../src/config/env');
      const originalSkip = env.SKIP_OTP;
      (env as any).SKIP_OTP = true; /* eslint-disable-line @typescript-eslint/no-explicit-any */

      try {
        const res = await request(app).post('/api/v1/auth/customer/otp/verify').send({ phone: customerPhone, code: '123456' });
        expect(res.status).toBe(httpStatus.UNAUTHORIZED);
        expect(res.body.error.message).toBe('Invalid or expired OTP.');
      } finally {
        (env as any).SKIP_OTP = originalSkip; /* eslint-disable-line @typescript-eslint/no-explicit-any */
      }
    });

    it('Scenario 7: When phone belongs to active Manager, verify customer OTP authenticates as USER and prevents customer creation', async () => {
      const managerUser = {
        id: 'mgr-user-1',
        phone: customerPhone,
        role: 'MANAGER',
        isActive: true,
        gamingCenter: { id: gamingCenterId, name: 'Main Center' },
      };

      MockedAuthRepository.findRecentOtp.mockResolvedValue({ id: 'o-mgr', codeHash: 'hashed_otp' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedArgon2.verify.mockResolvedValue(true /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedAuthRepository.consumeOtp.mockResolvedValue({ id: 'o-mgr' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

      (prisma.user.findMany /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).mockResolvedValue([managerUser]);
      (prisma.customerAccount.findUnique /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).mockResolvedValue(null);
      (prisma.session.create /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).mockResolvedValue({ id: 's-mgr-session' });

      const verifyRes = await request(app).post('/api/v1/auth/customer/otp/verify').send({ phone: customerPhone, code: '123456' });
      expect(verifyRes.status).toBe(httpStatus.OK);
      expect(verifyRes.body.data.user.id).toBe(managerUser.id);
      expect(verifyRes.body.data.user.actorType).toBe('USER');
      expect(verifyRes.body.data.user.roles).toContain('MANAGER');
      expect(verifyRes.body.data.tokens).toBeDefined();
      expect(MockedAuthRepository.createCustomer).not.toHaveBeenCalled();
    });
  });

  describe('Classic Login', () => {
    it('should return 401 for invalid credentials', async () => {
      MockedAuthRepository.findUserByPhone.mockResolvedValue({ id: userId, passwordHash: 'h' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedArgon2.verify.mockResolvedValue(false /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

      const res = await request(app).post('/api/v1/auth/login').send({ phone, password: 'wrong', gamingCenterId });
      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
    });

    it('should return 200 and tokens for valid credentials', async () => {
      MockedAuthRepository.findUserByPhone.mockResolvedValue({ id: userId, passwordHash: 'h' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedArgon2.verify.mockResolvedValue(true /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedAuthRepository.createSession.mockResolvedValue({ id: 's1' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

      const res = await request(app).post('/api/v1/auth/login').send({ phone, password: 'correct', gamingCenterId });
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
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(userId);
      expect(res.body.data.username).toBeNull();
    });

    it('GET /auth/me should return username when user has a username', async () => {
      MockedAuthRepository.findUserById.mockResolvedValue({
        id: userId,
        gamingCenterId,
        role: 'MANAGER',
        username: 'example_user',
      } as any);

      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(userId);
      expect(res.body.data.role).toBe('MANAGER');
      expect(res.body.data.gamingCenterId).toBe(gamingCenterId);
      expect(res.body.data.username).toBe('example_user');
    });

    it('GET /auth/me should return username as null when user does not have a username', async () => {
      MockedAuthRepository.findUserById.mockResolvedValue({
        id: userId,
        gamingCenterId,
        role: 'MANAGER',
        username: null,
      } as any);

      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(userId);
      expect(res.body.data.username).toBeNull();
    });

    it('GET /auth/me should return username as null for customer actor', async () => {
      const customerToken = generateAccessToken({ sessionId: 's2', actorId: 'cust-1', actorType: 'CUSTOMER' });
      (prisma.customerAccount.findUnique as any).mockResolvedValue({ id: 'cust-1' });

      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('cust-1');
      expect(res.body.data.username).toBeNull();
    });

    it('POST /auth/logout should revoke session', async () => {
      MockedAuthRepository.revokeSession.mockResolvedValue({ id: 's1' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      const res = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(MockedAuthRepository.revokeSession).toHaveBeenCalledWith('s1');
    });

    describe('PATCH /auth/me (User Profile Update)', () => {
      const existingUser = {
        id: userId,
        phone: '09123456789',
        fullName: 'Ali Rezaei',
        role: 'MANAGER',
        gamingCenterId,
        username: 'old_username',
        email: 'old@example.com',
        bio: 'Old bio',
        avatarUrl: null,
        publicName: null,
        isPublic: false,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$secret_hash',
      };

      it('should return 401 Unauthorized if no authorization header is provided', async () => {
        const res = await request(app).patch('/api/v1/auth/me').send({ username: 'new_name' });
        expect(res.status).toBe(401);
      });

      it('should return 404 Not Found if authenticated user no longer exists', async () => {
        MockedAuthRepository.findUserById.mockResolvedValue(null);
        const res = await request(app)
          .patch('/api/v1/auth/me')
          .set('Authorization', `Bearer ${token}`)
          .send({ username: 'new_name' });
        expect(res.status).toBe(404);
        expect(res.body.error.message).toBe('User not found');
      });

      it('should reject invalid input with 400 Bad Request', async () => {
        const res = await request(app)
          .patch('/api/v1/auth/me')
          .set('Authorization', `Bearer ${token}`)
          .send({ username: 'ab' }); // less than 3 chars
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it('should reject invalid email with 400 Bad Request', async () => {
        const res = await request(app)
          .patch('/api/v1/auth/me')
          .set('Authorization', `Bearer ${token}`)
          .send({ email: 'not-an-email' });
        expect(res.status).toBe(400);
      });

      it('should reject duplicate username with 409 Conflict', async () => {
        MockedAuthRepository.findUserById.mockResolvedValue(existingUser as any);
        MockedAuthRepository.findUserByUsername.mockResolvedValue({ id: 'other-user', username: 'taken_user' } as any);

        const res = await request(app)
          .patch('/api/v1/auth/me')
          .set('Authorization', `Bearer ${token}`)
          .send({ username: 'taken_user' });

        expect(res.status).toBe(409);
        expect(res.body.error.message).toBe('Username is already taken.');
      });

      it('should successfully update username only (partial update)', async () => {
        MockedAuthRepository.findUserById.mockResolvedValue(existingUser as any);
        MockedAuthRepository.findUserByUsername.mockResolvedValue(null);
        MockedAuthRepository.updateUser.mockResolvedValue({
          ...existingUser,
          username: 'ali_pro',
        } as any);

        const res = await request(app)
          .patch('/api/v1/auth/me')
          .set('Authorization', `Bearer ${token}`)
          .send({ username: 'ali_pro' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.username).toBe('ali_pro');
        expect(res.body.data.fullName).toBe('Ali Rezaei');
        expect(res.body.data.firstName).toBe('Ali');
        expect(res.body.data.lastName).toBe('Rezaei');
        expect(MockedAuthRepository.updateUser).toHaveBeenCalledWith(
          userId,
          expect.objectContaining({ username: 'ali_pro' })
        );
      });

      it('should successfully update firstName and lastName', async () => {
        MockedAuthRepository.findUserById.mockResolvedValue(existingUser as any);
        MockedAuthRepository.updateUser.mockResolvedValue({
          ...existingUser,
          fullName: 'Mohammad Karimi',
        } as any);

        const res = await request(app)
          .patch('/api/v1/auth/me')
          .set('Authorization', `Bearer ${token}`)
          .send({ firstName: 'Mohammad', lastName: 'Karimi' });

        expect(res.status).toBe(200);
        expect(res.body.data.fullName).toBe('Mohammad Karimi');
        expect(res.body.data.firstName).toBe('Mohammad');
        expect(res.body.data.lastName).toBe('Karimi');
        expect(MockedAuthRepository.updateUser).toHaveBeenCalledWith(
          userId,
          expect.objectContaining({ fullName: 'Mohammad Karimi' })
        );
      });

      it('should successfully update multiple fields simultaneously', async () => {
        MockedAuthRepository.findUserById.mockResolvedValue(existingUser as any);
        MockedAuthRepository.findUserByUsername.mockResolvedValue(null);
        MockedAuthRepository.updateUser.mockResolvedValue({
          ...existingUser,
          username: 'ali_gamer',
          fullName: 'Ali Ahmadi',
          email: 'ali@example.com',
          bio: 'Competitive gamer',
        } as any);

        const res = await request(app)
          .patch('/api/v1/auth/me')
          .set('Authorization', `Bearer ${token}`)
          .send({
            username: 'ali_gamer',
            firstName: 'Ali',
            lastName: 'Ahmadi',
            email: 'ali@example.com',
            bio: 'Competitive gamer',
          });

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(userId);
        expect(res.body.data.username).toBe('ali_gamer');
        expect(res.body.data.fullName).toBe('Ali Ahmadi');
        expect(res.body.data.firstName).toBe('Ali');
        expect(res.body.data.lastName).toBe('Ahmadi');
        expect(res.body.data.email).toBe('ali@example.com');
        expect(res.body.data.bio).toBe('Competitive gamer');
      });

      it('should protect against modifying protected fields and never expose passwordHash', async () => {
        MockedAuthRepository.findUserById.mockResolvedValue(existingUser as any);
        MockedAuthRepository.findUserByUsername.mockResolvedValue(null);
        MockedAuthRepository.updateUser.mockResolvedValue({
          ...existingUser,
          username: 'safe_user',
        } as any);

        const res = await request(app)
          .patch('/api/v1/auth/me')
          .set('Authorization', `Bearer ${token}`)
          .send({
            id: 'hacker-id',
            role: 'ADMIN',
            gamingCenterId: 'gc-hacked',
            passwordHash: 'injected_hash',
            username: 'safe_user',
          });

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(userId);
        expect(res.body.data.role).toBe('MANAGER');
        expect(res.body.data.gamingCenterId).toBe(gamingCenterId);
        expect(res.body.data.passwordHash).toBeUndefined();

        // Verify update call did NOT receive protected fields
        expect(MockedAuthRepository.updateUser).toHaveBeenCalledWith(
          userId, // Must be caller's authenticated user ID
          { username: 'safe_user' }
        );
      });
    });
  });
});
