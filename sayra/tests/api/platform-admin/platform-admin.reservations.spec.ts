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
    },
    gamingCenter: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    reservation: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    ['$extends']: jest.fn().mockReturnThis(),
    ['$transaction']: jest.fn(),
  },
}));

describe('GET /platform-admin/reservations API', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super Admin',
      isActive: true,
      isSuperuser: true,
    });
  });

  const mockDbReservations = [
    {
      id: 'cuid_res_10001',
      status: 'CONFIRMED',
      startTime: new Date('2026-11-04T10:00:00Z'),
      endTime: new Date('2026-11-04T12:00:00Z'),
      totalHours: 2,
      totalPrice: 500000,
      discountAmount: 50000,
      customerPayableAmount: 450000,
      createdAt: new Date('2026-11-01T08:00:00Z'),
      updatedAt: new Date('2026-11-01T08:30:00Z'),
      gamingCenter: {
        id: 'gc_1',
        name: 'Nexus Gaming Arena',
        slug: 'nexus-arena',
        addresses: [{ city: 'Tehran', isPrimary: true }],
      },
      customerAccount: {
        id: 'cust_1',
        fullName: 'Ali Rezaei',
        phone: '09121234567',
      },
      station: {
        id: 'st_1',
        name: 'Station 01 VIP',
        stationType: 'PC',
      },
      payments: [
        {
          id: 'pay_1',
          status: 'PAID',
          amount: 450000,
          method: 'ONLINE',
          providerPaymentId: 'trx_987654',
          referenceCode: null,
          paidAt: new Date('2026-11-01T08:05:00Z'),
          createdAt: new Date('2026-11-01T08:00:00Z'),
        },
      ],
      discount: {
        id: 'disc_1',
        code: 'WELCOME10',
        percentage: 10,
        fixedAmount: null,
        discountType: 'PERCENTAGE',
      },
    },
    {
      id: 'cuid_res_10002',
      status: 'PENDING',
      startTime: new Date('2026-11-05T14:00:00Z'),
      endTime: new Date('2026-11-05T16:00:00Z'),
      totalHours: 2,
      totalPrice: 300000,
      discountAmount: 0,
      customerPayableAmount: 300000,
      createdAt: new Date('2026-11-02T10:00:00Z'),
      updatedAt: new Date('2026-11-02T10:00:00Z'),
      gamingCenter: {
        id: 'gc_2',
        name: 'Pixel Play Cafe',
        slug: 'pixel-play',
        addresses: [{ city: 'Shiraz', isPrimary: true }],
      },
      customerAccount: {
        id: 'cust_2',
        fullName: 'Sara Mohammadi',
        phone: '09359876543',
      },
      station: {
        id: 'st_2',
        name: 'Station PS5',
        stationType: 'PS5',
      },
      payments: [],
      discount: null,
    },
  ];

  it('1. should list all platform reservations across all gaming centers', async () => {
    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue(mockDbReservations);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(2);

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);

    const first = res.body.data[0];
    expect(first.id).toBe('cuid_res_10001');
    expect(first.reservationCode).toBe('RES-10001');
    expect(first.status).toBe('CONFIRMED');
    expect(first.duration).toBe(2);
    expect(first.totalPrice).toBe(500000);
    expect(first.discountAmount).toBe(50000);
    expect(first.finalPrice).toBe(450000);
    expect(first.customer.fullName).toBe('Ali Rezaei');
    expect(first.gamingCenter.city).toBe('Tehran');
    expect(first.station.name).toBe('Station 01 VIP');
    expect(first.payment.status).toBe('PAID');
    expect(first.payment.transactionId).toBe('trx_987654');
    expect(first.discount.code).toBe('WELCOME10');

    expect(res.body.meta.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 2,
      totalPages: 1,
    });
  });

  it('2. should support pagination parameters', async () => {
    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([mockDbReservations[1]]);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(25);

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations?page=2&limit=10')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect((prisma as any).reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      })
    );
    expect(res.body.meta.pagination).toEqual({
      page: 2,
      pageSize: 10,
      totalItems: 25,
      totalPages: 3,
    });
  });

  it('3. should filter by city', async () => {
    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([mockDbReservations[0]]);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations?city=Tehran')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect((prisma as any).reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          gamingCenter: {
            addresses: {
              some: {
                city: {
                  contains: 'Tehran',
                  mode: 'insensitive',
                },
              },
            },
          },
        }),
      })
    );
  });

  it('4. should filter by gamingCenterId', async () => {
    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([mockDbReservations[0]]);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations?gamingCenterId=gc_1')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect((prisma as any).reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          gamingCenterId: 'gc_1',
        }),
      })
    );
  });

  it('5. should filter by customerId', async () => {
    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([mockDbReservations[0]]);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations?customerId=cust_1')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect((prisma as any).reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customerAccountId: 'cust_1',
        }),
      })
    );
  });

  it('6. should filter by status', async () => {
    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([mockDbReservations[0]]);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations?status=CONFIRMED')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect((prisma as any).reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'CONFIRMED',
        }),
      })
    );
  });

  it('7. should filter by date range', async () => {
    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([mockDbReservations[0]]);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(1);

    const startDate = '2026-11-04T00:00:00.000Z';
    const endDate = '2026-11-04T23:59:59.000Z';

    const res = await request(app)
      .get(`/api/v1/platform-admin/reservations?startDate=${startDate}&endDate=${endDate}`)
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect((prisma as any).reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startTime: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
      })
    );
  });

  it('8. should search across reservation code/id, customer fullName, and phone', async () => {
    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([mockDbReservations[0]]);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations?search=09121234567')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect((prisma as any).reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { id: { contains: '09121234567', mode: 'insensitive' } },
            { customerAccount: { phone: { contains: '09121234567' } } },
            { customerAccount: { fullName: { contains: '09121234567', mode: 'insensitive' } } },
          ],
        }),
      })
    );
  });

  it('9. should combine multiple filters simultaneously', async () => {
    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([mockDbReservations[0]]);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations?city=Tehran&gamingCenterId=gc_1&status=CONFIRMED&search=Ali&sortBy=startTime&sortOrder=asc')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect((prisma as any).reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          gamingCenterId: 'gc_1',
          status: 'CONFIRMED',
          gamingCenter: expect.any(Object),
          OR: expect.any(Array),
        }),
        orderBy: { startTime: 'asc' },
      })
    );
  });

  it('10. should return 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/platform-admin/reservations');
    expect(res.status).toBe(401);
  });

  it('11. should return 403 for TENANT_ADMIN / MANAGER', async () => {
    ((prisma as any).user.findUnique as jest.Mock).mockResolvedValue({
      id: 'usr_mgr_1',
      gamingCenterId: 'gc_1',
      role: 'MANAGER',
      isActive: true,
    });

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations')
      .set('Authorization', `Bearer ${tenantManagerToken}`);

    expect(res.status).toBe(403);
  });

  it('12. should return 403 for STAFF', async () => {
    ((prisma as any).user.findUnique as jest.Mock).mockResolvedValue({
      id: 'usr_staff_1',
      gamingCenterId: 'gc_1',
      role: 'STAFF',
      isActive: true,
    });

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it('13. should handle empty results correctly', async () => {
    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([]);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(0);

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations?city=Tabriz')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.pagination.totalItems).toBe(0);
    expect(res.body.meta.pagination.totalPages).toBe(0);
  });

  it('14. should return 400 for invalid query parameters (e.g. invalid date or limit)', async () => {
    const res = await request(app)
      .get('/api/v1/platform-admin/reservations?limit=invalid_number')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(400);
  });
});
