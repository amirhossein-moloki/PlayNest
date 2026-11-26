/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  GamingCenterWalletTransactionType,
  WithdrawalRequestStatus,
} from '@prisma/client';
import { env } from '../../../src/config/env';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';

jest.mock('../../../src/config/redis', () => ({
  get: jest.fn().mockImplementation(() => Promise.resolve(null)),
  set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
  del: jest.fn().mockImplementation(() => Promise.resolve(1)),
}));

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    gamingCenter: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    gamingCenterWalletTransaction: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    gamingCenterWithdrawalRequest: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    customerAccount: {
      findUnique: jest.fn(),
    },
    platformAdmin: {
      findUnique: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    ['$extends']: jest.fn().mockReturnThis(),
    ['$transaction']: jest.fn().mockImplementation((arg: any) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      if (typeof arg === 'function') {
        return arg(prisma);
      }
      return Promise.resolve(arg);
    }),
    ['$executeRaw']: jest.fn().mockResolvedValue(1 as never),
  },
}));

describe('Gaming Center Wallet & Withdrawal API', () => {
  const SECRET = env.JWT_ACCESS_SECRET;
  const MANAGER_GC1_TOKEN = jwt.sign({ sessionId: 's-mgr-1', actorId: 'mgr-1', actorType: 'USER' }, SECRET);
  const MANAGER_GC2_TOKEN = jwt.sign({ sessionId: 's-mgr-2', actorId: 'mgr-2', actorType: 'USER' }, SECRET);
  const STAFF_GC1_TOKEN = jwt.sign({ sessionId: 's-stf-1', actorId: 'stf-1', actorType: 'USER' }, SECRET);
  const CUSTOMER_TOKEN = jwt.sign({ sessionId: 's-cust-1', actorId: 'ca-1', actorType: 'CUSTOMER' }, SECRET);
  const PLATFORM_ADMIN_TOKEN = jwt.sign(
    { sessionId: 's-admin', actorId: 'pa-1', actorType: 'PLATFORM_ADMIN', mfaVerified: true },
    SECRET
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as any).mockImplementation((arg: any) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      if (typeof arg === 'function') {
        return arg(prisma);
      }
      return Promise.resolve(arg);
    });
    (prisma.$executeRaw as any).mockResolvedValue(1);

    (prisma.session.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.id === 's-mgr-1') {
        return Promise.resolve({ id: 's-mgr-1', actorId: 'mgr-1', actorType: 'USER', expiresAt: new Date(Date.now() + 100000) });
      }
      if (where.id === 's-mgr-2') {
        return Promise.resolve({ id: 's-mgr-2', actorId: 'mgr-2', actorType: 'USER', expiresAt: new Date(Date.now() + 100000) });
      }
      if (where.id === 's-cust-1') {
        return Promise.resolve({ id: 's-cust-1', actorId: 'ca-1', actorType: 'CUSTOMER', expiresAt: new Date(Date.now() + 100000) });
      }
      if (where.id === 's-admin') {
        return Promise.resolve({
          id: 's-admin',
          actorId: 'pa-1',
          actorType: 'PLATFORM_ADMIN',
          mfaVerifiedAt: new Date(),
          revokedAt: null,
          expiresAt: new Date(Date.now() + 100000),
        });
      }
      return Promise.resolve({ id: 's-stf-1', actorId: 'stf-1', actorType: 'USER', expiresAt: new Date(Date.now() + 100000) });
    });

    (prisma.user.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.id === 'mgr-1') {
        return Promise.resolve({ id: 'mgr-1', role: 'MANAGER', gamingCenterId: 'gc-1', isActive: true });
      }
      if (where.id === 'mgr-2') {
        return Promise.resolve({ id: 'mgr-2', role: 'MANAGER', gamingCenterId: 'gc-2', isActive: true });
      }
      return Promise.resolve({ id: 'stf-1', role: 'STAFF', gamingCenterId: 'gc-1', isActive: true });
    });

    (prisma.customerAccount.findUnique as any).mockResolvedValue({
      id: 'ca-1',
      phone: '+989120000001',
    });

    (prisma.platformAdmin.findUnique as any).mockResolvedValue({
      id: 'pa-1',
      isActive: true,
      isSuperuser: true,
      totpEnabled: true,
      totpSetupCompleted: true,
    });

    (prisma.gamingCenter.findUnique as any).mockResolvedValue({
      id: 'gc-1',
      slug: 'gc-1',
      name: 'Center 1',
      walletBalance: 90000,
      reservedBalance: 0,
      lastWithdrawalRequestAt: null,
    });
  });

  describe('Manager wallet overview & full-balance withdrawal (0% withdrawal fee)', () => {
    it('GET /wallet should return net withdrawable balance (90000) with withdrawalCommissionRate: 0', async () => {
      (prisma.gamingCenterWalletTransaction.aggregate as any)
        .mockResolvedValueOnce({ _sum: { grossAmount: 100000, commissionAmount: 10000, amount: 90000 } })
        .mockResolvedValueOnce({ _sum: { grossAmount: 0, commissionAmount: 0, amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });
      (prisma.gamingCenterWithdrawalRequest.aggregate as any).mockResolvedValueOnce({ _sum: { amount: 0 } });

      const res = await request(app)
        .get('/api/v1/gamingCenters/gc-1/wallet')
        .set('Authorization', `Bearer ${MANAGER_GC1_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        gamingCenterId: 'gc-1',
        walletBalance: 90000,
        reservedBalance: 0,
        availableBalance: 90000,
        commissionDeductedAt: 'RESERVATION_COMPLETION',
        withdrawalCommissionRate: 0,
        canWithdraw: true,
      });
    });

    it('POST /wallet/withdraw with 100% of displayed availableBalance (90000) should return 201 Created without 403', async () => {
      (prisma.gamingCenterWithdrawalRequest.findFirst as any).mockResolvedValue(null);
      (prisma.gamingCenterWithdrawalRequest.create as any).mockImplementation(async ({ data }: any) => ({
        id: 'gcwr-full',
        ...data,
        createdAt: new Date(),
      }));
      (prisma.gamingCenter.update as any).mockResolvedValue({ id: 'gc-1', reservedBalance: 90000 });
      (prisma.gamingCenterWalletTransaction.create as any).mockResolvedValue({ id: 'gctx-hold' });

      const res = await request(app)
        .post('/api/v1/gamingCenters/gc-1/wallet/withdraw')
        .set('Authorization', `Bearer ${MANAGER_GC1_TOKEN}`)
        .send({
          amount: 90000,
          bankDetails: { sheba: 'IR123456789012345678901234', bankName: 'Melli' },
          note: 'Withdraw 100% available balance',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(90000);
      expect(res.body.data.status).toBe(WithdrawalRequestStatus.PENDING);
    });

    it('POST /wallet/withdraw exceeding availableBalance (90001) should return 400', async () => {
      (prisma.gamingCenterWithdrawalRequest.findFirst as any).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/gamingCenters/gc-1/wallet/withdraw')
        .set('Authorization', `Bearer ${MANAGER_GC1_TOKEN}`)
        .send({ amount: 90001 });

      expect(res.status).toBe(400);
    });

    it('GET /wallet/withdrawals, /withdrawals/:id, /transactions, /transactions/:id should return 200', async () => {
      (prisma.gamingCenterWithdrawalRequest.findMany as any).mockResolvedValue([
        { id: 'gcwr-1', gamingCenterId: 'gc-1', amount: 90000, status: WithdrawalRequestStatus.PENDING },
      ]);
      (prisma.gamingCenterWithdrawalRequest.count as any).mockResolvedValue(1);
      (prisma.gamingCenterWithdrawalRequest.findFirst as any).mockResolvedValue({
        id: 'gcwr-1',
        gamingCenterId: 'gc-1',
        amount: 90000,
        status: WithdrawalRequestStatus.PENDING,
      });
      (prisma.gamingCenterWalletTransaction.findMany as any).mockResolvedValue([
        {
          id: 'gctx-1',
          gamingCenterId: 'gc-1',
          grossAmount: 100000,
          commissionAmount: 10000,
          amount: 90000,
          type: GamingCenterWalletTransactionType.RESERVATION_SETTLEMENT,
        },
      ]);
      (prisma.gamingCenterWalletTransaction.count as any).mockResolvedValue(1);
      (prisma.gamingCenterWalletTransaction.findFirst as any).mockResolvedValue({
        id: 'gctx-1',
        gamingCenterId: 'gc-1',
        grossAmount: 100000,
        commissionAmount: 10000,
        amount: 90000,
        type: GamingCenterWalletTransactionType.RESERVATION_SETTLEMENT,
      });

      const listW = await request(app)
        .get('/api/v1/gamingCenters/gc-1/wallet/withdrawals')
        .set('Authorization', `Bearer ${MANAGER_GC1_TOKEN}`);
      expect(listW.status).toBe(200);
      expect(listW.body.data).toHaveLength(1);

      const getW = await request(app)
        .get('/api/v1/gamingCenters/gc-1/wallet/withdrawals/gcwr-1')
        .set('Authorization', `Bearer ${MANAGER_GC1_TOKEN}`);
      expect(getW.status).toBe(200);

      const listTx = await request(app)
        .get('/api/v1/gamingCenters/gc-1/wallet/transactions')
        .set('Authorization', `Bearer ${MANAGER_GC1_TOKEN}`);
      expect(listTx.status).toBe(200);
      expect(listTx.body.data).toHaveLength(1);

      const getTx = await request(app)
        .get('/api/v1/gamingCenters/gc-1/wallet/transactions/gctx-1')
        .set('Authorization', `Bearer ${MANAGER_GC1_TOKEN}`);
      expect(getTx.status).toBe(200);
    });
  });

  describe('RBAC & Cross-Tenant Isolation', () => {
    it('should enforce strict RBAC and tenant boundaries across manager, staff, customer, and unauthenticated actors', async () => {
      // Unauthenticated -> 401
      const unauth = await request(app).get('/api/v1/gamingCenters/gc-1/wallet');
      expect(unauth.status).toBe(401);

      // Same-tenant STAFF -> 403
      const staff = await request(app)
        .get('/api/v1/gamingCenters/gc-1/wallet')
        .set('Authorization', `Bearer ${STAFF_GC1_TOKEN}`);
      expect(staff.status).toBe(403);

      const staffWithdraw = await request(app)
        .post('/api/v1/gamingCenters/gc-1/wallet/withdraw')
        .set('Authorization', `Bearer ${STAFF_GC1_TOKEN}`)
        .send({ amount: 50000 });
      expect(staffWithdraw.status).toBe(403);

      // Cross-tenant MANAGER (gc-2 -> gc-1) -> 404 (tenantGuard anti-enumeration)
      const crossTenant = await request(app)
        .get('/api/v1/gamingCenters/gc-1/wallet')
        .set('Authorization', `Bearer ${MANAGER_GC2_TOKEN}`);
      expect(crossTenant.status).toBe(404);

      // CUSTOMER accessing center wallet -> 404 (no gamingCenterId on actor)
      const customer = await request(app)
        .post('/api/v1/gamingCenters/gc-1/wallet/withdraw')
        .set('Authorization', `Bearer ${CUSTOMER_TOKEN}`)
        .send({ amount: 50000 });
      expect(customer.status).toBe(404);

      // MANAGER accessing platform-admin gaming-center-withdrawals -> 403
      const mgrAdmin = await request(app)
        .get('/api/v1/platform-admin/gaming-center-withdrawals')
        .set('Authorization', `Bearer ${MANAGER_GC1_TOKEN}`);
      expect(mgrAdmin.status).toBe(403);
    });
  });

  describe('Platform Admin gaming-center-withdrawals lifecycle', () => {
    it('should list, show overdue, approve, pay (0% fee), and reject gaming center withdrawals', async () => {
      (prisma.gamingCenterWithdrawalRequest.findMany as any).mockResolvedValue([
        { id: 'gcwr-1', gamingCenterId: 'gc-1', amount: 90000, status: WithdrawalRequestStatus.PENDING },
      ]);
      (prisma.gamingCenterWithdrawalRequest.count as any).mockResolvedValue(1);

      const listRes = await request(app)
        .get('/api/v1/platform-admin/gaming-center-withdrawals')
        .set('Authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);

      (prisma.gamingCenterWithdrawalRequest.findMany as any).mockResolvedValue([
        {
          id: 'gcwr-old',
          gamingCenterId: 'gc-1',
          amount: 50000,
          status: WithdrawalRequestStatus.APPROVED,
          approvedAt: new Date(Date.now() - 80 * 60 * 60 * 1000),
        },
      ]);
      const overdueRes = await request(app)
        .get('/api/v1/platform-admin/gaming-center-withdrawals/overdue')
        .set('Authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`);
      expect(overdueRes.status).toBe(200);
      expect(overdueRes.body.data).toHaveLength(1);

      // Approve
      (prisma.gamingCenterWithdrawalRequest.findUnique as any).mockResolvedValue({
        id: 'gcwr-1',
        gamingCenterId: 'gc-1',
        amount: 90000,
        currency: 'IRR',
        status: WithdrawalRequestStatus.PENDING,
      });
      (prisma.gamingCenterWithdrawalRequest.update as any).mockResolvedValue({
        id: 'gcwr-1',
        gamingCenterId: 'gc-1',
        status: WithdrawalRequestStatus.APPROVED,
      });
      const approveRes = await request(app)
        .post('/api/v1/platform-admin/gaming-center-withdrawals/gcwr-1/approve')
        .set('Authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`)
        .send({ note: 'Approved by platform admin' });
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe(WithdrawalRequestStatus.APPROVED);

      // Payment -> PAID
      (prisma.gamingCenterWithdrawalRequest.findUnique as any).mockResolvedValue({
        id: 'gcwr-1',
        gamingCenterId: 'gc-1',
        amount: 90000,
        currency: 'IRR',
        status: WithdrawalRequestStatus.APPROVED,
      });
      (prisma.gamingCenter.findUnique as any).mockResolvedValue({
        id: 'gc-1',
        walletBalance: 90000,
        reservedBalance: 90000,
      });
      (prisma.gamingCenter.update as any).mockResolvedValue({ id: 'gc-1', walletBalance: 0, reservedBalance: 0 });
      (prisma.gamingCenterWalletTransaction.create as any).mockResolvedValue({ id: 'gctx-paid' });
      (prisma.gamingCenterWithdrawalRequest.update as any).mockResolvedValue({
        id: 'gcwr-1',
        gamingCenterId: 'gc-1',
        status: WithdrawalRequestStatus.PAID,
        paymentReference: 'PAY-REF-90',
      });
      const payRes = await request(app)
        .patch('/api/v1/platform-admin/gaming-center-withdrawals/gcwr-1/payment')
        .set('Authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`)
        .send({ status: 'PAID', paymentReference: 'PAY-REF-90' });
      expect(payRes.status).toBe(200);
      expect(payRes.body.data.status).toBe(WithdrawalRequestStatus.PAID);

      // Reject
      (prisma.gamingCenterWithdrawalRequest.findUnique as any).mockResolvedValue({
        id: 'gcwr-2',
        gamingCenterId: 'gc-1',
        amount: 40000,
        currency: 'IRR',
        status: WithdrawalRequestStatus.PENDING,
      });
      (prisma.gamingCenter.findUnique as any).mockResolvedValue({
        id: 'gc-1',
        walletBalance: 40000,
        reservedBalance: 40000,
      });
      (prisma.gamingCenterWithdrawalRequest.update as any).mockResolvedValue({
        id: 'gcwr-2',
        gamingCenterId: 'gc-1',
        status: WithdrawalRequestStatus.REJECTED,
      });
      (prisma.gamingCenterWithdrawalRequest.findFirst as any).mockResolvedValue(null);
      (prisma.gamingCenter.update as any).mockResolvedValue({ id: 'gc-1', walletBalance: 40000, reservedBalance: 0 });
      (prisma.gamingCenterWalletTransaction.create as any).mockResolvedValue({ id: 'gctx-refund' });

      const rejectRes = await request(app)
        .post('/api/v1/platform-admin/gaming-center-withdrawals/gcwr-2/reject')
        .set('Authorization', `Bearer ${PLATFORM_ADMIN_TOKEN}`)
        .send({ reason: 'Incorrect bank account owner' });
      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.status).toBe(WithdrawalRequestStatus.REJECTED);
    });
  });
});
