import { Prisma, WithdrawalRequestStatus, WalletTransactionType } from '@prisma/client';
import { WithdrawalRepo, ListWithdrawalRequestsFilters } from './withdrawal.repo';
import { prisma } from '../../config/prisma';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import logger from '../../config/logger';

export interface RequestWithdrawalInput {
  customerAccountId: string;
  amount: number;
  bankDetails?: Prisma.InputJsonValue;
  note?: string;
}

export interface UpdateWithdrawalPaymentInput {
  status: 'PROCESSING' | 'PAID' | 'FAILED';
  paymentReference?: string;
  note?: string;
}

const COOLDOWN_HOURS = 24;
const SLA_PAYMENT_HOURS = 72;

export const WithdrawalStation = {
  /**
   * Get wallet balance overview for a customer
   */
  async getWalletOverview(customerAccountId: string) {
    const account = await WithdrawalRepo.findCustomerAccountById(customerAccountId);
    if (!account) {
      throw new AppError('Customer account not found', httpStatus.NOT_FOUND);
    }

    const walletBalance = account.walletBalance ?? 0;
    const reservedBalance = account.reservedBalance ?? 0;
    const availableBalance = Math.max(0, walletBalance - reservedBalance);

    // Check 24-hour withdrawal eligibility
    const now = new Date();
    let canWithdraw = true;
    let nextAllowedWithdrawalAt: Date | null = null;

    if (account.lastWithdrawalRequestAt) {
      const cooldownEnd = new Date(account.lastWithdrawalRequestAt.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
      if (now < cooldownEnd) {
        canWithdraw = false;
        nextAllowedWithdrawalAt = cooldownEnd;
      }
    }

    return {
      walletBalance,
      reservedBalance,
      availableBalance,
      currency: 'IRR',
      canWithdraw,
      lastWithdrawalRequestAt: account.lastWithdrawalRequestAt,
      nextAllowedWithdrawalAt,
    };
  },

  /**
   * Customer submits a withdrawal request
   */
  async requestWithdrawal(input: RequestWithdrawalInput) {
    const { customerAccountId, amount, bankDetails, note } = input;

    if (!amount || typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
      throw new AppError('Withdrawal amount must be a positive integer', httpStatus.BAD_REQUEST);
    }

    return prisma.$transaction(async (tx) => {
      // 1. Lock customer account row to ensure atomic check & reservation
      const account = await WithdrawalRepo.findCustomerAccountForUpdate(customerAccountId, tx);
      if (!account) {
        throw new AppError('Customer account not found', httpStatus.NOT_FOUND);
      }

      // 2. Verify 24-hour rate limit
      const now = new Date();
      if (account.lastWithdrawalRequestAt) {
        const cooldownEnd = new Date(account.lastWithdrawalRequestAt.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
        if (now < cooldownEnd) {
          throw new AppError(
            `You can only submit one withdrawal request every ${COOLDOWN_HOURS} hours. Next allowed at: ${cooldownEnd.toISOString()}`,
            httpStatus.TOO_MANY_REQUESTS
          );
        }
      }

      // Also double check with any active requests in DB
      const lastRequest = await WithdrawalRepo.findLastWithdrawalRequest(customerAccountId, tx);
      if (lastRequest) {
        const lastCreatedCooldown = new Date(lastRequest.createdAt.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
        if (now < lastCreatedCooldown) {
          throw new AppError(
            `You can only submit one withdrawal request every ${COOLDOWN_HOURS} hours. Next allowed at: ${lastCreatedCooldown.toISOString()}`,
            httpStatus.TOO_MANY_REQUESTS
          );
        }
      }

      // 3. Verify available balance
      const currentReserved = account.reservedBalance ?? 0;
      const availableBalance = account.walletBalance - currentReserved;

      if (amount > availableBalance) {
        throw new AppError(
          `Insufficient available balance. Requested: ${amount}, Available: ${availableBalance}`,
          httpStatus.BAD_REQUEST
        );
      }

      // 4. Create withdrawal request
      const withdrawal = await WithdrawalRepo.createWithdrawalRequest(
        {
          customerAccountId,
          amount,
          currency: 'IRR',
          status: WithdrawalRequestStatus.PENDING,
          bankDetails: bankDetails as Prisma.InputJsonValue | undefined,
          note,
        },
        tx
      );

      // 5. Atomically reserve balance and update lastWithdrawalRequestAt
      await WithdrawalRepo.updateCustomerAccount(
        customerAccountId,
        {
          reservedBalance: { increment: amount },
          lastWithdrawalRequestAt: now,
        },
        tx
      );

      // 6. Record transaction history for withdrawal hold
      await WithdrawalRepo.createWalletTransaction(
        {
          customerAccountId,
          amount: -amount,
          currency: 'IRR',
          type: WalletTransactionType.WITHDRAWAL_HOLD,
          withdrawalRequestId: withdrawal.id,
          note: `رزرو موجودی جهت درخواست برداشت شماره ${withdrawal.id}`,
        },
        tx
      );

      // 7. Dispatch in-app notification to customer
      await WithdrawalRepo.createCustomerNotification(
        {
          customerAccountId,
          title: 'درخواست برداشت ثبت شد',
          message: `درخواست برداشت وجه به مبلغ ${amount.toLocaleString('fa-IR')} ریال با موفقیت ثبت شد و در انتظار بررسی مدیر است.`,
          type: 'WITHDRAWAL_SUBMITTED',
          metadata: { withdrawalId: withdrawal.id, amount },
        },
        tx
      );

      logger.info({
        msg: 'Customer created withdrawal request',
        withdrawalId: withdrawal.id,
        customerAccountId,
        amount,
      });

      return withdrawal;
    });
  },

  /**
   * Platform Admin approves a withdrawal request
   */
  async approveWithdrawal(withdrawalId: string, adminId: string, note?: string) {
    return prisma.$transaction(async (tx) => {
      const withdrawal = await WithdrawalRepo.findWithdrawalById(withdrawalId, tx);
      if (!withdrawal) {
        throw new AppError('Withdrawal request not found', httpStatus.NOT_FOUND);
      }

      if (withdrawal.status !== WithdrawalRequestStatus.PENDING) {
        throw new AppError(
          `Cannot approve withdrawal request in status ${withdrawal.status}. Expected PENDING.`,
          httpStatus.CONFLICT
        );
      }

      const now = new Date();
      const updated = await WithdrawalRepo.updateWithdrawalRequest(
        withdrawalId,
        {
          status: WithdrawalRequestStatus.APPROVED,
          approvedAt: now,
          reviewerAdmin: { connect: { id: adminId } },
          ...(note ? { note: withdrawal.note ? `${withdrawal.note}\n${note}` : note } : {}),
        },
        tx
      );

      await WithdrawalRepo.createCustomerNotification(
        {
          customerAccountId: withdrawal.customerAccountId,
          title: 'تأیید درخواست برداشت',
          message: `درخواست برداشت وجه به مبلغ ${withdrawal.amount.toLocaleString('fa-IR')} ریال توسط مدیر تأیید شد و وارد مرحله پرداخت گردید.`,
          type: 'WITHDRAWAL_APPROVED',
          metadata: { withdrawalId, amount: withdrawal.amount, approvedAt: now.toISOString() },
        },
        tx
      );

      logger.info({
        msg: 'Platform Admin approved withdrawal request',
        withdrawalId,
        adminId,
        amount: withdrawal.amount,
      });

      return updated;
    });
  },

  /**
   * Platform Admin rejects a withdrawal request
   */
  async rejectWithdrawal(withdrawalId: string, adminId: string, reason: string, note?: string) {
    if (!reason || reason.trim().length === 0) {
      throw new AppError('Rejection reason is required', httpStatus.BAD_REQUEST);
    }

    return prisma.$transaction(async (tx) => {
      const withdrawal = await WithdrawalRepo.findWithdrawalById(withdrawalId, tx);
      if (!withdrawal) {
        throw new AppError('Withdrawal request not found', httpStatus.NOT_FOUND);
      }

      if (
        withdrawal.status !== WithdrawalRequestStatus.PENDING &&
        withdrawal.status !== WithdrawalRequestStatus.APPROVED
      ) {
        throw new AppError(
          `Cannot reject withdrawal request in status ${withdrawal.status}. Only PENDING or APPROVED requests can be rejected.`,
          httpStatus.CONFLICT
        );
      }

      const now = new Date();

      // Release reserved balance back to customer
      await WithdrawalRepo.updateCustomerAccount(
        withdrawal.customerAccountId,
        {
          reservedBalance: { decrement: withdrawal.amount },
        },
        tx
      );

      // Record refund transaction in wallet history
      await WithdrawalRepo.createWalletTransaction(
        {
          customerAccountId: withdrawal.customerAccountId,
          amount: withdrawal.amount,
          currency: 'IRR',
          type: WalletTransactionType.WITHDRAWAL_REFUND,
          withdrawalRequestId: withdrawal.id,
          note: `بازگشت مبلغ برداشت ردشده شماره ${withdrawal.id}. علت: ${reason}`,
        },
        tx
      );

      const updated = await WithdrawalRepo.updateWithdrawalRequest(
        withdrawalId,
        {
          status: WithdrawalRequestStatus.REJECTED,
          rejectedAt: now,
          rejectionReason: reason.trim(),
          reviewerAdmin: { connect: { id: adminId } },
          ...(note ? { note: withdrawal.note ? `${withdrawal.note}\n${note}` : note } : {}),
        },
        tx
      );

      await WithdrawalRepo.createCustomerNotification(
        {
          customerAccountId: withdrawal.customerAccountId,
          title: 'رد درخواست برداشت',
          message: `درخواست برداشت وجه شما رد شد و مبلغ ${withdrawal.amount.toLocaleString('fa-IR')} ریال به موجودی قابل برداشت شما بازگردانده شد. دلیل: ${reason.trim()}`,
          type: 'WITHDRAWAL_REJECTED',
          metadata: { withdrawalId, amount: withdrawal.amount, reason: reason.trim() },
        },
        tx
      );

      logger.info({
        msg: 'Platform Admin rejected withdrawal request',
        withdrawalId,
        adminId,
        reason,
        amount: withdrawal.amount,
      });

      return updated;
    });
  },

  /**
   * Platform Admin updates withdrawal payment status (PROCESSING, PAID, FAILED)
   */
  async updateWithdrawalPayment(
    withdrawalId: string,
    adminId: string,
    input: UpdateWithdrawalPaymentInput
  ) {
    const { status, paymentReference, note } = input;

    return prisma.$transaction(async (tx) => {
      const withdrawal = await WithdrawalRepo.findWithdrawalById(withdrawalId, tx);
      if (!withdrawal) {
        throw new AppError('Withdrawal request not found', httpStatus.NOT_FOUND);
      }

      const now = new Date();

      if (status === 'PROCESSING') {
        if (
          withdrawal.status !== WithdrawalRequestStatus.APPROVED &&
          withdrawal.status !== WithdrawalRequestStatus.PENDING
        ) {
          throw new AppError(
            `Cannot set status to PROCESSING from ${withdrawal.status}. Expected APPROVED or PENDING.`,
            httpStatus.CONFLICT
          );
        }

        const updated = await WithdrawalRepo.updateWithdrawalRequest(
          withdrawalId,
          {
            status: WithdrawalRequestStatus.PROCESSING,
            processedAt: now,
            paymentReference: paymentReference || withdrawal.paymentReference,
            ...(note ? { note: withdrawal.note ? `${withdrawal.note}\n${note}` : note } : {}),
          },
          tx
        );

        await WithdrawalRepo.createCustomerNotification(
          {
            customerAccountId: withdrawal.customerAccountId,
            title: 'پرداخت در حال انجام است',
            message: `فرایند واریز مبلغ ${withdrawal.amount.toLocaleString('fa-IR')} ریال در حال انجام است.`,
            type: 'WITHDRAWAL_PROCESSING',
            metadata: { withdrawalId, amount: withdrawal.amount },
          },
          tx
        );

        return updated;
      }

      if (status === 'PAID') {
        if (
          withdrawal.status !== WithdrawalRequestStatus.APPROVED &&
          withdrawal.status !== WithdrawalRequestStatus.PROCESSING
        ) {
          throw new AppError(
            `Cannot complete payment for withdrawal in status ${withdrawal.status}. Expected APPROVED or PROCESSING.`,
            httpStatus.CONFLICT
          );
        }

        // Lock customer account
        await WithdrawalRepo.findCustomerAccountForUpdate(withdrawal.customerAccountId, tx);

        // Deduct from reservedBalance AND deduct from walletBalance
        await WithdrawalRepo.updateCustomerAccount(
          withdrawal.customerAccountId,
          {
            reservedBalance: { decrement: withdrawal.amount },
            walletBalance: { decrement: withdrawal.amount },
          },
          tx
        );

        // Record successful payout transaction in wallet history
        await WithdrawalRepo.createWalletTransaction(
          {
            customerAccountId: withdrawal.customerAccountId,
            amount: -withdrawal.amount,
            currency: 'IRR',
            type: WalletTransactionType.WITHDRAWAL_PAID,
            withdrawalRequestId: withdrawal.id,
            note: `واریز موفق مبلغ برداشت شماره ${withdrawal.id}. شناسه پیگیری: ${paymentReference || 'ثبت‌نشده'}`,
          },
          tx
        );

        const updated = await WithdrawalRepo.updateWithdrawalRequest(
          withdrawalId,
          {
            status: WithdrawalRequestStatus.PAID,
            paidAt: now,
            paymentReference: paymentReference || withdrawal.paymentReference,
            reviewerAdmin: { connect: { id: adminId } },
            ...(note ? { note: withdrawal.note ? `${withdrawal.note}\n${note}` : note } : {}),
          },
          tx
        );

        await WithdrawalRepo.createCustomerNotification(
          {
            customerAccountId: withdrawal.customerAccountId,
            title: 'پرداخت با موفقیت انجام شد',
            message: `مبلغ ${withdrawal.amount.toLocaleString('fa-IR')} ریال با موفقیت به حساب شما واریز گردید. شناسه پیگیری: ${paymentReference || 'ثبت‌نشده'}`,
            type: 'WITHDRAWAL_PAID',
            metadata: { withdrawalId, amount: withdrawal.amount, paymentReference },
          },
          tx
        );

        logger.info({
          msg: 'Withdrawal marked as PAID',
          withdrawalId,
          adminId,
          paymentReference,
          amount: withdrawal.amount,
        });

        return updated;
      }

      if (status === 'FAILED') {
        if (
          withdrawal.status !== WithdrawalRequestStatus.APPROVED &&
          withdrawal.status !== WithdrawalRequestStatus.PROCESSING
        ) {
          throw new AppError(
            `Cannot mark payment as FAILED for withdrawal in status ${withdrawal.status}. Expected APPROVED or PROCESSING.`,
            httpStatus.CONFLICT
          );
        }

        // Release reserved balance back to available balance
        await WithdrawalRepo.updateCustomerAccount(
          withdrawal.customerAccountId,
          {
            reservedBalance: { decrement: withdrawal.amount },
          },
          tx
        );

        // Record refund transaction
        await WithdrawalRepo.createWalletTransaction(
          {
            customerAccountId: withdrawal.customerAccountId,
            amount: withdrawal.amount,
            currency: 'IRR',
            type: WalletTransactionType.WITHDRAWAL_REFUND,
            withdrawalRequestId: withdrawal.id,
            note: `بازگشت وجه به علت خطای واریز برای درخواست برداشت شماره ${withdrawal.id}`,
          },
          tx
        );

        const updated = await WithdrawalRepo.updateWithdrawalRequest(
          withdrawalId,
          {
            status: WithdrawalRequestStatus.FAILED,
            reviewerAdmin: { connect: { id: adminId } },
            paymentReference: paymentReference || withdrawal.paymentReference,
            ...(note ? { note: withdrawal.note ? `${withdrawal.note}\n${note}` : note } : {}),
          },
          tx
        );

        await WithdrawalRepo.createCustomerNotification(
          {
            customerAccountId: withdrawal.customerAccountId,
            title: 'پرداخت ناموفق بود',
            message: `پرداخت مبلغ ${withdrawal.amount.toLocaleString('fa-IR')} ریال ناموفق بود و مبلغ به موجودی قابل برداشت شما بازگردانده شد.`,
            type: 'WITHDRAWAL_FAILED',
            metadata: { withdrawalId, amount: withdrawal.amount },
          },
          tx
        );

        logger.warn({
          msg: 'Withdrawal marked as FAILED',
          withdrawalId,
          adminId,
          amount: withdrawal.amount,
        });

        return updated;
      }

      throw new AppError(`Unsupported payment status update: ${status}`, httpStatus.BAD_REQUEST);
    });
  },

  /**
   * Get single withdrawal request details
   */
  async getWithdrawalDetails(id: string, customerAccountId?: string) {
    const withdrawal = await WithdrawalRepo.findWithdrawalById(id);
    if (!withdrawal) {
      throw new AppError('Withdrawal request not found', httpStatus.NOT_FOUND);
    }

    if (customerAccountId && withdrawal.customerAccountId !== customerAccountId) {
      throw new AppError('Access denied: You do not own this withdrawal request', httpStatus.FORBIDDEN);
    }

    return withdrawal;
  },

  /**
   * List withdrawals for a customer
   */
  async listCustomerWithdrawals(
    customerAccountId: string,
    query: { page?: number; pageSize?: number; status?: WithdrawalRequestStatus }
  ) {
    const { page = 1, pageSize = 20, status } = query;
    const skip = (page - 1) * pageSize;

    const { items, total } = await WithdrawalRepo.listWithdrawals({
      customerAccountId,
      status,
      skip,
      take: pageSize,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    return {
      data: items,
      meta: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * List withdrawals for Platform Admin
   */
  async listAllWithdrawals(query: ListWithdrawalRequestsFilters & { page?: number; pageSize?: number }) {
    const {
      page = 1,
      pageSize = 20,
      customerAccountId,
      status,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * pageSize;

    const { items, total } = await WithdrawalRepo.listWithdrawals({
      customerAccountId,
      status,
      search,
      startDate,
      endDate,
      skip,
      take: pageSize,
      sortBy,
      sortOrder,
    });

    return {
      data: items,
      meta: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Find approved withdrawals exceeding the 72h SLA
   */
  async getOverdueWithdrawals() {
    const cutoff = new Date(Date.now() - SLA_PAYMENT_HOURS * 60 * 60 * 1000);
    const items = await WithdrawalRepo.findOverdueApprovedWithdrawals(cutoff);

    return {
      data: items.map((w) => ({
        ...w,
        hoursOverdue: Math.floor((Date.now() - (w.approvedAt?.getTime() ?? 0)) / (1000 * 60 * 60)) - SLA_PAYMENT_HOURS,
      })),
      meta: {
        totalItems: items.length,
        slaHours: SLA_PAYMENT_HOURS,
        cutoffDate: cutoff.toISOString(),
      },
    };
  },

  /**
   * List wallet transactions for customer
   */
  async listCustomerTransactions(
    customerAccountId: string,
    query: { page?: number; pageSize?: number; type?: WalletTransactionType }
  ) {
    const { page = 1, pageSize = 20, type } = query;
    const skip = (page - 1) * pageSize;

    const { items, total } = await WithdrawalRepo.listCustomerTransactions({
      customerAccountId,
      type,
      skip,
      take: pageSize,
    });

    return {
      data: items,
      meta: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Get single transaction for customer
   */
  async getCustomerTransaction(id: string, customerAccountId: string) {
    const tx = await WithdrawalRepo.findTransactionById(id, customerAccountId);
    if (!tx) {
      throw new AppError('Transaction not found or access denied', httpStatus.NOT_FOUND);
    }
    return tx;
  },

  /**
   * List customer in-app notifications
   */
  async listCustomerNotifications(customerAccountId: string, query: { page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20 } = query;
    const skip = (page - 1) * pageSize;

    const { items, total, unreadCount } = await WithdrawalRepo.listCustomerNotifications(
      customerAccountId,
      { skip, take: pageSize }
    );

    return {
      data: items,
      unreadCount,
      meta: {
        page,
        pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Mark customer in-app notification as read
   */
  async markNotificationRead(id: string, customerAccountId: string) {
    await WithdrawalRepo.markNotificationAsRead(id, customerAccountId);
    return { success: true };
  },
};
