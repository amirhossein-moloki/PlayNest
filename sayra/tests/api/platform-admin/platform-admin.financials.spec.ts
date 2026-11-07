/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';
import { AdminStationBridge } from '../../../src/platform-admin/services/admin-station-bridge';

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
    platformSetting: {
      findUnique: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    refund: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $extends: jest.fn().mockReturnThis(),
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../src/platform-admin/services/admin-station-bridge', () => ({
  AdminStationBridge: {
    retryRefund: jest.fn(),
    reconcilePayment: jest.fn(),
  },
}));

describe('Platform Super Admin Phase 3 Financials API Tests', () => {
  const platformAdminToken = generateAccessToken({
    sessionId: 'sess_admin_fin',
    actorId: 'pa_super_fin',
    actorType: 'PLATFORM_ADMIN',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_super_fin',
      fullName: 'Super Administrator',
      isActive: true,
      isSuperuser: true,
    });
    ((prisma as any).platformSetting.findUnique as jest.Mock).mockResolvedValue({
      id: 'default',
      maintenanceMode: false,
    });
  });

  it('GET /platform-admin/financials/payments should list platform payments with relations', async () => {
    const mockPayment = {
      id: 'pay_100',
      amount: 1500000,
      currency: 'IRR',
      status: 'PAID',
      method: 'GATEWAY',
      provider: 'ZARINPAL',
      createdAt: new Date(),
      gamingCenter: { id: 'gc_1', name: 'Alpha Arena', slug: 'alpha-arena' },
      reservation: { id: 'res_1', status: 'CONFIRMED' },
      refunds: [],
    };
    ((prisma as any).payment.findMany as jest.Mock).mockResolvedValue([mockPayment]);
    ((prisma as any).payment.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/platform-admin/financials/payments')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe('pay_100');
    expect(res.body.data[0].amount).toBe(1500000);
  });

  it('GET /platform-admin/financials/refunds should list platform refunds', async () => {
    const mockRefund = {
      id: 'ref_100',
      paymentId: 'pay_100',
      amount: 500000,
      status: 'FAILED',
      payment: { id: 'pay_100', amount: 1500000, status: 'PAID' },
      gamingCenter: { id: 'gc_1', name: 'Alpha Arena' },
      createdAt: new Date(),
    };
    ((prisma as any).refund.findMany as jest.Mock).mockResolvedValue([mockRefund]);
    ((prisma as any).refund.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/platform-admin/financials/refunds')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe('ref_100');
    expect(res.body.data[0].amount).toBe(500000);
  });

  it('POST /platform-admin/financials/refunds/:id/retry should invoke AdminStationBridge.retryRefund', async () => {
    (AdminStationBridge.retryRefund as jest.Mock).mockResolvedValue({
      id: 'ref_retried_200',
      status: 'PENDING',
      amount: 500000,
    });

    const res = await request(app)
      .post('/api/v1/platform-admin/financials/refunds/ref_100/retry')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect(AdminStationBridge.retryRefund).toHaveBeenCalledWith(
      'ref_100',
      expect.objectContaining({ platformAdminId: 'pa_super_fin' })
    );
  });

  it('POST /platform-admin/financials/payments/:id/reconcile should reconcile against payment gateway', async () => {
    ((prisma as any).payment.findUnique as jest.Mock).mockResolvedValue({
      id: 'pay_100',
      gamingCenterId: 'gc_1',
    });
    (AdminStationBridge.reconcilePayment as jest.Mock).mockResolvedValue({
      paymentId: 'pay_100',
      status: 'MATCHED',
      discrepancies: [],
    });

    const res = await request(app)
      .post('/api/v1/platform-admin/financials/payments/pay_100/reconcile')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect(AdminStationBridge.reconcilePayment).toHaveBeenCalledWith(
      'gc_1',
      'pay_100',
      expect.objectContaining({ platformAdminId: 'pa_super_fin' })
    );
    expect(res.body.data.status).toBe('MATCHED');
  });

  it('GET /platform-admin/financials/export should return financial CSV export', async () => {
    ((prisma as any).payment.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'pay_csv_1',
        amount: 2500000,
        currency: 'IRR',
        status: 'PAID',
        method: 'GATEWAY',
        provider: 'ZARINPAL',
        createdAt: new Date('2026-05-01T12:00:00Z'),
        gamingCenter: { name: 'Alpha Arena' },
      },
    ]);

    const res = await request(app)
      .get('/api/v1/platform-admin/financials/export')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('ID,GamingCenter,Amount,Currency,Status,Method,Provider,CreatedAt');
    expect(res.text).toContain('pay_csv_1');
    expect(res.text).toContain('Alpha Arena');
  });
});
