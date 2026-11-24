/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../src/app';
import { env } from '../../../src/config/env';
import {
  decryptTotpSecret,
  generateTotpCode,
  getTotpTimeStep,
} from '../../../src/modules/auth/totp.crypto';
import { PLATFORM_ADMIN_AUDIT_ACTIONS } from '../../../src/modules/auth/platform-admin-auth.constants';

// Stateful in-memory stores simulating PostgreSQL & Redis for full end-to-end 2FA flows
const dbState = {
  admins: [] as any[],
  authenticators: [] as any[],
  recoveryCodes: [] as any[],
  challenges: [] as any[],
  sessions: [] as any[],
  auditLogs: [] as any[],
  users: [] as any[],
  customers: [] as any[],
  redisMap: new Map<string, string>(),
  seq: 1,
};

const nextId = (prefix: string) => `${prefix}_${dbState.seq++}`;

jest.mock('argon2', () => ({
  hash: jest.fn(async (pw: string) => `argon2mock:${pw}`),
  verify: jest.fn(async (hash: string, pw: string) => hash === `argon2mock:${pw}`),
}));

jest.mock('../../../src/config/redis', () => {
  const mockRedis: any = {
    status: 'ready',
    get: jest.fn(async (key: string) => dbState.redisMap.get(key) ?? null),
    set: jest.fn(async (key: string, val: string) => {
      dbState.redisMap.set(key, String(val));
      return 'OK';
    }),
    del: jest.fn(async (...keys: string[]) => {
      let count = 0;
      for (const k of keys) {
        if (dbState.redisMap.delete(k)) count += 1;
      }
      return count;
    }),
    scan: jest.fn(async () => ['0', []]),
    ping: jest.fn(async () => 'PONG'),
  };
  return {
    __esModule: true,
    redis: mockRedis,
    default: mockRedis,
  };
});

function matchOrConditions(row: any, orList: any[]): boolean {
  return orList.some((cond) => {
    if (cond.username) {
      const target = typeof cond.username === 'string' ? cond.username : cond.username.equals;
      const mode = cond.username?.mode;
      if (!row.username) return false;
      return mode === 'insensitive'
        ? row.username.toLowerCase() === target.toLowerCase()
        : row.username === target;
    }
    if (cond.email) {
      const target = typeof cond.email === 'string' ? cond.email : cond.email.equals;
      const mode = cond.email?.mode;
      if (!row.email) return false;
      return mode === 'insensitive'
        ? row.email.toLowerCase() === target.toLowerCase()
        : row.email === target;
    }
    if (cond.phone !== undefined) {
      return row.phone === cond.phone;
    }
    if (cond.lastUsedStep === null) {
      return row.lastUsedStep === null || row.lastUsedStep === undefined;
    }
    if (cond.lastUsedStep?.lt !== undefined) {
      return typeof row.lastUsedStep === 'number' && row.lastUsedStep < cond.lastUsedStep.lt;
    }
    if (cond.totpLastUsedStep === null) {
      return row.totpLastUsedStep === null || row.totpLastUsedStep === undefined;
    }
    if (cond.totpLastUsedStep?.lt !== undefined) {
      return typeof row.totpLastUsedStep === 'number' && row.totpLastUsedStep < cond.totpLastUsedStep.lt;
    }
    return false;
  });
}

function matchesWhere(row: any, where: any = {}): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined) continue;
    if (k === 'OR' && Array.isArray(v)) {
      if (!matchOrConditions(row, v)) return false;
      continue;
    }
    if (v === null) {
      if (row[k] !== null && row[k] !== undefined) return false;
      continue;
    }
    if (typeof v === 'object' && !(v instanceof Date)) {
      const cond = v as Record<string, any>;
      if ('gt' in cond && !(row[k] && new Date(row[k]) > new Date(cond.gt))) return false;
      if ('lt' in cond && !(typeof row[k] === 'number' && row[k] < cond.lt)) return false;
      if ('not' in cond) {
        if (cond.not === null && (row[k] === null || row[k] === undefined)) return false;
        if (cond.not !== null && row[k] === cond.not) return false;
      }
      continue;
    }
    if (row[k] !== v) return false;
  }
  return true;
}

jest.mock('../../../src/config/prisma', () => {
  const mockPrisma: any = {
    platformAdmin: {
      findFirst: jest.fn(async ({ where, include }: any) => {
        const found = dbState.admins.find((a) => matchesWhere(a, where));
        if (!found) return null;
        if (include?.authenticators) {
          return {
            ...found,
            authenticators: dbState.authenticators.filter(
              (d) =>
                d.platformAdminId === found.id &&
                (!include.authenticators.where || matchesWhere(d, include.authenticators.where))
            ),
          };
        }
        return { ...found };
      }),
      findUnique: jest.fn(async ({ where, include }: any) => {
        const found = dbState.admins.find((a) => matchesWhere(a, where));
        if (!found) return null;
        if (include?.authenticators) {
          return {
            ...found,
            authenticators: dbState.authenticators.filter(
              (d) =>
                d.platformAdminId === found.id &&
                (!include.authenticators.where || matchesWhere(d, include.authenticators.where))
            ),
          };
        }
        return { ...found };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = dbState.admins.findIndex((a) => matchesWhere(a, where));
        if (idx === -1) throw new Error('Admin not found');
        dbState.admins[idx] = { ...dbState.admins[idx], ...data, updatedAt: new Date() };
        return { ...dbState.admins[idx] };
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        dbState.admins.forEach((a, idx) => {
          if (matchesWhere(a, where)) {
            dbState.admins[idx] = { ...a, ...data, updatedAt: new Date() };
            count += 1;
          }
        });
        return { count };
      }),
    },
    platformAdminAuthenticator: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: nextId('authdev'),
          createdAt: new Date(),
          updatedAt: new Date(),
          lastUsedAt: null,
          lastUsedStep: null,
          verifiedAt: null,
          ...data,
        };
        dbState.authenticators.push(row);
        return { ...row };
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const list = dbState.authenticators.filter((d) => matchesWhere(d, where));
        return list.length ? { ...list[list.length - 1] } : null;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return dbState.authenticators.filter((d) => matchesWhere(d, where)).map((d) => ({ ...d }));
      }),
      count: jest.fn(async ({ where }: any) => {
        return dbState.authenticators.filter((d) => matchesWhere(d, where)).length;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = dbState.authenticators.findIndex((d) => matchesWhere(d, where));
        if (idx === -1) throw new Error('Authenticator not found');
        dbState.authenticators[idx] = { ...dbState.authenticators[idx], ...data, updatedAt: new Date() };
        return { ...dbState.authenticators[idx] };
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        dbState.authenticators.forEach((d, idx) => {
          if (matchesWhere(d, where)) {
            dbState.authenticators[idx] = { ...d, ...data, updatedAt: new Date() };
            count += 1;
          }
        });
        return { count };
      }),
    },
    platformAdminRecoveryCode: {
      createMany: jest.fn(async ({ data }: any) => {
        for (const item of data) {
          dbState.recoveryCodes.push({
            id: nextId('rc'),
            usedAt: null,
            revokedAt: null,
            createdAt: new Date(),
            ...item,
          });
        }
        return { count: data.length };
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return dbState.recoveryCodes.filter((r) => matchesWhere(r, where)).map((r) => ({ ...r }));
      }),
      count: jest.fn(async ({ where }: any) => {
        return dbState.recoveryCodes.filter((r) => matchesWhere(r, where)).length;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        dbState.recoveryCodes.forEach((r, idx) => {
          if (matchesWhere(r, where)) {
            dbState.recoveryCodes[idx] = { ...r, ...data };
            count += 1;
          }
        });
        return { count };
      }),
    },
    platformAdminChallenge: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: nextId('chal'),
          attempts: 0,
          consumedAt: null,
          createdAt: new Date(),
          ...data,
        };
        dbState.challenges.push(row);
        return { ...row };
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const found = dbState.challenges.find((c) => matchesWhere(c, where));
        return found ? { ...found } : null;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        dbState.challenges.forEach((c, idx) => {
          if (matchesWhere(c, where)) {
            const patched = { ...c };
            if (data.attempts?.increment) {
              patched.attempts += data.attempts.increment;
            }
            for (const [dk, dv] of Object.entries(data)) {
              if (dk !== 'attempts') patched[dk] = dv;
            }
            dbState.challenges[idx] = patched;
            count += 1;
          }
        });
        return { count };
      }),
    },
    session: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: nextId('sess'),
          revokedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        dbState.sessions.push(row);
        return { ...row };
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const found = dbState.sessions.find((s) => matchesWhere(s, where));
        return found ? { ...found } : null;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return dbState.sessions.filter((s) => matchesWhere(s, where)).map((s) => ({ ...s }));
      }),
      count: jest.fn(async ({ where }: any) => {
        return dbState.sessions.filter((s) => matchesWhere(s, where)).length;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = dbState.sessions.findIndex((s) => matchesWhere(s, where));
        if (idx === -1) throw new Error('Session not found');
        dbState.sessions[idx] = { ...dbState.sessions[idx], ...data, updatedAt: new Date() };
        return { ...dbState.sessions[idx] };
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        dbState.sessions.forEach((s, idx) => {
          if (matchesWhere(s, where)) {
            dbState.sessions[idx] = { ...s, ...data, updatedAt: new Date() };
            count += 1;
          }
        });
        return { count };
      }),
    },
    auditLog: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: nextId('audit'),
          createdAt: new Date(),
          ...data,
        };
        dbState.auditLogs.push(row);
        return { ...row };
      }),
    },
    user: {
      findUnique: jest.fn(async ({ where }: any) => {
        return dbState.users.find((u) => u.id === where.id) ?? null;
      }),
    },
    customerAccount: {
      findUnique: jest.fn(async ({ where }: any) => {
        return dbState.customers.find((c) => c.id === where.id) ?? null;
      }),
    },
    platformSetting: {
      findUnique: jest.fn(async () => ({ id: 'default', maintenanceMode: false })),
    },
    gamingCenter: {
      count: jest.fn(async () => 4),
    },
    gameStation: {
      count: jest.fn(async () => 20),
    },
    reservation: {
      count: jest.fn(async () => 12),
    },
    gamingSession: {
      count: jest.fn(async () => 3),
    },
    ticket: {
      count: jest.fn(async () => 1),
    },
    $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
  };

  return { prisma: mockPrisma };
});

describe('Platform Admin Mandatory TOTP 2FA End-to-End Security Suite', () => {
  const adminPassword = 'UltraStrongPassword!2026';

  function seedAdmin(overrides: Record<string, any> = {}) {
    const admin = {
      id: nextId('pa'),
      username: 'superadmin',
      fullName: 'Root Platform Admin',
      phone: '09121112233',
      email: 'root@playnest.ir',
      passwordHash: `argon2mock:${adminPassword}`,
      isActive: true,
      isSuperuser: true,
      totpEnabled: false,
      totpSetupCompleted: false,
      totpSecretEncrypted: null,
      totpPendingSecretEncrypted: null,
      totpPendingCreatedAt: null,
      totpEnabledAt: null,
      totpLastUsedAt: null,
      totpLastUsedStep: null,
      totpFailedAttempts: 0,
      totpLockedUntil: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
    dbState.admins.push(admin);
    return admin;
  }

  async function enrollInitialAdmin(username = 'superadmin') {
    const loginRes = await request(app)
      .post('/api/v1/auth/platform-admin/login')
      .set('User-Agent', 'PlayNestSecurityTest/1.0')
      .send({ username, password: adminPassword });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.status).toBe('TOTP_SETUP_REQUIRED');
    const setupToken = loginRes.body.data.setupToken;

    const setupRes = await request(app)
      .post('/api/v1/auth/platform-admin/2fa/setup')
      .send({ setupToken, label: 'Google Authenticator' });

    expect(setupRes.status).toBe(200);
    const { deviceId, secret } = setupRes.body.data;
    const code = generateTotpCode(secret);

    const confirmRes = await request(app)
      .post('/api/v1/auth/platform-admin/2fa/confirm')
      .send({ setupToken, deviceId, code });

    expect(confirmRes.status).toBe(200);
    return {
      secret,
      deviceId,
      accessToken: confirmRes.body.data.accessToken as string,
      refreshToken: confirmRes.body.data.refreshToken as string,
      recoveryCodes: confirmRes.body.data.recoveryCodes as string[],
    };
  }

  beforeEach(() => {
    dbState.admins = [];
    dbState.authenticators = [];
    dbState.recoveryCodes = [];
    dbState.challenges = [];
    dbState.sessions = [];
    dbState.auditLogs = [];
    dbState.users = [];
    dbState.customers = [];
    dbState.redisMap.clear();
    dbState.seq = 1;
    jest.clearAllMocks();
  });

  it('enforces mandatory 2FA setup on first login, rejects unverified/forged access, and succeeds with Google Authenticator', async () => {
    const admin = seedAdmin();

    // 1. Login Step 1 with username & password -> Setup Session only
    const loginRes = await request(app)
      .post('/api/v1/auth/platform-admin/login')
      .set('User-Agent', 'Mozilla/5.0')
      .send({ username: 'superadmin', password: adminPassword });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.status).toBe('TOTP_SETUP_REQUIRED');
    expect(loginRes.body.data.requiresTwoFactorSetup).toBe(true);
    expect(loginRes.body.data.accessToken).toBeUndefined();
    expect(loginRes.body.data.refreshToken).toBeUndefined();

    const setupToken = loginRes.body.data.setupToken;

    // 2. Setup token CANNOT access protected admin APIs
    const blockedSetupRes = await request(app)
      .get('/api/v1/platform-admin/operations/overview')
      .set('Authorization', `Bearer ${setupToken}`);
    expect(blockedSetupRes.status).toBe(401);

    // 3. Forged JWT with mfaVerified: false CANNOT access admin APIs
    const unverifiedJwt = jwt.sign(
      { sessionId: 's_fake', actorId: admin.id, actorType: 'PLATFORM_ADMIN', mfaVerified: false },
      env.JWT_ACCESS_SECRET
    );
    const blockedUnverifiedRes = await request(app)
      .get('/api/v1/platform-admin/operations/overview')
      .set('Authorization', `Bearer ${unverifiedJwt}`);
    expect(blockedUnverifiedRes.status).toBe(401);

    // 4. Start setup -> produces encrypted pending secret, QR SVG & DataURL, manual key; 2FA STILL inactive
    const setupRes = await request(app)
      .post('/api/v1/auth/platform-admin/2fa/setup')
      .send({ setupToken, label: 'Google Authenticator' });

    expect(setupRes.status).toBe(200);
    expect(setupRes.body.data.qrCodeDataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(setupRes.body.data.qrCodeSvg).toContain('<svg');
    expect(setupRes.body.data.manualEntryKey.replace(/\s+/g, '')).toBe(setupRes.body.data.secret);
    expect(setupRes.body.data.otpauthUrl).toContain('algorithm=SHA1');
    expect(setupRes.body.data.otpauthUrl).toContain('digits=6');
    expect(setupRes.body.data.otpauthUrl).toContain('period=30');

    // Unconfirmed secret MUST NOT mark 2FA as active or allow access
    expect(dbState.admins[0].totpEnabled).toBe(false);
    expect(dbState.admins[0].totpSetupCompleted).toBe(false);
    expect(dbState.admins[0].totpPendingSecretEncrypted).not.toContain(setupRes.body.data.secret);

    const forgedBeforeConfirmJwt = jwt.sign(
      { sessionId: 's_fake2', actorId: admin.id, actorType: 'PLATFORM_ADMIN', mfaVerified: true },
      env.JWT_ACCESS_SECRET
    );
    const blockedBeforeConfirm = await request(app)
      .get('/api/v1/platform-admin/operations/overview')
      .set('Authorization', `Bearer ${forgedBeforeConfirmJwt}`);
    expect(blockedBeforeConfirm.status).toBe(401);

    // 5. Confirm with wrong 6-digit code fails
    const badConfirm = await request(app)
      .post('/api/v1/auth/platform-admin/2fa/confirm')
      .send({ setupToken, deviceId: setupRes.body.data.deviceId, code: '000000' });
    expect(badConfirm.status).toBe(401);
    expect(dbState.admins[0].totpEnabled).toBe(false);

    // 6. Confirm with valid 6-digit code from Google Authenticator -> activates 2FA + returns 10 recovery codes + full tokens
    const validCode = generateTotpCode(setupRes.body.data.secret);
    const confirmRes = await request(app)
      .post('/api/v1/auth/platform-admin/2fa/confirm')
      .send({ setupToken, deviceId: setupRes.body.data.deviceId, code: validCode });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.accessToken).toBeDefined();
    expect(confirmRes.body.data.refreshToken).toBeDefined();
    expect(confirmRes.body.data.recoveryCodes).toHaveLength(10);
    const rawSetCookie = confirmRes.headers['set-cookie'] as string | string[] | undefined;
    const setCookieHeader = Array.isArray(rawSetCookie) ? rawSetCookie.join(';') : String(rawSetCookie || '');
    expect(setCookieHeader).toContain('HttpOnly');
    expect(setCookieHeader).toContain('SameSite=Strict');

    // Secret is AES-256-GCM encrypted in DB, recovery codes are hashed
    expect(dbState.admins[0].totpEnabled).toBe(true);
    expect(dbState.admins[0].totpSetupCompleted).toBe(true);
    expect(dbState.admins[0].totpSecretEncrypted.startsWith('v1:')).toBe(true);
    expect(decryptTotpSecret(dbState.admins[0].totpSecretEncrypted, admin.id)).toBe(
      setupRes.body.data.secret
    );
    expect(dbState.recoveryCodes).toHaveLength(10);
    expect(dbState.recoveryCodes[0].codeHash.startsWith('rc_hmac256:')).toBe(true);

    // 7. Full access to admin endpoints now succeeds
    const okRes = await request(app)
      .get('/api/v1/platform-admin/operations/overview')
      .set('Authorization', `Bearer ${confirmRes.body.data.accessToken}`);
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.totalCenters).toBe(4);
  });

  it('supports Microsoft Authenticator as second device, rejects wrong/expired/replayed codes, and supports device replacement', async () => {
    seedAdmin();
    const { secret: googleSecret, accessToken } = await enrollInitialAdmin();

    // Advance clock simulation: enroll Microsoft Authenticator as secondary device
    const msSetupRes = await request(app)
      .post('/api/v1/auth/platform-admin/2fa/setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: adminPassword,
        currentTotpCode: generateTotpCode(googleSecret, Date.now() + 60_000),
        mode: 'ADD',
        label: 'Microsoft Authenticator',
      });

    // Note: generateTotpCode(+60s) isn't within current +/-1 step (30s) window! Verify current code works:
    expect(msSetupRes.status).toBe(401);

    const msSetupOk = await request(app)
      .post('/api/v1/auth/platform-admin/2fa/setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: adminPassword,
        currentTotpCode: generateTotpCode(googleSecret, Date.now() + 30_000), // next step to avoid replay from initial confirm
        mode: 'ADD',
        label: 'Microsoft Authenticator',
      });
    expect(msSetupOk.status).toBe(200);
    const msSecret = msSetupOk.body.data.secret;

    const msConfirm = await request(app)
      .post('/api/v1/auth/platform-admin/2fa/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        deviceId: msSetupOk.body.data.deviceId,
        code: generateTotpCode(msSecret),
        mode: 'ADD',
      });
    expect(msConfirm.status).toBe(200);

    // Security status shows 2 active devices
    const statusRes = await request(app)
      .get('/api/v1/auth/platform-admin/2fa/status')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.devices).toHaveLength(2);

    // Subsequent login -> Step 1
    const step1 = await request(app)
      .post('/api/v1/auth/platform-admin/login')
      .send({ username: 'superadmin', password: adminPassword });
    expect(step1.status).toBe(200);
    expect(step1.body.data.status).toBe('TOTP_REQUIRED');
    const challengeToken = step1.body.data.challengeToken;

    // Expired TOTP code (90s old = 3 steps behind) rejected
    const expiredCode = generateTotpCode(msSecret, Date.now() - 90_000);
    const expiredRes = await request(app)
      .post('/api/v1/auth/platform-admin/verify-2fa')
      .send({ challengeToken, code: expiredCode });
    expect(expiredRes.status).toBe(401);

    // Wrong code rejected
    const wrongRes = await request(app)
      .post('/api/v1/auth/platform-admin/verify-2fa')
      .send({ challengeToken, code: '000000' });
    expect(wrongRes.status).toBe(401);

    // Verify using Microsoft Authenticator at +30s step succeeds
    const futureMsTs = Date.now() + 30_000;
    const msCode = generateTotpCode(msSecret, futureMsTs);
    // Align device lastUsedStep slightly below future step by verifying current step or mocking Date.now
    const realNow = Date.now;
    jest.spyOn(Date, 'now').mockReturnValue(futureMsTs);
    try {
      const okVerify = await request(app)
        .post('/api/v1/auth/platform-admin/verify-2fa')
        .send({ challengeToken, code: msCode });
      expect(okVerify.status).toBe(200);
      expect(okVerify.body.data.accessToken).toBeDefined();

      // Replay attack with exact same TOTP code on a new challenge MUST be rejected!
      const step1Again = await request(app)
        .post('/api/v1/auth/platform-admin/login')
        .send({ username: 'superadmin', password: adminPassword });
      const replayRes = await request(app)
        .post('/api/v1/auth/platform-admin/verify-2fa')
        .send({ challengeToken: step1Again.body.data.challengeToken, code: msCode });
      expect(replayRes.status).toBe(401);
      expect(replayRes.body.error.code).toBe('TOTP_REPLAY');

      // Replace Authenticator device flow
      const stepNext = futureMsTs + 30_000;
      jest.spyOn(Date, 'now').mockReturnValue(stepNext);
      const replaceStart = await request(app)
        .post('/api/v1/auth/platform-admin/2fa/setup')
        .set('Authorization', `Bearer ${okVerify.body.data.accessToken}`)
        .send({
          currentPassword: adminPassword,
          currentTotpCode: generateTotpCode(msSecret, stepNext),
          mode: 'REPLACE',
          label: 'Replaced Hardware Phone',
        });
      expect(replaceStart.status).toBe(200);
      const replacementSecret = replaceStart.body.data.secret;

      const replaceConfirm = await request(app)
        .post('/api/v1/auth/platform-admin/2fa/confirm')
        .set('Authorization', `Bearer ${okVerify.body.data.accessToken}`)
        .send({
          deviceId: replaceStart.body.data.deviceId,
          code: generateTotpCode(replacementSecret, stepNext),
          mode: 'REPLACE',
        });
      expect(replaceConfirm.status).toBe(200);
      expect(replaceConfirm.body.data.replaced).toBe(true);

      const postReplaceStatus = await request(app)
        .get('/api/v1/auth/platform-admin/2fa/status')
        .set('Authorization', `Bearer ${okVerify.body.data.accessToken}`);
      expect(postReplaceStatus.body.data.devices).toHaveLength(1);
      expect(postReplaceStatus.body.data.devices[0].label).toBe('Replaced Hardware Phone');
    } finally {
      jest.restoreAllMocks();
      Date.now = realNow;
    }
  });

  it('supports single-use Recovery Codes, regeneration invalidating old codes, refresh rotation, and 2FA disable', async () => {
    seedAdmin();
    const { secret, accessToken, refreshToken, recoveryCodes } = await enrollInitialAdmin();

    // 1. Login using a Recovery Code
    const loginStep1 = await request(app)
      .post('/api/v1/auth/platform-admin/login')
      .send({ username: 'superadmin', password: adminPassword });
    const recoveryLogin = await request(app)
      .post('/api/v1/auth/platform-admin/verify-2fa')
      .send({
        challengeToken: loginStep1.body.data.challengeToken,
        recoveryCode: recoveryCodes[0],
      });

    expect(recoveryLogin.status).toBe(200);
    expect(recoveryLogin.body.data.usedRecoveryCode).toBe(true);
    expect(recoveryLogin.body.data.remainingRecoveryCodes).toBe(9);

    // 2. Reusing the consumed recovery code MUST fail
    const loginStep1Again = await request(app)
      .post('/api/v1/auth/platform-admin/login')
      .send({ username: 'superadmin', password: adminPassword });
    const reuseRecoveryRes = await request(app)
      .post('/api/v1/auth/platform-admin/verify-2fa')
      .send({
        challengeToken: loginStep1Again.body.data.challengeToken,
        recoveryCode: recoveryCodes[0],
      });
    expect(reuseRecoveryRes.status).toBe(401);

    // 3. Refresh token rotation: old refresh token works once, rotated token works, replaying old fails
    const refreshRes = await request(app)
      .post('/api/v1/auth/platform-admin/refresh')
      .send({ refreshToken });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeDefined();
    expect(refreshRes.body.data.refreshToken).toBeDefined();
    expect(refreshRes.body.data.refreshToken).not.toBe(refreshToken);

    const replayRefreshRes = await request(app)
      .post('/api/v1/auth/platform-admin/refresh')
      .send({ refreshToken });
    expect(replayRefreshRes.status).toBe(401);

    // 4. Regenerate recovery codes (advance 30s step so TOTP code is fresh)
    const nextStepMs = (getTotpTimeStep() + 1) * 30_000 + 5_000;
    jest.spyOn(Date, 'now').mockReturnValue(nextStepMs);
    try {
      const regenRes = await request(app)
        .post('/api/v1/auth/platform-admin/2fa/recovery-codes/regenerate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: adminPassword,
          code: generateTotpCode(secret, nextStepMs),
        });
      expect(regenRes.status).toBe(200);
      expect(regenRes.body.data.recoveryCodes).toHaveLength(10);

      // Old unused recovery code[1] MUST now be invalidated
      const oldCodeLogin = await request(app)
        .post('/api/v1/auth/platform-admin/login')
        .send({ username: 'superadmin', password: adminPassword });
      const oldCodeVerify = await request(app)
        .post('/api/v1/auth/platform-admin/verify-2fa')
        .send({
          challengeToken: oldCodeLogin.body.data.challengeToken,
          recoveryCode: recoveryCodes[1],
        });
      expect(oldCodeVerify.status).toBe(401);

      // 5. Disable 2FA (advance another 30s step) -> revokes all sessions immediately
      const disableStepMs = nextStepMs + 30_000;
      jest.spyOn(Date, 'now').mockReturnValue(disableStepMs);
      const disableRes = await request(app)
        .post('/api/v1/auth/platform-admin/2fa/disable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: adminPassword,
          code: generateTotpCode(secret, disableStepMs),
        });
      expect(disableRes.status).toBe(200);
      expect(disableRes.body.data.disabled).toBe(true);
      expect(disableRes.body.data.sessionsRevoked).toBe(true);

      // Existing token is immediately rejected
      const postDisableAccess = await request(app)
        .get('/api/v1/platform-admin/operations/overview')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(postDisableAccess.status).toBe(401);

      // Next login forces mandatory 2FA setup again!
      const nextLogin = await request(app)
        .post('/api/v1/auth/platform-admin/login')
        .send({ username: 'superadmin', password: adminPassword });
      expect(nextLogin.status).toBe(200);
      expect(nextLogin.body.data.status).toBe('TOTP_SETUP_REQUIRED');
    } finally {
      jest.restoreAllMocks();
    }

    // Verify all required audit events were logged and NO secrets/passwords/recovery codes exist in AuditLog!
    const loggedActions = dbState.auditLogs.map((l) => l.action);
    expect(loggedActions).toContain(PLATFORM_ADMIN_AUDIT_ACTIONS.TOTP_SETUP_STARTED);
    expect(loggedActions).toContain(PLATFORM_ADMIN_AUDIT_ACTIONS.TOTP_SETUP_COMPLETED);
    expect(loggedActions).toContain(PLATFORM_ADMIN_AUDIT_ACTIONS.ADMIN_LOGIN_SUCCESS);
    expect(loggedActions).toContain(PLATFORM_ADMIN_AUDIT_ACTIONS.TOTP_VERIFICATION_FAILED);
    expect(loggedActions).toContain(PLATFORM_ADMIN_AUDIT_ACTIONS.RECOVERY_CODE_USED);
    expect(loggedActions).toContain(PLATFORM_ADMIN_AUDIT_ACTIONS.RECOVERY_CODES_REGENERATED);
    expect(loggedActions).toContain(PLATFORM_ADMIN_AUDIT_ACTIONS.TOTP_DISABLED);
    expect(loggedActions).toContain(PLATFORM_ADMIN_AUDIT_ACTIONS.ADMIN_SESSION_REVOKED);

    const serializedAudits = JSON.stringify(dbState.auditLogs);
    expect(serializedAudits).not.toContain(adminPassword);
    expect(serializedAudits).not.toContain(secret);
    for (const rc of recoveryCodes) {
      expect(serializedAudits).not.toContain(rc);
    }
  });

  it('blocks customers and tenant users from platform admin 2FA & admin endpoints and prevents account enumeration', async () => {
    seedAdmin();

    // Unknown user vs wrong password produce identical 401 message (no account enumeration)
    const unknownRes = await request(app)
      .post('/api/v1/auth/platform-admin/login')
      .send({ username: 'does_not_exist', password: adminPassword });
    const wrongPwRes = await request(app)
      .post('/api/v1/auth/platform-admin/login')
      .send({ username: 'superadmin', password: 'WrongPassword!' });

    expect(unknownRes.status).toBe(401);
    expect(wrongPwRes.status).toBe(401);
    expect(unknownRes.body.error.message).toBe(wrongPwRes.body.error.message);

    // Customer token blocked from 2FA management and platform-admin endpoints
    dbState.customers.push({ id: 'cust_1', phone: '09120000001' });
    const customerToken = jwt.sign(
      { sessionId: 'sess_cust_1', actorId: 'cust_1', actorType: 'CUSTOMER' },
      env.JWT_ACCESS_SECRET
    );

    const custStatusRes = await request(app)
      .get('/api/v1/auth/platform-admin/2fa/status')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(custStatusRes.status).toBe(403);

    const custAdminRes = await request(app)
      .get('/api/v1/platform-admin/operations/overview')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(custAdminRes.status).toBe(403);

    // Tenant MANAGER user blocked as well
    dbState.users.push({ id: 'usr_mgr_1', role: 'MANAGER', gamingCenterId: 'gc_1', isActive: true });
    const managerToken = jwt.sign(
      { sessionId: 'sess_mgr_1', actorId: 'usr_mgr_1', actorType: 'USER' },
      env.JWT_ACCESS_SECRET
    );
    const mgrStatusRes = await request(app)
      .get('/api/v1/auth/platform-admin/2fa/status')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(mgrStatusRes.status).toBe(403);
  });

  it('fails closed (503) when TOTP service key is missing in production — never bypasses 2FA', async () => {
    seedAdmin();
    const origNodeEnv = process.env.NODE_ENV;
    const origKey = process.env.PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY;
    try {
      process.env.NODE_ENV = 'production';
      process.env.PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY = '';

      const res = await request(app)
        .post('/api/v1/auth/platform-admin/login')
        .send({ username: 'superadmin', password: adminPassword });

      expect(res.status).toBe(503);
      expect(res.body.data?.accessToken).toBeUndefined();
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      process.env.PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY = origKey;
    }
  });
});
