/* eslint-disable @typescript-eslint/no-explicit-any */
import { reservationStation } from '../../modules/reservation/reservation.station';
import { RefundsStation } from '../../modules/payments/payments.refund.station';
import { VerificationStation } from '../../modules/verification/verification.station';
import { ReconciliationStation } from '../../modules/payments/reconciliation.station';
import { AdminAuditService } from './admin-audit.service';
import { UserRole, SessionActorType } from '@prisma/client';
import logger from '../../config/logger';
import { prisma } from '../../config/prisma';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export interface AdminActionContext {
  platformAdminId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Service Station Bridge:
 * Connects administrative actions from the Platform Admin Panel directly to domain stations,
 * guaranteeing all business rules, exclusion constraints (tstzrange), financial ledgers,
 * and state transitions are strictly executed without direct DB table tampering.
 */
export class AdminStationBridge {
  /**
   * Safe administrative cancellation of a reservation via reservationStation
   */
  static async cancelReservation(
    gamingCenterId: string,
    reservationId: string,
    reason: string,
    context: AdminActionContext
  ): Promise<any> {
    logger.info({ reservationId, gamingCenterId, adminId: context.platformAdminId }, 'AdminStationBridge: cancelling reservation');

    const actor = {
      id: context.platformAdminId,
      role: UserRole.ADMIN,
      actorType: SessionActorType.USER,
    };

    const result = await reservationStation.cancelReservation(
      reservationId,
      gamingCenterId,
      actor,
      { reason: `[ADMIN CANCEL] ${reason}` },
      { ip: context.ipAddress, userAgent: context.userAgent }
    );

    await AdminAuditService.logAdminEvent({
      platformAdminId: context.platformAdminId,
      action: 'ADMIN_RESERVATION_CANCELLED',
      entity: 'Reservation',
      entityId: reservationId,
      newData: { gamingCenterId, reason, status: 'CANCELED' },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return result;
  }

  /**
   * Safe administrative confirmation of a reservation via reservationStation
   */
  static async confirmReservation(
    gamingCenterId: string,
    reservationId: string,
    context: AdminActionContext
  ): Promise<any> {
    logger.info({ reservationId, gamingCenterId, adminId: context.platformAdminId }, 'AdminStationBridge: confirming reservation');

    const result = await reservationStation.confirmReservation(reservationId, gamingCenterId);

    await AdminAuditService.logAdminEvent({
      platformAdminId: context.platformAdminId,
      action: 'ADMIN_RESERVATION_CONFIRMED',
      entity: 'Reservation',
      entityId: reservationId,
      newData: { gamingCenterId, status: 'CONFIRMED' },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return result;
  }

  /**
   * Safe administrative start of a reservation via reservationStation
   */
  static async startReservation(
    gamingCenterId: string,
    reservationId: string,
    context: AdminActionContext
  ): Promise<any> {
    logger.info({ reservationId, gamingCenterId, adminId: context.platformAdminId }, 'AdminStationBridge: starting reservation');

    const actor = {
      id: context.platformAdminId,
      role: UserRole.ADMIN,
      actorType: SessionActorType.USER,
    };

    const result = await reservationStation.startReservation(
      reservationId,
      gamingCenterId,
      actor,
      { ip: context.ipAddress, userAgent: context.userAgent }
    );

    await AdminAuditService.logAdminEvent({
      platformAdminId: context.platformAdminId,
      action: 'ADMIN_RESERVATION_STARTED',
      entity: 'Reservation',
      entityId: reservationId,
      newData: { gamingCenterId, status: 'IN_PROGRESS' },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return result;
  }

  /**
   * Safe administrative completion of a reservation via reservationStation
   */
  static async completeReservation(
    gamingCenterId: string,
    reservationId: string,
    context: AdminActionContext
  ): Promise<any> {
    logger.info({ reservationId, gamingCenterId, adminId: context.platformAdminId }, 'AdminStationBridge: completing reservation');

    const actor = {
      id: context.platformAdminId,
      role: UserRole.ADMIN,
      actorType: SessionActorType.USER,
    };

    const result = await reservationStation.completeReservation(
      reservationId,
      gamingCenterId,
      actor,
      { ip: context.ipAddress, userAgent: context.userAgent }
    );

    await AdminAuditService.logAdminEvent({
      platformAdminId: context.platformAdminId,
      action: 'ADMIN_RESERVATION_COMPLETED',
      entity: 'Reservation',
      entityId: reservationId,
      newData: { gamingCenterId, status: 'COMPLETED' },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return result;
  }

  /**
   * Safe administrative no-show mark via reservationStation
   */
  static async markNoShow(
    gamingCenterId: string,
    reservationId: string,
    context: AdminActionContext
  ): Promise<any> {
    logger.info({ reservationId, gamingCenterId, adminId: context.platformAdminId }, 'AdminStationBridge: marking no-show');

    const actor = {
      id: context.platformAdminId,
      role: UserRole.ADMIN,
      actorType: SessionActorType.USER,
    };

    const result = await reservationStation.markAsNoShow(
      reservationId,
      gamingCenterId,
      actor,
      { ip: context.ipAddress, userAgent: context.userAgent }
    );

    await AdminAuditService.logAdminEvent({
      platformAdminId: context.platformAdminId,
      action: 'ADMIN_RESERVATION_NOSHOW',
      entity: 'Reservation',
      entityId: reservationId,
      newData: { gamingCenterId, status: 'NO_SHOW' },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return result;
  }

  /**
   * Safe administrative refund execution via RefundsStation
   */
  static async processRefund(
    params: {
      gamingCenterId: string;
      paymentId: string;
      amount: number;
      currency?: string;
      reason?: string;
      idempotencyKey?: string;
    },
    context: AdminActionContext
  ): Promise<any> {
    logger.info({ paymentId: params.paymentId, adminId: context.platformAdminId }, 'AdminStationBridge: processing refund');

    const result = await RefundsStation.requestRefund({
      gamingCenterId: params.gamingCenterId,
      paymentId: params.paymentId,
      amount: params.amount,
      currency: params.currency || 'IRR',
      reason: `[ADMIN REFUND] ${params.reason || 'Platform Administrator override'}`,
      requestedById: context.platformAdminId,
      idempotencyKey: params.idempotencyKey,
    });

    await AdminAuditService.logAdminEvent({
      platformAdminId: context.platformAdminId,
      action: 'ADMIN_REFUND_PROCESSED',
      entity: 'Refund',
      entityId: (result as any)?.id || params.paymentId,
      newData: { paymentId: params.paymentId, amount: params.amount, reason: params.reason },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return result;
  }

  /**
   * Safe verification decision via VerificationStation
   */
  /**
   * Safe administrative retry of a failed refund with Idempotency preservation
   */
  static async retryRefund(
    refundId: string,
    context: AdminActionContext
  ): Promise<any> {
    logger.info({ refundId, adminId: context.platformAdminId }, 'AdminStationBridge: retrying refund');

    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
      include: { payment: true },
    });

    if (!refund) {
      throw new AppError('Refund record not found.', httpStatus.NOT_FOUND);
    }

    if (refund.status === 'SUCCESSFUL') {
      throw new AppError('Refund has already been completed successfully.', httpStatus.CONFLICT);
    }

    const retryIdempotencyKey = `retry_${refund.id}_${Date.now()}`;
    const result = await RefundsStation.requestRefund({
      gamingCenterId: refund.gamingCenterId,
      paymentId: refund.paymentId,
      amount: refund.amount,
      currency: refund.currency,
      reason: `[ADMIN RETRY] Previous refund attempt ${refund.id} retry`,
      requestedById: context.platformAdminId,
      idempotencyKey: retryIdempotencyKey,
    });

    await AdminAuditService.logAdminEvent({
      platformAdminId: context.platformAdminId,
      action: 'ADMIN_REFUND_RETRIED',
      entity: 'Refund',
      entityId: refundId,
      newData: { newRefundId: (result as any)?.id, previousRefundId: refundId },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return result;
  }

  /**
   * Safe administrative gateway inquiry & reconciliation via ReconciliationStation
   */
  static async reconcilePayment(
    gamingCenterId: string,
    paymentId: string,
    context: AdminActionContext
  ): Promise<any> {
    logger.info({ paymentId, gamingCenterId, adminId: context.platformAdminId }, 'AdminStationBridge: reconciling payment');

    const result = await ReconciliationStation.reconcilePayment({
      gamingCenterId,
      paymentId,
    });

    await AdminAuditService.logAdminEvent({
      platformAdminId: context.platformAdminId,
      action: 'ADMIN_PAYMENT_RECONCILED',
      entity: 'Payment',
      entityId: paymentId,
      newData: { status: result.status, discrepancies: result.discrepancies },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return result;
  }

  static async decideVerification(
    verificationId: string,
    approved: boolean,
    notes: string,
    context: AdminActionContext
  ): Promise<any> {
    logger.info({ verificationId, approved, adminId: context.platformAdminId }, 'AdminStationBridge: deciding verification');

    const actor = {
      id: context.platformAdminId,
      role: UserRole.ADMIN,
      actorType: SessionActorType.USER,
    };

    let result;
    if (approved) {
      result = await VerificationStation.approveVerification(
        verificationId,
        context.platformAdminId,
        actor,
        { ip: context.ipAddress, userAgent: context.userAgent }
      );
    } else {
      result = await VerificationStation.rejectVerification(
        verificationId,
        context.platformAdminId,
        notes,
        actor,
        { ip: context.ipAddress, userAgent: context.userAgent }
      );
    }

    await AdminAuditService.logAdminEvent({
      platformAdminId: context.platformAdminId,
      action: approved ? 'ADMIN_VERIFICATION_APPROVED' : 'ADMIN_VERIFICATION_REJECTED',
      entity: 'GamingCenterVerification',
      entityId: verificationId,
      newData: { approved, notes },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return result;
  }
}
