/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import Zibal from 'zibal';
import { ZibalProvider } from '../../../../src/modules/payments/providers/zibal.provider';
import { PaymentStatus } from '@prisma/client';
import AppError from '../../../../src/common/errors/AppError';

const {
  ZibalValidationError,
  ZibalApiError,
  ZibalNetworkError,
  ZibalTimeoutError,
  ZibalIntegrityError,
} = Zibal.errors;

describe('ZibalProvider Unit Tests', () => {
  let mockClient: any;
  let provider: ZibalProvider;

  beforeEach(() => {
    mockClient = {
      request: jest.fn(),
      verify: jest.fn(),
    };
    provider = new ZibalProvider(mockClient);
    jest.clearAllMocks();
  });

  describe('initiatePayment', () => {
    it('1. should successfully initiate payment with valid parameters', async () => {
      mockClient.request.mockResolvedValueOnce({
        trackId: 12345678,
        result: 100,
        message: 'success',
        paymentUrl: 'https://gateway.zibal.ir/start/12345678',
      });

      const result = await provider.initiatePayment({
        amount: 500000,
        currency: 'IRR',
        description: 'Test reservation',
        callbackUrl: 'http://localhost:3000/api/v1/payments/zibal/callback',
        reservationId: 'res-123',
        gamingCenterId: 'gc-456',
      });

      expect(mockClient.request).toHaveBeenCalledWith({
        amount: 500000,
        orderId: 'res-123',
        callbackUrl: 'http://localhost:3000/api/v1/payments/zibal/callback',
        description: 'Test reservation',
      });
      expect(result.providerPaymentId).toBe('12345678');
      expect(result.checkoutUrl).toBe('https://gateway.zibal.ir/start/12345678');
    });

    it('2. should handle ZibalValidationError correctly', async () => {
      mockClient.request.mockRejectedValueOnce(new ZibalValidationError('amount must be positive'));

      await expect(
        provider.initiatePayment({
          amount: -500,
          currency: 'IRR',
          description: 'Invalid',
          callbackUrl: 'http://localhost:3000/callback',
          reservationId: 'res-1',
          gamingCenterId: 'gc-1',
        })
      ).rejects.toThrow(AppError);
    });

    it('3. should handle ZibalApiError correctly', async () => {
      mockClient.request.mockRejectedValueOnce(new ZibalApiError('merchant is invalid', { code: 'INVALID_MERCHANT' }));

      await expect(
        provider.initiatePayment({
          amount: 50000,
          currency: 'IRR',
          description: 'Merchant error',
          callbackUrl: 'http://localhost:3000/callback',
          reservationId: 'res-1',
          gamingCenterId: 'gc-1',
        })
      ).rejects.toThrow('Payment initiation rejected by provider.');
    });

    it('4. should handle ZibalTimeoutError correctly', async () => {
      mockClient.request.mockRejectedValueOnce(new ZibalTimeoutError('request timed out'));

      await expect(
        provider.initiatePayment({
          amount: 50000,
          currency: 'IRR',
          description: 'Timeout',
          callbackUrl: 'http://localhost:3000/callback',
          reservationId: 'res-1',
          gamingCenterId: 'gc-1',
        })
      ).rejects.toThrow('Payment provider request timed out. Please try again.');
    });

    it('5. should handle ZibalNetworkError correctly', async () => {
      mockClient.request.mockRejectedValueOnce(new ZibalNetworkError('connection reset'));

      await expect(
        provider.initiatePayment({
          amount: 50000,
          currency: 'IRR',
          description: 'Network',
          callbackUrl: 'http://localhost:3000/callback',
          reservationId: 'res-1',
          gamingCenterId: 'gc-1',
        })
      ).rejects.toThrow('Network error connecting to payment provider.');
    });
  });

  describe('verifyPayment', () => {
    it('6. should verify payment successfully', async () => {
      mockClient.verify.mockResolvedValueOnce({
        status: 1,
        refNumber: 987654321,
        amount: 200000,
        orderId: 'res-123',
      });

      const result = await provider.verifyPayment({
        authority: '12345678',
        amount: 200000,
        metadata: {
          orderId: 'res-123',
        },
      });

      expect(mockClient.verify).toHaveBeenCalledWith({
        trackId: '12345678',
        expectedAmount: 200000,
        expectedOrderId: 'res-123',
      });
      expect(result.success).toBe(true);
      expect(result.status).toBe(PaymentStatus.PAID);
      expect(result.refId).toBe('987654321');
    });

    it('7. should handle ZibalIntegrityError when amount or orderId mismatches', async () => {
      mockClient.verify.mockRejectedValueOnce(new ZibalIntegrityError('amount mismatch'));

      const result = await provider.verifyPayment({
        authority: '12345678',
        amount: 200000,
        metadata: {
          orderId: 'res-123',
        },
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.failureReason).toContain('Payment integrity check failed');
    });

    it('8. should handle ZibalApiError during verification', async () => {
      mockClient.verify.mockRejectedValueOnce(new ZibalApiError('trackId not found', { code: 'NOT_FOUND' }));

      const result = await provider.verifyPayment({
        authority: '99999999',
        amount: 200000,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.failureReason).toBe('trackId not found');
    });

    it('9. should handle ZibalTimeoutError during verification without throwing', async () => {
      mockClient.verify.mockRejectedValueOnce(new ZibalTimeoutError('timeout during verify'));

      const result = await provider.verifyPayment({
        authority: '12345678',
        amount: 200000,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.failureReason).toBe('Payment verification timed out.');
    });

    it('10. should handle ZibalNetworkError during verification without throwing', async () => {
      mockClient.verify.mockRejectedValueOnce(new ZibalNetworkError('connection failed'));

      const result = await provider.verifyPayment({
        authority: '12345678',
        amount: 200000,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.failureReason).toBe('Payment verification network error.');
    });
  });

  describe('Refund methods', () => {
    it('11. should return not supported for automated refund', async () => {
      const res = await provider.requestRefund({
        paymentId: 'p1',
        amount: 100,
        currency: 'IRR',
      });
      expect(res.success).toBe(false);
    });

    it('12. should return not supported for refund verification', async () => {
      const res = await provider.verifyRefund({
        refundId: 'r1',
        amount: 100,
        currency: 'IRR',
      });
      expect(res.success).toBe(false);
    });
  });
});
