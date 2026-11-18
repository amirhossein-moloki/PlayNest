import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { WalletRepo } from '../../../../src/modules/wallet/wallet.repo';
import { PaymentStatus } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('WalletRepo.findTotalPaidForReservation with BookingHold / GroupBooking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should find paid amount via groupBookingId when payment has no direct reservationId', async () => {
    const mockTx = {
      payment: {
        findMany: jest
          .fn<(...args: any[]) => Promise<any>>()
          .mockResolvedValueOnce([]) // direct reservationId lookup
          .mockResolvedValueOnce([{ id: 'pay-1', amount: 160000, status: PaymentStatus.PAID }]), // groupBookingId lookup
      },
      reservation: {
        findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
          groupBookingId: 'gb-1',
          customerPayableAmount: 0,
          totalPrice: 80000,
        }),
      },
    };

    const paid = await WalletRepo.findTotalPaidForReservation('res-1', mockTx as any);
    expect(paid).toBe(80000);
    expect(mockTx.payment.findMany).toHaveBeenCalledTimes(2);
    expect(mockTx.payment.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        groupBookingId: 'gb-1',
        status: PaymentStatus.PAID,
      },
    });
  });

  it('should return direct payment amount when reservationId is linked on Payment', async () => {
    const mockTx = {
      payment: {
        findMany: jest
          .fn<(...args: any[]) => Promise<any>>()
          .mockResolvedValueOnce([{ id: 'pay-1', amount: 80000, status: PaymentStatus.PAID }]),
      },
      reservation: {
        findUnique: jest.fn<(...args: any[]) => Promise<any>>(),
      },
    };

    const paid = await WalletRepo.findTotalPaidForReservation('res-1', mockTx as any);
    expect(paid).toBe(80000);
    expect(mockTx.reservation.findUnique).not.toHaveBeenCalled();
  });
});
