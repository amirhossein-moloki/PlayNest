/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import argon2 from 'argon2';
import { encryptTotpSecret, generateTotpCode, generateTotpSecret } from '../../../src/modules/auth/totp.crypto';

jest.mock('../../../src/config/redis', () => ({
  get: jest.fn().mockImplementation(() => Promise.resolve(null)),
  set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
  del: jest.fn().mockImplementation(() => Promise.resolve(1)),
  scan: jest.fn().mockImplementation(() => Promise.resolve(['0', []])),
}));

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    platformAdmin: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    platformAdminAuthenticator: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    platformAdminRecoveryCode: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    platformAdminChallenge: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));

const MockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

describe('PLATFORM_ADMIN Authentication API (Mandatory TOTP 2FA)', () => {
  const adminId = 'pa_123';
  const username = 'superadmin';
  const phone = '09129998877';
  const password = 'SuperSecretPassword123!';
  const totpSecret = generateTotpSecret();
  const totpCipher = encryptTotpSecret(totpSecret, adminId);

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(prisma));
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit_1' });
  });

  it('step 1 login with username & password issues ephemeral challengeToken (never access/refresh tokens)', async () => {
    (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue({
      id: adminId,
      username,
      fullName: 'Global Superuser',
      phone,
      email: 'admin@playenest.com',
      passwordHash: 'hashed_pw',
      isActive: true,
      isSuperuser: true,
      totpEnabled: true,
      totpSetupCompleted: true,
      totpSecretEncrypted: totpCipher,
      failedLoginAttempts: 0,
      lockedUntil: null,
      authenticators: [
        {
          id: 'auth_1',
          secretEncrypted: totpCipher,
          status: 'ACTIVE',
          isPrimary: true,
          lastUsedStep: null,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
    });
    MockedArgon2.verify.mockResolvedValue(true as any);
    (prisma.platformAdminChallenge.create as jest.Mock).mockResolvedValue({
      id: 'chal_1',
      platformAdminId: adminId,
      purpose: 'TOTP_VERIFY',
    });

    const res = await request(app)
      .post('/api/v1/auth/platform-admin/login')
      .send({ username, password });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('TOTP_REQUIRED');
    expect(res.body.data.requiresTwoFactor).toBe(true);
    expect(res.body.data.requiresTwoFactorSetup).toBe(false);
    expect(res.body.data.challengeToken).toBeDefined();
    expect(res.body.data.accessToken).toBeUndefined();
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(res.body.data.tokens).toBeUndefined();
    expect(res.body.data.admin.id).toBe(adminId);
    expect(res.body.data.admin.passwordHash).toBeUndefined();
    expect(res.body.data.admin.totpSecretEncrypted).toBeUndefined();
  });

  it('step 1 login forces TOTP_SETUP_REQUIRED when 2FA has not been set up yet', async () => {
    (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue({
      id: adminId,
      username,
      fullName: 'New Superuser',
      phone: null,
      email: null,
      passwordHash: 'hashed_pw',
      isActive: true,
      isSuperuser: true,
      totpEnabled: false,
      totpSetupCompleted: false,
      totpSecretEncrypted: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      authenticators: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
    });
    MockedArgon2.verify.mockResolvedValue(true as any);
    (prisma.platformAdminChallenge.create as jest.Mock).mockResolvedValue({
      id: 'chal_setup_1',
      platformAdminId: adminId,
      purpose: 'TOTP_SETUP',
    });

    const res = await request(app)
      .post('/api/v1/auth/platform-admin/login')
      .send({ username, password });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('TOTP_SETUP_REQUIRED');
    expect(res.body.data.requiresTwoFactorSetup).toBe(true);
    expect(res.body.data.setupToken).toBeDefined();
    expect(res.body.data.accessToken).toBeUndefined();
    expect(res.body.data.tokens).toBeUndefined();
  });

  it('step 2 verify-2fa issues full tokens only after valid TOTP verification', async () => {
    (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue({
      id: adminId,
      username,
      fullName: 'Global Superuser',
      phone,
      email: 'admin@playenest.com',
      passwordHash: 'hashed_pw',
      isActive: true,
      isSuperuser: true,
      totpEnabled: true,
      totpSetupCompleted: true,
      totpSecretEncrypted: totpCipher,
      failedLoginAttempts: 0,
      lockedUntil: null,
      authenticators: [{ id: 'auth_1', secretEncrypted: totpCipher, status: 'ACTIVE', isPrimary: true, lastUsedStep: null }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    MockedArgon2.verify.mockResolvedValue(true as any);

    let savedTokenHash = '';
    (prisma.platformAdminChallenge.create as jest.Mock).mockImplementation(async ({ data }: any) => {
      savedTokenHash = data.tokenHash;
      return { id: 'chal_verify_1', ...data };
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/platform-admin/login')
      .send({ username, password });

    const { challengeToken } = loginRes.body.data;
    const validTotp = generateTotpCode(totpSecret);

    (prisma.platformAdminChallenge.findUnique as jest.Mock).mockResolvedValue({
      id: 'chal_verify_1',
      platformAdminId: adminId,
      purpose: 'TOTP_VERIFY',
      tokenHash: savedTokenHash,
      attempts: 0,
      maxAttempts: 5,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 300_000),
    });
    (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: adminId,
      username,
      fullName: 'Global Superuser',
      phone,
      email: 'admin@playenest.com',
      isActive: true,
      isSuperuser: true,
      totpEnabled: true,
      totpSetupCompleted: true,
      totpSecretEncrypted: totpCipher,
      totpLastUsedStep: null,
      totpFailedAttempts: 0,
      totpLockedUntil: null,
      authenticators: [{ id: 'auth_1', secretEncrypted: totpCipher, status: 'ACTIVE', isPrimary: true, lastUsedStep: null }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.platformAdminChallenge.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.platformAdminAuthenticator.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.platformAdmin.update as jest.Mock).mockResolvedValue({
      id: adminId,
      username,
      fullName: 'Global Superuser',
      phone,
      email: 'admin@playenest.com',
      isActive: true,
      isSuperuser: true,
      totpEnabled: true,
      totpSetupCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.session.create as jest.Mock).mockResolvedValue({ id: 'sess_pa_1' });

    const verifyRes = await request(app)
      .post('/api/v1/auth/platform-admin/verify-2fa')
      .send({ challengeToken, code: validTotp });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.accessToken).toBeDefined();
    expect(verifyRes.body.data.refreshToken).toBeUndefined();
    expect(verifyRes.body.data.tokens.refreshToken).toBeUndefined();
    const rawSetCookie = verifyRes.headers['set-cookie'] as string | string[] | undefined;
    const setCookieHeader = Array.isArray(rawSetCookie) ? rawSetCookie.join(';') : String(rawSetCookie || '');
    expect(setCookieHeader).toContain('playnest_pa_refresh=');
    expect(setCookieHeader).toContain('HttpOnly');
    expect(verifyRes.body.data.tokens.accessToken).toBe(verifyRes.body.data.accessToken);
    expect(verifyRes.body.data.admin.passwordHash).toBeUndefined();
  });

  it('should reject login if credentials are invalid', async () => {
    (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue({
      id: adminId,
      username,
      fullName: 'Global Superuser',
      phone,
      email: 'admin@playenest.com',
      passwordHash: 'hashed_pw',
      isActive: true,
      isSuperuser: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      authenticators: [],
    });
    MockedArgon2.verify.mockResolvedValue(false as any);

    const res = await request(app)
      .post('/api/v1/auth/platform-admin/login')
      .send({ username, password: 'wrong_password' });

    expect(res.status).toBe(401);
  });

  it('should reject login if platform admin account is deactivated', async () => {
    (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue({
      id: adminId,
      username,
      fullName: 'Deactivated Admin',
      phone,
      email: 'admin@playenest.com',
      passwordHash: 'hashed_pw',
      isActive: false,
      isSuperuser: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      authenticators: [],
    });
    MockedArgon2.verify.mockResolvedValue(true as any);

    const res = await request(app)
      .post('/api/v1/auth/platform-admin/login')
      .send({ username, password });

    expect(res.status).toBe(401);
  });

  it('should reject tenant users attempting to authenticate via platform-admin login', async () => {
    (prisma.platformAdmin.findFirst as jest.Mock).mockResolvedValue(null);
    MockedArgon2.verify.mockResolvedValue(false as any);

    const res = await request(app)
      .post('/api/v1/auth/platform-admin/login')
      .send({ username: 'tenant_manager', password });

    expect(res.status).toBe(401);
  });

  it('should serve platform admin SSR dashboard & dedicated 2FA login page without prompt()', async () => {
    const dashRes = await request(app).get('/api/v1/platform-admin/dashboard');
    expect(dashRes.status).toBe(200);
    expect(dashRes.type).toBe('text/html');
    expect(dashRes.text).toContain('PlayNest - Platform Superuser Administration');
    expect(dashRes.text).toContain('id="authOverlay"');
    expect(dashRes.text).toContain('id="loginForm"');
    expect(dashRes.text).toContain('/api/v1/auth/platform-admin/login');
    expect(dashRes.text).toContain('/api/v1/auth/platform-admin/verify-2fa');
    expect(dashRes.text).toContain('tab-security');
    expect(dashRes.text).not.toContain('prompt(\'Enter');

    const loginPageRes = await request(app).get('/api/v1/platform-admin/login');
    expect(loginPageRes.status).toBe(200);
    expect(loginPageRes.type).toBe('text/html');
    expect(loginPageRes.text).toContain('view-login');
    expect(loginPageRes.text).toContain('view-verify-2fa');
    expect(loginPageRes.text).toContain('view-setup-2fa');
    expect(loginPageRes.text).toContain('view-recovery-codes');
  });
});
