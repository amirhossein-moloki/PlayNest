/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import * as argon2 from 'argon2';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SessionActorType, UserRole } from '@prisma/client';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import redis from '../../src/config/redis';
import { generateAccessToken, generateRefreshToken } from '../../src/modules/auth/auth.tokens';
import * as usersRepo from '../../src/modules/users/users.repo';
import { encryptTotpSecret, generateTotpCode, generateTotpSecret } from '../../src/modules/auth/totp.crypto';
import { PLATFORM_ADMIN_REFRESH_COOKIE_NAME } from '../../src/modules/auth/platform-admin-auth.constants';

const redisStore = new Map<string, string>();
const auditLogEntries: any[] = [];

jest.mock('argon2', () => ({
  hash: jest.fn(async (pw: string) => `argon2_mock:${pw}`),
  verify: jest.fn(async () => false),
}));

jest.mock('../../src/config/redis', () => {
  const mockRedis: any = {
    status: 'ready',
    get: jest.fn(async (key: string) => redisStore.get(key) ?? null),
    set: jest.fn(async (key: string, val: string) => {
      redisStore.set(key, String(val));
      return 'OK';
    }),
    del: jest.fn(async (...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        if (redisStore.delete(key)) deleted += 1;
      }
      return deleted;
    }),
    scan: jest.fn(async () => ['0', []]),
  };
  return {
    __esModule: true,
    redis: mockRedis,
    default: mockRedis,
  };
});

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    customerAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    platformAdmin: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    platformAdminAuthenticator: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    platformAdminChallenge: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    gamingCenter: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('SEC-028: Auth Hardening, passwordHash Redaction, Lockout, Cookie-Only PA Refresh & CORS Guard', () => {
  const gamingCenterId = 'c111111111111111111111111';
  const managerId = 'c222222222222222222222222';
  const staffId = 'c333333333333333333333333';
  const platformAdminId = 'c444444444444444444444444';

  const managerRecord = {
    id: managerId,
    gamingCenterId,
    fullName: 'Center Manager',
    phone: '09120001111',
    role: UserRole.MANAGER,
    isActive: true,
    isPublic: false,
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$secret_manager_hash',
  };

  const staffRecord = {
    id: staffId,
    gamingCenterId,
    fullName: 'Staff Member',
    phone: '09120002222',
    role: UserRole.STAFF,
    isActive: true,
    isPublic: false,
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$secret_staff_hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const adminActor = {
    id: platformAdminId,
    username: 'secadmin',
    fullName: 'Platform Admin',
    phone: '09120009999',
    email: 'secadmin@playnest.test',
    passwordHash: '$argon2id$secret_admin_hash',
    isActive: true,
    isSuperuser: true,
    totpEnabled: true,
    totpSetupCompleted: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    redisStore.clear();
    auditLogEntries.length = 0;

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(prisma));
    (prisma.auditLog.create as jest.Mock).mockImplementation(async (args: any) => {
      auditLogEntries.push(args?.data);
      return { id: `audit_${auditLogEntries.length}` };
    });
    (prisma.session.findUnique as jest.Mock).mockResolvedValue({
      id: 'sess_active_1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 600_000),
    } as never);
    (prisma.session.findMany as jest.Mock).mockResolvedValue([] as never);
    (prisma.session.updateMany as jest.Mock).mockResolvedValue({ count: 0 } as never);
    (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 } as never);
    (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue({
      id: gamingCenterId,
      name: 'Test Center',
      slug: 'test-center',
    } as never);
    (prisma.user.findUnique as jest.Mock).mockImplementation((async (args: any) => {
      if (args?.where?.id === managerId) return { ...managerRecord };
      if (args?.where?.id === staffId) return { ...staffRecord };
      return null;
    }) as any);
  });

  it('1. omitPasswordHash and staff HTTP endpoints strip passwordHash from responses and audit logs', async () => {
    const singleSanitized = usersRepo.omitPasswordHash({ ...staffRecord }) as any;
    expect(singleSanitized.passwordHash).toBeUndefined();
    expect(singleSanitized.id).toBe(staffId);

    const managerToken = generateAccessToken({
      sessionId: 'sess_active_1',
      actorId: managerId,
      actorType: SessionActorType.USER,
    });

    (prisma.user.findFirst as jest.Mock)
      .mockResolvedValueOnce(null as never) // create duplicate check
      .mockResolvedValueOnce({ ...staffRecord } as never) // GET :userId
      .mockResolvedValueOnce({ ...staffRecord } as never) // PUT existing check
      .mockResolvedValueOnce({ ...staffRecord, fullName: 'Updated Staff' } as never) // PUT updated lookup
      .mockResolvedValueOnce({ ...staffRecord } as never); // DELETE existing check
    (prisma.user.create as jest.Mock).mockResolvedValue({ ...staffRecord } as never);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ ...staffRecord }] as never);
    (prisma.user.count as jest.Mock).mockResolvedValue(1 as never);

    const createRes = await request(app)
      .post(`/api/v1/gamingCenters/${gamingCenterId}/staff`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        fullName: 'Staff Member',
        phone: '09120002222',
        role: UserRole.STAFF,
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.passwordHash).toBeUndefined();

    const listRes = await request(app)
      .get(`/api/v1/gamingCenters/${gamingCenterId}/staff`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].passwordHash).toBeUndefined();

    const getRes = await request(app)
      .get(`/api/v1/gamingCenters/${gamingCenterId}/staff/${staffId}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.passwordHash).toBeUndefined();

    const updateRes = await request(app)
      .put(`/api/v1/gamingCenters/${gamingCenterId}/staff/${staffId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ fullName: 'Updated Staff' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.passwordHash).toBeUndefined();

    const deleteRes = await request(app)
      .delete(`/api/v1/gamingCenters/${gamingCenterId}/staff/${staffId}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(deleteRes.status).toBe(204);

    expect(auditLogEntries.length).toBeGreaterThanOrEqual(3);
    const serializedAudits = JSON.stringify(auditLogEntries);
    expect(serializedAudits).not.toContain('passwordHash');
    expect(serializedAudits).not.toContain('secret_staff_hash');
  });

  it('2. POST /api/v1/gamingCenters rejects non-PLATFORM_ADMIN with 403 and sets passwordHash: null for provisioned owner', async () => {
    const managerToken = generateAccessToken({
      sessionId: 'sess_active_1',
      actorId: managerId,
      actorType: SessionActorType.USER,
    });

    const forbiddenRes = await request(app)
      .post('/api/v1/gamingCenters')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Unauthorized Center',
        slug: 'unauth-center',
        ownerId: managerId,
      });
    expect(forbiddenRes.status).toBe(403);
    expect(prisma.gamingCenter.create).not.toHaveBeenCalled();

    const platformAdminToken = generateAccessToken({
      sessionId: 'sess_active_1',
      actorId: platformAdminId,
      actorType: SessionActorType.PLATFORM_ADMIN,
      mfaVerified: true,
    });

    (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue({ ...adminActor } as never);
    (prisma.gamingCenter.findFirst as jest.Mock).mockResolvedValue(null as never);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null as never);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null as never);
    (prisma.gamingCenter.create as jest.Mock).mockResolvedValue({
      id: gamingCenterId,
      name: 'New Center',
      slug: 'new-center',
      games: [],
      isActive: true,
    } as never);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 'c555555555555555555555555',
      fullName: adminActor.fullName,
      phone: adminActor.phone,
      role: UserRole.MANAGER,
      gamingCenterId,
      passwordHash: null,
      isActive: true,
    } as never);

    const createdRes = await request(app)
      .post('/api/v1/gamingCenters')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        name: 'New Center',
        slug: 'new-center',
        ownerId: platformAdminId,
      });

    expect(createdRes.status).toBe(201);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: null,
        }),
      })
    );
  });

  it('3. loginUser rejects inactive users and enforces 5-attempt Redis ACCOUNT_LOCKED lockout', async () => {
    const phone = '09120001111';

    // Inactive user is rejected even when password matches
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      ...managerRecord,
      isActive: false,
    } as never);
    (argon2.verify as jest.Mock).mockResolvedValueOnce(true as never);

    const inactiveRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone, password: 'ValidPassword123!', gamingCenterId });
    expect(inactiveRes.status).toBe(401);
    expect(inactiveRes.body.success).toBe(false);

    // 5 failed password attempts trigger Redis lock and 6th returns 429 ACCOUNT_LOCKED
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...managerRecord } as never);
    (argon2.verify as jest.Mock).mockResolvedValue(false as never);

    for (let i = 0; i < 5; i += 1) {
      const failRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ phone, password: `WrongPass_${i}` });
      expect(failRes.status).toBe(401);
    }

    const callsBeforeLock = (argon2.verify as jest.Mock).mock.calls.length;
    const lockedRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone, password: 'AnyPassword' });

    expect(lockedRes.status).toBe(429);
    expect(lockedRes.body.error?.code).toBe('ACCOUNT_LOCKED');
    expect((argon2.verify as jest.Mock).mock.calls.length).toBe(callsBeforeLock);
    expect(redis.set).toHaveBeenCalled();
  });

  it('4. PlatformAdmin 2FA & refresh are cookie-only, regular /auth/refresh keeps JSON refreshToken, and UI templates omit localStorage refresh storage', async () => {
    const secret = generateTotpSecret();
    const cipher = encryptTotpSecret(secret, platformAdminId);
    const challengeToken = (await import('../../src/modules/auth/auth.tokens')).generatePlatformAdminChallengeToken({
      challengeId: 'chal_cookie_only',
      actorId: platformAdminId,
      purpose: 'TOTP_VERIFY',
      nonce: 'nonce_cookie_only',
    });

    (prisma.platformAdminChallenge.findUnique as jest.Mock).mockResolvedValue({
      id: 'chal_cookie_only',
      platformAdminId,
      purpose: 'TOTP_VERIFY',
      nonce: 'nonce_cookie_only',
      consumedAt: null,
      expiresAt: new Date(Date.now() + 300_000),
    } as never);
    (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      ...adminActor,
      totpSecretEncrypted: cipher,
      totpLastUsedStep: null,
      totpFailedAttempts: 0,
      totpLockedUntil: null,
      authenticators: [
        { id: 'auth_dev_1', secretEncrypted: cipher, status: 'ACTIVE', isPrimary: true, lastUsedStep: null },
      ],
    } as never);
    (prisma.platformAdminChallenge.updateMany as jest.Mock).mockResolvedValue({ count: 1 } as never);
    (prisma.platformAdminAuthenticator.updateMany as jest.Mock).mockResolvedValue({ count: 1 } as never);
    (prisma.platformAdmin.update as jest.Mock).mockResolvedValue({ ...adminActor } as never);
    (prisma.session.create as jest.Mock).mockResolvedValue({ id: 'sess_pa_cookie_1' } as never);

    const verifyRes = await request(app)
      .post('/api/v1/auth/platform-admin/verify-2fa')
      .send({ challengeToken, code: generateTotpCode(secret) });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.accessToken).toBeDefined();
    expect(verifyRes.body.data.refreshToken).toBeUndefined();
    expect(verifyRes.body.data.tokens?.refreshToken).toBeUndefined();
    const verifyCookies = ([] as string[]).concat(verifyRes.headers['set-cookie'] || []);
    const paCookieHeader = verifyCookies.find((c) => c.startsWith(`${PLATFORM_ADMIN_REFRESH_COOKIE_NAME}=`)) || '';
    expect(paCookieHeader).toContain('HttpOnly');

    const cookiePair = paCookieHeader.split(';')[0];
    const paSession = {
      id: 'sess_pa_cookie_1',
      actorId: platformAdminId,
      actorType: SessionActorType.PLATFORM_ADMIN,
      refreshTokenHash: 'any_hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 600_000),
    };
    const { hashToken } = await import('../../src/modules/auth/auth.tokens');
    paSession.refreshTokenHash = hashToken(cookiePair.split('=')[1]);
    (prisma.session.findUnique as jest.Mock).mockResolvedValueOnce(paSession as never);
    (prisma.session.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 } as never);
    (prisma.session.create as jest.Mock).mockResolvedValueOnce({ id: 'sess_pa_cookie_2' } as never);

    const refreshPaRes = await request(app)
      .post('/api/v1/auth/platform-admin/refresh')
      .set('Cookie', cookiePair)
      .send({});

    expect(refreshPaRes.status).toBe(200);
    expect(refreshPaRes.body.data.accessToken).toBeDefined();
    expect(refreshPaRes.body.data.refreshToken).toBeUndefined();
    expect(refreshPaRes.body.data.tokens?.refreshToken).toBeUndefined();
    const rotatedCookies = ([] as string[]).concat(refreshPaRes.headers['set-cookie'] || []);
    expect(rotatedCookies.some((c) => c.startsWith(`${PLATFORM_ADMIN_REFRESH_COOKIE_NAME}=`) && c.includes('HttpOnly'))).toBe(true);

    // Regular USER refresh keeps JSON refreshToken for API clients
    const userRefreshToken = generateRefreshToken({
      sessionId: 'sess_user_1',
      actorId: managerId,
      actorType: SessionActorType.USER,
    });
    (prisma.session.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'sess_user_1',
      actorId: managerId,
      actorType: SessionActorType.USER,
      refreshTokenHash: hashToken(userRefreshToken),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 600_000),
    } as never);
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ ...managerRecord } as never);
    (prisma.session.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 } as never);
    (prisma.session.create as jest.Mock).mockResolvedValueOnce({ id: 'sess_user_2' } as never);

    const userRefreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: userRefreshToken });

    expect(userRefreshRes.status).toBe(200);
    expect(userRefreshRes.body.data.accessToken).toBeDefined();
    expect(userRefreshRes.body.data.refreshToken).toBeDefined();

    // Platform Admin HTML/JS templates must never store refresh tokens in localStorage
    const templateFiles = [
      'src/modules/platform-admin/platform-admin-auth-ui.templates.ts',
      'src/modules/platform-admin/platform-admin-ui.templates.ts',
      'src/modules/platform-admin/platform-analytics-ui.templates.ts',
    ];
    for (const relPath of templateFiles) {
      const content = fs.readFileSync(path.resolve(__dirname, '../..', relPath), 'utf8');
      expect(content).not.toMatch(/localStorage\.setItem\(['"]platform_refresh_token['"]/);
      expect(content).not.toMatch(/localStorage\.getItem\(['"]platform_refresh_token['"]/);
    }
  });

  it('5. validateProductionEnv rejects wildcard CORS_ORIGIN when CORS_CREDENTIALS=true', async () => {
    const prevEnv = {
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      PAYMENT_PROVIDER_WEBHOOK_SECRET: process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET,
    };
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET || 'test_access_secret_at_least_32_characters_long';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_at_least_32_characters_long';
    process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET =
      process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET || 'test-webhook-secret';

    try {
      const envMod = await jest.requireActual<any>('../../src/config/env');
      const validateProductionEnv = envMod.validateProductionEnv as (d: any) => void;

      const baseProdEnv = {
        NODE_ENV: 'production',
        MEDIA_STORAGE_DRIVER: 'local',
        SKIP_OTP: false,
        JWT_ACCESS_SECRET: 'prod_access_secret_at_least_32_characters_long_1234',
        JWT_REFRESH_SECRET: 'prod_refresh_secret_at_least_32_characters_long_1234',
        PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        PAYMENT_PROVIDER_WEBHOOK_SECRET: 'strong-production-webhook-secret-1234',
        DEFAULT_PAYMENT_PROVIDER: 'ZIBAL',
        ZIBAL_MERCHANT: 'real-zibal-merchant-id',
        ZARINPAL_SANDBOX: false,
        INTERNAL_SSR_SECRET: 'strong-production-ssr-secret-value',
        CORS_CREDENTIALS: true,
        CORS_ORIGIN: '*',
      };

      expect(() => validateProductionEnv(baseProdEnv)).toThrow(/CORS_ORIGIN/);
      expect(() =>
        validateProductionEnv({ ...baseProdEnv, CORS_ORIGIN: 'https://panel.playnest.ir' })
      ).not.toThrow();
    } finally {
      for (const [k, v] of Object.entries(prevEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
