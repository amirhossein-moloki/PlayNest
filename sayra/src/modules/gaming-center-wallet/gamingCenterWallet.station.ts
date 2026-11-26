import {
  GamingCenterWalletTransactionType,
  Prisma,
  SessionActorType,
  WithdrawalRequestStatus,
} from '@prisma/client';
import httpStatus from 'http-status';
import AppError from '../../common/errors/AppError';
import logger from '../../config/logger';
import { prisma } from '../../config/prisma';
import { auditService } from '../audit/audit.station';
import {
  GamingCenterWalletRepo,
  ListGamingCenterWithdrawalsFilters,
} from './gamingCenterWallet.repo';

const COOLDOWN_HOURS = 24;
const SLA_PAYMENT_HOURS = 72;

export interface CreditReservationSettlementInput {
  gamingCenterId: string;
  reservationId: string;
  earningId?: string | null;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  currency?: string;
  note?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface RequestGamingCenterWithdrawalInput {
  gamingCenterId: string;
  amount: number;
  bankDetails?: Prisma.InputJsonValue;
  note?: string;
}

export interface UpdateGamingCenterWithdrawalPaymentInput {
  status: 'PROCESSING' | 'PAID' | 'FAILED';
  paymentReference?: string;
  note?: string;
}

export const gamingCenterWalletStation = {
  /**
   * Idempotently credit net reservation settlement to a gaming center wallet
   * after one-time completion commission deduction.
   */
  async creditReservationSettlement(
    input: CreditReservationSettlementInput,
    tx: Prisma.TransactionClient
  ) {
    if (
      !tx?.gamingCenterWalletTransaction?.findUnique ||
      !tx?.gamingCenterWalletTransaction?.create
    ) {
      return null;
    }

    const idempotencyKey = `reservation_settlement:${input.reservationId}`;

    // Lock the gaming center row when available to prevent concurrent double-credits
    await GamingCenterWalletRepo.findGamingCenterForUpdate(input.gamingCenterId, tx);

    const existing = await GamingCenterWalletRepo.findTransactionByIdempotencyKey(
      idempotencyKey,
      tx
    );
    if (existing) {
      return { credited: false, transaction: existing };
    }

    const grossAmount = Math.max(0, Math.round(input.grossAmount));
    const commissionAmount = Math.max(0, Math.round(input.commissionAmount));
    const netAmount = Math.max(0, Math.round(input.netAmount));
    const currency = input.currency || 'IRR';

    if (netAmount > 0 && typeof tx.gamingCenter?.update === 'function') {
      await GamingCenterWalletRepo.updateGamingCenterWallet(
        input.gamingCenterId,
        {
          walletBalance: { increment: netAmount },
        },
        tx
      );
    }

    const transaction = await GamingCenterWalletRepo.createWalletTransaction(
      {
        gamingCenterId: input.gamingCenterId,
        grossAmount,
        commissionAmount,
        amount: netAmount,
        currency,
        type: GamingCenterWalletTransactionType.RESERVATION_SETTLEMENT,
        reservationId: input.reservationId,
        earningId: input.earningId ?? null,
        idempotencyKey,
        note:
          input.note ||
          `تسویه رزرو ${input.reservationId} پس از کسر کمیسیون`,
        metadata: input.metadata,
      },
      tx
    );

    return { credited: true, transaction };
  },

  /**
   * Idempotently reverse a previously settled reservation credit on refund/cancellation.
   */
  async reverseReservationSettlement(
    reservationId: string,
    reason: string | undefined,
    tx: Prisma.TransactionClient
  ) {
    if (
      !tx?.gamingCenterWalletTransaction?.findUnique ||
      !tx?.gamingCenterWalletTransaction?.create
    ) {
      return null;
    }

    const settlementKey = `reservation_settlement:${reservationId}`;
    const reversalKey = `reservation_settlement_reversal:${reservationId}`;

    const settlementTx = await GamingCenterWalletRepo.findTransactionByIdempotencyKey(
      settlementKey,
      tx
    );
    if (!settlementTx || settlementTx.amount <= 0) {
      return null;
    }

    const existingReversal = await GamingCenterWalletRepo.findTransactionByIdempotencyKey(
      reversalKey,
      tx
    );
    if (existingReversal) {
      return existingReversal;
    }

    const gc = await GamingCenterWalletRepo.findGamingCenterForUpdate(
      settlementTx.gamingCenterId,
      tx
    );

    const available = Math.max(0, (gc?.walletBalance ?? 0) - (gc?.reservedBalance ?? 0));
    const deductible = Math.min(available, settlementTx.amount);
    const shortfall = settlementTx.amount - deductible;

    if (deductible > 0 && typeof tx.gamingCenter?.update === 'function') {
      await GamingCenterWalletRepo.updateGamingCenterWallet(
        settlementTx.gamingCenterId,
        {
          walletBalance: { decrement: deductible },
        },
        tx
      );
    }

    if (shortfall > 0) {
      logger.error(
        {
          reservationId,
          gamingCenterId: settlementTx.gamingCenterId,
          shortfall,
          requestedReversal: settlementTx.amount,
          deductedAmount: deductible,
        },
        'Gaming center settlement reversal shortfall requires manual recovery'
      );
    }

    return GamingCenterWalletRepo.createWalletTransaction(
      {
        gamingCenterId: settlementTx.gamingCenterId,
        grossAmount: -settlementTx.grossAmount,
        commissionAmount: -settlementTx.commissionAmount,
        amount: -deductible,
        currency: settlementTx.currency || 'IRR',
        type: GamingCenterWalletTransactionType.SETTLEMENT_REVERSAL,
        reservationId,
        earningId: settlementTx.earningId,
        idempotencyKey: reversalKey,
        note: reason || `برگشت تسویه رزرو ${reservationId}`,
        metadata: {
          requestedReversal: settlementTx.amount,
          deductedAmount: deductible,
          shortfallAmount: shortfall,
          requiresManualRecovery: shortfall > 0,
        },
      },
      tx
    );
  },

  /**
   * Get final withdrawable net wallet overview for a gaming center.
   */
  async getWalletOverview(gamingCenterId: string) {
    const gc = await GamingCenterWalletRepo.findGamingCenterById(gamingCenterId);
    if (!gc) {
      throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
    }

    const walletBalance = gc.walletBalance ?? 0;
    const reservedBalance = gc.reservedBalance ?? 0;
    const availableBalance = Math.max(0, walletBalance - reservedBalance);

    const now = new Date();
    let canWithdraw = true;
    let nextAllowedWithdrawalAt: Date | null = null;

    if (gc.lastWithdrawalRequestAt) {
      const cooldownEnd = new Date(
        gc.lastWithdrawalRequestAt.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000
      );
      if (now < cooldownEnd) {
        canWithdraw = false;
        nextAllowedWithdrawalAt = cooldownEnd;
      }
    }

    const summary = await GamingCenterWalletRepo.getWalletSummaryAggregates(gamingCenterId);

    return {
      gamingCenterId: gc.id,
      walletBalance,
      reservedBalance,
      availableBalance,
      currency: 'IRR',
      commissionDeductedAt: 'RESERVATION_COMPLETION',
      withdrawalCommissionRate: 0,
      canWithdraw,
      lastWithdrawalRequestAt: gc.lastWithdrawalRequestAt ?? null,
      nextAllowedWithdrawalAt,
      summary,
    };
  },

  /**
   * Manager requests a withdrawal up to 100% of availableBalance with 0% commission.
   */
  async requestWithdrawal(
    input: RequestGamingCenterWithdrawalInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const { gamingCenterId, amount, bankDetails, note } = input;

    if (!amount || typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
      throw new AppError('Withdrawal amount must be a positive integer', httpStatus.BAD_REQUEST);
    }

    const withdrawal = await prisma.$transaction(async (tx) => {
      const gc = await GamingCenterWalletRepo.findGamingCenterForUpdate(gamingCenterId, tx);
      if (!gc) {
        throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
      }

      const now = new Date();
      if (gc.lastWithdrawalRequestAt) {
        const cooldownEnd = new Date(
          gc.lastWithdrawalRequestAt.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000
        );
        if (now < cooldownEnd) {
          throw new AppError(
            `You can only submit one withdrawal request every ${COOLDOWN_HOURS} hours. Next allowed at: ${cooldownEnd.toISOString()}`,
            httpStatus.TOO_MANY_REQUESTS
          );
        }
      }

      const lastActiveRequest = await GamingCenterWalletRepo.findLastActiveWithdrawalRequest(
        gamingCenterId,
        tx
      );
      if (lastActiveRequest) {
        const lastCreatedCooldown = new Date(
          lastActiveRequest.createdAt.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000
        );
        if (now < lastCreatedCooldown) {
          throw new AppError(
            `You can only submit one withdrawal request every ${COOLDOWN_HOURS} hours. Next allowed at: ${lastCreatedCooldown.toISOString()}`,
            httpStatus.TOO_MANY_REQUESTS
          );
        }
      }

      const currentReserved = gc.reservedBalance ?? 0;
      const availableBalance = (gc.walletBalance ?? 0) - currentReserved;

      if (amount > availableBalance) {
        throw new AppError(
          `Insufficient available balance. Requested: ${amount}, Available: ${availableBalance}`,
          httpStatus.BAD_REQUEST
        );
      }

      const createdWithdrawal = await GamingCenterWalletRepo.createWithdrawalRequest(
        {
          gamingCenterId,
          requestedByUserId: actor.actorType === SessionActorType.USER ? actor.id : null,
          amount,
          currency: 'IRR',
          status: WithdrawalRequestStatus.PENDING,
          bankDetails: bankDetails as Prisma.InputJsonValue | undefined,
          note,
        },
        tx
      );

      await GamingCenterWalletRepo.updateGamingCenterWallet(
        gamingCenterId,
        {
          reservedBalance: { increment: amount },
          lastWithdrawalRequestAt: now,
        },
        tx
      );

      await GamingCenterWalletRepo.createWalletTransaction(
        {
          gamingCenterId,
          grossAmount: 0,
          commissionAmount: 0,
          amount: -amount,
          currency: 'IRR',
          type: GamingCenterWalletTransactionType.WITHDRAWAL_HOLD,
          withdrawalRequestId: createdWithdrawal.id,
          idempotencyKey: `withdrawal_hold:${createdWithdrawal.id}`,
          note: `رزرو موجودی جهت درخواست برداشت شماره ${createdWithdrawal.id}`,
        },
        tx
      );

      return createdWithdrawal;
    });

    await auditService.log(
      gamingCenterId,
      actor,
      'GAMING_CENTER_WITHDRAWAL_REQUESTED',
      { name: 'GamingCenterWithdrawalRequest', id: withdrawal.id },
      { old: null, new: withdrawal },
      context
    );

    logger.info({
      msg: 'Gaming center requested withdrawal',
      withdrawalId: withdrawal.id,
      gamingCenterId,
      amount,
      actorId: actor.id,
    });

    return withdrawal;
  },

  async listGamingCenterWithdrawals(
    gamingCenterId: string,
    query: { page?: number; pageSize?: number; status?: WithdrawalRequestStatus }
  ) {
    const { page = 1, pageSize = 20, status } = query;
    const skip = (page - 1) * pageSize;

    const { items, total } = await GamingCenterWalletRepo.listWithdrawals({
      gamingCenterId,
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

  async getWithdrawalDetails(withdrawalId: string, gamingCenterId?: string) {
    const withdrawal = await GamingCenterWalletRepo.findWithdrawalById(
      withdrawalId,
      gamingCenterId
    );
    if (!withdrawal || (gamingCenterId && withdrawal.gamingCenterId !== gamingCenterId)) {
      throw new AppError('Withdrawal request not found', httpStatus.NOT_FOUND);
    }

    return withdrawal;
  },

  async listGamingCenterTransactions(
    gamingCenterId: string,
    query: { page?: number; pageSize?: number; type?: GamingCenterWalletTransactionType }
  ) {
    const { page = 1, pageSize = 20, type } = query;
    const skip = (page - 1) * pageSize;

    const { items, total } = await GamingCenterWalletRepo.listTransactions({
      gamingCenterId,
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

  async getGamingCenterTransaction(transactionId: string, gamingCenterId: string) {
    const tx = await GamingCenterWalletRepo.findTransactionById(transactionId, gamingCenterId);
    if (!tx || tx.gamingCenterId !== gamingCenterId) {
      throw new AppError('Transaction not found or access denied', httpStatus.NOT_FOUND);
    }
    return tx;
  },

  async listAllWithdrawals(
    query: ListGamingCenterWithdrawalsFilters & { page?: number; pageSize?: number }
  ) {
    const {
      page = 1,
      pageSize = 20,
      gamingCenterId,
      status,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * pageSize;

    const { items, total } = await GamingCenterWalletRepo.listWithdrawals({
      gamingCenterId,
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

  async getOverdueWithdrawals() {
    const cutoff = new Date(Date.now() - SLA_PAYMENT_HOURS * 60 * 60 * 1000);
    const items = await GamingCenterWalletRepo.findOverdueApprovedWithdrawals(cutoff);

    return {
      data: items.map((w) => ({
        ...w,
        hoursOverdue:
          Math.floor((Date.now() - (w.approvedAt?.getTime() ?? 0)) / (1000 * 60 * 60)) -
          SLA_PAYMENT_HOURS,
      })),
      meta: {
        totalItems: items.length,
        slaHours: SLA_PAYMENT_HOURS,
        cutoffDate: cutoff.toISOString(),
      },
    };
  },

  async approveWithdrawal(withdrawalId: string, adminId: string, note?: string) {
    return prisma.$transaction(async (tx) => {
      await GamingCenterWalletRepo.lockWithdrawalRequestForUpdate(withdrawalId, tx);
      const withdrawal = await GamingCenterWalletRepo.findWithdrawalById(withdrawalId, undefined, tx);
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
      const updated = await GamingCenterWalletRepo.updateWithdrawalRequest(
        withdrawalId,
        {
          status: WithdrawalRequestStatus.APPROVED,
          approvedAt: now,
          reviewerAdmin: { connect: { id: adminId } },
          ...(note ? { note: withdrawal.note ? `${withdrawal.note}\n${note}` : note } : {}),
        },
        tx
      );

      logger.info({
        msg: 'Platform Admin approved gaming center withdrawal request',
        withdrawalId,
        adminId,
        gamingCenterId: withdrawal.gamingCenterId,
        amount: withdrawal.amount,
      });

      return updated;
    });
  },

  async rejectWithdrawal(withdrawalId: string, adminId: string, reason: string, note?: string) {
    if (!reason || reason.trim().length === 0) {
      throw new AppError('Rejection reason is required', httpStatus.BAD_REQUEST);
    }

    return prisma.$transaction(async (tx) => {
      await GamingCenterWalletRepo.lockWithdrawalRequestForUpdate(withdrawalId, tx);
      const withdrawal = await GamingCenterWalletRepo.findWithdrawalById(withdrawalId, undefined, tx);
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

      const gc = await GamingCenterWalletRepo.findGamingCenterForUpdate(
        withdrawal.gamingCenterId,
        tx
      );
      if (!gc || (gc.reservedBalance ?? 0) < withdrawal.amount) {
        throw new AppError(
          'Insufficient reserved balance to reject withdrawal request',
          httpStatus.CONFLICT
        );
      }

      const now = new Date();

      const updated = await GamingCenterWalletRepo.updateWithdrawalRequest(
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

      const previousActive = await GamingCenterWalletRepo.findLastActiveWithdrawalRequest(
        withdrawal.gamingCenterId,
        tx
      );

      await GamingCenterWalletRepo.updateGamingCenterWallet(
        withdrawal.gamingCenterId,
        {
          reservedBalance: { decrement: withdrawal.amount },
          lastWithdrawalRequestAt: previousActive?.createdAt ?? null,
        },
        tx
      );

      await GamingCenterWalletRepo.createWalletTransaction(
        {
          gamingCenterId: withdrawal.gamingCenterId,
          grossAmount: 0,
          commissionAmount: 0,
          amount: withdrawal.amount,
          currency: withdrawal.currency || 'IRR',
          type: GamingCenterWalletTransactionType.WITHDRAWAL_REFUND,
          withdrawalRequestId: withdrawal.id,
          idempotencyKey: `withdrawal_refund:${withdrawal.id}`,
          note: `بازگشت مبلغ برداشت ردشده شماره ${withdrawal.id}. علت: ${reason.trim()}`,
        },
        tx
      );

      logger.info({
        msg: 'Platform Admin rejected gaming center withdrawal request',
        withdrawalId,
        adminId,
        gamingCenterId: withdrawal.gamingCenterId,
        reason,
        amount: withdrawal.amount,
      });

      return updated;
    });
  },

  async updateWithdrawalPayment(
    withdrawalId: string,
    adminId: string,
    input: UpdateGamingCenterWithdrawalPaymentInput
  ) {
    const { status, paymentReference, note } = input;

    return prisma.$transaction(async (tx) => {
      await GamingCenterWalletRepo.lockWithdrawalRequestForUpdate(withdrawalId, tx);
      const withdrawal = await GamingCenterWalletRepo.findWithdrawalById(withdrawalId, undefined, tx);
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

        return GamingCenterWalletRepo.updateWithdrawalRequest(
          withdrawalId,
          {
            status: WithdrawalRequestStatus.PROCESSING,
            processedAt: now,
            paymentReference: paymentReference || withdrawal.paymentReference,
            ...(note ? { note: withdrawal.note ? `${withdrawal.note}\n${note}` : note } : {}),
          },
          tx
        );
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

        const gc = await GamingCenterWalletRepo.findGamingCenterForUpdate(
          withdrawal.gamingCenterId,
          tx
        );
        if (
          !gc ||
          (gc.reservedBalance ?? 0) < withdrawal.amount ||
          (gc.walletBalance ?? 0) < withdrawal.amount
        ) {
          throw new AppError(
            'Insufficient wallet or reserved balance for withdrawal payout',
            httpStatus.CONFLICT
          );
        }

        // Deduct exact requested amount with 0% commission (commission already deducted at reservation completion)
        await GamingCenterWalletRepo.updateGamingCenterWallet(
          withdrawal.gamingCenterId,
          {
            reservedBalance: { decrement: withdrawal.amount },
            walletBalance: { decrement: withdrawal.amount },
          },
          tx
        );

        await GamingCenterWalletRepo.createWalletTransaction(
          {
            gamingCenterId: withdrawal.gamingCenterId,
            grossAmount: 0,
            commissionAmount: 0,
            amount: -withdrawal.amount,
            currency: withdrawal.currency || 'IRR',
            type: GamingCenterWalletTransactionType.WITHDRAWAL_PAID,
            withdrawalRequestId: withdrawal.id,
            idempotencyKey: `withdrawal_paid:${withdrawal.id}`,
            note: `واریز موفق مبلغ برداشت شماره ${withdrawal.id}. شناسه پیگیری: ${paymentReference || 'ثبت‌نشده'}`,
          },
          tx
        );

        const updated = await GamingCenterWalletRepo.updateWithdrawalRequest(
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

        logger.info({
          msg: 'Gaming center withdrawal marked as PAID',
          withdrawalId,
          adminId,
          gamingCenterId: withdrawal.gamingCenterId,
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

        const gc = await GamingCenterWalletRepo.findGamingCenterForUpdate(
          withdrawal.gamingCenterId,
          tx
        );
        if (!gc || (gc.reservedBalance ?? 0) < withdrawal.amount) {
          throw new AppError(
            'Insufficient reserved balance for failed withdrawal release',
            httpStatus.CONFLICT
          );
        }

        await GamingCenterWalletRepo.updateGamingCenterWallet(
          withdrawal.gamingCenterId,
          {
            reservedBalance: { decrement: withdrawal.amount },
          },
          tx
        );

        await GamingCenterWalletRepo.createWalletTransaction(
          {
            gamingCenterId: withdrawal.gamingCenterId,
            grossAmount: 0,
            commissionAmount: 0,
            amount: withdrawal.amount,
            currency: withdrawal.currency || 'IRR',
            type: GamingCenterWalletTransactionType.WITHDRAWAL_REFUND,
            withdrawalRequestId: withdrawal.id,
            idempotencyKey: `withdrawal_failed_refund:${withdrawal.id}`,
            note: `بازگشت وجه به علت خطای واریز برای درخواست برداشت شماره ${withdrawal.id}`,
          },
          tx
        );

        const updated = await GamingCenterWalletRepo.updateWithdrawalRequest(
          withdrawalId,
          {
            status: WithdrawalRequestStatus.FAILED,
            reviewerAdmin: { connect: { id: adminId } },
            paymentReference: paymentReference || withdrawal.paymentReference,
            ...(note ? { note: withdrawal.note ? `${withdrawal.note}\n${note}` : note } : {}),
          },
          tx
        );

        logger.warn({
          msg: 'Gaming center withdrawal marked as FAILED',
          withdrawalId,
          adminId,
          gamingCenterId: withdrawal.gamingCenterId,
          amount: withdrawal.amount,
        });

        return updated;
      }

      throw new AppError(`Unsupported payment status update: ${status}`, httpStatus.BAD_REQUEST);
    });
  },
};
