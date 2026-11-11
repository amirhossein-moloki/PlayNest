/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { WalletChargeStation } from '../../../../src/modules/wallet/charge.station';
import { WalletChargeRepo } from '../../../../src/modules/wallet/charge.repo';
import { PaymentProviderFactory } from '../../../../src/modules/payments/providers';
import { WalletChargeStatus, PaymentStatus } from '@prisma/client';
import AppError from '../../../../src/common/errors/AppError';

jest.mock('../../../../src/modules/wallet/charge.repo');
jest.mock('../../../../src/modules/payments/providers');

describe('WalletChargeStation Unit Tests', () => {
  const MockedRepo = WalletChargeRepo as jest.Mocked<typeof WalletChargeRepo>;
  const mockProvider: any = {
    name: 'ZIBAL',
    initiatePayment: jest.fn(),
    verifyPayment: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (PaymentProviderFactory.getProvider as jest.Mock).mockReturnValue(mockProvider);
  });

  describe('Currency & Amount Normalization', () => {
    it('1. should convert IRT to IRR by multiplying by 10', () => {
      const result = WalletChargeStation.normalizeAmountToRials(50000, 'IRT');
      expect(result.amountRials).toBe(500000);
      expect(result.currency).toBe('IRR');
    });

    it('2. should keep IRR without multiplying', () => {
      const result = WalletChargeStation.normalizeAmountToRials(500000, 'IRR');
      expect(result.amountRials).toBe(500000);
      expect(result.currency).toBe('IRR');
    });

    it('3. should reject zero amount', () => {
      expect(() => WalletChargeStation.normalizeAmountToRials(0, 'IRT')).toThrow(AppError);
    });

    it('4. should reject negative amount', () => {
      expect(() => WalletChargeStation.normalizeAmountToRials(-1000, 'IRT')).toThrow(AppError);
    });

    it('5. should reject amount below minimum threshold (1,000 Tomans)', () => {
      expect(() => WalletChargeStation.normalizeAmountToRials(999, 'IRT')).toThrow(
        /Minimum wallet charge amount/
      );
    });

    it('6. should reject amount exceeding maximum threshold', () => {
      expect(() => WalletChargeStation.normalizeAmountToRials(60_000_000, 'IRT')).toThrow(
        /Maximum wallet charge amount/
      );
    });

    it('7. should reject non-integer amount', () => {
      expect(() => WalletChargeStation.normalizeAmountToRials(10500.5, 'IRT')).toThrow(AppError);
    });
  });

  describe('Charge Initiation with Zibal', () => {
    it('8. should successfully initiate charge and return paymentUrl', async () => {
      MockedRepo.findChargeByIdempotencyKey.mockResolvedValue(null);
      MockedRepo.createCharge.mockResolvedValue({
        id: 'charge-123',
        customerAccountId: 'cust-1',
        amount: 500000,
        currency: 'IRR',
        provider: 'ZIBAL',
        status: WalletChargeStatus.PENDING,
        trackId: null,
        refNumber: null,
        failureReason: null,
        idempotencyKey: null,
        rawProviderPayload: null,
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      mockProvider.initiatePayment.mockResolvedValue({
        providerPaymentId: '98765432',
        checkoutUrl: 'https://gateway.zibal.ir/start/98765432',
        rawPayload: { trackId: 98765432, result: 100 },
      });

      const res = await WalletChargeStation.initiateCharge({
        customerAccountId: 'cust-1',
        amount: 50000,
        currency: 'IRT',
      });

      expect(res.chargeId).toBe('charge-123');
      expect(res.trackId).toBe('98765432');
      expect(res.paymentUrl).toBe('https://gateway.zibal.ir/start/98765432');
      expect(res.amount).toBe(500000);
      expect(res.status).toBe(WalletChargeStatus.PENDING);
      expect(MockedRepo.updateCharge).toHaveBeenCalledWith('charge-123', {
        trackId: '98765432',
        rawProviderPayload: { trackId: 98765432, result: 100 },
      });
    });

    it('9. should handle duplicate request with same Idempotency-Key idempotently', async () => {
      MockedRepo.findChargeByIdempotencyKey.mockResolvedValue({
        id: 'charge-existing',
        customerAccountId: 'cust-1',
        amount: 500000,
        currency: 'IRR',
        status: WalletChargeStatus.PENDING,
        trackId: '98765432',
      } as any);

      const res = await WalletChargeStation.initiateCharge({
        customerAccountId: 'cust-1',
        amount: 50000,
        currency: 'IRT',
        idempotencyKey: 'idem-key-abc',
      });

      expect(res.replayed).toBe(true);
      expect(res.chargeId).toBe('charge-existing');
      expect(res.trackId).toBe('98765432');
      expect(MockedRepo.createCharge).not.toHaveBeenCalled();
      expect(mockProvider.initiatePayment).not.toHaveBeenCalled();
    });

    it('10. should mark charge as FAILED when Zibal gateway returns error during initiation', async () => {
      MockedRepo.findChargeByIdempotencyKey.mockResolvedValue(null);
      MockedRepo.createCharge.mockResolvedValue({
        id: 'charge-fail',
        customerAccountId: 'cust-1',
        amount: 500000,
        currency: 'IRR',
        status: WalletChargeStatus.PENDING,
      } as any);

      mockProvider.initiatePayment.mockRejectedValue(new Error('Gateway timeout'));

      await expect(
        WalletChargeStation.initiateCharge({
          customerAccountId: 'cust-1',
          amount: 50000,
          currency: 'IRT',
        })
      ).rejects.toThrow(/Failed to initiate wallet payment gateway/);

      expect(MockedRepo.updateCharge).toHaveBeenCalledWith('charge-fail', {
        status: WalletChargeStatus.FAILED,
        failureReason: 'Gateway timeout',
      });
    });
  });

  describe('Verification & Atomic Credit', () => {
    it('11. should return error if charge record is not found', async () => {
      MockedRepo.findChargeByTrackId.mockResolvedValue(null);

      const res = await WalletChargeStation.verifyCharge({
        trackId: 'invalid-track',
      });

      expect(res.success).toBe(false);
      expect(res.failureReason).toContain('یافت نشد');
    });

    it('12. should handle idempotency: return success if already PAID without re-crediting', async () => {
      MockedRepo.findChargeByTrackId.mockResolvedValue({
        id: 'charge-paid',
        status: WalletChargeStatus.PAID,
        amount: 500000,
        refNumber: 'ref-already-paid',
      } as any);

      const res = await WalletChargeStation.verifyCharge({
        trackId: 'track-paid',
      });

      expect(res.success).toBe(true);
      expect(res.alreadyProcessed).toBe(true);
      expect(mockProvider.verifyPayment).not.toHaveBeenCalled();
      expect(MockedRepo.executeAtomicCredit).not.toHaveBeenCalled();
    });

    it('13. should handle gateway cancellation status gracefully', async () => {
      MockedRepo.findChargeByTrackId.mockResolvedValue({
        id: 'charge-cancel',
        status: WalletChargeStatus.PENDING,
        amount: 500000,
      } as any);

      const res = await WalletChargeStation.verifyCharge({
        trackId: 'track-cancel',
        statusQuery: 3, // Non-success status code
      });

      expect(res.success).toBe(false);
      expect(MockedRepo.updateCharge).toHaveBeenCalledWith('charge-cancel', {
        status: WalletChargeStatus.CANCELLED,
        failureReason: expect.stringContaining('Gateway callback unfulfilled'),
      });
      expect(mockProvider.verifyPayment).not.toHaveBeenCalled();
    });

    it('14. should handle unsuccessful verification from Zibal', async () => {
      MockedRepo.findChargeByTrackId.mockResolvedValue({
        id: 'charge-verif-fail',
        status: WalletChargeStatus.PENDING,
        amount: 500000,
        trackId: 'track-fail',
      } as any);

      mockProvider.verifyPayment.mockResolvedValue({
        success: false,
        status: PaymentStatus.FAILED,
        failureReason: 'Payment integrity check failed: amount mismatch',
      });

      const res = await WalletChargeStation.verifyCharge({
        trackId: 'track-fail',
        statusQuery: 1,
      });

      expect(res.success).toBe(false);
      expect(MockedRepo.updateCharge).toHaveBeenCalledWith('charge-verif-fail', {
        status: WalletChargeStatus.FAILED,
        failureReason: 'Payment integrity check failed: amount mismatch',
      });
      expect(MockedRepo.executeAtomicCredit).not.toHaveBeenCalled();
    });

    it('15. should successfully verify and atomically credit wallet', async () => {
      MockedRepo.findChargeByTrackId.mockResolvedValue({
        id: 'charge-ok',
        status: WalletChargeStatus.PENDING,
        amount: 500000,
        trackId: 'track-ok',
      } as any);

      mockProvider.verifyPayment.mockResolvedValue({
        success: true,
        status: PaymentStatus.PAID,
        refId: 'ref-123456789',
        rawPayload: { result: 100, refNumber: 123456789 },
      });

      MockedRepo.executeAtomicCredit.mockResolvedValue({
        id: 'charge-ok',
        status: WalletChargeStatus.PAID,
        amount: 500000,
        refNumber: 'ref-123456789',
      } as any);

      const res = await WalletChargeStation.verifyCharge({
        trackId: 'track-ok',
        statusQuery: 1,
      });

      expect(res.success).toBe(true);
      expect(res.refNumber).toBe('ref-123456789');
      expect(MockedRepo.executeAtomicCredit).toHaveBeenCalledWith(
        'charge-ok',
        'ref-123456789',
        { result: 100, refNumber: 123456789 }
      );
    });
  });

  describe('Charge Status & Ownership', () => {
    it('16. should reject querying charge belonging to another user', async () => {
      MockedRepo.findChargeByIdAndCustomer.mockResolvedValue(null);

      await expect(
        WalletChargeStation.getChargeStatus('charge-other', 'cust-hacker')
      ).rejects.toThrow(/Wallet charge transaction not found/);
    });

    it('17. should return charge details for valid owner', async () => {
      MockedRepo.findChargeByIdAndCustomer.mockResolvedValue({
        id: 'charge-mine',
        customerAccountId: 'cust-owner',
        amount: 500000,
        currency: 'IRR',
        provider: 'ZIBAL',
        status: WalletChargeStatus.PAID,
        trackId: 'track-mine',
        refNumber: 'ref-mine',
        failureReason: null,
        paidAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const status = await WalletChargeStation.getChargeStatus('charge-mine', 'cust-owner');
      expect(status.id).toBe('charge-mine');
      expect(status.status).toBe(WalletChargeStatus.PAID);
    });
  });
});
