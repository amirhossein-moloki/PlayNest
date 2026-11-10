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

describe('Payment Callback Route (GET & POST /api/v1/payments/callback)', () => {
  const authority = 'S00000000000000000000000000000o37y85';
  const orderId = 'res-200';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. should redirect to payment failed URL when Authority query parameter is missing', async () => {
    const res = await request(app).get('/api/v1/payments/callback');

    expect(res.status).toBe(302);
    expect(res.header.location).toContain('https://www.sayra-booking.ir/payment/failed');
    expect(res.header.location).toContain('status=failed');
  });

  it('2. should redirect to payment failed URL when payment record does not exist in database', async () => {
    (prisma.payment.findFirst as any).mockResolvedValueOnce(null);

    const res = await request(app).get(`/api/v1/payments/callback?Authority=${authority}&orderId=${orderId}`);

    expect(res.status).toBe(302);
    expect(res.header.location).toContain('https://www.sayra-booking.ir/payment/failed');
    expect(res.header.location).toContain(`trackId=${authority}`);
    expect(res.header.location).toContain(`orderId=${orderId}`);
    expect(res.header.location).toContain('status=failed');
  });

  it('3. should handle user cancellation / failure (Status=NOK) and redirect to payment failed URL', async () => {
    (prisma.payment.findFirst as any).mockResolvedValueOnce({
      id: 'pay-zarinpal-1',
      reservationId: orderId,
      amount: 150000,
      currency: 'IRR',
      providerPaymentId: authority,
      status: PaymentStatus.INITIATED,
    });

    const handleFailedSpy = jest.spyOn(PaymentsRepo, 'handleFailedPayment').mockResolvedValueOnce({
      id: 'pay-zarinpal-1',
      status: PaymentStatus.FAILED,
    } as any);

    const res = await request(app).get(`/api/v1/payments/callback?Authority=${authority}&Status=NOK`);

    expect(res.status).toBe(302);
    expect(res.header.location).toContain('https://www.sayra-booking.ir/payment/failed');
    expect(res.header.location).toContain(`trackId=${authority}`);
    expect(res.header.location).toContain(`orderId=${orderId}`);
    expect(res.header.location).toContain('status=failed');
    expect(handleFailedSpy).toHaveBeenCalledWith(
      expect.anything(),
      'pay-zarinpal-1',
      PaymentStatus.FAILED,
      expect.stringContaining('Gateway callback returned unfulfilled status: status=NOK')
    );
  });

  it('4. should handle idempotency: redirect to payment success URL when payment is already PAID', async () => {
    (prisma.payment.findFirst as any).mockResolvedValueOnce({
      id: 'pay-zarinpal-1',
      reservationId: orderId,
      amount: 150000,
      currency: 'IRR',
      providerPaymentId: authority,
      status: PaymentStatus.PAID,
      referenceCode: 'ZARINPAL-REF-999',
    });

    const res = await request(app).get(`/api/v1/payments/callback?Authority=${authority}&Status=OK`);

    expect(res.status).toBe(302);
    expect(res.header.location).toContain('https://www.sayra-booking.ir/payment/success');
    expect(res.header.location).toContain('refNumber=ZARINPAL-REF-999');
    expect(res.header.location).toContain(`trackId=${authority}`);
    expect(res.header.location).toContain('status=success');
  });

  it('5. should authoritatively verify and redirect to payment success URL when Status=OK', async () => {
    (prisma.payment.findFirst as any).mockResolvedValueOnce({
      id: 'pay-zarinpal-1',
      reservationId: orderId,
      amount: 150000,
      currency: 'IRR',
      provider: 'ZARINPAL',
      providerPaymentId: authority,
      status: PaymentStatus.INITIATED,
      reservation: {
        id: orderId,
        status: ReservationStatus.PENDING,
        paymentState: ReservationPaymentState.PENDING,
      },
    });

    const mockProvider = {
      name: 'ZARINPAL',
      verifyPayment: (jest.fn() as any).mockResolvedValueOnce({
        success: true,
        status: PaymentStatus.PAID,
        refId: 'ZP-12345678',
      }),
    };
    jest.spyOn(PaymentProviderFactory, 'getProvider').mockReturnValue(mockProvider as any);

    jest.spyOn(PaymentsRepo, 'handleSuccessfulPayment').mockResolvedValueOnce({
      id: 'pay-zarinpal-1',
      reservationId: orderId,
      amount: 150000,
      currency: 'IRR',
      providerPaymentId: authority,
      referenceCode: 'ZP-12345678',
      status: PaymentStatus.PAID,
    } as any);

    const res = await request(app).get(`/api/v1/payments/callback?Authority=${authority}&Status=OK`);

    expect(res.status).toBe(302);
    expect(res.header.location).toContain('https://www.sayra-booking.ir/payment/success');
    expect(res.header.location).toContain('refNumber=ZP-12345678');
    expect(res.header.location).toContain(`orderId=${orderId}`);
    expect(res.header.location).toContain('status=success');
    expect(mockProvider.verifyPayment).toHaveBeenCalledWith({
      authority,
      amount: 150000,
      metadata: {
        orderId,
        reservationId: orderId,
      },
    });
  });

  it('6. should redirect to payment failed URL when verification fails on Status=OK', async () => {
    (prisma.payment.findFirst as any).mockResolvedValueOnce({
      id: 'pay-zarinpal-1',
      reservationId: orderId,
      amount: 150000,
      currency: 'IRR',
      provider: 'ZARINPAL',
      providerPaymentId: authority,
      status: PaymentStatus.INITIATED,
    });

    const mockProvider = {
      name: 'ZARINPAL',
      verifyPayment: (jest.fn() as any).mockResolvedValueOnce({
        success: false,
        status: PaymentStatus.FAILED,
        failureReason: 'Verification code invalid',
      }),
    };
    jest.spyOn(PaymentProviderFactory, 'getProvider').mockReturnValue(mockProvider as any);

    jest.spyOn(PaymentsRepo, 'handleFailedPayment').mockResolvedValueOnce({
      id: 'pay-zarinpal-1',
      reservationId: orderId,
      status: PaymentStatus.FAILED,
      failureReason: 'Verification code invalid',
    } as any);

    const res = await request(app).get(`/api/v1/payments/callback?Authority=${authority}&Status=OK`);

    expect(res.status).toBe(302);
    expect(res.header.location).toContain('https://www.sayra-booking.ir/payment/failed');
    expect(res.header.location).toContain('status=failed');
    expect(res.header.location).toContain('Verification+code+invalid');
  });

  it('7. should also support alias route /zarinpal/callback via POST', async () => {
    (prisma.payment.findFirst as any).mockResolvedValueOnce({
      id: 'pay-zarinpal-1',
      reservationId: orderId,
      amount: 150000,
      currency: 'IRR',
      providerPaymentId: authority,
      status: PaymentStatus.INITIATED,
    });

    jest.spyOn(PaymentsRepo, 'handleFailedPayment').mockResolvedValueOnce({
      id: 'pay-zarinpal-1',
      status: PaymentStatus.FAILED,
    } as any);

    const res = await request(app)
      .post('/api/v1/payments/zarinpal/callback')
      .send({ Authority: authority, Status: 'NOK' });

    expect(res.status).toBe(302);
    expect(res.header.location).toContain('https://www.sayra-booking.ir/payment/failed');
  });
});
