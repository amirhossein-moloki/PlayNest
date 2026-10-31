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
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    gamingCenter: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
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
    gameStation: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    reservation: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    gamingSession: {
      count: jest.fn(),
    },
    ticket: {
      count: jest.fn(),
    },
    payment: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    refund: {
      count: jest.fn(),
    },
    customerAccount: {
      findUnique: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    ['$extends']: jest.fn().mockReturnThis(),
    ['$transaction']: jest.fn(),
  },
}));

describe('PLATFORM_ADMIN Authorization & Tenant Isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const platformAdminToken = generateAccessToken({
    sessionId: 'sess_admin',
    actorId: 'pa_1',
    actorType: 'PLATFORM_ADMIN',
  });

  const tenantManagerToken = generateAccessToken({
    sessionId: 'sess_manager',
    actorId: 'usr_mgr_1',
    actorType: 'USER',
  });

  const staffToken = generateAccessToken({
    sessionId: 'sess_staff',
    actorId: 'usr_staff_1',
    actorType: 'USER',
  });

  it('PLATFORM_ADMIN can access any valid Gaming Center tenant route', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super User',
      isActive: true,
      isSuperuser: true,
    });

    ((prisma as any).gamingCenter.findUnique as jest.Mock).mockResolvedValue({
      id: 'center_target_1',
      slug: 'center-1',
    });

    ((prisma as any).gameStation.findMany as jest.Mock).mockResolvedValue([]);
    ((prisma as any).gameStation.count as jest.Mock).mockResolvedValue(0);

    const res = await request(app)
      .get('/api/v1/gamingCenters/center_target_1/stations')
      .set('x-api-key', env.STATIC_API_KEY)
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
  });

  it('PLATFORM_ADMIN receives 404 when target Gaming Center does not exist', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super User',
      isActive: true,
      isSuperuser: true,
    });

    ((prisma as any).gamingCenter.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/gamingCenters/non_existent_center/stations')
      .set('x-api-key', env.STATIC_API_KEY)
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(404);
  });

  it('Tenant Manager CANNOT access another Gaming Center (strict isolation)', async () => {
    ((prisma as any).user.findUnique as jest.Mock).mockResolvedValue({
      id: 'usr_mgr_1',
      gamingCenterId: 'center_owner_1',
      role: 'MANAGER',
      isActive: true,
    });

    const res = await request(app)
      .get('/api/v1/gamingCenters/center_foreign_2/stations')
      .set('x-api-key', env.STATIC_API_KEY)
      .set('Authorization', `Bearer ${tenantManagerToken}`);

    expect(res.status).toBe(404);
  });

  it('Staff user CANNOT access platform admin endpoints (403 forbidden)', async () => {
    ((prisma as any).user.findUnique as jest.Mock).mockResolvedValue({
      id: 'usr_staff_1',
      gamingCenterId: 'center_1',
      role: 'STAFF',
      isActive: true,
    });

    const res = await request(app)
      .get('/api/v1/platform-admin/operations/overview')
      .set('x-api-key', env.STATIC_API_KEY)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it('PLATFORM_ADMIN can access global platform endpoints', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super User',
      isActive: true,
      isSuperuser: true,
    });

    ((prisma as any).gamingCenter.count as jest.Mock).mockResolvedValue(5);
    ((prisma as any).gameStation.count as jest.Mock).mockResolvedValue(30);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(100);
    ((prisma as any).gamingSession.count as jest.Mock).mockResolvedValue(8);
    ((prisma as any).ticket.count as jest.Mock).mockResolvedValue(2);

    const res = await request(app)
      .get('/api/v1/platform-admin/operations/overview')
      .set('x-api-key', env.STATIC_API_KEY)
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalCenters).toBe(5);
    expect(res.body.data.totalStations).toBe(30);
  });
});
