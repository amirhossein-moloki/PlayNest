/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { customerPanelRouter } from '../../../../src/modules/customer-panel/customer-panel.routes';
import { WalletChargeStation } from '../../../../src/modules/wallet/charge.station';
import { SessionActorType, WalletChargeStatus } from '@prisma/client';
import { responseMiddleware } from '../../../../src/common/middleware/response';
import { errorHandler } from '../../../../src/common/errors/errorHandler';

jest.mock('../../../../src/modules/wallet/charge.station');

let currentActor: any = null;

jest.mock('../../../../src/common/middleware/auth', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    if (currentActor) {
      req.actor = currentActor;
      next();
    } else {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }
  },
}));

describe('Wallet Charge API Endpoints', () => {
  let app: Express;
  const MockedStation = WalletChargeStation as jest.Mocked<typeof WalletChargeStation>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use(responseMiddleware);
    app.use('/api/v1/customer', customerPanelRouter);
    app.use(errorHandler);

    currentActor = {
      id: 'cust-123',
      actorType: SessionActorType.CUSTOMER,
      phone: '09123456789',
    };
  });

  describe('POST /api/v1/customer/wallet/charge', () => {
    it('1. should reject unauthenticated requests', async () => {
      currentActor = null;
      const res = await request(app)
        .post('/api/v1/customer/wallet/charge')
        .send({ amount: 50000 });

      expect(res.status).toBe(401);
    });

    it('2. should reject invalid amounts (e.g. negative or non-integer)', async () => {
      const res1 = await request(app)
        .post('/api/v1/customer/wallet/charge')
        .send({ amount: -100 });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/v1/customer/wallet/charge')
        .send({ amount: 0 });
      expect(res2.status).toBe(400);

      const res3 = await request(app)
        .post('/api/v1/customer/wallet/charge')
        .send({ amount: 100.5 });
      expect(res3.status).toBe(400);
    });

    it('3. should accept valid amount, pass Idempotency-Key header, and return 201 with payment URL', async () => {
      MockedStation.initiateCharge.mockResolvedValue({
        chargeId: 'charge-999',
        trackId: 'track-888',
        paymentUrl: 'https://gateway.zibal.ir/start/track-888',
        amount: 500000,
        currency: 'IRR',
        status: WalletChargeStatus.PENDING,
      });

      const res = await request(app)
        .post('/api/v1/customer/wallet/charge')
        .set('Idempotency-Key', 'unique-client-key-12345678')
        .send({ amount: 50000, currency: 'IRT' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.chargeId).toBe('charge-999');
      expect(res.body.data.paymentUrl).toBe('https://gateway.zibal.ir/start/track-888');
      expect(MockedStation.initiateCharge).toHaveBeenCalledWith({
        customerAccountId: 'cust-123',
        amount: 50000,
        currency: 'IRT',
        idempotencyKey: 'unique-client-key-12345678',
      });
    });
  });

  describe('GET /api/v1/customer/wallet/charge/:chargeId', () => {
    it('4. should return 401 if unauthenticated', async () => {
      currentActor = null;
      const res = await request(app).get('/api/v1/customer/wallet/charge/charge-999');
      expect(res.status).toBe(401);
    });

    it('5. should return charge status for the owner', async () => {
      MockedStation.getChargeStatus.mockResolvedValue({
        id: 'charge-999',
        customerAccountId: 'cust-123',
        amount: 500000,
        currency: 'IRR',
        provider: 'ZIBAL',
        status: WalletChargeStatus.PAID,
        trackId: 'track-888',
        refNumber: 'ref-111222',
        failureReason: null,
        paidAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const res = await request(app).get('/api/v1/customer/wallet/charge/charge-999');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('charge-999');
      expect(res.body.data.status).toBe(WalletChargeStatus.PAID);
      expect(MockedStation.getChargeStatus).toHaveBeenCalledWith('charge-999', 'cust-123');
    });
  });
});
