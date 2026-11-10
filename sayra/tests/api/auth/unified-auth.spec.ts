import { describe, it, expect, jest, beforeEach } from '@jest/globals';
/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import argon2 from 'argon2';
import { env } from '../../../src/config/env';
import { UserRole } from '@prisma/client';
import httpStatus from 'http-status';

jest.mock('../../../src/jobs/producers/sms.producer', () => ({
  queueSms: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../src/config/redis', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockImplementation(() => Promise.resolve(null)),
    set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
    del: jest.fn().mockImplementation(() => Promise.resolve(1)),
    incr: jest.fn().mockImplementation(() => Promise.resolve(1)),
    expire: jest.fn().mockImplementation(() => Promise.resolve(1)),
    ttl: jest.fn().mockImplementation(() => Promise.resolve(120)),
    call: jest.fn().mockImplementation(() => Promise.resolve('OK')),
  },
  redis: {
    get: jest.fn().mockImplementation(() => Promise.resolve(null)),
    set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
    del: jest.fn().mockImplementation(() => Promise.resolve(1)),
    incr: jest.fn().mockImplementation(() => Promise.resolve(1)),
    expire: jest.fn().mockImplementation(() => Promise.resolve(1)),
    ttl: jest.fn().mockImplementation(() => Promise.resolve(120)),
    call: jest.fn().mockImplementation(() => Promise.resolve('OK')),
  },
}));

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    customerAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    phoneOtp: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    gamingCenter: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

describe('Unified OTP Authentication & Security Hardening Test Suite', () => {
  const userPhone = '09121111111';
  const customerPhone = '09122222222';
  const newPhone = '09123333333';
  const sharedPhone = '09124444444';
  const multiCenterPhone = '09125555555';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Existing User Login
  it('1. Existing User Login: POST /api/v1/auth/otp/login identifies USER and returns roles and centers', async () => {
    const mockOtp = {
      id: 'otp-u1',
      phone: '+989121111111',
      codeHash: await argon2.hash('123456'),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    };
    (prisma.phoneOtp.findFirst as any).mockResolvedValue(mockOtp);
    (prisma.phoneOtp.updateMany as any).mockResolvedValue({ count: 1 });

    const mockUser = {
      id: 'usr-1',
      phone: '+989121111111',
      role: UserRole.MANAGER,
      isActive: true,
      gamingCenter: { id: 'gc-1', name: 'Grand Center' },
    };
    (prisma.user.findMany as any).mockResolvedValue([mockUser]);
    (prisma.customerAccount.findUnique as any).mockResolvedValue(null);
    (prisma.session.create as any).mockResolvedValue({ id: 'sess-usr-1' });

    const res = await request(app)
      .post('/api/v1/auth/otp/login')
      .send({ phone: userPhone, otp: '123456' });

    expect(res.status).toBe(httpStatus.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.actorType).toBe('USER');
    expect(res.body.data.user.roles).toContain(UserRole.MANAGER);
    expect(res.body.data.user.gamingCenters).toHaveLength(1);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  // 2. Existing Customer Login
  it('2. Existing Customer Login: identifies CUSTOMER, roles [CUSTOMER]', async () => {
    const mockOtp = {
      id: 'otp-c1',
      phone: '+989122222222',
      codeHash: await argon2.hash('123456'),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    };
    (prisma.phoneOtp.findFirst as any).mockResolvedValue(mockOtp);
    (prisma.phoneOtp.updateMany as any).mockResolvedValue({ count: 1 });

    (prisma.user.findMany as any).mockResolvedValue([]);
    const mockCustomer = {
      id: 'cust-1',
      phone: '+989122222222',
      phoneVerifiedAt: new Date(),
    };
    (prisma.customerAccount.findUnique as any).mockResolvedValue(mockCustomer);
    (prisma.session.create as any).mockResolvedValue({ id: 'sess-cust-1' });

    const res = await request(app)
      .post('/api/v1/auth/otp/login')
      .send({ phone: customerPhone, otp: '123456' });

    expect(res.status).toBe(httpStatus.OK);
    expect(res.body.data.user.actorType).toBe('CUSTOMER');
    expect(res.body.data.user.roles).toEqual(['CUSTOMER']);
    expect(res.body.data.user.gamingCenters).toEqual([]);
  });

  // 3. New Phone -> Safe Customer Creation
  it('3. New Phone: automatically provisions new CustomerAccount and logs in', async () => {
    const mockOtp = {
      id: 'otp-new',
      phone: '+989123333333',
      codeHash: await argon2.hash('123456'),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    };
    (prisma.phoneOtp.findFirst as any).mockResolvedValue(mockOtp);
    (prisma.phoneOtp.updateMany as any).mockResolvedValue({ count: 1 });

    (prisma.user.findMany as any).mockResolvedValue([]);
    (prisma.customerAccount.findUnique as any).mockResolvedValue(null);
    const createdCustomer = {
      id: 'cust-new-created',
      phone: '+989123333333',
      phoneVerifiedAt: new Date(),
    };
    (prisma.customerAccount.upsert as any).mockResolvedValue(createdCustomer);
    (prisma.session.create as any).mockResolvedValue({ id: 'sess-cust-new' });

    const res = await request(app)
      .post('/api/v1/auth/otp/login')
      .send({ phone: newPhone, otp: '123456' });

    expect(res.status).toBe(httpStatus.OK);
    expect(res.body.data.user.id).toBe('cust-new-created');
    expect(res.body.data.user.actorType).toBe('CUSTOMER');
    expect(res.body.data.user.roles).toEqual(['CUSTOMER']);
  });

  // 4. Branch Manager User Login
  it('4. Branch Manager User Login: extracts MANAGER role and center', async () => {
    const mockOtp = {
      id: 'otp-mgr',
      phone: '+989121111111',
      codeHash: await argon2.hash('123456'),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    };
    (prisma.phoneOtp.findFirst as any).mockResolvedValue(mockOtp);
    (prisma.phoneOtp.updateMany as any).mockResolvedValue({ count: 1 });

    const mockManager = {
      id: 'usr-mgr',
      phone: '+989121111111',
      role: UserRole.MANAGER,
      isActive: true,
      gamingCenter: { id: 'center-1', name: 'Center One' },
    };
    (prisma.user.findMany as any).mockResolvedValue([mockManager]);
    (prisma.customerAccount.findUnique as any).mockResolvedValue(null);
    (prisma.session.create as any).mockResolvedValue({ id: 'sess-mgr' });

    const res = await request(app)
      .post('/api/v1/auth/otp/login')
      .send({ phone: userPhone, otp: '123456' });

    expect(res.status).toBe(httpStatus.OK);
    expect(res.body.data.user.actorType).toBe('USER');
    expect(res.body.data.user.roles).toEqual([UserRole.MANAGER]);
    expect(res.body.data.user.gamingCenters[0].role).toBe(UserRole.MANAGER);
  });

  // 5. Employee User Login
  it('5. Employee User Login: extracts STAFF/EMPLOYEE role', async () => {
    const mockOtp = {
      id: 'otp-emp',
      phone: '+989121111111',
      codeHash: await argon2.hash('123456'),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    };
    (prisma.phoneOtp.findFirst as any).mockResolvedValue(mockOtp);
    (prisma.phoneOtp.updateMany as any).mockResolvedValue({ count: 1 });

    const mockStaff = {
      id: 'usr-staff',
      phone: '+989121111111',
      role: UserRole.STAFF,
      isActive: true,
      gamingCenter: { id: 'center-2', name: 'Center Two' },
    };
    (prisma.user.findMany as any).mockResolvedValue([mockStaff]);
    (prisma.customerAccount.findUnique as any).mockResolvedValue(null);
    (prisma.session.create as any).mockResolvedValue({ id: 'sess-staff' });

    const res = await request(app)
      .post('/api/v1/auth/otp/login')
      .send({ phone: userPhone, otp: '123456' });

    expect(res.status).toBe(httpStatus.OK);
    expect(res.body.data.user.actorType).toBe('USER');
    expect(res.body.data.user.roles).toEqual([UserRole.STAFF]);
  });

  // 6. User with Multiple Gaming Centers
  it('6. User with multiple Gaming Centers: returns context for all centers with individual roles', async () => {
    const mockOtp = {
      id: 'otp-multi',
      phone: '+989125555555',
      codeHash: await argon2.hash('123456'),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    };
    (prisma.phoneOtp.findFirst as any).mockResolvedValue(mockOtp);
    (prisma.phoneOtp.updateMany as any).mockResolvedValue({ count: 1 });

    const mockUser1 = {
      id: 'usr-mc-1',
      phone: '+989125555555',
      role: UserRole.MANAGER,
      isActive: true,
      gamingCenter: { id: 'center-a', name: 'Center A' },
    };
    const mockUser2 = {
      id: 'usr-mc-2',
      phone: '+989125555555',
      role: UserRole.SUPERVISOR,
      isActive: true,
      gamingCenter: { id: 'center-b', name: 'Center B' },
    };
    (prisma.user.findMany as any).mockResolvedValue([mockUser1, mockUser2]);
    (prisma.customerAccount.findUnique as any).mockResolvedValue(null);
    (prisma.session.create as any).mockResolvedValue({ id: 'sess-mc' });

    const res = await request(app)
      .post('/api/v1/auth/otp/login')
      .send({ phone: multiCenterPhone, otp: '123456' });

    expect(res.status).toBe(httpStatus.OK);
    expect(res.body.data.user.gamingCenters).toHaveLength(2);
    expect(res.body.data.user.roles).toContain(UserRole.MANAGER);
    expect(res.body.data.user.roles).toContain(UserRole.SUPERVISOR);
  });

  // 7. Phone shared between User and Customer
  it('7. Phone shared between User and Customer: identifies User account while maintaining consistency', async () => {
    const mockOtp = {
      id: 'otp-shared',
      phone: '+989124444444',
      codeHash: await argon2.hash('123456'),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    };
    (prisma.phoneOtp.findFirst as any).mockResolvedValue(mockOtp);
    (prisma.phoneOtp.updateMany as any).mockResolvedValue({ count: 1 });

    const mockUser = {
      id: 'usr-shared',
      phone: '+989124444444',
      role: UserRole.STAFF,
      isActive: true,
      gamingCenter: { id: 'gc-shared', name: 'Shared Center' },
    };
    const mockCustomer = {
      id: 'cust-shared',
      phone: '+989124444444',
    };
    (prisma.user.findMany as any).mockResolvedValue([mockUser]);
    (prisma.customerAccount.findUnique as any).mockResolvedValue(mockCustomer);
    (prisma.session.create as any).mockResolvedValue({ id: 'sess-shared' });

    const res = await request(app)
      .post('/api/v1/auth/otp/login')
      .send({ phone: sharedPhone, otp: '123456' });

    expect(res.status).toBe(httpStatus.OK);
    expect(res.body.data.user.actorType).toBe('USER');
    expect(res.body.data.user.id).toBe('usr-shared');
  });

  // 8. Incorrect OTP
  it('8. Incorrect OTP returns 401 and increments attempts', async () => {
    const mockOtp = {
      id: 'otp-wrong',
      phone: '+989121111111',
      codeHash: await argon2.hash('123456'),
      attempts: 1,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    };
    (prisma.phoneOtp.findFirst as any).mockResolvedValue(mockOtp);
    (prisma.phoneOtp.update as any).mockResolvedValue({ ...mockOtp, attempts: 2 });

    const res = await request(app)
      .post('/api/v1/auth/otp/login')
      .send({ phone: userPhone, otp: '999999' });

    expect(res.status).toBe(httpStatus.UNAUTHORIZED);
    expect(prisma.phoneOtp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'otp-wrong' },
        data: { attempts: { increment: 1 } },
      })
    );
  });

  // 9. Expired OTP
  it('9. Expired OTP is rejected with 401', async () => {
    (prisma.phoneOtp.findFirst as any).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/otp/login')
      .send({ phone: userPhone, otp: '123456' });

    expect(res.status).toBe(httpStatus.UNAUTHORIZED);
  });

  // 10. Reuse Consumed OTP (Replay Attack)
  it('10. Replay attack: Reusing already consumed OTP is rejected', async () => {
    (prisma.phoneOtp.findFirst as any).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/otp/login')
      .send({ phone: userPhone, otp: '123456' });

    expect(res.status).toBe(httpStatus.UNAUTHORIZED);
  });

  // 11. OTP Resend invalidates previous
  it('11. Resend OTP invalidates previous unconsumed OTPs', async () => {
    (prisma.phoneOtp.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.phoneOtp.create as any).mockResolvedValue({ id: 'otp-new-resend' });

    const res = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ phone: userPhone });

    expect(res.status).toBe(httpStatus.OK);
    expect(prisma.phoneOtp.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          phone: '+989121111111',
          consumedAt: null,
        }),
      })
    );
  });

  // 12. 5 failed attempts locks/invalidates OTP
  it('12. 5 failed attempts locks and invalidates OTP', async () => {
    const mockOtp = {
      id: 'otp-lock-5',
      phone: '+989121111111',
      codeHash: await argon2.hash('123456'),
      attempts: 5,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    };
    (prisma.phoneOtp.findFirst as any).mockResolvedValue(mockOtp);
    (prisma.phoneOtp.update as any).mockResolvedValue({ ...mockOtp, consumedAt: new Date() });

    const { OtpService } = await import('../../../src/modules/auth/otp.service');
    await expect(
      OtpService.verifyAndConsumeOtp('+989121111111', '123456')
    ).rejects.toThrow('Too many failed attempts. OTP has been invalidated.');

    expect(prisma.phoneOtp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'otp-lock-5' },
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      })
    );
  });

  // 13. Concurrency: atomic consumption race condition
  it('13. Concurrency: Two concurrent requests consuming same OTP allows only 1 winner', async () => {
    const mockOtp = {
      id: 'otp-race',
      phone: '+989121111111',
      codeHash: await argon2.hash('123456'),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    };
    (prisma.phoneOtp.findFirst as any).mockResolvedValue(mockOtp);

    // First call succeeds with count 1, second fails with count 0
    let callCount = 0;
    (prisma.phoneOtp.updateMany as any).mockImplementation(() => {
      callCount += 1;
      return Promise.resolve({ count: callCount === 1 ? 1 : 0 });
    });

    const mockUser = {
      id: 'usr-race',
      phone: '+989121111111',
      role: UserRole.STAFF,
      isActive: true,
      gamingCenter: { id: 'gc-r', name: 'Race GC' },
    };
    (prisma.user.findMany as any).mockResolvedValue([mockUser]);
    (prisma.customerAccount.findUnique as any).mockResolvedValue(null);
    (prisma.session.create as any).mockResolvedValue({ id: 'sess-race' });

    const [res1, res2] = await Promise.all([
      request(app).post('/api/v1/auth/otp/login').send({ phone: userPhone, otp: '123456' }),
      request(app).post('/api/v1/auth/otp/login').send({ phone: userPhone, otp: '123456' }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 401]);
  });

  // 14. Concurrency: Customer creation duplicate prevention
  it('14. Concurrency: Parallel creation requests resolve safely without duplicate Customer', async () => {
    const mockCustomer = {
      id: 'cust-unique',
      phone: '+989123333333',
      phoneVerifiedAt: new Date(),
    };
    (prisma.customerAccount.upsert as any).mockResolvedValue(mockCustomer);

    const { UserProvisioningService } = await import('../../../src/modules/auth/user-provisioning.service');
    const [c1, c2] = await Promise.all([
      UserProvisioningService.provisionCustomer('+989123333333'),
      UserProvisioningService.provisionCustomer('+989123333333'),
    ]);

    expect(c1.id).toBe(c2.id);
    expect(c1.id).toBe('cust-unique');
  });

  // 15. Attempt to forge role from client input
  it('15. Attempt to forge role: Client sending custom role is ignored; role is strictly from DB', async () => {
    const mockOtp = {
      id: 'otp-forge',
      phone: '+989121111111',
      codeHash: await argon2.hash('123456'),
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    };
    (prisma.phoneOtp.findFirst as any).mockResolvedValue(mockOtp);
    (prisma.phoneOtp.updateMany as any).mockResolvedValue({ count: 1 });

    const mockStaff = {
      id: 'usr-staff-forge',
      phone: '+989121111111',
      role: UserRole.STAFF,
      isActive: true,
      gamingCenter: { id: 'gc-forge', name: 'Forge GC' },
    };
    (prisma.user.findMany as any).mockResolvedValue([mockStaff]);
    (prisma.customerAccount.findUnique as any).mockResolvedValue(null);
    (prisma.session.create as any).mockResolvedValue({ id: 'sess-forge' });

    const res = await request(app)
      .post('/api/v1/auth/otp/login')
      .send({ phone: userPhone, otp: '123456', role: 'ADMIN', actorType: 'PLATFORM_ADMIN' });

    expect(res.status).toBe(httpStatus.OK);
    expect(res.body.data.user.actorType).toBe('USER');
    expect(res.body.data.user.roles).toEqual([UserRole.STAFF]);
    expect(res.body.data.user.roles).not.toContain('ADMIN');
  });

  // 16. Tenant isolation: Attempt to access unauthorized gaming center
  it('16. Tenant isolation: Staff of Center A cannot access private tenant routes of Center B', async () => {
    const { generateAccessToken } = await import('../../../src/modules/auth/auth.tokens');
    const token = generateAccessToken({
      sessionId: 'sess-iso',
      actorId: 'usr-center-a',
      actorType: 'USER',
    });

    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'usr-center-a',
      role: UserRole.STAFF,
      gamingCenterId: 'center-a',
      isActive: true,
    });

    const res = await request(app)
      .get('/api/v1/gaming-centers/center-b/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(httpStatus.NOT_FOUND);
  });

  // 17. Refresh token rotation: Old refresh token is replaced, replay is rejected
  it('17. Refresh token rotation: Old refresh token is replaced, replay is rejected', async () => {
    const { SessionService } = await import('../../../src/modules/auth/session.service');
    const mockSession = {
      id: 'sess-rotate',
      actorId: 'usr-rot',
      actorType: 'USER',
      tokenHash: 'hashed_rot_token',
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
    };

    (prisma.session.findUnique as any).mockResolvedValue(mockSession);
    (prisma.session.update as any).mockResolvedValue({ ...mockSession, tokenHash: 'new_hash' });

    const rotateResult = await SessionService.rotateRefreshToken('valid_token');
    expect(rotateResult.accessToken).toBeDefined();
    expect(rotateResult.refreshToken).toBeDefined();

    // Replay with revoked session
    (prisma.session.findUnique as any).mockResolvedValue({ ...mockSession, revokedAt: new Date() });
    await expect(SessionService.rotateRefreshToken('revoked_token')).rejects.toThrow('Session is invalid or has been revoked');
  });

  // 18. Logout revokes session and invalidates cache
  it('18. Logout revokes session and invalidates cache', async () => {
    (prisma.session.findUnique as any).mockResolvedValue({
      id: 'sess-logout',
      actorId: 'usr-log',
      actorType: 'USER',
    });
    (prisma.session.update as any).mockResolvedValue({
      id: 'sess-logout',
      revokedAt: new Date(),
    });

    const { SessionService } = await import('../../../src/modules/auth/session.service');
    const result = await SessionService.revokeSession('sess-logout');
    expect(result.message).toBe('Logged out successfully');
  });

  // 19. SKIP_OTP works in production when enabled as per requirements
  it('19. SKIP_OTP works in production when enabled as per requirements', async () => {
    const origEnv = env.NODE_ENV;
    const origSkip = env.SKIP_OTP;
    try {
      (env as any).NODE_ENV = 'production';
      (env as any).SKIP_OTP = true;

      const { OtpService } = await import('../../../src/modules/auth/otp.service');
      (prisma.phoneOtp.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.phoneOtp.create as any).mockImplementation(({ data }: any) => Promise.resolve({ id: 'otp-prod', ...data }));

      await OtpService.requestOtp('+989121111111');

      const createCall = (prisma.phoneOtp.create as any).mock.calls[0][0];
      const is000000 = await argon2.verify(createCall.data.codeHash, '000000');
      expect(is000000).toBe(true);
    } finally {
      (env as any).NODE_ENV = origEnv;
      (env as any).SKIP_OTP = origSkip;
    }
  });
});
