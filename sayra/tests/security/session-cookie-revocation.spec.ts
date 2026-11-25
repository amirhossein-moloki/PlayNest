/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SessionActorType, UserRole } from '@prisma/client';
import {
  authMiddleware,
  verifySignedSessionCookie,
} from '../../src/common/middleware/auth';
import { errorHandler } from '../../src/common/errors/errorHandler';
import { generateAccessToken } from '../../src/modules/auth/auth.tokens';
import { ADMIN_CONSTANTS } from '../../src/platform-admin/config/admin.constants';
import { prisma } from '../../src/config/prisma';
import redis from '../../src/config/redis';
import { authService } from '../../src/modules/auth/auth.station';
import { AuthRepository } from '../../src/modules/auth/auth.repository';
import { PlatformAdminRepo } from '../../src/modules/platform-admin/platform-admin.repo';
import { deleteStaffMember } from '../../src/modules/users/users.station';
import { SessionService } from '../../src/modules/auth/session.service';

jest.mock('../../src/config/redis', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    customerAccount: {
      findUnique: jest.fn(),
    },
    platformAdmin: {
      findUnique: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    gamingCenter: {
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

function signExpressSessionCookie(sessionId: string, secret: string): string {
  const sig = crypto
    .createHmac('sha256', secret)
    .update(sessionId)
    .digest('base64')
    .replace(/=+$/, '');
  return `s:${sessionId}.${sig}`;
}

describe('SEC-017: AdminJS Cookie Signature, Session Revocation & Refresh Rotation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redis.get as jest.Mock).mockImplementation((() => Promise.resolve(null)) as any);
    (redis.set as jest.Mock).mockImplementation((() => Promise.resolve('OK')) as any);
    (redis.del as jest.Mock).mockImplementation((() => Promise.resolve(1)) as any);
  });

  it('verifySignedSessionCookie & authMiddleware reject forged/unsigned AdminJS cookies and accept validly signed ones', async () => {
    expect(verifySignedSessionCookie('s:sess1', ADMIN_CONSTANTS.SESSION_SECRET)).toBeNull();
    expect(verifySignedSessionCookie('s:sess1.forgedsig', ADMIN_CONSTANTS.SESSION_SECRET)).toBeNull();
    const validCookie = signExpressSessionCookie('admin-sid-1', ADMIN_CONSTANTS.SESSION_SECRET);
    expect(verifySignedSessionCookie(validCookie, ADMIN_CONSTANTS.SESSION_SECRET)).toBe('admin-sid-1');

    const app = express();
    app.use(cookieParser(ADMIN_CONSTANTS.COOKIE_SECRET));
    app.get('/protected', authMiddleware, (req: any, res) => {
      res.json({ ok: true, actor: req.actor });
    });
    app.use(errorHandler);

    // 1. Unsigned/forged AdminJS cookie is rejected with 401 even if Redis has admin-sid-1
    (redis.get as jest.Mock).mockImplementation(((key: string) => {
      if (key === `${ADMIN_CONSTANTS.SESSION_PREFIX}admin-sid-1`) {
        return Promise.resolve(
          JSON.stringify({
            adminUser: {
              id: 'pa-1',
              isSuperuser: true,
              mfaVerified: true,
              sessionId: 'sess-pa-1',
            },
          })
        );
      }
      return Promise.resolve(null);
    }) as any);
    (prisma.platformAdmin.findUnique as jest.Mock).mockImplementation((() =>
      Promise.resolve({
        id: 'pa-1',
        isActive: true,
        isSuperuser: true,
        totpEnabled: true,
        totpSetupCompleted: true,
      })) as any);

    const forgedRes = await request(app)
      .get('/protected')
      .set('Cookie', `${ADMIN_CONSTANTS.SESSION_COOKIE_NAME}=s:admin-sid-1.invalidsig`);
    expect(forgedRes.status).toBe(401);

    const unsignedRes = await request(app)
      .get('/protected')
      .set('Cookie', `${ADMIN_CONSTANTS.SESSION_COOKIE_NAME}=s:admin-sid-1`);
    expect(unsignedRes.status).toBe(401);

    // 2. Validly HMAC-signed cookie works cleanly
    const validRes = await request(app)
      .get('/protected')
      .set(
        'Cookie',
        `${ADMIN_CONSTANTS.SESSION_COOKIE_NAME}=${encodeURIComponent(validCookie)}`
      );
    expect(validRes.status).toBe(200);
    expect(validRes.body.actor.id).toBe('pa-1');
  });

  it('rejects PLATFORM_ADMIN Bearer token without sessionId and rejects revoked USER/CUSTOMER tokens via Redis cache', async () => {
    const app = express();
    app.get('/protected', authMiddleware, (req: any, res) => {
      res.json({ ok: true, actor: req.actor });
    });
    app.use(errorHandler);

    // 1. PLATFORM_ADMIN missing sessionId fails closed
    const adminNoSidToken = generateAccessToken({
      actorId: 'pa-1',
      actorType: SessionActorType.PLATFORM_ADMIN,
      mfaVerified: true,
    } as any);
    const adminNoSidRes = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${adminNoSidToken}`);
    expect(adminNoSidRes.status).toBe(401);

    // 2. Revoked USER & CUSTOMER sessions rejected via Redis cache
    (redis.get as jest.Mock).mockImplementation(((key: string) => {
      if (key === 'auth:revoked_session:revoked-user-sid' || key === 'auth:revoked_session:revoked-cust-sid') {
        return Promise.resolve('1');
      }
      return Promise.resolve(null);
    }) as any);

    const userToken = generateAccessToken({
      sessionId: 'revoked-user-sid',
      actorId: 'usr-1',
      actorType: SessionActorType.USER,
    });
    const userRes = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${userToken}`);
    expect(userRes.status).toBe(401);

    const custToken = generateAccessToken({
      sessionId: 'revoked-cust-sid',
      actorId: 'cust-1',
      actorType: SessionActorType.CUSTOMER,
    });
    const custRes = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${custToken}`);
    expect(custRes.status).toBe(401);
  });

  it('marks sessions revoked in Redis on logout, deleteStaffMember, and PlatformAdminRepo.revokeUserSessions', async () => {
    jest.spyOn(AuthRepository, 'findSessionById').mockResolvedValue({
      id: 'sess-logout-1',
      actorId: 'usr-1',
      actorType: SessionActorType.USER,
    } as any);
    jest.spyOn(AuthRepository, 'revokeSession').mockResolvedValue({} as any);

    await authService.logout('sess-logout-1');
    expect(redis.set as any).toHaveBeenCalledWith(
      'auth:revoked_session:sess-logout-1',
      '1',
      'EX',
      expect.any(Number)
    );

    jest.clearAllMocks();
    (prisma.user.findFirst as jest.Mock).mockImplementation((() =>
      Promise.resolve({ id: 'usr-staff', role: UserRole.STAFF, gamingCenterId: 'gc-1' })) as any);
    (prisma.user.updateMany as jest.Mock).mockImplementation((() => Promise.resolve({ count: 1 })) as any);
    (prisma.session.findMany as jest.Mock).mockImplementation((() =>
      Promise.resolve([{ id: 'sess-staff-1' }, { id: 'sess-staff-2' }])) as any);
    (prisma.session.updateMany as jest.Mock).mockImplementation((() => Promise.resolve({ count: 2 })) as any);

    await deleteStaffMember('gc-1', 'usr-staff', {
      id: 'usr-mgr',
      actorType: SessionActorType.USER,
    });
    expect(redis.set as any).toHaveBeenCalledWith(
      'auth:revoked_session:sess-staff-1',
      '1',
      'EX',
      expect.any(Number)
    );
    expect(redis.set as any).toHaveBeenCalledWith(
      'auth:revoked_session:sess-staff-2',
      '1',
      'EX',
      expect.any(Number)
    );

    jest.clearAllMocks();
    (prisma.session.findMany as jest.Mock).mockImplementation((() =>
      Promise.resolve([{ id: 'sess-admin-revoke-1' }])) as any);
    (prisma.session.updateMany as jest.Mock).mockImplementation((() => Promise.resolve({ count: 1 })) as any);

    await PlatformAdminRepo.revokeUserSessions('usr-staff');
    expect(redis.set as any).toHaveBeenCalledWith(
      'auth:revoked_session:sess-admin-revoke-1',
      '1',
      'EX',
      expect.any(Number)
    );
  });

  it('rotates refresh tokens on authService.refreshAuthToken and rejects inactive users', async () => {
    const validSession = {
      id: 'sess-rot-1',
      actorId: 'usr-active',
      actorType: SessionActorType.USER,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    };
    jest.spyOn(AuthRepository, 'findSessionByToken').mockResolvedValue(validSession as any);
    jest.spyOn(AuthRepository, 'findUserById').mockResolvedValue({
      id: 'usr-active',
      isActive: true,
      role: UserRole.STAFF,
    } as any);
    const rotateSpy = jest
      .spyOn(AuthRepository, 'rotateSessionToken')
      .mockResolvedValue({ ...validSession } as any);

    const rotated = await authService.refreshAuthToken('old-raw-refresh-token');
    expect(rotated.accessToken).toBeTruthy();
    expect(rotated.refreshToken).toBeTruthy();
    expect(rotated.refreshToken).not.toBe('old-raw-refresh-token');
    expect(rotateSpy).toHaveBeenCalledWith('sess-rot-1', expect.any(String));

    // Deactivated user is rejected & session revoked
    jest.spyOn(AuthRepository, 'findUserById').mockResolvedValue({
      id: 'usr-active',
      isActive: false,
      role: UserRole.STAFF,
    } as any);
    const revokeSpy = jest.spyOn(AuthRepository, 'revokeSession').mockResolvedValue({} as any);
    await expect(authService.refreshAuthToken('next-raw-refresh-token')).rejects.toThrow(
      /inactive/i
    );
    expect(revokeSpy).toHaveBeenCalledWith('sess-rot-1');

    // SessionService.rotateRefreshToken also blocks inactive users
    (prisma.session.findUnique as jest.Mock).mockImplementation((() =>
      Promise.resolve(validSession)) as any);
    (prisma.user.findUnique as jest.Mock).mockImplementation((() =>
      Promise.resolve({ role: UserRole.STAFF, isActive: false })) as any);
    (prisma.session.update as jest.Mock).mockImplementation((() => Promise.resolve({})) as any);
    await expect(SessionService.rotateRefreshToken('some-token')).rejects.toThrow(/inactive/i);
  });
});
