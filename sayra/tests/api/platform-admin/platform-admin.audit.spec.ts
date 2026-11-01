/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { env } from '../../../src/config/env';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';

jest.mock('../../../src/config/redis', () => ({
  get: jest.fn().mockImplementation(() => Promise.resolve(null)),
  set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
  del: jest.fn().mockImplementation(() => Promise.resolve(1)),
}));

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    platformAdmin: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    gamingCenter: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    session: {
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    ['$extends']: jest.fn().mockReturnThis(),
    ['$transaction']: jest.fn(),
  },
}));

describe('PLATFORM_ADMIN Audit Logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const platformAdminToken = generateAccessToken({
    sessionId: 'sess_admin',
    actorId: 'pa_1',
    actorType: 'PLATFORM_ADMIN',
  });

  it('records audit log with platformAdminId when updating user status', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super User',
      isActive: true,
      isSuperuser: true,
    });

    ((prisma as any).user.findUnique as jest.Mock).mockResolvedValue({
      id: 'usr_target_1',
      gamingCenterId: 'center_1',
      fullName: 'Target User',
      isActive: true,
    });

    ((prisma as any).user.update as jest.Mock).mockResolvedValue({
      id: 'usr_target_1',
      gamingCenterId: 'center_1',
      fullName: 'Target User',
      isActive: false,
      passwordHash: 'secret',
    });

    ((prisma as any).auditLog.create as jest.Mock).mockResolvedValue({
      id: 'audit_log_1',
    });

    const res = await request(app)
      .patch('/api/v1/platform-admin/users/usr_target_1/status')
      .set('x-api-key', env.STATIC_API_KEY)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect((prisma as any).auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platformAdminId: 'pa_1',
          action: 'PLATFORM_ADMIN_USER_STATUS_UPDATE',
          entity: 'User',
          entityId: 'usr_target_1',
          gamingCenterId: 'center_1',
        }),
      })
    );
  });
});
