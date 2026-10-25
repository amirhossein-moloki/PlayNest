import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { RefundsStation } from '../../../../src/modules/payments/payments.refund.station';
import { RefundsRepo } from '../../../../src/modules/payments/payments.refund.repo';
import { PaymentsRepo } from '../../../../src/modules/payments/payments.repo';
import { PaymentStatus, RefundStatus } from '@prisma/client';
import AppError from '../../../../src/common/errors/AppError';
import httpStatus from 'http-status';

jest.mock('../../../../src/modules/payments/payments.refund.repo');
jest.mock('../../../../src/modules/payments/payments.repo');

const MockedRefundsRepo = RefundsRepo as jest.Mocked<typeof RefundsRepo>;
const MockedPaymentsRepo = PaymentsRepo as jest.Mocked<typeof PaymentsRepo>;

describe('Phase 6 — Refund Integration & Concurrency Simulation', () => {
  const gamingCenterId = 'gc-integration-1';
  const paymentId = 'pay-integration-1';

  beforeEach(() => {
    jest.clearAllMocks();
    MockedPaymentsRepo.transaction.mockImplementation(async (cb: /* eslint-disable-line @typescript-eslint/no-explicit-any */ any) => cb({}));
  });

  it('CONCURRENT OVER-REFUND PROTECTION: rejects concurrent request when cumulative sum exceeds balance', async () => {
    const mockPayment = {
      id: paymentId,
      gamingCenterId,
      amount: 100000,
      currency: 'IRR',
      status: PaymentStatus.PAID,
      provider: 'FAKE',
      providerPaymentId: 'auth-100',
      reservationId: 'res-100',
    };

    MockedRefundsRepo.findRefundByIdempotencyKey.mockResolvedValue(null);
    MockedRefundsRepo.findPaymentForRefundLock.mockResolvedValue(mockPayment as any);

    MockedRefundsRepo.calculateRefundableBalance
      .mockResolvedValueOnce({ totalRefundedOrPending: 0, remainingBalance: 100000 })
      .mockResolvedValueOnce({ totalRefundedOrPending: 80000, remainingBalance: 20000 });

    MockedRefundsRepo.calculateRefundableBalance
      .mockResolvedValueOnce({ totalRefundedOrPending: 80000, remainingBalance: 20000 });

    MockedRefundsRepo.createRefundRecord.mockResolvedValue({
      id: 'ref-req-1',
      paymentId,
      amount: 80000,
      currency: 'IRR',
      status: RefundStatus.PENDING,
    } as any);

    MockedRefundsRepo.updateRefundStatus.mockResolvedValue({
      id: 'ref-req-1',
      paymentId,
      amount: 80000,
      currency: 'IRR',
      status: RefundStatus.SUCCESSFUL,
      providerRefundId: 'FAKE_REF_80',
      processedAt: new Date(),
      createdAt: new Date(),
    } as any);

    const req1 = RefundsStation.requestRefund({
      gamingCenterId,
      paymentId,
      amount: 80000,
      currency: 'IRR',
      idempotencyKey: 'key-req-1',
      providerName: 'FAKE',
    });

    const req2 = RefundsStation.requestRefund({
      gamingCenterId,
      paymentId,
      amount: 80000,
      currency: 'IRR',
      idempotencyKey: 'key-req-2',
      providerName: 'FAKE',
    });

    const [res1, res2] = await Promise.allSettled([req1, req2]);

    expect(res1.status).toBe('fulfilled');
    expect(res2.status).toBe('rejected');

    if (res2.status === 'rejected') {
      expect((res2.reason as AppError).message).toContain('exceeds remaining refundable balance');
      expect((res2.reason as AppError).statusCode).toBe(httpStatus.CONFLICT);
    }
  });

  it('IDEMPOTENCY PROTECTION: duplicate provider callbacks return cached refund record', async () => {
    const existingRefund = {
      id: 'ref-cached-1',
      paymentId,
      gamingCenterId,
      amount: 30000,
      currency: 'IRR',
      status: RefundStatus.SUCCESSFUL,
      providerRefundId: 'FAKE_REF_30',
      failureReason: null,
      processedAt: new Date(),
      createdAt: new Date(),
    };

    MockedRefundsRepo.findRefundByIdempotencyKey.mockResolvedValue(existingRefund as any);

    const res = await RefundsStation.requestRefund({
      gamingCenterId,
      paymentId,
      amount: 30000,
      currency: 'IRR',
      idempotencyKey: 'key-idem-dup',
      providerName: 'FAKE',
    });

    expect(res.refundId).toBe('ref-cached-1');
    expect(res.status).toBe(RefundStatus.SUCCESSFUL);
    expect(MockedRefundsRepo.createRefundRecord).not.toHaveBeenCalled();
  });
});
