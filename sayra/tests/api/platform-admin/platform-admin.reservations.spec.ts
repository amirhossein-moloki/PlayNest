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
    reservation: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    ['$extends']: jest.fn().mockReturnThis(),
    ['$transaction']: jest.fn(),
  },
}));

describe('GET /platform-admin/reservations API', () => {
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

  const sampleReservation = {
    id: 'res_123',
    status: 'CONFIRMED',
    startTime: new Date('2026-11-04T10:00:00Z'),
    endTime: new Date('2026-11-04T12:00:00Z'),
    totalHours: 2,
    totalPrice: 500000,
    discountAmount: 50000,
    customerPayableAmount: 450000,
    paymentState: 'PAID',
    voucherCode: 'PROMO10',
    createdAt: new Date('2026-11-01T10:00:00Z'),
    updatedAt: new Date('2026-11-01T10:00:00Z'),
    gamingCenter: {
      id: 'gc_1',
      name: 'Cyber Arena',
      slug: 'cyber-arena',
      addresses: [
        {
          city: 'Tehran',
          isPrimary: true,
        },
      ],
    },
    customerAccount: {
      id: 'cust_acc_1',
      fullName: 'Ali Rezaei',
      phone: '09123456789',
    },
    customerProfile: {
      id: 'cust_prof_1',
      displayName: 'Ali Rezaei',
    },
    station: {
      id: 'st_1',
      name: 'Station 01',
      stationType: 'PC',
    },
    payments: [
      {
        id: 'pay_1',
        status: 'PAID',
        amount: 450000,
        method: 'ONLINE',
        providerPaymentId: 'trx_1001',
        paidAt: new Date('2026-11-01T10:05:00Z'),
      },
    ],
    discount: {
      id: 'disc_1',
      value: 10,
      valueType: 'PERCENTAGE',
    },
    campaign: {
      id: 'camp_1',
      code: 'PROMO10',
      name: 'Welcome Campaign',
    },
  };

  it('1. Retrieves list of all platform reservations for PLATFORM_ADMIN', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super User',
      isActive: true,
      isSuperuser: true,
    });

    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([sampleReservation]);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);

    const item = res.body.data[0];
    expect(item.id).toBe('res_123');
    expect(item.reservationCode).toBe('res_123');
    expect(item.status).toBe('CONFIRMED');
    expect(item.duration).toBe(2);
    expect(item.totalPrice).toBe(500000);
    expect(item.discountAmount).toBe(50000);
    expect(item.finalPrice).toBe(450000);
    expect(item.paymentState).toBe('PAID');
    expect(item.customer.fullName).toBe('Ali Rezaei');
    expect(item.gamingCenter.city).toBe('Tehran');
    expect(item.station.name).toBe('Station 01');
    expect(item.payment.status).toBe('PAID');
    expect(item.payment.transactionId).toBe('trx_1001');
    expect(item.discountCampaign.code).toBe('PROMO10');

    expect(res.body.meta.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalItems: 1,
      totalPages: 1,
    });
  });

  it('2. Supports pagination parameters (page, limit)', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super User',
      isActive: true,
      isSuperuser: true,
    });

    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([sampleReservation]);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(45);

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations?page=2&limit=15')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect((prisma as any).reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 15,
        take: 15,
      })
    );
    expect(res.body.meta.pagination).toEqual({
      page: 2,
      pageSize: 15,
      total: 45,
      totalItems: 45,
      totalPages: 3,
    });
  });

  it('3. Filters by city', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super User',
      isActive: true,
      isSuperuser: true,
    });

    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([sampleReservation]);
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
                city: { contains: 'Tehran', mode: 'insensitive' },
              },
            },
          },
        }),
      })
    );
  });

  it('4. Filters by gamingCenterId', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super User',
      isActive: true,
      isSuperuser: true,
    });

    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([sampleReservation]);
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

  it('5. Filters by customerId', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super User',
      isActive: true,
      isSuperuser: true,
    });

    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([sampleReservation]);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations?customerId=cust_acc_1')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect((prisma as any).reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { customerAccountId: 'cust_acc_1' },
            { customerProfileId: 'cust_acc_1' },
          ],
        }),
      })
    );
  });

  it('6. Filters by status (CONFIRMED, PAID, CANCELLED)', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super User',
      isActive: true,
      isSuperuser: true,
    });

    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([sampleReservation]);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(1);

    // 6a. CONFIRMED
    const resConfirmed = await request(app)
      .get('/api/v1/platform-admin/reservations?status=CONFIRMED')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(resConfirmed.status).toBe(200);
    expect((prisma as any).reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'CONFIRMED',
        }),
      })
    );

    // 6b. PAID
    const resPaid = await request(app)
      .get('/api/v1/platform-admin/reservations?status=PAID')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(resPaid.status).toBe(200);
    expect((prisma as any).reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paymentState: 'PAID',
        }),
      })
    );

    // 6c. CANCELLED -> mapped to CANCELED enum
    const resCancelled = await request(app)
      .get('/api/v1/platform-admin/reservations?status=CANCELLED')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(resCancelled.status).toBe(200);
    expect((prisma as any).reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'CANCELED',
        }),
      })
    );
  });

  it('7. Filters by date range (startDate, endDate)', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super User',
      isActive: true,
      isSuperuser: true,
    });

    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([sampleReservation]);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(1);

    const startDate = '2026-11-01T00:00:00.000Z';
    const endDate = '2026-11-05T23:59:59.000Z';

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

  it('8. Searches by customer name, phone, or reservation code/ID', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super User',
      isActive: true,
      isSuperuser: true,
    });

    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([sampleReservation]);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations?search=0912')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect((prisma as any).reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { id: { contains: '0912', mode: 'insensitive' } },
            {
              customerAccount: {
                OR: [
                  { fullName: { contains: '0912', mode: 'insensitive' } },
                  { phone: { contains: '0912' } },
                ],
              },
            },
            {
              customerProfile: {
                displayName: { contains: '0912', mode: 'insensitive' },
              },
            },
          ]),
        }),
      })
    );
  });

  it('9. Combines multiple filters simultaneously', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super User',
      isActive: true,
      isSuperuser: true,
    });

    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([sampleReservation]);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations?gamingCenterId=gc_1&city=Tehran&status=CONFIRMED&search=Ali')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect((prisma as any).reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          gamingCenterId: 'gc_1',
          status: 'CONFIRMED',
          gamingCenter: {
            addresses: {
              some: {
                city: { contains: 'Tehran', mode: 'insensitive' },
              },
            },
          },
          OR: expect.arrayContaining([
            { id: { contains: 'Ali', mode: 'insensitive' } },
          ]),
        }),
      })
    );
  });

  it('10. Prevents unauthorized users from accessing the endpoint (401 unauthenticated, 403 non-admin)', async () => {
    // 10a: No token -> 401
    const unauthRes = await request(app).get('/api/v1/platform-admin/reservations');
    expect(unauthRes.status).toBe(401);

    // 10b: Tenant Manager -> 403
    ((prisma as any).user.findUnique as jest.Mock).mockResolvedValue({
      id: 'usr_mgr_1',
      gamingCenterId: 'gc_1',
      role: 'MANAGER',
      isActive: true,
    });

    const tenantRes = await request(app)
      .get('/api/v1/platform-admin/reservations')
      .set('Authorization', `Bearer ${tenantManagerToken}`);

    expect(tenantRes.status).toBe(403);
  });

  it('11. Handles empty reservation results gracefully', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super User',
      isActive: true,
      isSuperuser: true,
    });

    ((prisma as any).reservation.findMany as jest.Mock).mockResolvedValue([]);
    ((prisma as any).reservation.count as jest.Mock).mockResolvedValue(0);

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations?city=UnknownCity')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.pagination.totalItems).toBe(0);
    expect(res.body.meta.pagination.totalPages).toBe(1);
  });

  it('12. Rejects invalid query parameters with 400', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_1',
      fullName: 'Super User',
      isActive: true,
      isSuperuser: true,
    });

    const res = await request(app)
      .get('/api/v1/platform-admin/reservations?page=invalid&limit=200')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(400);
  });
});
