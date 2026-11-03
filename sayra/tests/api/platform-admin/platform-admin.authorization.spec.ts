/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
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
      findFirst: jest.fn(),
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
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it('Tenant Manager CANNOT access platform admin endpoints (403 forbidden)', async () => {
    ((prisma as any).user.findUnique as jest.Mock).mockResolvedValue({
      id: 'usr_mgr_1',
      gamingCenterId: 'center_owner_1',
      role: 'MANAGER',
      isActive: true,
    });

    const res = await request(app)
      .get('/api/v1/platform-admin/operations/overview')
      .set('Authorization', `Bearer ${tenantManagerToken}`);

    expect(res.status).toBe(403);
  });

  it('Unauthenticated request CANNOT access platform admin endpoints (401 unauthorized)', async () => {
    const res = await request(app)
      .get('/api/v1/platform-admin/operations/overview');

    expect(res.status).toBe(401);
  });

  it('Deactivated PlatformAdmin CANNOT access platform admin endpoints (401 unauthorized)', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Deactivated Super User',
      isActive: false,
      isSuperuser: true,
    });

    const res = await request(app)
      .get('/api/v1/platform-admin/operations/overview')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(401);
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
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalCenters).toBe(5);
    expect(res.body.data.totalStations).toBe(30);
  });

  it('PLATFORM_ADMIN can view and patch gamingCenter details directly via /api/v1/gamingCenters/:id', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super User',
      isActive: true,
      isSuperuser: true,
    });

    const targetGc = {
      id: 'gc_target_1',
      name: 'Old Center Name',
      slug: 'center-1',
      isActive: true,
    };
    ((prisma as any).gamingCenter.findUnique as jest.Mock).mockResolvedValue(targetGc);
    ((prisma as any).gamingCenter.findFirst as jest.Mock).mockResolvedValue(targetGc);

    ((prisma as any).gamingCenter.update as jest.Mock).mockResolvedValue({
      id: 'gc_target_1',
      name: 'New Center Name',
      slug: 'center-1',
      isActive: true,
    });

    // 1. GET /api/v1/gamingCenters/:id
    const getRes = await request(app)
      .get('/api/v1/gamingCenters/gc_target_1')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.name).toBe('Old Center Name');

    // 2. PATCH /api/v1/gamingCenters/:id
    const patchRes = await request(app)
      .patch('/api/v1/gamingCenters/gc_target_1')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ name: 'New Center Name' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.name).toBe('New Center Name');
  });

  it('PLATFORM_ADMIN can view and edit gamingCenter details via /api/v1/platform-admin/gaming-centers/:id', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super User',
      isActive: true,
      isSuperuser: true,
    });

    ((prisma as any).gamingCenter.findUnique as jest.Mock).mockResolvedValue({
      id: 'gc_target_2',
      name: 'PlayStation Arena',
      slug: 'ps-arena',
      isActive: true,
      subscriptionStatus: 'ACTIVE',
      addresses: [],
      settings: null,
      _count: { users: 2, stations: 10, reservations: 50 },
    });

    ((prisma as any).gamingCenter.update as jest.Mock).mockResolvedValue({
      id: 'gc_target_2',
      name: 'PlayStation Arena VIP',
      slug: 'ps-arena',
      isActive: true,
      subscriptionStatus: 'ACTIVE',
    });

    // 1. GET /api/v1/platform-admin/gaming-centers/:id
    const getRes = await request(app)
      .get('/api/v1/platform-admin/gaming-centers/gc_target_2')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.name).toBe('PlayStation Arena');
    expect(getRes.body.data._count.stations).toBe(10);

    // 2. PATCH /api/v1/platform-admin/gaming-centers/:id
    const patchRes = await request(app)
      .patch('/api/v1/platform-admin/gaming-centers/gc_target_2')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ name: 'PlayStation Arena VIP' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.name).toBe('PlayStation Arena VIP');
  });
});
