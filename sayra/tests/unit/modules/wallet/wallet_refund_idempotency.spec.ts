import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { walletService } from '../../../../src/modules/wallet/wallet.station';
import { WalletRepo } from '../../../../src/modules/wallet/wallet.repo';
import { ReservationPaymentState, WalletTransactionType } from '@prisma/client';

jest.mock('../../../../src/modules/wallet/wallet.repo');
jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    $transaction: jest.fn(async (cb: any) => cb({
      walletTransaction: {
        findFirst: jest.fn(),
      },
    })),
  },
}));

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Wallet Refund Idempotency and Exact Paid Calculation', () => {
  const MockedWalletRepo = WalletRepo as jest.Mocked<typeof WalletRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not refund if total paid is 0', async () => {
    MockedWalletRepo.findReservation.mockResolvedValue({
      id: 'res-unpaid',
      customerAccountId: 'acc-1',
      customerAccount: { id: 'acc-1' },
      customerPayableAmount: 50000,
      stationSnapshot: { currency: 'IRR' },
    } as any);

    MockedWalletRepo.findRefundTransaction.mockResolvedValue(null);
    MockedWalletRepo.findTotalPaidForReservation.mockResolvedValue(0);

    await walletService.refundReservationToWallet('res-unpaid');

    expect(MockedWalletRepo.createTransaction).not.toHaveBeenCalled();
    expect(MockedWalletRepo.updateBalance).not.toHaveBeenCalled();
  });

  it('should not double-refund if refund transaction already exists', async () => {
    MockedWalletRepo.findReservation.mockResolvedValue({
      id: 'res-already-refunded',
      customerAccountId: 'acc-1',
      customerAccount: { id: 'acc-1' },
      customerPayableAmount: 50000,
      stationSnapshot: { currency: 'IRR' },
    } as any);

    MockedWalletRepo.findRefundTransaction.mockResolvedValue({
      id: 'tx-refund-1',
      amount: 50000,
      type: WalletTransactionType.REFUND,
    } as any);

    await walletService.refundReservationToWallet('res-already-refunded');

    expect(MockedWalletRepo.createTransaction).not.toHaveBeenCalled();
    expect(MockedWalletRepo.updateBalance).not.toHaveBeenCalled();
  });

  it('should cap refund at customerPayableAmount for discounted reservations', async () => {
    MockedWalletRepo.findReservation.mockResolvedValue({
      id: 'res-discounted',
      customerAccountId: 'acc-1',
      customerAccount: { id: 'acc-1' },
      originalAmount: 100000,
      customerPayableAmount: 80000, // 20000 discount applied
      stationSnapshot: { currency: 'IRR' },
    } as any);

    MockedWalletRepo.findRefundTransaction.mockResolvedValue(null);
    MockedWalletRepo.findTotalPaidForReservation.mockResolvedValue(80000);
    MockedWalletRepo.updateBalance.mockResolvedValue({} as any);
    MockedWalletRepo.createTransaction.mockResolvedValue({} as any);
    MockedWalletRepo.updateReservationPaymentState.mockResolvedValue({} as any);
    MockedWalletRepo.updatePaymentsStatus.mockResolvedValue({ count: 1 } as any);

    await walletService.refundReservationToWallet('res-discounted');

    expect(MockedWalletRepo.updateBalance).toHaveBeenCalledWith('acc-1', 80000, expect.anything());
    expect(MockedWalletRepo.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        customerAccountId: 'acc-1',
        amount: 80000,
        type: WalletTransactionType.REFUND,
        reservationId: 'res-discounted',
      }),
      expect.anything()
    );
    expect(MockedWalletRepo.updateReservationPaymentState).toHaveBeenCalledWith(
      'res-discounted',
      ReservationPaymentState.REFUNDED,
      expect.anything()
    );
  });
});
