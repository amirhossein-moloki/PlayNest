/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ReservationPaymentState,
  ReservationStatus,
  WalletTransactionType,
  WithdrawalRequestStatus,
} from '@prisma/client';
import { prisma } from '../../src/config/prisma';
import { WalletRepo } from '../../src/modules/wallet/wallet.repo';
import { walletService } from '../../src/modules/wallet/wallet.station';
import { WithdrawalRepo } from '../../src/modules/wallet/withdrawal.repo';
import { WithdrawalStation } from '../../src/modules/wallet/withdrawal.station';
import { PaymentsRepo } from '../../src/modules/payments/payments.repo';
import { GroupBookingRepo } from '../../src/modules/group-booking/group-booking.repo';
import { getAvailableWalletBalance } from '../../src/modules/wallet/wallet-access.guard';

jest.mock('../../src/modules/reservation/reservation.code', () => ({
  generateUniqueCheckInCode: jest.fn(async () => '123456'),
}));

jest.mock('../../src/modules/commissions/commissions.station', () => ({
  commissionsStation: {
    reverseCommissionForRefundedReservation: jest.fn(async () => undefined),
  },
}));

describe('SEC-005 & SEC-006: Wallet Double-Refund & Reserved Withdrawal Double-Spend Remediation', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('SEC-005: Deterministic 2x Double-Refund Prevention', () => {
    it('excludes paymentId-linked RESERVATION_PAYMENT transactions so child reservation refunds 1x, not 2x', async () => {
      const creditSpy = jest.spyOn(walletService, 'credit').mockResolvedValue({} as any);
      jest.spyOn(WalletRepo, 'findRefundTransaction').mockResolvedValue(null);
      jest.spyOn(WalletRepo, 'findTotalPaidForReservation').mockResolvedValue(100000);
      jest.spyOn(WalletRepo, 'updateReservationPaymentState').mockResolvedValue({} as any);
      jest.spyOn(WalletRepo, 'updatePaymentsStatus').mockResolvedValue({ count: 1 } as any);

      const findFirstMock = jest.fn(async (args: any) => {
        // Verify production query explicitly excludes payment-linked wallet transactions
        if (args?.where?.paymentId === null) {
          return null;
        }
        return {
          id: 'wt-paid-link',
          reservationId: 'res-child-1',
          type: WalletTransactionType.RESERVATION_PAYMENT,
          paymentId: 'pay-wallet-1',
          amount: -100000,
        };
      });

      const txMock: any = {
        $executeRaw: jest.fn(async () => 1),
        reservation: {
          findUnique: jest.fn(async () => ({
            id: 'res-child-1',
            customerAccountId: 'cust-1',
            gamingCenterId: 'gc-1',
            totalPrice: 100000,
            customerPayableAmount: 0, // Pre-fix group child omitted customerPayableAmount
            paymentState: ReservationPaymentState.PAID,
            stationSnapshot: { currency: 'IRR' },
          })),
        },
        walletTransaction: {
          findFirst: findFirstMock,
        },
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(txMock));

      await walletService.refundReservationToWallet('res-child-1');

      expect(findFirstMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reservationId: 'res-child-1',
            type: WalletTransactionType.RESERVATION_PAYMENT,
            paymentId: null,
          }),
        })
      );
      expect(creditSpy).toHaveBeenCalledTimes(1);
      expect(creditSpy).toHaveBeenCalledWith(
        'cust-1',
        100000,
        WalletTransactionType.REFUND,
        'IRR',
        'res-child-1',
        expect.any(String),
        txMock
      );
    });

    it('caps refund at totalPrice fallback even when customerPayableAmount is 0 and totalActualPaid exceeds totalPrice', async () => {
      const creditSpy = jest.spyOn(walletService, 'credit').mockResolvedValue({} as any);
      jest.spyOn(WalletRepo, 'findRefundTransaction').mockResolvedValue(null);
      jest.spyOn(WalletRepo, 'findTotalPaidForReservation').mockResolvedValue(120000);
      jest.spyOn(WalletRepo, 'updateReservationPaymentState').mockResolvedValue({} as any);
      jest.spyOn(WalletRepo, 'updatePaymentsStatus').mockResolvedValue({ count: 1 } as any);

      const txMock: any = {
        $executeRaw: jest.fn(async () => 1),
        reservation: {
          findUnique: jest.fn(async () => ({
            id: 'res-child-2',
            customerAccountId: 'cust-1',
            gamingCenterId: 'gc-1',
            totalPrice: 120000,
            customerPayableAmount: 0,
            paymentState: ReservationPaymentState.PAID,
            stationSnapshot: { currency: 'IRR' },
          })),
        },
        walletTransaction: {
          findFirst: jest.fn(async () => ({
            id: 'wt-direct-1',
            reservationId: 'res-child-2',
            paymentId: null,
            amount: -120000,
          })),
        },
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(txMock));

      await walletService.refundReservationToWallet('res-child-2');

      expect(creditSpy).toHaveBeenCalledWith(
        'cust-1',
        120000,
        WalletTransactionType.REFUND,
        'IRR',
        'res-child-2',
        expect.any(String),
        txMock
      );
    });

    it('populates customerPayableAmount and originalAmount on group-booking child reservations', async () => {
      const createdPayloads: any[] = [];
      const txMock: any = {
        groupBooking: {
          create: jest.fn(async () => ({ id: 'gb-1' })),
          findUnique: jest.fn(async () => ({ id: 'gb-1', reservations: [] })),
        },
        reservation: {
          create: jest.fn(async ({ data }: any) => {
            createdPayloads.push(data);
            return { id: 'res-child-new', ...data };
          }),
        },
        groupBookingItem: {
          create: jest.fn(async () => ({ id: 'gbi-1' })),
        },
      };

      await GroupBookingRepo.createGroupBookingWithDetails(
        {
          gamingCenterId: 'gc-1',
          customerProfileId: 'prof-1',
          customerAccountId: 'cust-1',
          createdByUserId: 'user-1',
          startTime: new Date('2026-12-01T10:00:00Z'),
          endTime: new Date('2026-12-01T12:00:00Z'),
          totalHours: 2,
          totalPrice: 80000,
          discountAmount: 20000,
          status: ReservationStatus.CONFIRMED,
          paymentState: ReservationPaymentState.PAID,
          items: [
            {
              stationId: 'st-1',
              price: 80000,
              discountAmount: 20000,
              stationSnapshot: { name: 'PS5-1', hourlyPrice: 50000, stationType: 'PS5' },
            },
          ],
        },
        txMock
      );

      expect(createdPayloads).toHaveLength(1);
      expect(createdPayloads[0]).toMatchObject({
        totalPrice: 80000,
        customerPayableAmount: 80000,
        originalAmount: 100000,
        discountAmount: 20000,
      });
    });
  });

  describe('SEC-006: Reserved Balance Enforcement & Withdrawal FOR UPDATE Locks', () => {
    it('computes spendable wallet balance by subtracting reservedBalance', () => {
      expect(getAvailableWalletBalance({ walletBalance: 500000, reservedBalance: 400000 })).toBe(100000);
      expect(getAvailableWalletBalance({ walletBalance: 100000, reservedBalance: 150000 })).toBe(0);
      expect(getAvailableWalletBalance({ walletBalance: 250000 })).toBe(250000);
      expect(getAvailableWalletBalance(null)).toBe(0);
    });

    it('rejects WalletRepo.updateBalance debit exceeding available balance (walletBalance - reservedBalance)', async () => {
      const executeRaw = jest.fn(async () => 1);
      const txMock: any = {
        $executeRaw: executeRaw,
        customerAccount: {
          findUnique: jest.fn(async () => ({
            walletBalance: 500000,
            reservedBalance: 400000,
          })),
          update: jest.fn(),
        },
      };

      await expect(WalletRepo.updateBalance('cust-1', -150000, txMock)).rejects.toThrow(
        'INSUFFICIENT_BALANCE'
      );
      expect(executeRaw).toHaveBeenCalledTimes(1);
      expect(txMock.customerAccount.update).not.toHaveBeenCalled();
    });

    it('blocks PaymentsRepo.createFullWalletPayment when reservedBalance makes spendable funds insufficient', async () => {
      const txMock: any = {
        $executeRaw: jest.fn(async () => 1),
        customerAccount: {
          findUnique: jest.fn(async () => ({
            id: 'cust-1',
            walletBalance: 200000,
            reservedBalance: 150000,
          })),
          update: jest.fn(),
        },
      };
      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(txMock));

      await expect(
        PaymentsRepo.createFullWalletPayment({
          reservationId: 'res-1',
          gamingCenterId: 'gc-1',
          customerAccountId: 'cust-1',
          amount: 100000,
          currency: 'IRR',
          idempotencyKey: 'idem-full-1',
        })
      ).rejects.toThrow('Insufficient wallet balance.');
      expect(txMock.customerAccount.update).not.toHaveBeenCalled();
    });

    it('blocks PaymentsRepo.createPartialPayment when reservedBalance makes walletContribution exceed available balance', async () => {
      const txMock: any = {
        $executeRaw: jest.fn(async () => 1),
        customerAccount: {
          findUnique: jest.fn(async () => ({
            id: 'cust-1',
            walletBalance: 200000,
            reservedBalance: 150000,
          })),
          update: jest.fn(),
        },
      };
      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(txMock));

      await expect(
        PaymentsRepo.createPartialPayment({
          reservationId: 'res-1',
          gamingCenterId: 'gc-1',
          customerAccountId: 'cust-1',
          totalAmount: 250000,
          walletContribution: 100000,
          currency: 'IRR',
          provider: 'ZARINPAL' as any,
          idempotencyKey: 'idem-part-1',
        })
      ).rejects.toThrow('Insufficient wallet balance.');
      expect(txMock.customerAccount.update).not.toHaveBeenCalled();
    });

    it('acquires WithdrawalRequest FOR UPDATE lock before reading withdrawal and enforces CustomerAccount reservedBalance on reject/FAILED/PAID', async () => {
      const callOrder: string[] = [];
      const txMock: any = {
        $executeRaw: jest.fn(async (strings: TemplateStringsArray) => {
          callOrder.push(`raw:${strings.join('?')}`);
          return 1;
        }),
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(txMock));
      jest.spyOn(WithdrawalRepo, 'findWithdrawalById').mockImplementation(async () => {
        callOrder.push('findWithdrawalById');
        return {
          id: 'with-lock-1',
          customerAccountId: 'cust-1',
          amount: 200000,
          status: WithdrawalRequestStatus.APPROVED,
        } as any;
      });
      jest.spyOn(WithdrawalRepo, 'findCustomerAccountForUpdate').mockImplementation(async () => {
        callOrder.push('findCustomerAccountForUpdate');
        return {
          id: 'cust-1',
          walletBalance: 200000,
          reservedBalance: 50000, // Insufficient reservedBalance (already consumed/rejected)
        } as any;
      });
      const updateAcctSpy = jest.spyOn(WithdrawalRepo, 'updateCustomerAccount');

      await expect(
        WithdrawalStation.rejectWithdrawal('with-lock-1', 'admin-1', 'Duplicate attempt')
      ).rejects.toThrow('Insufficient reserved balance');

      expect(callOrder[0]).toContain('WithdrawalRequest');
      expect(callOrder[0]).toContain('FOR UPDATE');
      expect(callOrder[1]).toBe('findWithdrawalById');
      expect(callOrder[2]).toBe('findCustomerAccountForUpdate');
      expect(updateAcctSpy).not.toHaveBeenCalled();

      await expect(
        WithdrawalStation.updateWithdrawalPayment('with-lock-1', 'admin-1', {
          status: 'PAID',
          paymentReference: 'REF-1',
        })
      ).rejects.toThrow('Insufficient wallet or reserved balance');
      expect(updateAcctSpy).not.toHaveBeenCalled();

      await expect(
        WithdrawalStation.updateWithdrawalPayment('with-lock-1', 'admin-1', {
          status: 'FAILED',
        })
      ).rejects.toThrow('Insufficient reserved balance');
      expect(updateAcctSpy).not.toHaveBeenCalled();
    });
  });
});
