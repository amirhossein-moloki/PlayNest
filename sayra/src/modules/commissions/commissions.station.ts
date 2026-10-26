
import { ReservationSource, CommissionStatus, CommissionType, CommissionPaymentStatus, Prisma, SessionActorType, ReservationPaymentState, CommissionPaymentMethod, PaymentProvider } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { CommissionsRepo } from './commissions.repo';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { ListCommissionsQuery, RecordCommissionPaymentInput, UpsertPolicyInput } from './commissions.validators';
import { auditService } from '../audit/audit.station';

export function getTargetPeriod(date: Date, timeZone?: string | null): string {
  if (timeZone) {
    try {
      return formatInTimeZone(date, timeZone, 'yyyy-MM');
    } catch {
      // Fallback to UTC if timezone is invalid
    }
  }
  return formatInTimeZone(date, 'UTC', 'yyyy-MM');
}

export const commissionsStation = {
  async getPolicy(gamingCenterId: string) {
    const policy = await CommissionsRepo.findPolicyByGamingCenterId(gamingCenterId);
    if (!policy) {
      throw new AppError('Commission policy not found for this gamingCenter.', httpStatus.NOT_FOUND);
    }
    return policy;
  },

  async upsertPolicy(
    gamingCenterId: string,
    input: UpsertPolicyInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const existingPolicy = await CommissionsRepo.findPolicyByGamingCenterId(gamingCenterId);

    const maxPercentBps = input.maxPercentBps ?? existingPolicy?.maxPercentBps ?? 10000;
    if (input.percentBps !== undefined && input.percentBps > maxPercentBps) {
      throw new AppError(
        `Commission rate exceeds maximum configured limit of ${maxPercentBps / 100}%.`,
        httpStatus.BAD_REQUEST
      );
    }

    const data: Prisma.CommissionPolicyCreateInput = {
      type: input.type,
      percentBps: input.percentBps,
      fixedAmount: input.fixedAmount,
      currency: input.currency,
      monthlyTarget: input.monthlyTarget,
      maxPercentBps,
      applyToOnlineOnly: input.applyToOnlineOnly ?? true,
      minimumFeeAmount: input.minimumFeeAmount,
      isActive: input.isActive ?? true,
      gamingCenter: { connect: { id: gamingCenterId } },
    };

    const policy = await CommissionsRepo.upsertPolicy(gamingCenterId, data);

    await auditService.log(
      gamingCenterId,
      actor,
      'COMMISSION_POLICY_UPSERT',
      { name: 'CommissionPolicy', id: policy.id },
      { old: existingPolicy, new: policy },
      context
    );

    return policy;
  },

  async getTargetProgress(gamingCenterId: string, periodInput?: string) {
    const policy = await CommissionsRepo.findPolicyByGamingCenterId(gamingCenterId);
    const settings = await CommissionsRepo.findSettingsByGamingCenterId(gamingCenterId);

    const targetPeriod = periodInput || getTargetPeriod(new Date(), settings?.timeZone);
    const monthlyTarget = policy?.monthlyTarget ?? null;

    const paidReservationCount = await CommissionsRepo.countTargetContributions(gamingCenterId, targetPeriod);

    let remainingCount: number | null = null;
    let isTargetReached = false;

    if (monthlyTarget !== null) {
      if (monthlyTarget === 0) {
        isTargetReached = true;
        remainingCount = 0;
      } else {
        isTargetReached = paidReservationCount >= monthlyTarget;
        remainingCount = Math.max(0, monthlyTarget - paidReservationCount);
      }
    }

    return {
      gamingCenterId,
      targetPeriod,
      monthlyTarget,
      paidReservationCount,
      remainingCount,
      isTargetReached,
    };
  },

  async calculateCommission(reservationId: string, externalTx?: Prisma.TransactionClient) {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Fetch reservation
      const reservation = await CommissionsRepo.findReservationForEarning(reservationId, tx);

      if (!reservation) return null;
      if (reservation.earning) return reservation.earning; // Already calculated (idempotency)

      // 2. Fetch policy
      const policy = await CommissionsRepo.findPolicyByGamingCenterId(reservation.gamingCenterId, tx);

      if (!policy || !policy.isActive) return null;

      // 3. Lock policy row for atomic concurrency control across instances
      await CommissionsRepo.lockPolicyForUpdate(reservation.gamingCenterId, tx);

      // Re-check earning after acquiring lock
      const recheckedEarning = await CommissionsRepo.findEarning(reservationId, tx);
      if (recheckedEarning) return recheckedEarning;

      // 4. Apply filters (e.g. apply to online bookings only)
      if (policy.applyToOnlineOnly && reservation.source !== ReservationSource.ONLINE) {
        return null;
      }

      // 5. Determine target period based on site timezone and payment paidAt date
      const settings = await CommissionsRepo.findSettingsByGamingCenterId(reservation.gamingCenterId, tx);
      const paymentPaidAt = reservation.payments?.[0]?.paidAt || new Date();
      const targetPeriod = getTargetPeriod(paymentPaidAt, settings?.timeZone);

      // 6. Read target progress
      const currentContributionCount = await CommissionsRepo.countTargetContributions(reservation.gamingCenterId, targetPeriod, tx);

      let targetReached = false;
      let targetContribution = false;

      if (policy.monthlyTarget !== null && policy.monthlyTarget !== undefined) {
        if (policy.monthlyTarget === 0) {
          targetReached = true;
          targetContribution = false;
        } else if (currentContributionCount >= policy.monthlyTarget) {
          targetReached = true;
          targetContribution = false;
        } else {
          targetReached = false;
          targetContribution = true;
        }
      } else {
        // Monthly target disabled
        targetReached = false;
        targetContribution = true;
      }

      // 7. Calculate base price before discounts (use originalAmount)
      const basePrice = Math.round(
        reservation.originalAmount && reservation.originalAmount > 0
          ? reservation.originalAmount
          : reservation.totalPrice + reservation.discountAmount
      );

      // 8. Calculate commission amount
      let commissionAmount = 0;
      if (!targetReached) {
        if (policy.type === CommissionType.PERCENT && policy.percentBps) {
          commissionAmount = Math.round((basePrice * policy.percentBps) / 10000);
        } else if (policy.type === CommissionType.FIXED && policy.fixedAmount) {
          commissionAmount = policy.fixedAmount;
        }

        // Apply minimum fee if configured
        if (policy.minimumFeeAmount && commissionAmount < policy.minimumFeeAmount) {
          commissionAmount = policy.minimumFeeAmount;
        }
      }

      const currency = policy.currency || 'USD';

      // 9. Determine auto-settlement
      const hasOnlinePayment = reservation.payments?.some(p => p.provider !== PaymentProvider.MANUAL);
      const shouldAutoSettle = reservation.paymentState === ReservationPaymentState.PAID && hasOnlinePayment;
      const status = shouldAutoSettle ? CommissionStatus.CHARGED : CommissionStatus.PENDING;

      // 10. Create Earning record
      const commission = await CommissionsRepo.createEarning({
        reservationId: reservation.id,
        gamingCenterId: reservation.gamingCenterId,
        status,
        baseAmount: basePrice,
        currency,
        type: policy.type,
        percentBps: policy.percentBps,
        fixedAmount: policy.fixedAmount,
        commissionAmount,
        targetPeriod,
        targetReached,
        targetContribution,
        calculatedAt: new Date(),
        chargedAt: shouldAutoSettle ? new Date() : null,
      }, tx);

      // 11. Record auto-settlement payment if applicable
      if (shouldAutoSettle && commissionAmount > 0) {
        await CommissionsRepo.createEarningPayment({
          earningId: commission.id,
          amount: commissionAmount,
          currency,
          status: CommissionPaymentStatus.PAID,
          method: CommissionPaymentMethod.ONLINE,
          paidAt: new Date(),
          referenceCode: `AUTO_SETTLE_${reservation.id}`,
        }, tx);
      }

      return commission;
    };

    if (externalTx) {
      return execute(externalTx);
    }
    return CommissionsRepo.transaction(execute);
  },

  async listEarnings(gamingCenterId: string, query: ListCommissionsQuery) {
    const { page = 1, pageSize = 20, status, targetPeriod, dateFrom, dateTo } = query;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: Prisma.EarningWhereInput = {
      status,
      targetPeriod,
      createdAt: {
        gte: dateFrom ? new Date(dateFrom) : undefined,
        lte: dateTo ? new Date(dateTo) : undefined,
      }
    };

    const { commissions, totalItems } = await CommissionsRepo.listEarnings(gamingCenterId, where, skip, take);

    return {
      data: commissions,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      }
    };
  },

  async payCommission(
    earningId: string,
    gamingCenterId: string,
    input: RecordCommissionPaymentInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    return CommissionsRepo.transaction(async (tx) => {
      const commission = await CommissionsRepo.findCommissionById(earningId, gamingCenterId, tx);

      if (!commission) {
        throw new AppError('Commission record not found.', httpStatus.NOT_FOUND);
      }

      // Ensure currency matches
      if (input.currency !== commission.currency) {
        throw new AppError(
          `Currency mismatch. Commission is in ${commission.currency}, but payment is in ${input.currency}.`,
          httpStatus.BAD_REQUEST
        );
      }

      const payment = await CommissionsRepo.createEarningPayment({
        earningId: earningId,
        amount: input.amount,
        currency: input.currency,
        status: input.status,
        method: input.method,
        referenceCode: input.referenceCode,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      }, tx);

      await auditService.log(
        gamingCenterId,
        actor,
        'COMMISSION_PAYMENT_RECORD',
        { name: 'EarningPayment', id: payment.id },
        { old: null, new: payment },
        context
      );

      // If fully paid, update commission status
      const allPayments = await CommissionsRepo.findEarningPayments(earningId, CommissionPaymentStatus.PAID, tx);

      const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

      if (totalPaid >= commission.commissionAmount) {
        await CommissionsRepo.updateEarning(earningId, gamingCenterId, {
          status: CommissionStatus.CHARGED,
          chargedAt: new Date()
        }, tx);
      }

      return payment;
    });
  }
};
