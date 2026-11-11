/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { customerPanelRouter } from '../../../../src/modules/customer-panel/customer-panel.routes';
import platformAdminRouter from '../../../../src/modules/platform-admin/platform-admin.routes';
import { WithdrawalStation } from '../../../../src/modules/wallet/withdrawal.station';
import { SessionActorType } from '@prisma/client';
import { responseMiddleware } from '../../../../src/common/middleware/response';
import { errorHandler } from '../../../../src/common/errors/errorHandler';

jest.mock('../../../../src/modules/wallet/withdrawal.station');
jest.mock('../../../../src/modules/audit/audit.station', () => ({
  auditService: {
    log: jest.fn().mockImplementation(() => Promise.resolve({} as any)),
  },
}));

// Mock middlewares
let currentActor: any = null;

function resForbidden(_req: any, res: any) {
  res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
}

jest.mock('../../../../src/common/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    if (currentActor) {
      req.actor = currentActor;
      next();
    } else {
      resForbidden(req, _res);
    }
  },
}));

describe('Withdrawal Routes Access Control & API Integration', () => {
  let app: Express;
  const MockedWithdrawalStation = WithdrawalStation as jest.Mocked<typeof WithdrawalStation>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use(responseMiddleware);

    app.use('/api/v1/customer', customerPanelRouter);
    app.use('/api/v1/platform-admin', platformAdminRouter);

    app.use(errorHandler);
  });

  describe('Customer Wallet Routes (/api/v1/customer/wallet)', () => {
    it('should allow CUSTOMER actor to fetch wallet overview', async () => {
      currentActor = {
        id: 'cust-1',
        actorType: SessionActorType.CUSTOMER,
      };

      MockedWithdrawalStation.getWalletOverview.mockResolvedValue({
        walletBalance: 1000000,
        reservedBalance: 200000,
        availableBalance: 800000,
        currency: 'IRR',
        canWithdraw: true,
        lastWithdrawalRequestAt: null,
        nextAllowedWithdrawalAt: null,
      });

      const res = await request(app).get('/api/v1/customer/wallet');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.availableBalance).toBe(800000);
      expect(MockedWithdrawalStation.getWalletOverview).toHaveBeenCalledWith('cust-1');
    });

    it('should block non-CUSTOMER (e.g. USER / staff) from accessing customer wallet routes', async () => {
      currentActor = {
        id: 'user-1',
        actorType: SessionActorType.USER,
      };

      const res = await request(app).get('/api/v1/customer/wallet');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should submit withdrawal request for CUSTOMER with valid body', async () => {
      currentActor = {
        id: 'cust-1',
        actorType: SessionActorType.CUSTOMER,
      };

      MockedWithdrawalStation.requestWithdrawal.mockResolvedValue({
        id: 'with-1',
        amount: 250000,
        status: 'PENDING',
      } as any);

      const res = await request(app)
        .post('/api/v1/customer/wallet/withdraw')
        .send({
          amount: 250000,
          bankDetails: { sheba: 'IR123456789012345678901234' },
          note: 'تسویه موجودی',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(MockedWithdrawalStation.requestWithdrawal).toHaveBeenCalledWith({
        customerAccountId: 'cust-1',
        amount: 250000,
        bankDetails: { sheba: 'IR123456789012345678901234' },
        note: 'تسویه موجودی',
      });
    });
  });

  describe('Platform Admin Routes Access Control (/api/v1/platform-admin/withdrawals)', () => {
    it('should forbid CUSTOMER from accessing platform admin withdrawal endpoints', async () => {
      currentActor = {
        id: 'cust-1',
        actorType: SessionActorType.CUSTOMER,
      };

      const res = await request(app).get('/api/v1/platform-admin/withdrawals');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow PLATFORM_ADMIN to list all withdrawals', async () => {
      currentActor = {
        id: 'admin-1',
        actorType: SessionActorType.PLATFORM_ADMIN,
        isSuperuser: true,
      };

      MockedWithdrawalStation.listAllWithdrawals.mockResolvedValue({
        data: [{ id: 'with-1', amount: 500000 }] as any,
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      const res = await request(app).get('/api/v1/platform-admin/withdrawals');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should allow PLATFORM_ADMIN to approve a withdrawal', async () => {
      currentActor = {
        id: 'admin-1',
        actorType: SessionActorType.PLATFORM_ADMIN,
        isSuperuser: true,
      };

      MockedWithdrawalStation.getWithdrawalDetails.mockResolvedValue({
        id: 'with-1',
        status: 'PENDING',
      } as any);

      MockedWithdrawalStation.approveWithdrawal.mockResolvedValue({
        id: 'with-1',
        status: 'APPROVED',
      } as any);

      const res = await request(app)
        .post('/api/v1/platform-admin/withdrawals/with-1/approve')
        .send({ note: 'تأیید شد' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(MockedWithdrawalStation.approveWithdrawal).toHaveBeenCalledWith('with-1', 'admin-1', 'تأیید شد');
    });

    it('should allow PLATFORM_ADMIN to reject a withdrawal with mandatory reason', async () => {
      currentActor = {
        id: 'admin-1',
        actorType: SessionActorType.PLATFORM_ADMIN,
        isSuperuser: true,
      };

      MockedWithdrawalStation.getWithdrawalDetails.mockResolvedValue({
        id: 'with-1',
        status: 'PENDING',
      } as any);

      MockedWithdrawalStation.rejectWithdrawal.mockResolvedValue({
        id: 'with-1',
        status: 'REJECTED',
      } as any);

      const res = await request(app)
        .post('/api/v1/platform-admin/withdrawals/with-1/reject')
        .send({ reason: 'شماره شبا با نام دارنده مطابقت ندارد' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(MockedWithdrawalStation.rejectWithdrawal).toHaveBeenCalledWith(
        'with-1',
        'admin-1',
        'شماره شبا با نام دارنده مطابقت ندارد',
        undefined
      );
    });

    it('should fail rejection when reason is missing or too short', async () => {
      currentActor = {
        id: 'admin-1',
        actorType: SessionActorType.PLATFORM_ADMIN,
        isSuperuser: true,
      };

      const res = await request(app)
        .post('/api/v1/platform-admin/withdrawals/with-1/reject')
        .send({ reason: 'x' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
