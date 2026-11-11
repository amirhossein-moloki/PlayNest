/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { WithdrawalStation } from '../../../../src/modules/wallet/withdrawal.station';
import { WithdrawalRepo } from '../../../../src/modules/wallet/withdrawal.repo';
import { WithdrawalRequestStatus, WalletTransactionType } from '@prisma/client';
import AppError from '../../../../src/common/errors/AppError';

jest.mock('../../../../src/modules/wallet/withdrawal.repo');
jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    $transaction: jest.fn(async (cb: any) => cb({
      $executeRaw: jest.fn(),
      customerAccount: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      withdrawalRequest: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      walletTransaction: {
        create: jest.fn(),
      },
      customerNotification: {
        create: jest.fn(),
      },
    })),
  },
}));

describe('WithdrawalStation Core Unit Tests', () => {
  const MockedWithdrawalRepo = WithdrawalRepo as jest.Mocked<typeof WithdrawalRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Wallet Overview & Balance Calculation', () => {
    it('should correctly compute availableBalance as walletBalance minus reservedBalance', async () => {
      MockedWithdrawalRepo.findCustomerAccountById.mockResolvedValue({
        id: 'cust-1',
        walletBalance: 500000,
        reservedBalance: 150000,
        lastWithdrawalRequestAt: null,
      } as any);

      const overview = await WithdrawalStation.getWalletOverview('cust-1');

      expect(overview.walletBalance).toBe(500000);
      expect(overview.reservedBalance).toBe(150000);
      expect(overview.availableBalance).toBe(350000);
      expect(overview.canWithdraw).toBe(true);
      expect(overview.nextAllowedWithdrawalAt).toBeNull();
    });

    it('should disallow withdrawal when 24h cooldown is active', async () => {
      const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      MockedWithdrawalRepo.findCustomerAccountById.mockResolvedValue({
        id: 'cust-1',
        walletBalance: 500000,
        reservedBalance: 0,
        lastWithdrawalRequestAt: recentDate,
      } as any);

      const overview = await WithdrawalStation.getWalletOverview('cust-1');

      expect(overview.canWithdraw).toBe(false);
      expect(overview.nextAllowedWithdrawalAt).toBeInstanceOf(Date);
    });
  });

  describe('Withdrawal Request Submission', () => {
    it('should throw BAD_REQUEST for zero or negative amount', async () => {
      await expect(
        WithdrawalStation.requestWithdrawal({
          customerAccountId: 'cust-1',
          amount: 0,
        })
      ).rejects.toThrow(AppError);

      await expect(
        WithdrawalStation.requestWithdrawal({
          customerAccountId: 'cust-1',
          amount: -50000,
        })
      ).rejects.toThrow(AppError);
    });

    it('should throw TOO_MANY_REQUESTS if a request was submitted within the last 24 hours', async () => {
      const recentDate = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5 hours ago
      MockedWithdrawalRepo.findCustomerAccountForUpdate.mockResolvedValue({
        id: 'cust-1',
        walletBalance: 500000,
        reservedBalance: 0,
        lastWithdrawalRequestAt: recentDate,
      } as any);

      await expect(
        WithdrawalStation.requestWithdrawal({
          customerAccountId: 'cust-1',
          amount: 100000,
        })
      ).rejects.toThrow('24 hours');
    });

    it('should throw BAD_REQUEST if requested amount exceeds available balance', async () => {
      MockedWithdrawalRepo.findCustomerAccountForUpdate.mockResolvedValue({
        id: 'cust-1',
        walletBalance: 200000,
        reservedBalance: 150000, // available is only 50000
        lastWithdrawalRequestAt: null,
      } as any);
      MockedWithdrawalRepo.findLastWithdrawalRequest.mockResolvedValue(null);

      await expect(
        WithdrawalStation.requestWithdrawal({
          customerAccountId: 'cust-1',
          amount: 100000,
        })
      ).rejects.toThrow('Insufficient available balance');
    });

    it('should successfully reserve balance and create withdrawal request and notification', async () => {
      MockedWithdrawalRepo.findCustomerAccountForUpdate.mockResolvedValue({
        id: 'cust-1',
        walletBalance: 500000,
        reservedBalance: 0,
        lastWithdrawalRequestAt: null,
      } as any);
      MockedWithdrawalRepo.findLastWithdrawalRequest.mockResolvedValue(null);

      MockedWithdrawalRepo.createWithdrawalRequest.mockResolvedValue({
        id: 'with-1',
        customerAccountId: 'cust-1',
        amount: 200000,
        status: WithdrawalRequestStatus.PENDING,
      } as any);

      const result = await WithdrawalStation.requestWithdrawal({
        customerAccountId: 'cust-1',
        amount: 200000,
        bankDetails: { sheba: 'IR12345' },
      });

      expect(result.id).toBe('with-1');
      expect(MockedWithdrawalRepo.updateCustomerAccount).toHaveBeenCalledWith(
        'cust-1',
        expect.objectContaining({
          reservedBalance: { increment: 200000 },
        }),
        expect.anything()
      );
      expect(MockedWithdrawalRepo.createWalletTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          customerAccountId: 'cust-1',
          amount: -200000,
          type: WalletTransactionType.WITHDRAWAL_HOLD,
          withdrawalRequestId: 'with-1',
        }),
        expect.anything()
      );
      expect(MockedWithdrawalRepo.createCustomerNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          customerAccountId: 'cust-1',
          type: 'WITHDRAWAL_SUBMITTED',
        }),
        expect.anything()
      );
    });
  });

  describe('Approval Workflow', () => {
    it('should approve a PENDING withdrawal request', async () => {
      MockedWithdrawalRepo.findWithdrawalById.mockResolvedValue({
        id: 'with-1',
        customerAccountId: 'cust-1',
        amount: 200000,
        status: WithdrawalRequestStatus.PENDING,
      } as any);

      MockedWithdrawalRepo.updateWithdrawalRequest.mockResolvedValue({
        id: 'with-1',
        status: WithdrawalRequestStatus.APPROVED,
      } as any);

      const result = await WithdrawalStation.approveWithdrawal('with-1', 'admin-1');

      expect(result.status).toBe(WithdrawalRequestStatus.APPROVED);
      expect(MockedWithdrawalRepo.updateWithdrawalRequest).toHaveBeenCalledWith(
        'with-1',
        expect.objectContaining({
          status: WithdrawalRequestStatus.APPROVED,
          reviewerAdmin: { connect: { id: 'admin-1' } },
        }),
        expect.anything()
      );
      expect(MockedWithdrawalRepo.createCustomerNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          customerAccountId: 'cust-1',
          type: 'WITHDRAWAL_APPROVED',
        }),
        expect.anything()
      );
    });

    it('should reject approval if request is not PENDING (prevent duplicate approval)', async () => {
      MockedWithdrawalRepo.findWithdrawalById.mockResolvedValue({
        id: 'with-1',
        customerAccountId: 'cust-1',
        amount: 200000,
        status: WithdrawalRequestStatus.APPROVED,
      } as any);

      await expect(WithdrawalStation.approveWithdrawal('with-1', 'admin-1')).rejects.toThrow(
        'Cannot approve withdrawal request in status APPROVED'
      );
    });
  });

  describe('Rejection Workflow & Balance Release', () => {
    it('should release reserved balance and record WITHDRAWAL_REFUND transaction on rejection', async () => {
      MockedWithdrawalRepo.findWithdrawalById.mockResolvedValue({
        id: 'with-1',
        customerAccountId: 'cust-1',
        amount: 200000,
        status: WithdrawalRequestStatus.PENDING,
      } as any);

      MockedWithdrawalRepo.updateWithdrawalRequest.mockResolvedValue({
        id: 'with-1',
        status: WithdrawalRequestStatus.REJECTED,
      } as any);

      const result = await WithdrawalStation.rejectWithdrawal('with-1', 'admin-1', 'نامعتبر بودن شبا');

      expect(result.status).toBe(WithdrawalRequestStatus.REJECTED);
      expect(MockedWithdrawalRepo.updateCustomerAccount).toHaveBeenCalledWith(
        'cust-1',
        expect.objectContaining({
          reservedBalance: { decrement: 200000 },
        }),
        expect.anything()
      );
      expect(MockedWithdrawalRepo.createWalletTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          customerAccountId: 'cust-1',
          amount: 200000,
          type: WalletTransactionType.WITHDRAWAL_REFUND,
          withdrawalRequestId: 'with-1',
        }),
        expect.anything()
      );
      expect(MockedWithdrawalRepo.createCustomerNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          customerAccountId: 'cust-1',
          type: 'WITHDRAWAL_REJECTED',
        }),
        expect.anything()
      );
    });

    it('should require a rejection reason', async () => {
      await expect(
        WithdrawalStation.rejectWithdrawal('with-1', 'admin-1', '')
      ).rejects.toThrow('Rejection reason is required');
    });

    it('should prevent rejecting an already terminal request (PAID or REJECTED)', async () => {
      MockedWithdrawalRepo.findWithdrawalById.mockResolvedValue({
        id: 'with-1',
        customerAccountId: 'cust-1',
        amount: 200000,
        status: WithdrawalRequestStatus.PAID,
      } as any);

      await expect(
        WithdrawalStation.rejectWithdrawal('with-1', 'admin-1', 'Reason')
      ).rejects.toThrow('Cannot reject withdrawal request in status PAID');
    });
  });

  describe('Payment Execution Workflow', () => {
    it('should transition to PAID and deduct both walletBalance and reservedBalance', async () => {
      MockedWithdrawalRepo.findWithdrawalById.mockResolvedValue({
        id: 'with-1',
        customerAccountId: 'cust-1',
        amount: 200000,
        status: WithdrawalRequestStatus.APPROVED,
      } as any);
      MockedWithdrawalRepo.findCustomerAccountForUpdate.mockResolvedValue({
        id: 'cust-1',
        walletBalance: 500000,
        reservedBalance: 200000,
      } as any);

      MockedWithdrawalRepo.updateWithdrawalRequest.mockResolvedValue({
        id: 'with-1',
        status: WithdrawalRequestStatus.PAID,
      } as any);

      const result = await WithdrawalStation.updateWithdrawalPayment('with-1', 'admin-1', {
        status: 'PAID',
        paymentReference: 'PAY-123456',
      });

      expect(result.status).toBe(WithdrawalRequestStatus.PAID);
      expect(MockedWithdrawalRepo.updateCustomerAccount).toHaveBeenCalledWith(
        'cust-1',
        expect.objectContaining({
          reservedBalance: { decrement: 200000 },
          walletBalance: { decrement: 200000 },
        }),
        expect.anything()
      );
      expect(MockedWithdrawalRepo.createWalletTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          customerAccountId: 'cust-1',
          amount: -200000,
          type: WalletTransactionType.WITHDRAWAL_PAID,
          withdrawalRequestId: 'with-1',
        }),
        expect.anything()
      );
    });

    it('should release reserved balance on FAILED payment and record WITHDRAWAL_REFUND', async () => {
      MockedWithdrawalRepo.findWithdrawalById.mockResolvedValue({
        id: 'with-1',
        customerAccountId: 'cust-1',
        amount: 200000,
        status: WithdrawalRequestStatus.PROCESSING,
      } as any);

      MockedWithdrawalRepo.updateWithdrawalRequest.mockResolvedValue({
        id: 'with-1',
        status: WithdrawalRequestStatus.FAILED,
      } as any);

      const result = await WithdrawalStation.updateWithdrawalPayment('with-1', 'admin-1', {
        status: 'FAILED',
        note: 'خطای انتقال پایا',
      });

      expect(result.status).toBe(WithdrawalRequestStatus.FAILED);
      expect(MockedWithdrawalRepo.updateCustomerAccount).toHaveBeenCalledWith(
        'cust-1',
        expect.objectContaining({
          reservedBalance: { decrement: 200000 },
        }),
        expect.anything()
      );
      expect(MockedWithdrawalRepo.createWalletTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          customerAccountId: 'cust-1',
          amount: 200000,
          type: WalletTransactionType.WITHDRAWAL_REFUND,
          withdrawalRequestId: 'with-1',
        }),
        expect.anything()
      );
    });
  });

  describe('Security & Isolation', () => {
    it('should forbid customer from viewing another customer withdrawal request', async () => {
      MockedWithdrawalRepo.findWithdrawalById.mockResolvedValue({
        id: 'with-1',
        customerAccountId: 'cust-other',
        amount: 200000,
      } as any);

      await expect(
        WithdrawalStation.getWithdrawalDetails('with-1', 'cust-current')
      ).rejects.toThrow('Access denied: You do not own this withdrawal request');
    });
  });

  describe('72-Hour Overdue SLA Tracking', () => {
    it('should calculate overdue hours for approved requests older than 72 hours', async () => {
      const ninetyHoursAgo = new Date(Date.now() - 90 * 60 * 60 * 1000);
      MockedWithdrawalRepo.findOverdueApprovedWithdrawals.mockResolvedValue([
        {
          id: 'with-overdue-1',
          customerAccountId: 'cust-1',
          amount: 300000,
          status: WithdrawalRequestStatus.APPROVED,
          approvedAt: ninetyHoursAgo,
        } as any,
      ]);

      const overdue = await WithdrawalStation.getOverdueWithdrawals();

      expect(overdue.data).toHaveLength(1);
      expect(overdue.data[0].hoursOverdue).toBeGreaterThanOrEqual(17);
      expect(overdue.meta.slaHours).toBe(72);
    });
  });
});
