import { Router, Response, NextFunction } from 'express';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { authMiddleware } from '../../common/middleware/auth';
import { verifyPaymentWebhookSignature } from '../webhooks/middleware/verifyPaymentWebhookSignature';
import { AppRequest } from '../../types/express';
import { PaymentsRepo } from './payments.repo';
import { PaymentsStation } from './payments.station';
import { PaymentStatus, SessionActorType, UserRole } from '@prisma/client';
import { z } from 'zod';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { IdempotencyRepo } from '../../common/repositories/idempotency.repo';
import { IdempotencyStatus } from '../../types/idempotency';
import { eventEmitter, AppEvents } from '../../common/events/event-emitter';
import { prisma } from '../../config/prisma';

const router = Router();

const ALLOWED_STAFF_VERIFY_ROLES: ReadonlyArray<string> = [
  UserRole.MANAGER,
  UserRole.ADMIN,
  UserRole.STAFF,
];

function assertCanVerifyPayment(req: AppRequest, payment: any): void {
  const actor = req.actor;
  if (!actor) {
    throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
  }
  if (actor.actorType === SessionActorType.PLATFORM_ADMIN && actor.mfaVerified) {
    return;
  }
  if (
    actor.actorType === SessionActorType.USER &&
    actor.gamingCenterId === payment.gamingCenterId &&
    actor.role &&
    ALLOWED_STAFF_VERIFY_ROLES.includes(actor.role)
  ) {
    return;
  }
  if (actor.actorType === SessionActorType.CUSTOMER) {
    const ownerCustomerId =
      payment.reservation?.customerAccountId ||
      payment.groupBooking?.customerAccountId ||
      payment.bookingHold?.customerAccountId;
    if (ownerCustomerId && ownerCustomerId === actor.id) {
      return;
    }
  }
  throw new AppError('Forbidden: You are not authorized to verify this payment', httpStatus.FORBIDDEN);
}

function sanitizeGroupBookingSummary(groupBooking: any) {
  if (!groupBooking) {
    return undefined;
  }
  return {
    id: groupBooking.id,
    gamingCenterId: groupBooking.gamingCenterId,
    status: groupBooking.status,
    paymentState: groupBooking.paymentState,
    totalAmount: groupBooking.totalAmount,
    finalAmount: groupBooking.finalAmount,
    currency: groupBooking.currency,
    createdAt: groupBooking.createdAt,
    reservations: Array.isArray(groupBooking.reservations)
      ? groupBooking.reservations.map((r: any) => ({
          id: r.id,
          stationId: r.stationId,
          startTime: r.startTime,
          endTime: r.endTime,
          status: r.status,
          paymentState: r.paymentState,
        }))
      : undefined,
  };
}

const verifyPaymentSchema = z.object({
  params: z.object({
    paymentId: z.string(),
  }),
  body: z.object({
    authority: z.string().optional(),
  }).optional(),
});

const webhookSchema = z.object({
  body: z.object({
    eventId: z.string().optional(),
    paymentId: z.string(),
    authority: z.string().optional(),
    status: z.string(),
    provider: z.string().optional(),
    refId: z.string().optional(),
    amount: z.number().optional(),
  }),
});

/**
 * Direct payment verification endpoint: POST /api/v1/payments/:paymentId/verify
 */
router.post(
  '/:paymentId/verify',
  authMiddleware,
  validate(verifyPaymentSchema),
  asyncHandler<AppRequest>(async (req: AppRequest, res: Response, next: NextFunction) => {
    try {
      const { paymentId } = req.params;
      const payment = await PaymentsRepo.transaction(async (tx) => {
        return tx.payment.findUnique({
          where: { id: paymentId },
          include: { bookingHold: true, reservation: true, groupBooking: true },
        });
      });

      if (!payment) {
        throw new AppError('Payment record not found.', httpStatus.NOT_FOUND);
      }

      assertCanVerifyPayment(req, payment);

      const suppliedAuthority = (req.body?.authority || req.query.authority || req.query.Authority) as string | undefined;
      if (suppliedAuthority && payment.providerPaymentId && suppliedAuthority !== payment.providerPaymentId) {
        throw new AppError('Payment authority mismatch.', httpStatus.BAD_REQUEST);
      }

      // Check idempotency if already paid
      if (payment.status === PaymentStatus.PAID) {
        if (payment.bookingHoldId) {
          const { BookingHoldStation } = await import('../booking-hold/booking-hold.station');
          const groupBooking = await BookingHoldStation.convertHoldToReservations(payment.bookingHoldId, payment.id);
          res.ok({
            success: true,
            paymentId: payment.id,
            paymentStatus: PaymentStatus.PAID,
            referenceCode: payment.referenceCode,
            message: 'Payment already verified.',
            groupBooking: sanitizeGroupBookingSummary(groupBooking),
          });
          return;
        }

        res.ok({
          success: true,
          paymentId: payment.id,
          paymentStatus: PaymentStatus.PAID,
          referenceCode: payment.referenceCode,
          message: 'Payment already verified.',
        });
        return;
      }

      const authority = (suppliedAuthority || payment.providerPaymentId) as string | undefined;

      // Never honor client-supplied provider or client-forced failure status on direct verify;
      // always defer to authoritative server-to-server provider verification.
      const result = await PaymentsStation.verifyPayment({
        gamingCenterId: payment.gamingCenterId,
        reservationId: payment.reservationId || payment.bookingHoldId || payment.id,
        authority,
        status: undefined,
        providerName: payment.provider,
      });

      // If this was a booking hold, fetch converted group booking
      let groupBooking;
      if (payment.bookingHoldId && result.success) {
        const { BookingHoldRepo } = await import('../booking-hold/booking-hold.repo');
        const { GroupBookingRepo } = await import('../group-booking/group-booking.repo');
        const hold = await BookingHoldRepo.findHoldById(payment.bookingHoldId);
        if (hold?.convertedGroupBookingId) {
          groupBooking = await GroupBookingRepo.findGroupBookingById(hold.convertedGroupBookingId, payment.gamingCenterId);
        }
      }

      res.ok({
        ...result,
        ...(groupBooking ? { groupBooking: sanitizeGroupBookingSummary(groupBooking) } : {}),
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * Universal payment gateway webhook: POST /api/v1/payments/webhook
 */
router.post(
  '/webhook',
  verifyPaymentWebhookSignature,
  validate(webhookSchema),
  asyncHandler<AppRequest>(async (req: AppRequest, res: Response, next: NextFunction) => {
    try {
      const { paymentId, eventId, status: eventStatus, refId, amount, provider } = req.body;
      const idempotencyKey = eventId || req.header('X-Event-ID') || `webhook:${paymentId}:${eventStatus}`;
      const idempotencyScope = 'payments:webhook';

      const existingKey = await IdempotencyRepo.findKey(idempotencyScope, idempotencyKey);
      if (existingKey) {
        if (existingKey.status === IdempotencyStatus.IN_PROGRESS) {
          throw new AppError('Webhook is currently being processed.', httpStatus.CONFLICT);
        }
        res.ok({ message: 'Webhook already processed.', idempotencyKey });
        return;
      }

      try {
        await IdempotencyRepo.createKey({
          key: idempotencyKey,
          scope: idempotencyScope,
          requestHash: '',
          status: IdempotencyStatus.IN_PROGRESS,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (err.code === 'P2002') {
          res.ok({ message: 'Webhook already processed in parallel.' });
          return;
        }
        throw err;
      }

      try {
        const normalizedStatus = eventStatus.toUpperCase();

        await PaymentsRepo.transaction(async (tx) => {
          const payment = await tx.payment.findUnique({
            where: { id: paymentId },
            include: { bookingHold: true, reservation: true },
          });

          if (!payment) {
            throw new AppError('Payment not found.', httpStatus.NOT_FOUND);
          }

          if (provider && payment.provider && payment.provider.toUpperCase() !== provider.toUpperCase()) {
            throw new AppError('Payment provider mismatch.', httpStatus.BAD_REQUEST);
          }

          if (amount !== undefined) {
            const expectedGatewayAmount = payment.amount - (payment.walletAmount || 0);
            if (amount !== expectedGatewayAmount && amount !== payment.amount) {
              throw new AppError('Payment amount mismatch.', httpStatus.BAD_REQUEST);
            }
          }

          if (normalizedStatus === 'PAID' || normalizedStatus === 'SUCCEEDED' || normalizedStatus === 'OK') {
            await PaymentsRepo.handleSuccessfulPayment(tx, payment.id, refId);

            if (payment.bookingHoldId) {
              const { BookingHoldStation } = await import('../booking-hold/booking-hold.station');
              await BookingHoldStation.convertHoldToReservations(payment.bookingHoldId, payment.id, tx);
            }
          } else if (normalizedStatus === 'FAILED' || normalizedStatus === 'NOK' || normalizedStatus === 'CANCELLED') {
            if (payment.status !== PaymentStatus.PAID) {
              await PaymentsRepo.handleFailedPayment(tx, payment.id, PaymentStatus.FAILED, 'Webhook reported failure');
            }
          }
        });

        if (normalizedStatus === 'PAID' || normalizedStatus === 'SUCCEEDED' || normalizedStatus === 'OK') {
          const refreshed = typeof prisma.payment?.findUnique === 'function'
            ? await prisma.payment.findUnique({ where: { id: paymentId } })
            : null;
          if (refreshed) {
            eventEmitter.emit(AppEvents.PAYMENT_SUCCESS, { payment: refreshed });
          }
        } else if (normalizedStatus === 'FAILED' || normalizedStatus === 'NOK' || normalizedStatus === 'CANCELLED') {
          const refreshed = typeof prisma.payment?.findUnique === 'function'
            ? await prisma.payment.findUnique({ where: { id: paymentId } })
            : null;
          if (refreshed) {
            eventEmitter.emit(AppEvents.PAYMENT_FAILED, {
              payment: refreshed,
              failureReason: 'Webhook reported failure',
            });
          }
        }

        await IdempotencyRepo.updateKey(idempotencyScope, idempotencyKey, { status: IdempotencyStatus.COMPLETED });
        res.ok({ message: 'Webhook processed successfully.' });
      } catch (err) {
        await IdempotencyRepo.updateKey(idempotencyScope, idempotencyKey, { status: IdempotencyStatus.FAILED });
        throw err;
      }
    } catch (error) {
      next(error);
    }
  })
);

export const directPaymentsRouter = router;
