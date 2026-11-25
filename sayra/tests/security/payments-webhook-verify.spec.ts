/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import crypto from 'crypto';
import request from 'supertest';
import httpStatus from 'http-status';
import { PaymentStatus, ReservationPaymentState, ReservationStatus, WalletChargeStatus } from '@prisma/client';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { env } from '../../src/config/env';
import { generateAccessToken } from '../../src/modules/auth/auth.tokens';
import { PaymentsRepo } from '../../src/modules/payments/payments.repo';
import { PaymentsStation } from '../../src/modules/payments/payments.station';
import { IdempotencyRepo } from '../../src/common/repositories/idempotency.repo';
import { WalletChargeRepo } from '../../src/modules/wallet/charge.repo';

jest.mock('../../src/config/redis', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockImplementation(() => Promise.resolve(null)),
    set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
    del: jest.fn().mockImplementation(() => Promise.resolve(1)),
  },
}));

jest.mock('../../src/jobs/producers/analytics.producer', () => ({
  queueAnalyticsSync: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    customerAccount: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    walletCharge: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    walletTransaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    customerNotification: {
      create: jest.fn(),
    },
    bookingHold: {
      findUnique: jest.fn(),
    },
    groupBooking: {
      findFirst: jest.fn(),
    },
    idempotencyKey: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

function signBody(body: Record<string, unknown>): string {
  return crypto
    .createHmac('sha256', env.PAYMENT_PROVIDER_WEBHOOK_SECRET)
    .update(Buffer.from(JSON.stringify(body)))
    .digest('hex');
}

describe('SEC-003: Webhook HMAC Signature, /payments/:id/verify & Callback Hardening', () => {
  const ownerId = 'cust_owner_1';
  const attackerId = 'cust_attacker_2';
  const paymentId = 'pay_sec3_1';
  let ownerToken: string;
  let attackerToken: string;

  beforeEach(() => {
    jest.clearAllMocks();
    ownerToken = generateAccessToken({ sessionId: 's_own', actorId: ownerId, actorType: 'CUSTOMER' });
    attackerToken = generateAccessToken({ sessionId: 's_att', actorId: attackerId, actorType: 'CUSTOMER' });

    (prisma.customerAccount.findUnique as jest.MockedFunction<any>).mockImplementation((args: any) => {
      if (args?.where?.id === ownerId) return Promise.resolve({ id: ownerId, phone: '+989121111111' });
      if (args?.where?.id === attackerId) return Promise.resolve({ id: attackerId, phone: '+989122222222' });
      return Promise.resolve(null);
    });
  });

  describe('POST /api/v1/payments/webhook & /webhooks/payments/:provider', () => {
    it('rejects unsigned or forged signatures on /api/v1/payments/webhook with 401', async () => {
      const resNoSig = await request(app)
        .post('/api/v1/payments/webhook')
        .send({ paymentId, status: 'PAID' });
      expect(resNoSig.status).toBe(httpStatus.UNAUTHORIZED);

      const resBadSig = await request(app)
        .post('/api/v1/payments/webhook')
        .set('X-Signature', '0'.repeat(64))
        .send({ paymentId, status: 'PAID' });
      expect(resBadSig.status).toBe(httpStatus.UNAUTHORIZED);
    });

    it('accepts valid HMAC signature on /webhooks/payments/zarinpal proving req.rawBody is captured globally', async () => {
      jest.spyOn(IdempotencyRepo, 'findKey').mockResolvedValueOnce(null);
      jest.spyOn(IdempotencyRepo, 'createKey').mockResolvedValueOnce({} as any);
      jest.spyOn(IdempotencyRepo, 'updateKey').mockResolvedValueOnce({} as any);

      const payload = {
        eventId: 'evt_raw_body_ok',
        paymentId,
        status: 'SUCCEEDED',
      };

      jest.spyOn(PaymentsRepo, 'transaction').mockImplementationOnce(async (fn: any) =>
        fn({
          payment: {
            findUnique: (jest.fn() as any).mockResolvedValue({
              id: paymentId,
              provider: 'ZARINPAL',
              amount: 100000,
              walletAmount: 0,
              status: PaymentStatus.INITIATED,
            }),
          },
        } as any)
      );
      jest.spyOn(PaymentsRepo, 'handleSuccessfulPayment').mockResolvedValueOnce({
        id: paymentId,
        status: PaymentStatus.PAID,
      } as any);
      (prisma.payment.findUnique as jest.MockedFunction<any>).mockResolvedValue({
        id: paymentId,
        status: PaymentStatus.PAID,
      });

      const res = await request(app)
        .post('/api/v1/webhooks/payments/zarinpal')
        .set('X-Signature', signBody(payload))
        .send(payload);

      expect(res.status).toBe(httpStatus.OK);
    });

    it('rejects provider mismatch and amount mismatch on signed webhooks', async () => {
      jest.spyOn(IdempotencyRepo, 'findKey').mockResolvedValue(null);
      jest.spyOn(IdempotencyRepo, 'createKey').mockResolvedValue({} as any);
      jest.spyOn(IdempotencyRepo, 'updateKey').mockResolvedValue({} as any);

      jest.spyOn(PaymentsRepo, 'transaction').mockImplementation(async (fn: any) =>
        fn({
          payment: {
            findUnique: (jest.fn() as any).mockResolvedValue({
              id: paymentId,
              provider: 'ZARINPAL',
              amount: 200000,
              walletAmount: 50000,
              status: PaymentStatus.INITIATED,
            }),
          },
        } as any)
      );

      const mismatchPayload = {
        eventId: 'evt_amt_mismatch',
        paymentId,
        provider: 'ZARINPAL',
        status: 'PAID',
        amount: 1,
      };

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('X-Signature', signBody(mismatchPayload))
        .send(mismatchPayload);

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /api/v1/payments/:paymentId/verify', () => {
    const ownedPayment = {
      id: paymentId,
      gamingCenterId: 'gc_1',
      provider: 'ZARINPAL',
      providerPaymentId: 'AUTH_REAL_1',
      status: PaymentStatus.PAID,
      amount: 100000,
      walletAmount: 0,
      bookingHoldId: 'hold_1',
      referenceCode: 'REF_1',
      bookingHold: { id: 'hold_1', customerAccountId: ownerId },
      reservation: null,
      groupBooking: null,
    };

    it('requires authentication and denies cross-customer verification', async () => {
      const unauthRes = await request(app)
        .post(`/api/v1/payments/${paymentId}/verify`)
        .send({});
      expect(unauthRes.status).toBe(httpStatus.UNAUTHORIZED);

      jest.spyOn(PaymentsRepo, 'transaction').mockImplementationOnce(async (fn: any) =>
        fn({ payment: { findUnique: (jest.fn() as any).mockResolvedValue(ownedPayment) } } as any)
      );

      const otherCustomerRes = await request(app)
        .post(`/api/v1/payments/${paymentId}/verify`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({});
      expect(otherCustomerRes.status).toBe(httpStatus.FORBIDDEN);
    });

    it('ignores client provider override and client NOK status while stripping groupBooking PII', async () => {
      const verifySpy = jest.spyOn(PaymentsStation, 'verifyPayment').mockResolvedValueOnce({
        success: true,
        paymentId,
        paymentStatus: PaymentStatus.PAID,
        totalAmount: 100000,
        walletAmount: 0,
        gatewayAmount: 100000,
        referenceCode: 'REF_OK',
        message: 'Payment verified successfully.',
      });

      const pendingOwnedPayment = {
        ...ownedPayment,
        status: PaymentStatus.INITIATED,
        bookingHoldId: 'hold_1',
      };
      jest.spyOn(PaymentsRepo, 'transaction').mockImplementationOnce(async (fn: any) =>
        fn({ payment: { findUnique: (jest.fn() as any).mockResolvedValue(pendingOwnedPayment) } } as any)
      );

      const { BookingHoldRepo } = await import('../../src/modules/booking-hold/booking-hold.repo');
      const { GroupBookingRepo } = await import('../../src/modules/group-booking/group-booking.repo');
      jest.spyOn(BookingHoldRepo, 'findHoldById').mockResolvedValueOnce({
        id: 'hold_1',
        convertedGroupBookingId: 'gb_1',
      } as any);
      jest.spyOn(GroupBookingRepo, 'findGroupBookingById').mockResolvedValueOnce({
        id: 'gb_1',
        gamingCenterId: 'gc_1',
        status: ReservationStatus.CONFIRMED,
        paymentState: ReservationPaymentState.PAID,
        totalAmount: 100000,
        finalAmount: 100000,
        currency: 'IRR',
        customerAccount: { id: ownerId, phone: '+989121111111', walletBalance: 999999 },
        reservations: [],
      } as any);

      const res = await request(app)
        .post(`/api/v1/payments/${paymentId}/verify`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ provider: 'FAKE', status: 'NOK', authority: 'AUTH_REAL_1' });

      expect(res.status).toBe(httpStatus.OK);
      expect(verifySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          providerName: 'ZARINPAL',
          status: undefined,
          authority: 'AUTH_REAL_1',
        })
      );
      expect(res.body.data.groupBooking?.customerAccount).toBeUndefined();
    });

    it('rejects mismatched authority passed to /payments/:paymentId/verify', async () => {
      jest.spyOn(PaymentsRepo, 'transaction').mockImplementationOnce(async (fn: any) =>
        fn({ payment: { findUnique: (jest.fn() as any).mockResolvedValue({ ...ownedPayment, status: PaymentStatus.INITIATED }) } } as any)
      );

      const res = await request(app)
        .post(`/api/v1/payments/${paymentId}/verify`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ authority: 'WRONG_AUTH' });

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
    });
  });

  describe('Callback orderId Fallback Removal & WalletCharge Guard', () => {
    it('does not allow NOK callback with missing or mismatched Authority/trackId to fail a payment via orderId', async () => {
      const failSpy = jest.spyOn(PaymentsRepo, 'handleFailedPayment');

      const missingAuthRes = await request(app)
        .get('/api/v1/payments/callback?orderId=res-victim-1&Status=NOK');
      expect(missingAuthRes.status).toBe(302);
      expect(missingAuthRes.header.location).toContain('/payment/failed');
      expect(failSpy).not.toHaveBeenCalled();

      (prisma.payment.findFirst as jest.MockedFunction<any>).mockResolvedValueOnce(null);
      const wrongZibalRes = await request(app)
        .get('/api/v1/payments/zibal/callback?trackId=WRONG_TRACK&orderId=res-victim-1&status=3&success=0');
      expect(wrongZibalRes.status).toBe(302);
      expect(failSpy).not.toHaveBeenCalled();
    });

    it('locks WalletCharge FOR UPDATE before PAID check and only marks PENDING charges as CANCELLED/FAILED', async () => {
      const executeRawMock = jest.fn() as jest.MockedFunction<any>;
      executeRawMock.mockResolvedValue(1);
      (prisma.$transaction as jest.MockedFunction<any>).mockImplementation((fn: any) =>
        fn({
          $executeRaw: executeRawMock,
          walletCharge: {
            findUnique: (jest.fn() as any).mockResolvedValue({
              id: 'wc_locked',
              customerAccountId: ownerId,
              status: WalletChargeStatus.PAID,
              amount: 50000,
            }),
          },
        })
      );

      const res = await WalletChargeRepo.executeAtomicCredit('wc_locked', 'REF1');
      expect(executeRawMock).toHaveBeenCalled();
      expect(res.status).toBe(WalletChargeStatus.PAID);

      (prisma.walletCharge.updateMany as jest.MockedFunction<any>).mockResolvedValue({ count: 0 });
      (prisma.walletCharge.findUnique as jest.MockedFunction<any>).mockResolvedValue({
        id: 'wc_locked',
        status: WalletChargeStatus.PAID,
      });

      const updated = await WalletChargeRepo.updateCharge('wc_locked', {
        status: WalletChargeStatus.CANCELLED,
        failureReason: 'Late NOK',
      });
      expect(prisma.walletCharge.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'wc_locked', status: WalletChargeStatus.PENDING },
        })
      );
      expect(updated?.status).toBe(WalletChargeStatus.PAID);
    });
  });
});
