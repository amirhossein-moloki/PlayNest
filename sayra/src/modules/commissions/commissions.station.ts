import {
  ReservationSource,
  CommissionStatus,
  CommissionPaymentStatus,
  Prisma,
  SessionActorType,
  ReservationPaymentState,
  ReservationStatus,
  CommissionPaymentMethod,
  PaymentProvider,
  PaymentMethod,
} from '@prisma/client';
import { CommissionsRepo } from './commissions.repo';
import {
  getTargetPeriod,
  resolveEffectiveCommissionPolicy,
  evaluateMonthlyTarget,
  computeCommissionAmount,
  computeMerchantPayoutAmount,
} from './commission-calculator';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import {
  ListCommissionsQuery,
  ListPlatformCommissionsQuery,
  RecordCommissionPaymentInput,
  UpsertPolicyInput,
  WaiveCommissionInput,
} from './commissions.validators';
import { auditService } from '../audit/audit.station';

export { getTargetPeriod };

export const commissionsStation = {
  async getPolicy(gamingCenterId: string) {
    const policy = await CommissionsRepo.findPolicyByGamingCenterId(gamingCenterId);
    if (policy) {
      return policy;
    }

    const effectivePolicy = await resolveEffectiveCommissionPolicy(gamingCenterId);
    if (effectivePolicy) {
      return effectivePolicy;
    }

    throw new AppError('Commission policy not found for this gamingCenter.', httpStatus.NOT_FOUND);
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
      // 1. Fetch reservation (including parent groupBooking payments if any)
      const reservation = await CommissionsRepo.findReservationForEarning(reservationId, tx);

      if (!reservation) return null;

      // Never create a new earning for canceled, expired, or refunded reservations
      if (
        reservation.status === ReservationStatus.CANCELED ||
        reservation.status === ReservationStatus.EXPIRED ||
        reservation.paymentState === ReservationPaymentState.REFUNDED
      ) {
        return reservation.earning ?? null;
      }

      const allPaidPayments = [
        ...(reservation.payments ?? []),
        ...(reservation.groupBooking?.payments ?? []),
      ];
      // Wallet and online gateway payments are collected by the platform and auto-settled.
      // Note: Payment.method defaults to ONLINE in schema even for MANUAL in-person payments,
      // so MANUAL payments only auto-settle when method === WALLET.
      const hasPlatformCollectedPayment = allPaidPayments.some(
        (p) => p.provider !== PaymentProvider.MANUAL || p.method === PaymentMethod.WALLET
      );
      const shouldAutoSettle =
        reservation.paymentState === ReservationPaymentState.PAID && hasPlatformCollectedPayment;

      // 2. Idempotency + late online/wallet payment auto-settlement
      if (reservation.earning) {
        if (reservation.earning.status === CommissionStatus.PENDING && shouldAutoSettle) {
          const now = new Date();
          const updatedEarning = await CommissionsRepo.updateEarning(
            reservation.earning.id,
            reservation.gamingCenterId,
            {
              status: CommissionStatus.CHARGED,
              chargedAt: now,
            },
            tx
          );

          if (reservation.earning.commissionAmount > 0) {
            const existingPayments = await CommissionsRepo.findEarningPayments(
              reservation.earning.id,
              CommissionPaymentStatus.PAID,
              tx
            );
            const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
            const remaining = reservation.earning.commissionAmount - totalPaid;

            if (remaining > 0) {
              await CommissionsRepo.createEarningPayment(
                {
                  earningId: reservation.earning.id,
                  amount: remaining,
                  currency: reservation.earning.currency,
                  status: CommissionPaymentStatus.PAID,
                  method: CommissionPaymentMethod.ONLINE,
                  paidAt: now,
                  referenceCode: `AUTO_SETTLE_${reservation.id}`,
                },
                tx
              );
            }
          }

          return updatedEarning ?? { ...reservation.earning, status: CommissionStatus.CHARGED, chargedAt: now };
        }

        return reservation.earning;
      }

      // 3. Resolve effective policy (center policy or platform default fallback; null if center opted out)
      const policy = await resolveEffectiveCommissionPolicy(reservation.gamingCenterId, tx);
      if (!policy) return null;

      // 4. Lock center policy row for atomic concurrency control across instances
      if (!policy.isPlatformDefault) {
        await CommissionsRepo.lockPolicyForUpdate(reservation.gamingCenterId, tx);

        // Re-check earning after acquiring lock
        const recheckedEarning = await CommissionsRepo.findEarning(reservationId, tx);
        if (recheckedEarning) return recheckedEarning;
      }

      // 5. Apply filters (e.g. apply to online bookings only)
      if (policy.applyToOnlineOnly && reservation.source !== ReservationSource.ONLINE) {
        return null;
      }

      // 6. Determine target period based on site timezone and payment paidAt date
      const paymentPaidAt = allPaidPayments.find((p) => p.paidAt)?.paidAt || new Date();
      const { targetPeriod, targetReached, targetContribution } = await evaluateMonthlyTarget(
        reservation.gamingCenterId,
        policy,
        paymentPaidAt,
        tx
      );

      // 7. Calculate base price before discounts (use originalAmount)
      const basePrice = Math.round(
        reservation.originalAmount && reservation.originalAmount > 0
          ? reservation.originalAmount
          : reservation.totalPrice + reservation.discountAmount
      );

      // 8. Calculate commission amount
      const commissionAmount = computeCommissionAmount(basePrice, policy, targetReached);

      const snapshotCurrency = (reservation.stationSnapshot as Record<string, unknown> | null)?.currency;
      const currency =
        policy.currency ||
        (typeof snapshotCurrency === 'string' && snapshotCurrency.length === 3 ? snapshotCurrency : 'IRR');

      const status = shouldAutoSettle ? CommissionStatus.CHARGED : CommissionStatus.PENDING;
      const now = new Date();

      // 9. Create Earning record
      const commission = await CommissionsRepo.createEarning(
        {
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
          calculatedAt: now,
          chargedAt: shouldAutoSettle ? now : null,
        },
        tx
      );

      // 10. Record auto-settlement payment if applicable
      if (shouldAutoSettle && commissionAmount > 0) {
        await CommissionsRepo.createEarningPayment(
          {
            earningId: commission.id,
            amount: commissionAmount,
            currency,
            status: CommissionPaymentStatus.PAID,
            method: CommissionPaymentMethod.ONLINE,
            paidAt: now,
            referenceCode: `AUTO_SETTLE_${reservation.id}`,
          },
          tx
        );
      }

      // 11. Synchronize Reservation.merchantPayoutAmount with the finalized commission
      if (typeof tx.reservation?.update === 'function') {
        const syncedMerchantPayout = computeMerchantPayoutAmount(
          basePrice,
          reservation.discountAmount || 0,
          reservation.discountFundingSource,
          commissionAmount
        );
        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            merchantPayoutAmount: syncedMerchantPayout,
            ...(!reservation.originalAmount || reservation.originalAmount <= 0
              ? { originalAmount: basePrice }
              : {}),
          },
        });
      }

      return commission;
    };

    if (externalTx) {
      return execute(externalTx);
    }
    return CommissionsRepo.transaction(execute);
  },

  async reverseCommissionForReservation(
    reservationId: string,
    options?: { reason?: string },
    externalTx?: Prisma.TransactionClient
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      const earning = await CommissionsRepo.findEarningWithPaymentsByReservationId(reservationId, tx);
      if (!earning) return null;

      if (
        earning.status === CommissionStatus.REFUNDED ||
        earning.status === CommissionStatus.WAIVED
      ) {
        return earning;
      }

      const wasCollected =
        earning.status === CommissionStatus.CHARGED ||
        (earning.payments ?? []).some((p) => p.status === CommissionPaymentStatus.PAID);

      const targetStatus = wasCollected ? CommissionStatus.REFUNDED : CommissionStatus.WAIVED;
      const defaultNote = wasCollected
        ? 'Reversed due to refund/cancellation'
        : 'Waived due to cancellation';

      const updated = await CommissionsRepo.updateEarning(
        earning.id,
        earning.gamingCenterId,
        {
          status: targetStatus,
          targetContribution: false,
          note: options?.reason || defaultNote,
        },
        tx
      );

      if (wasCollected) {
        await CommissionsRepo.updateEarningPaymentsStatus(
          earning.id,
          CommissionPaymentStatus.PAID,
          CommissionPaymentStatus.REFUNDED,
          tx
        );
      }

      await CommissionsRepo.updateEarningPaymentsStatus(
        earning.id,
        CommissionPaymentStatus.PENDING,
        CommissionPaymentStatus.VOID,
        tx
      );

      return updated ?? { ...earning, status: targetStatus, targetContribution: false };
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
      },
    };

    const { commissions, totalItems } = await CommissionsRepo.listEarnings(gamingCenterId, where, skip, take);

    return {
      data: commissions,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  },

  async listAllEarnings(query: ListPlatformCommissionsQuery) {
    const { page = 1, pageSize = 20, gamingCenterId, status, targetPeriod, dateFrom, dateTo } = query;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const dateFilter =
      dateFrom || dateTo
        ? {
          createdAt: {
            gte: dateFrom ? new Date(dateFrom) : undefined,
            lte: dateTo ? new Date(dateTo) : undefined,
          },
        }
        : undefined;

    const where: Prisma.EarningWhereInput = {
      ...(gamingCenterId ? { gamingCenterId } : {}),
      ...(status ? { status } : {}),
      ...(targetPeriod ? { targetPeriod } : {}),
      ...dateFilter,
    };

    const { commissions, totalItems } = await CommissionsRepo.listAllEarnings(where, skip, take);

    return {
      data: commissions,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  },

  async payCommission(
    earningId: string,
    gamingCenterId: string | undefined,
    input: RecordCommissionPaymentInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    return CommissionsRepo.transaction(async (tx) => {
      const commission = gamingCenterId
        ? await CommissionsRepo.findCommissionById(earningId, gamingCenterId, tx)
        : await CommissionsRepo.findEarningByIdWithPayments(earningId, tx);

      if (!commission) {
        throw new AppError('Commission record not found.', httpStatus.NOT_FOUND);
      }

      if (
        commission.status === CommissionStatus.CHARGED ||
        commission.status === CommissionStatus.REFUNDED ||
        commission.status === CommissionStatus.WAIVED
      ) {
        throw new AppError(
          `Cannot record payment for a commission with status ${commission.status}.`,
          httpStatus.CONFLICT
        );
      }

      const effectiveCenterId = gamingCenterId || commission.gamingCenterId;

      // Ensure currency matches
      if (input.currency !== commission.currency) {
        throw new AppError(
          `Currency mismatch. Commission is in ${commission.currency}, but payment is in ${input.currency}.`,
          httpStatus.BAD_REQUEST
        );
      }

      const payment = await CommissionsRepo.createEarningPayment(
        {
          earningId,
          amount: input.amount,
          currency: input.currency,
          status: input.status,
          method: input.method,
          referenceCode: input.referenceCode,
          paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        },
        tx
      );

      await auditService.log(
        effectiveCenterId,
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
        await CommissionsRepo.updateEarning(
          earningId,
          effectiveCenterId,
          {
            status: CommissionStatus.CHARGED,
            chargedAt: new Date(),
          },
          tx
        );
      }

      return payment;
    });
  },

  async waiveCommission(
    earningId: string,
    gamingCenterId: string | undefined,
    input: WaiveCommissionInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    return CommissionsRepo.transaction(async (tx) => {
      const commission = gamingCenterId
        ? await CommissionsRepo.findCommissionById(earningId, gamingCenterId, tx)
        : await CommissionsRepo.findEarningByIdWithPayments(earningId, tx);

      if (!commission) {
        throw new AppError('Commission record not found.', httpStatus.NOT_FOUND);
      }

      if (
        commission.status === CommissionStatus.CHARGED ||
        commission.status === CommissionStatus.REFUNDED ||
        commission.status === CommissionStatus.WAIVED
      ) {
        throw new AppError(
          `Cannot waive a commission with status ${commission.status}.`,
          httpStatus.CONFLICT
        );
      }

      const effectiveCenterId = gamingCenterId || commission.gamingCenterId;

      const updated = await CommissionsRepo.updateEarning(
        commission.id,
        effectiveCenterId,
        {
          status: CommissionStatus.WAIVED,
          targetContribution: false,
          note: input?.reason || 'Waived by platform admin',
        },
        tx
      );

      await CommissionsRepo.updateEarningPaymentsStatus(
        commission.id,
        CommissionPaymentStatus.PENDING,
        CommissionPaymentStatus.VOID,
        tx
      );

      await auditService.log(
        effectiveCenterId,
        actor,
        'COMMISSION_WAIVE',
        { name: 'Earning', id: commission.id },
        { old: commission, new: updated },
        context
      );

      return updated ?? { ...commission, status: CommissionStatus.WAIVED, targetContribution: false };
    });
  },
};
