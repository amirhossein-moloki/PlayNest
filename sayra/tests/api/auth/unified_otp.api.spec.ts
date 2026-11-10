import request from 'supertest';
import app from '../../../src/app';
import { AuthRepository } from '../../../src/modules/auth/auth.repository';
import { env } from '../../../src/config/env';
import argon2 from 'argon2';
import httpStatus from 'http-status';

jest.mock('../../../src/modules/auth/auth.repository');

describe('Unified OTP Authentication API', () => {
  const phone = '09123456789';
  const normalizedPhone = '+989123456789';

  beforeEach(() => {
    jest.clearAllMocks();
    (env as unknown as { SKIP_OTP: boolean; NODE_ENV: string }).SKIP_OTP = false;
    (env as unknown as { SKIP_OTP: boolean; NODE_ENV: string }).NODE_ENV = 'test';
  });

  describe('POST /api/v1/auth/otp/request', () => {
    it('Scenario 1: Successfully request OTP for any phone number', async () => {
      (AuthRepository.invalidateActiveOtps as jest.Mock).mockResolvedValue({ count: 1 });
      (AuthRepository.createOtp as jest.Mock).mockResolvedValue({ id: 'otp-1' });

      const res = await request(app)
        .post('/api/v1/auth/otp/request')
        .send({ phone });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain(`OTP sent to ${normalizedPhone}`);
      expect(AuthRepository.invalidateActiveOtps).toHaveBeenCalledWith(normalizedPhone, 'LOGIN');
      expect(AuthRepository.createOtp).toHaveBeenCalled();
    });

    it('Scenario 2: Validation failure on invalid phone format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/request')
        .send({ phone: '123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/otp/login', () => {
    const validOtpCode = '123456';

    beforeEach(async () => {
      const hash = await argon2.hash(validOtpCode);
      (AuthRepository.createSession as jest.Mock).mockResolvedValue({ id: 'sess-1' });
      (AuthRepository.findRecentOtp as jest.Mock).mockResolvedValue({
        id: 'otp-1',
        phone: normalizedPhone,
        codeHash: hash,
        attempts: 0,
        consumedAt: null,
      });
      (AuthRepository.atomicConsumeOtp as jest.Mock).mockResolvedValue({ count: 1 });
    });

    it('Scenario 1: Existing User (Staff/Manager) Login', async () => {
      const mockUsers = [
        {
          id: 'usr-1',
          role: 'MANAGER',
          phone: normalizedPhone,
          gamingCenter: { id: 'gc-1', name: 'Center Alpha', slug: 'center-alpha' },
        },
      ];
      (AuthRepository.findUsersWithDetailsByPhone as jest.Mock).mockResolvedValue(mockUsers);
      (AuthRepository.findCustomerByPhone as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/otp/login')
        .send({ phone, otp: validOtpCode });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user).toEqual({
        id: 'usr-1',
        phone: normalizedPhone,
        actorType: 'USER',
        roles: ['MANAGER'],
        permissions: [],
        gamingCenters: [
          {
            id: 'gc-1',
            name: 'Center Alpha',
            role: 'MANAGER',
          },
        ],
      });
      expect(AuthRepository.markUserPhoneVerified).toHaveBeenCalledWith(normalizedPhone);
    });

    it('Scenario 2: Existing Customer Login', async () => {
      (AuthRepository.findUsersWithDetailsByPhone as jest.Mock).mockResolvedValue([]);
      (AuthRepository.findCustomerByPhone as jest.Mock).mockResolvedValue({
        id: 'cust-1',
        phone: normalizedPhone,
        phoneVerifiedAt: new Date(),
      });

      const res = await request(app)
        .post('/api/v1/auth/otp/login')
        .send({ phone, otp: validOtpCode });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toEqual({
        id: 'cust-1',
        phone: normalizedPhone,
        actorType: 'CUSTOMER',
        roles: ['CUSTOMER'],
        permissions: [],
        gamingCenters: [],
      });
    });

    it('Scenario 3: New Phone auto-registers as Customer', async () => {
      (AuthRepository.findUsersWithDetailsByPhone as jest.Mock).mockResolvedValue([]);
      (AuthRepository.findCustomerByPhone as jest.Mock).mockResolvedValue(null);
      (AuthRepository.upsertCustomerAccount as jest.Mock).mockResolvedValue({
        id: 'cust-new',
        phone: normalizedPhone,
        phoneVerifiedAt: new Date(),
      });

      const res = await request(app)
        .post('/api/v1/auth/otp/login')
        .send({ phone, otp: validOtpCode });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe('cust-new');
      expect(res.body.data.user.actorType).toBe('CUSTOMER');
      expect(res.body.data.user.roles).toEqual(['CUSTOMER']);
      expect(AuthRepository.upsertCustomerAccount).toHaveBeenCalledWith(normalizedPhone, expect.any(Date));
    });

    it('Scenario 4: Multi-Gaming Center User Login', async () => {
      const mockUsers = [
        {
          id: 'usr-1',
          role: 'SUPERVISOR',
          phone: normalizedPhone,
          gamingCenter: { id: 'gc-1', name: 'Center One', slug: 'c-1' },
        },
        {
          id: 'usr-2',
          role: 'STAFF',
          phone: normalizedPhone,
          gamingCenter: { id: 'gc-2', name: 'Center Two', slug: 'c-2' },
        },
      ];
      (AuthRepository.findUsersWithDetailsByPhone as jest.Mock).mockResolvedValue(mockUsers);
      (AuthRepository.findCustomerByPhone as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/otp/login')
        .send({ phone, otp: validOtpCode });

      expect(res.status).toBe(200);
      expect(res.body.data.user.roles).toEqual(expect.arrayContaining(['SUPERVISOR', 'STAFF']));
      expect(res.body.data.user.gamingCenters).toHaveLength(2);
    });

    it('Scenario 5: Shared phone between User and Customer identifies primary as USER', async () => {
      const mockUsers = [
        {
          id: 'usr-1',
          role: 'ADMIN',
          phone: normalizedPhone,
          gamingCenter: { id: 'gc-main', name: 'Headquarters', slug: 'hq' },
        },
      ];
      (AuthRepository.findUsersWithDetailsByPhone as jest.Mock).mockResolvedValue(mockUsers);
      (AuthRepository.findCustomerByPhone as jest.Mock).mockResolvedValue({
        id: 'cust-dual',
        phone: normalizedPhone,
        phoneVerifiedAt: null,
      });

      const res = await request(app)
        .post('/api/v1/auth/otp/login')
        .send({ phone, otp: validOtpCode });

      expect(res.status).toBe(200);
      expect(res.body.data.user.actorType).toBe('USER');
      expect(res.body.data.user.id).toBe('usr-1');
      expect(AuthRepository.markCustomerPhoneVerified).toHaveBeenCalledWith('cust-dual');
    });

    it('Scenario 6: Incorrect OTP fails and increments attempts', async () => {
      (AuthRepository.incrementOtpAttempts as jest.Mock).mockResolvedValue({ id: 'otp-1', attempts: 1 });

      const res = await request(app)
        .post('/api/v1/auth/otp/login')
        .send({ phone, otp: '000000' });

      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
      expect(res.body.error.message).toContain('Invalid or expired OTP');
      expect(AuthRepository.incrementOtpAttempts).toHaveBeenCalledWith('otp-1');
    });

    it('Scenario 7: Expired or missing OTP fails with 401', async () => {
      (AuthRepository.findRecentOtp as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/otp/login')
        .send({ phone, otp: validOtpCode });

      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
      expect(res.body.error.message).toContain('Invalid or expired OTP');
    });

    it('Scenario 8: Replay attack prevention (already consumed OTP fails)', async () => {
      (AuthRepository.atomicConsumeOtp as jest.Mock).mockResolvedValue({ count: 0 });

      const res = await request(app)
        .post('/api/v1/auth/otp/login')
        .send({ phone, otp: validOtpCode });

      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
      expect(res.body.error.message).toContain('OTP has already been used');
    });

    it('Scenario 9: Brute-force protection (lockout after 5 attempts)', async () => {
      (AuthRepository.findRecentOtp as jest.Mock).mockResolvedValue({
        id: 'otp-locked',
        phone: normalizedPhone,
        codeHash: '$hash',
        attempts: 5,
        consumedAt: null,
      });

      const res = await request(app)
        .post('/api/v1/auth/otp/login')
        .send({ phone, otp: validOtpCode });

      expect(res.status).toBe(httpStatus.TOO_MANY_REQUESTS);
      expect(res.body.error.message).toContain('Too many failed attempts');
      expect(AuthRepository.consumeOtp).toHaveBeenCalledWith('otp-locked');
    });

    it('Scenario 10: SKIP_OTP=true in test environment with 000000', async () => {
      (env as unknown as { SKIP_OTP: boolean; NODE_ENV: string }).SKIP_OTP = true;
      (env as unknown as { SKIP_OTP: boolean; NODE_ENV: string }).NODE_ENV = 'test';

      (AuthRepository.findUsersWithDetailsByPhone as jest.Mock).mockResolvedValue([]);
      (AuthRepository.findCustomerByPhone as jest.Mock).mockResolvedValue({
        id: 'cust-skip',
        phone: normalizedPhone,
        phoneVerifiedAt: new Date(),
      });

      const res = await request(app)
        .post('/api/v1/auth/otp/login')
        .send({ phone, otp: '000000' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe('cust-skip');
    });

    it('Scenario 11: SKIP_OTP is completely ignored in production environment', async () => {
      (env as unknown as { SKIP_OTP: boolean; NODE_ENV: string }).SKIP_OTP = true;
      (env as unknown as { SKIP_OTP: boolean; NODE_ENV: string }).NODE_ENV = 'production';

      const res = await request(app)
        .post('/api/v1/auth/otp/login')
        .send({ phone, otp: '000000' });

      // In production, 000000 is checked against the real argon2 hash, not bypassed
      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
    });
  });

  describe('Concurrency & Security Edge Cases', () => {
    it('Scenario 12: Concurrent requests trying to consume the same OTP only one succeeds', async () => {
      let callCount = 0;
      (AuthRepository.findRecentOtp as jest.Mock).mockResolvedValue({
        id: 'otp-concurrent',
        phone: normalizedPhone,
        codeHash: await argon2.hash('123456'),
        attempts: 0,
        consumedAt: null,
      });

      // Simulate first call succeeding, second call failing because count = 0
      (AuthRepository.atomicConsumeOtp as jest.Mock).mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? { count: 1 } : { count: 0 };
      });

      (AuthRepository.findUsersWithDetailsByPhone as jest.Mock).mockResolvedValue([]);
      (AuthRepository.findCustomerByPhone as jest.Mock).mockResolvedValue({
        id: 'cust-1',
        phone: normalizedPhone,
        phoneVerifiedAt: new Date(),
      });
      (AuthRepository.createSession as jest.Mock).mockResolvedValue({ id: 'sess-1' });

      const [res1, res2] = await Promise.all([
        request(app).post('/api/v1/auth/otp/login').send({ phone, otp: '123456' }),
        request(app).post('/api/v1/auth/otp/login').send({ phone, otp: '123456' }),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(401);
    });

    it('Scenario 13: Refresh token replay protection and session invalidation', async () => {
      (AuthRepository.findSessionByToken as jest.Mock).mockResolvedValue({
        id: 'sess-old',
        actorId: 'usr-1',
        actorType: 'USER',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 10000),
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'revoked_token' });

      expect(res.status).toBe(httpStatus.UNAUTHORIZED);
      expect(res.body.error.message).toContain('Session is invalid or has been revoked');
    });

    it('Scenario 14: Client role tampering immunity (roles come purely from DB)', async () => {
      (AuthRepository.findRecentOtp as jest.Mock).mockResolvedValue({
        id: 'otp-tamper',
        phone: normalizedPhone,
        codeHash: await argon2.hash('123456'),
        attempts: 0,
        consumedAt: null,
      });
      (AuthRepository.atomicConsumeOtp as jest.Mock).mockResolvedValue({ count: 1 });
      (AuthRepository.findUsersWithDetailsByPhone as jest.Mock).mockResolvedValue([]);
      (AuthRepository.findCustomerByPhone as jest.Mock).mockResolvedValue(null);
      (AuthRepository.upsertCustomerAccount as jest.Mock).mockResolvedValue({
        id: 'cust-new',
        phone: normalizedPhone,
        phoneVerifiedAt: new Date(),
      });
      (AuthRepository.createSession as jest.Mock).mockResolvedValue({ id: 'sess-1' });

      // Client attempts to pass a malicious role in payload
      const res = await request(app)
        .post('/api/v1/auth/otp/login')
        .send({ phone, otp: '123456', role: 'ADMIN', roles: ['ADMIN', 'SUPERUSER'] });

      expect(res.status).toBe(200);
      expect(res.body.data.user.roles).toEqual(['CUSTOMER']);
      expect(res.body.data.user.roles).not.toContain('ADMIN');
    });
  });
});
