/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { paymentsCallbackRouter } from '../../../src/modules/payments/payments.callback.routes';
import { prisma } from '../../../src/config/prisma';
import { WalletChargeStation } from '../../../src/modules/wallet/charge.station';
import { WalletChargeStatus } from '@prisma/client';

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    payment: {
      findFirst: jest.fn(),
    },
    walletCharge: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../../src/modules/wallet/charge.station', () => ({
  WalletChargeStation: {
    verifyCharge: jest.fn(),
  },
}));

describe('Wallet Charge Zibal Callback Endpoints', () => {
  let app: Express;
  const MockedPrisma = prisma as any;
  const MockedChargeStation = WalletChargeStation as jest.Mocked<typeof WalletChargeStation>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use('/api/v1/payments', paymentsCallbackRouter);
  });

  describe('GET /api/v1/payments/zibal/wallet/callback (Dedicated Route)', () => {
    it('1. should redirect to payment failed URL if trackId and orderId are missing', async () => {
      const res = await request(app).get('/api/v1/payments/zibal/wallet/callback');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/payment/failed');
      expect(res.headers.location).toContain('type=wallet_charge');
    });

    it('2. should verify charge and redirect to success URL on successful payment', async () => {
      MockedChargeStation.verifyCharge.mockResolvedValue({
        success: true,
        charge: {
          id: 'wc-123',
          amount: 500000,
          currency: 'IRR',
          trackId: 'track-777',
          status: WalletChargeStatus.PAID,
          refNumber: 'ref-999888',
        } as any,
        refNumber: 'ref-999888',
      });

      const res = await request(app).get(
        '/api/v1/payments/zibal/wallet/callback?trackId=track-777&status=2&success=1'
      );

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/payment/success');
      expect(res.headers.location).toContain('type=wallet_charge');
      expect(res.headers.location).toContain('orderId=wc-123');
      expect(res.headers.location).toContain('refNumber=ref-999888');
      expect(res.headers.location).toContain('status=success');
    });

    it('3. should redirect to payment failed URL on unsuccessful payment', async () => {
      MockedChargeStation.verifyCharge.mockResolvedValue({
        success: false,
        charge: { id: 'wc-fail' } as any,
        failureReason: 'Gateway error',
      });

      const res = await request(app).get(
        '/api/v1/payments/zibal/wallet/callback?trackId=track-fail&status=3'
      );

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/payment/failed');
      expect(res.headers.location).toContain('type=wallet_charge');
      expect(res.headers.location).toContain('failureReason=Gateway+error');
    });
  });

  describe('Fallback Detection in GET /api/v1/payments/zibal/callback', () => {
    it('4. should identify wallet charge if payment record not in Payment table and delegate verification', async () => {
      // Payment table returns null
      MockedPrisma.payment.findFirst.mockResolvedValue(null);
      // WalletCharge table finds charge
      MockedPrisma.walletCharge.findFirst.mockResolvedValue({
        id: 'wc-found',
        trackId: 'track-wc',
      });

      MockedChargeStation.verifyCharge.mockResolvedValue({
        success: true,
        charge: {
          id: 'wc-found',
          amount: 1000000,
          currency: 'IRR',
          trackId: 'track-wc',
          status: WalletChargeStatus.PAID,
          refNumber: 'ref-auto-detected',
        } as any,
        refNumber: 'ref-auto-detected',
      });

      const res = await request(app).get(
        '/api/v1/payments/zibal/callback?trackId=track-wc&status=1'
      );

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/payment/success');
      expect(res.headers.location).toContain('type=wallet_charge');
      expect(res.headers.location).toContain('orderId=wc-found');
      expect(MockedChargeStation.verifyCharge).toHaveBeenCalledWith(
        expect.objectContaining({ trackId: 'track-wc' })
      );
    });
  });
});
