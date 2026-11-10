import { Router } from 'express';
import { validate } from '../../common/middleware/validate';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { AppRequest } from '../../types/express';
import { Response, NextFunction } from 'express';
import { PaymentsRepo } from './payments.repo';
import { PaymentsStation } from './payments.station';
import { PaymentStatus } from '@prisma/client';
import { z } from 'zod';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { IdempotencyRepo } from '../../common/repositories/idempotency.repo';
import { IdempotencyStatus } from '../../types/idempotency';

const router = Router();

const verifyPaymentSchema = z.object({
  params: z.object({
    paymentId: z.string(),
  }),
  body: z.object({
    authority: z.string().optional(),
    status: z.string().optional(),
    provider: z.string().optional(),
  }).optional(),
});

const webhookSchema = z.object({
  body: z.object({
    eventId: z.string().optional(),
    paymentId: z.string(),
    authority: z.string().optional(),
    status: z.string(),
    refId: z.string().optional(),
    amount: z.number().optional(),
  }),
});

/**
 * Direct payment verification endpoint: POST /api/v1/payments/:paymentId/verify
 */
router.post(
  '/:paymentId/verify',
  validate(verifyPaymentSchema),
  asyncHandler<AppRequest>(async (req: AppRequest, res: Response, next: NextFunction) => {
    try {
      const { paymentId } = req.params;
      const payment = await PaymentsRepo.transaction(async (tx) => {
        return tx.payment.findUnique({
          where: { id: paymentId },
          include: { bookingHold: true, reservation: true },
        });
      });

      if (!payment) {
        throw new AppError('Payment record not found.', httpStatus.NOT_FOUND);
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
            groupBooking,
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

      const authority = (req.body?.authority || req.query.authority || req.query.Authority || payment.providerPaymentId) as string | undefined;
      const status = (req.body?.status || req.query.status || req.query.Status) as string | undefined;
      const providerName = req.body?.provider || payment.provider;

      const result = await PaymentsStation.verifyPayment({
        gamingCenterId: payment.gamingCenterId,
        reservationId: payment.reservationId || payment.bookingHoldId || payment.id,
        authority,
        status,
        providerName,
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
        ...(groupBooking ? { groupBooking } : {}),
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
  validate(webhookSchema),
  asyncHandler<AppRequest>(async (req: AppRequest, res: Response, next: NextFunction) => {
    try {
      const { paymentId, eventId, status: eventStatus, refId } = req.body;
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
        await PaymentsRepo.transaction(async (tx) => {
          const payment = await tx.payment.findUnique({
            where: { id: paymentId },
            include: { bookingHold: true, reservation: true },
          });

          if (!payment) {
            throw new AppError('Payment not found.', httpStatus.NOT_FOUND);
          }

          const normalizedStatus = eventStatus.toUpperCase();

          if (normalizedStatus === 'PAID' || normalizedStatus === 'SUCCEEDED' || normalizedStatus === 'OK') {
            await PaymentsRepo.handleSuccessfulPayment(tx, payment.id, refId);

            if (payment.bookingHoldId) {
              const { BookingHoldStation } = await import('../booking-hold/booking-hold.station');
              await BookingHoldStation.convertHoldToReservations(payment.bookingHoldId, payment.id, tx);
            }
          } else if (normalizedStatus === 'FAILED' || normalizedStatus === 'NOK' || normalizedStatus === 'CANCELLED') {
            await PaymentsRepo.handleFailedPayment(tx, payment.id, PaymentStatus.FAILED, 'Webhook reported failure');
          }
        });

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
