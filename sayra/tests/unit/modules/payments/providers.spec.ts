import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ZarinPalProvider } from '../../../../src/modules/payments/providers/zarinpal.provider';
import { FakePaymentProvider } from '../../../../src/modules/payments/providers/fake.provider';
import { PaymentProviderFactory } from '../../../../src/modules/payments/providers/payment-provider.factory';
import { PaymentStatus } from '@prisma/client';
import AppError from '../../../../src/common/errors/AppError';

const mockFetch = jest.fn() as any;
global.fetch = mockFetch;

describe('Payment Provider Adapters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ZarinPalProvider', () => {
    const provider = new ZarinPalProvider();

    it('should successfully initiate payment', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            data: { authority: 'A00000000000000000000000000000000001', code: 100 },
            errors: [],
          }),
      });

      const result = await provider.initiatePayment({
        amount: 50000,
        currency: 'IRR',
        description: 'Test payment',
        callbackUrl: 'http://localhost/callback',
        reservationId: 'res-1',
        gamingCenterId: 'gc-1',
      });

      expect(result.providerPaymentId).toBe('A00000000000000000000000000000000001');
      expect(result.checkoutUrl).toContain('A00000000000000000000000000000000001');
    });

    it('should handle initiation provider error', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            data: null,
            errors: { code: -10, message: 'Invalid IP' },
          }),
      });

      await expect(
        provider.initiatePayment({
          amount: 50000,
          currency: 'IRR',
          description: 'Test payment',
          callbackUrl: 'http://localhost/callback',
          reservationId: 'res-1',
          gamingCenterId: 'gc-1',
        })
      ).rejects.toThrow('Payment initiation failed with provider.');
    });

    it('should verify successful payment', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            data: { code: 100, ref_id: 12345678 },
            errors: [],
          }),
      });

      const result = await provider.verifyPayment({
        authority: 'A00000000000000000000000000000000001',
        amount: 50000,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(PaymentStatus.PAID);
      expect(result.refId).toBe('12345678');
    });

    it('should handle failed payment verification', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            data: null,
            errors: { code: -51, message: 'Session is not paid' },
          }),
      });

      const result = await provider.verifyPayment({
        authority: 'A00000000000000000000000000000000001',
        amount: 50000,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(PaymentStatus.FAILED);
    });
  });

  describe('FakePaymentProvider', () => {
    const provider = new FakePaymentProvider();

    it('should initiate fake payment', async () => {
      const result = await provider.initiatePayment({
        amount: 10000,
        currency: 'IRR',
        description: 'Test',
        callbackUrl: 'http://localhost/callback',
        reservationId: 'res-1',
        gamingCenterId: 'gc-1',
      });

      expect(result.providerPaymentId).toContain('FAKE_AUTH_');
      expect(result.checkoutUrl).toContain('https://fake-payment.local');
    });

    it('should verify fake payment success', async () => {
      const result = await provider.verifyPayment({
        authority: 'FAKE_AUTH_SUCCESS_123',
        amount: 10000,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(PaymentStatus.PAID);
      expect(result.refId).toContain('FAKE_REF_');
    });

    it('should simulate fake payment failure', async () => {
      const result = await provider.verifyPayment({
        authority: 'FAKE_AUTH_FAIL_123',
        amount: 10000,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(PaymentStatus.FAILED);
    });
  });

  describe('PaymentProviderFactory', () => {
    it('should return ZarinPalProvider by default', () => {
      const provider = PaymentProviderFactory.getProvider();
      expect(provider.name).toBe('ZARINPAL');
    });

    it('should return FakePaymentProvider in dev/test environment', () => {
      const provider = PaymentProviderFactory.getProvider('FAKE');
      expect(provider.name).toBe('FAKE');
    });

    it('should throw error for unsupported provider', () => {
      expect(() => PaymentProviderFactory.getProvider('INVALID')).toThrow(AppError);
    });
  });
});
