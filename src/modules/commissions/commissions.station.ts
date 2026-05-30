
import { ReservationSource, CommissionStatus, CommissionType, CommissionPaymentStatus, Prisma, SessionActorType, ReservationPaymentState, CommissionPaymentMethod, PaymentProvider } from '@prisma/client';
import { CommissionsRepo } from './commissions.repo';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { ListCommissionsQuery, RecordCommissionPaymentInput, UpsertPolicyInput } from './commissions.validators';
import { auditService } from '../audit/audit.station';

export const commissionsService = {
  async getPolicy(gamingCenterId: string) {
    const policy = await CommissionsRepo.findPolicyBySalonId(gamingCenterId);
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
    const existingPolicy = await CommissionsRepo.findPolicyBySalonId(gamingCenterId);

    const data: Prisma.CommissionPolicyCreateInput = {
      type: input.type,
      percentBps: input.percentBps,
      fixedAmount: input.fixedAmount,
      currency: input.currency,
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

  async calculateCommission(reservationId: string) {
    return CommissionsRepo.transaction(async (tx) => {
      // 1. Fetch reservation
      const reservation = await CommissionsRepo.findReservationForEarning(reservationId, tx);

      if (!reservation) return null;
      if (reservation.earning) return reservation.earning; // Already calculated

      // 2. Fetch policy
      const policy = await CommissionsRepo.findPolicyBySalonId(reservation.gamingCenterId, tx);

      if (!policy || !policy.isActive) return null;

      // 3. Apply filters
      // We only take commission for ONLINE reservations.
      if (reservation.source !== ReservationSource.ONLINE) {
        return null;
      }

      // 4. Calculate amount
      let commissionAmount = 0;

      if (policy.type === CommissionType.PERCENT && policy.percentBps) {
        commissionAmount = Math.floor((reservation.totalPrice * policy.percentBps) / 10000);
      } else if (policy.type === CommissionType.FIXED && policy.fixedAmount) {
        commissionAmount = policy.fixedAmount;
      }

      // Apply minimum fee
      if (policy.minimumFeeAmount && commissionAmount < policy.minimumFeeAmount) {
        commissionAmount = policy.minimumFeeAmount;
      }

      const currency = policy.currency || 'USD';

      // 5. Determine if it should be automatically settled
      const hasOnlinePayment = reservation.payments?.some(p => p.provider !== PaymentProvider.MANUAL);
      const shouldAutoSettle = reservation.paymentState === ReservationPaymentState.PAID && hasOnlinePayment;
      const status = shouldAutoSettle ? CommissionStatus.CHARGED : CommissionStatus.PENDING;

      // 6. Create Earning record
      const commission = await CommissionsRepo.createEarning({
        reservationId: reservation.id,
        gamingCenterId: reservation.gamingCenterId,
        status,
        baseAmount: Math.floor(reservation.totalPrice),
        currency,
        type: policy.type,
        percentBps: policy.percentBps,
        fixedAmount: policy.fixedAmount,
        commissionAmount: commissionAmount,
        calculatedAt: new Date(),
        chargedAt: shouldAutoSettle ? new Date() : null,
      }, tx);

      // 7. If auto-settled, record the payment
      if (shouldAutoSettle) {
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
    });
  },

  async listEarnings(gamingCenterId: string, query: ListCommissionsQuery) {
    const { page = 1, pageSize = 20, status, dateFrom, dateTo } = query;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: Prisma.EarningWhereInput = {
      status,
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
