/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BookingHoldExpiryWorker } from '../../../../src/jobs/workers/bookingHoldExpiry.worker';
import { BookingHoldRepo } from '../../../../src/modules/booking-hold/booking-hold.repo';
import { BookingHoldStatus, PaymentStatus } from '@prisma/client';

jest.mock('../../../../src/modules/booking-hold/booking-hold.repo');
jest.mock('../../../../src/common/context/request-context', () => ({
  runWithSystemContext: jest.fn(async (_name, fn: any) => fn()),
}));

const MockedBookingHoldRepo = BookingHoldRepo as jest.Mocked<typeof BookingHoldRepo>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('BookingHoldExpiryWorker', () => {
  let worker: BookingHoldExpiryWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new BookingHoldExpiryWorker({ enabled: true, batchSize: 10, pollIntervalMs: 5000 });
  });

  it('should expire active holds whose expiresAt has passed', async () => {
    const expiredHold = {
      id: 'hold-expired-1',
      status: BookingHoldStatus.ACTIVE,
      payment: {
        id: 'pay-1',
        status: PaymentStatus.INITIATED,
      },
    };

    MockedBookingHoldRepo.findExpiredActiveHolds.mockResolvedValue([expiredHold as any]);
    MockedBookingHoldRepo.findHoldForUpdate.mockResolvedValue(expiredHold as any);

    const updateHoldMock = jest.fn();
    const updatePaymentMock = jest.fn();

    MockedBookingHoldRepo.transaction.mockImplementation(async (fn: any) => {
      return fn({
        bookingHold: { update: updateHoldMock },
        payment: { update: updatePaymentMock },
      } as any);
    });

    const result = await worker.tick(new Date());

    expect(result.candidatesFound).toBe(1);
    expect(result.expiredCount).toBe(1);
    expect(updateHoldMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'hold-expired-1' },
        data: { status: BookingHoldStatus.EXPIRED },
      })
    );
    expect(updatePaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ status: PaymentStatus.CANCELED }),
      })
    );
  });

  it('should NOT expire hold if associated payment is successfully verified (PAID)', async () => {
    const paidHold = {
      id: 'hold-paid-awaiting-conversion',
      status: BookingHoldStatus.ACTIVE,
      payment: {
        id: 'pay-verified',
        status: PaymentStatus.PAID,
      },
    };

    MockedBookingHoldRepo.findExpiredActiveHolds.mockResolvedValue([paidHold as any]);
    MockedBookingHoldRepo.findHoldForUpdate.mockResolvedValue(paidHold as any);

    const updateHoldMock = jest.fn();

    MockedBookingHoldRepo.transaction.mockImplementation(async (fn: any) => {
      return fn({
        bookingHold: { update: updateHoldMock },
      } as any);
    });

    const result = await worker.tick(new Date());

    expect(result.candidatesFound).toBe(1);
    expect(result.expiredCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(updateHoldMock).not.toHaveBeenCalled();
  });
});
