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
  DiscountFundingSource,
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
import { GamingCenterWalletRepo } from '../gaming-center-wallet/gamingCenterWallet.repo';
import { gamingCenterWalletStation } from '../gaming-center-wallet/gamingCenterWallet.station';

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

      const allPaidPayments = [
        ...(reservation.payments ?? []),
        ...(reservation.groupBooking?.payments ?? []),
      ];
      // Wallet and online gateway payments are collected by the platform and settled at completion.
      // Note: Payment.method defaults to ONLINE in schema even for MANUAL in-person payments,
      // so MANUAL payments only qualify as platform-collected when method === WALLET.
      const hasPlatformCollectedPayment = allPaidPayments.some(
        (p) => p.provider !== PaymentProvider.MANUAL || p.method === PaymentMethod.WALLET
      );

      // Deduct commission & settle gaming center wallet ONLY ONCE when reservation completes
      // and ONLY for platform-collected paid reservations.
      if (
        reservation.status !== ReservationStatus.COMPLETED ||
        reservation.paymentState !== ReservationPaymentState.PAID ||
        !hasPlatformCollectedPayment
      ) {
        return reservation.earning ?? null;
      }

      // 2. Acquire deadlock-free pessimistic locks: GamingCenter first, then CommissionPolicy
      await GamingCenterWalletRepo.findGamingCenterForUpdate(reservation.gamingCenterId, tx);

      const policy = await resolveEffectiveCommissionPolicy(reservation.gamingCenterId, tx);
      if (policy && !policy.isPlatformDefault) {
        await CommissionsRepo.lockPolicyForUpdate(reservation.gamingCenterId, tx);
      }

      // Re-check earning inside locks for concurrency idempotency
      const existingEarning =
        reservation.earning || (await CommissionsRepo.findEarning(reservationId, tx));

      const basePrice = Math.round(
        reservation.originalAmount && reservation.originalAmount > 0
          ? reservation.originalAmount
          : (reservation.totalPrice || 0) + (reservation.discountAmount || 0)
      );
      const discountAmount = Math.round(reservation.discountAmount || 0);
      const grossMerchantAmount =
        reservation.discountFundingSource === DiscountFundingSource.MERCHANT_FUNDED
          ? Math.max(0, basePrice - discountAmount)
          : basePrice;

      const snapshotCurrency = (reservation.stationSnapshot as Record<string, unknown> | null)?.currency;
      const currency =
        policy?.currency ||
        (typeof snapshotCurrency === 'string' && snapshotCurrency.length === 3 ? snapshotCurrency : 'IRR');

      // 3. Idempotent / legacy PENDING auto-settlement path if Earning already exists
      if (existingEarning) {
        let settledEarning = existingEarning;
        if (existingEarning.status === CommissionStatus.PENDING) {
          const now = new Date();
          const updatedEarning = await CommissionsRepo.updateEarning(
            existingEarning.id,
            reservation.gamingCenterId,
            {
              status: CommissionStatus.CHARGED,
              chargedAt: now,
            },
            tx
          );

          if (existingEarning.commissionAmount > 0) {
            const existingPayments = await CommissionsRepo.findEarningPayments(
              existingEarning.id,
              CommissionPaymentStatus.PAID,
              tx
            );
            const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
            const remaining = existingEarning.commissionAmount - totalPaid;

            if (remaining > 0) {
              await CommissionsRepo.createEarningPayment(
                {
                  earningId: existingEarning.id,
                  amount: remaining,
                  currency: existingEarning.currency,
                  status: CommissionPaymentStatus.PAID,
                  method: CommissionPaymentMethod.ONLINE,
                  paidAt: now,
                  referenceCode: `AUTO_SETTLE_${reservation.id}`,
                },
                tx
              );
            }
          }

          settledEarning =
            updatedEarning ?? {
              ...existingEarning,
              status: CommissionStatus.CHARGED,
              chargedAt: now,
            };
        }

        if (settledEarning.status === CommissionStatus.REFUNDED) {
          return settledEarning;
        }

        const effectiveCommission =
          settledEarning.status === CommissionStatus.WAIVED ? 0 : settledEarning.commissionAmount;
        const netCredit = computeMerchantPayoutAmount(
          basePrice,
          discountAmount,
          reservation.discountFundingSource,
          effectiveCommission
        );

        await gamingCenterWalletStation.creditReservationSettlement(
          {
            gamingCenterId: reservation.gamingCenterId,
            reservationId: reservation.id,
            earningId: settledEarning.id,
            grossAmount: grossMerchantAmount,
            commissionAmount: effectiveCommission,
            netAmount: netCredit,
            currency: settledEarning.currency || currency,
            metadata: {
              basePrice,
              discountAmount,
              discountFundingSource: reservation.discountFundingSource ?? null,
              commissionRateBps: settledEarning.percentBps ?? null,
              targetReached: settledEarning.targetReached ?? false,
            },
          },
          tx
        );

        return settledEarning;
      }

      // 4. First-time completion settlement: compute commission (0 when opted out / non-matching source)
      const commissionApplies = Boolean(
        policy && !(policy.applyToOnlineOnly && reservation.source !== ReservationSource.ONLINE)
      );

      let commissionAmount = 0;
      let commission: Awaited<ReturnType<typeof CommissionsRepo.createEarning>> | null = null;
      const now = new Date();

      if (commissionApplies && policy) {
        const referenceDate =
          reservation.completedAt || allPaidPayments.find((p) => p.paidAt)?.paidAt || now;
        const { targetPeriod, targetReached, targetContribution } = await evaluateMonthlyTarget(
          reservation.gamingCenterId,
          policy,
          referenceDate,
          tx
        );

        commissionAmount = computeCommissionAmount(basePrice, policy, targetReached);

        commission = await CommissionsRepo.createEarning(
          {
            reservationId: reservation.id,
            gamingCenterId: reservation.gamingCenterId,
            status: CommissionStatus.CHARGED,
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
            chargedAt: now,
          },
          tx
        );

        if (commissionAmount > 0) {
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
      }

      // 5. Synchronize Reservation.merchantPayoutAmount & credit net amount ONCE to GamingCenter wallet
      const netCredit = computeMerchantPayoutAmount(
        basePrice,
        discountAmount,
        reservation.discountFundingSource,
        commissionAmount
      );

      if (typeof tx.reservation?.update === 'function') {
        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            merchantPayoutAmount: netCredit,
            ...(!reservation.originalAmount || reservation.originalAmount <= 0
              ? { originalAmount: basePrice }
              : {}),
          },
        });
      }

      await gamingCenterWalletStation.creditReservationSettlement(
        {
          gamingCenterId: reservation.gamingCenterId,
          reservationId: reservation.id,
          earningId: commission?.id ?? null,
          grossAmount: grossMerchantAmount,
          commissionAmount,
          netAmount: netCredit,
          currency,
          metadata: {
            basePrice,
            discountAmount,
            discountFundingSource: reservation.discountFundingSource ?? null,
            commissionRateBps: commission?.percentBps ?? null,
            targetReached: commission?.targetReached ?? false,
          },
        },
        tx
      );

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
      if (!earning) {
        await gamingCenterWalletStation.reverseReservationSettlement(reservationId, options?.reason, tx);
        return null;
      }

      if (
        earning.status === CommissionStatus.REFUNDED ||
        earning.status === CommissionStatus.WAIVED
      ) {
        await gamingCenterWalletStation.reverseReservationSettlement(reservationId, options?.reason, tx);
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

      await gamingCenterWalletStation.reverseReservationSettlement(reservationId, options?.reason, tx);

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
