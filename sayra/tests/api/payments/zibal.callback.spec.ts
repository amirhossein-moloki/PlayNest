/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { PaymentsRepo } from '../../../src/modules/payments/payments.repo';
import { PaymentProviderFactory } from '../../../src/modules/payments/providers';
import { PaymentStatus, ReservationPaymentState, ReservationStatus } from '@prisma/client';

jest.mock('../../../src/config/redis', () => ({
  get: jest.fn().mockImplementation(() => Promise.resolve(null)),
  set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
  del: jest.fn().mockImplementation(() => Promise.resolve(1)),
}));

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    payment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    reservation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback: any) => callback(prisma)),
  },
}));

describe('Zibal Callback Route (GET /api/v1/payments/zibal/callback)', () => {
  const trackId = '12345678';
  const orderId = 'res-100';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. should return 400 when trackId query parameter is missing', async () => {
    const res = await request(app).get('/api/v1/payments/zibal/callback');

    expect(res.status).toBe(400);
    expect(res.text).toContain('خطا در پرداخت');
    expect(res.text).toContain('شناسه پیگیری (trackId) در درخواست بازگشت درگاه یافت نشد');
  });

  it('2. should return 404 when payment record does not exist in database', async () => {
    (prisma.payment.findFirst as any).mockResolvedValueOnce(null);

    const res = await request(app).get(`/api/v1/payments/zibal/callback?trackId=${trackId}&orderId=${orderId}`);

    expect(res.status).toBe(404);
    expect(res.text).toContain('خطا در پرداخت');
    expect(res.text).toContain('تراکنش پرداخت متناظر در سیستم یافت نشد');
  });

  it('3. should handle idempotency: return 200 with success page when payment is already PAID', async () => {
    (prisma.payment.findFirst as any).mockResolvedValueOnce({
      id: 'pay-1',
      reservationId: orderId,
      amount: 200000,
      currency: 'IRR',
      providerPaymentId: trackId,
      status: PaymentStatus.PAID,
      referenceCode: 'REF-ALREADY-PAID',
    });

    const res = await request(app).get(`/api/v1/payments/zibal/callback?trackId=${trackId}&status=1`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('پرداخت با موفقیت انجام شد');
    expect(res.text).toContain('این پرداخت قبلاً با موفقیت تأیید و ثبت شده است');
    expect(res.text).toContain('REF-ALREADY-PAID');
  });

  it('4. should handle explicit failure returned by gateway (status != 1 and status != 2)', async () => {
    (prisma.payment.findFirst as any).mockResolvedValueOnce({
      id: 'pay-1',
      reservationId: orderId,
      amount: 200000,
      currency: 'IRR',
      providerPaymentId: trackId,
      status: PaymentStatus.INITIATED,
    });

    const handleFailedSpy = jest.spyOn(PaymentsRepo, 'handleFailedPayment').mockResolvedValueOnce({
      id: 'pay-1',
      status: PaymentStatus.FAILED,
    } as any);

    const res = await request(app).get(`/api/v1/payments/zibal/callback?trackId=${trackId}&status=3&success=0`);

    expect(res.status).toBe(400);
    expect(res.text).toContain('پرداخت ناموفق بود');
    expect(handleFailedSpy).toHaveBeenCalled();
  });

  it('5. should authoritatively verify and succeed when gateway reports status=1 or 2', async () => {
    (prisma.payment.findFirst as any).mockResolvedValueOnce({
      id: 'pay-1',
      reservationId: orderId,
      amount: 200000,
      currency: 'IRR',
      providerPaymentId: trackId,
      status: PaymentStatus.INITIATED,
      reservation: {
        id: orderId,
        status: ReservationStatus.PENDING,
        paymentState: ReservationPaymentState.PENDING,
      },
    });

    const mockProvider = {
      name: 'ZIBAL',
      verifyPayment: (jest.fn() as any).mockResolvedValueOnce({
        success: true,
        status: PaymentStatus.PAID,
        refId: 'ZIBAL-REF-12345',
      }),
    };
    jest.spyOn(PaymentProviderFactory, 'getProvider').mockReturnValue(mockProvider as any);

    jest.spyOn(PaymentsRepo, 'handleSuccessfulPayment').mockResolvedValueOnce({
      id: 'pay-1',
      reservationId: orderId,
      amount: 200000,
      currency: 'IRR',
      providerPaymentId: trackId,
      referenceCode: 'ZIBAL-REF-12345',
      status: PaymentStatus.PAID,
    } as any);

    const res = await request(app).get(`/api/v1/payments/zibal/callback?trackId=${trackId}&status=1&success=1`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('پرداخت با موفقیت انجام شد');
    expect(res.text).toContain('ZIBAL-REF-12345');
    expect(mockProvider.verifyPayment).toHaveBeenCalledWith({
      authority: trackId,
      amount: 200000,
      metadata: {
        orderId,
        reservationId: orderId,
      },
    });
  });

  it('6. should render failure page when verification fails (e.g. amount mismatch)', async () => {
    (prisma.payment.findFirst as any).mockResolvedValueOnce({
      id: 'pay-1',
      reservationId: orderId,
      amount: 200000,
      currency: 'IRR',
      providerPaymentId: trackId,
      status: PaymentStatus.INITIATED,
    });

    const mockProvider = {
      name: 'ZIBAL',
      verifyPayment: (jest.fn() as any).mockResolvedValueOnce({
        success: false,
        status: PaymentStatus.FAILED,
        failureReason: 'Payment integrity check failed: amount or orderId mismatch.',
      }),
    };
    jest.spyOn(PaymentProviderFactory, 'getProvider').mockReturnValue(mockProvider as any);

    jest.spyOn(PaymentsRepo, 'handleFailedPayment').mockResolvedValueOnce({
      id: 'pay-1',
      reservationId: orderId,
      status: PaymentStatus.FAILED,
      failureReason: 'Payment integrity check failed: amount or orderId mismatch.',
    } as any);

    const res = await request(app).get(`/api/v1/payments/zibal/callback?trackId=${trackId}&status=1`);

    expect(res.status).toBe(400);
    expect(res.text).toContain('پرداخت ناموفق بود');
    expect(res.text).toContain('Payment integrity check failed');
  });
});
