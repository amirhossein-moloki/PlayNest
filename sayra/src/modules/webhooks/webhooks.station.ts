import { PaymentStatus } from '@prisma/client';
import { IdempotencyStatus } from '../../types/idempotency';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { IdempotencyRepo } from '../../common/repositories/idempotency.repo';
import { PaymentsRepo } from '../payments/payments.repo';
import { queueAnalyticsSync } from '../../jobs/producers/analytics.producer';
import logger from '../../config/logger';
import { eventEmitter, AppEvents } from '../../common/events/event-emitter';
import { prisma } from '../../config/prisma';

const processPaymentWebhook = async ({
  provider,
  payload,
}: {
  provider: string;
  payload: { eventId: string; paymentId: string; status: 'SUCCEEDED' | 'FAILED' | 'EXPIRED'; amount?: number };
  signature?: string | null;
}) => {
  const { eventId, paymentId, status: eventStatus, amount } = payload;

  if (!eventId || !paymentId || !eventStatus) {
    throw new AppError('Invalid payload.', httpStatus.BAD_REQUEST);
  }

  const idempotencyScope = `payment-webhook:${provider}`;

  // 1. Check if this event has been processed before
  const existingKey = await IdempotencyRepo.findKey(idempotencyScope, eventId);

  if (existingKey) {
    // If it's completed, we're done. Acknowledge receipt.
    // If it failed, we could allow a retry, but for now, we'll just acknowledge.
    // If it's in progress, this is a race condition. Let the provider retry.
    if (existingKey.status === IdempotencyStatus.IN_PROGRESS) {
      throw new AppError('Request is already being processed.', httpStatus.CONFLICT);
    }
    // For COMPLETED or FAILED, we return success to stop retries.
    return;
  }

  // 2. Create the idempotency key before processing
  try {
    await IdempotencyRepo.createKey({
      key: eventId,
      scope: idempotencyScope,
      requestHash: '', // Webhooks use eventId for idempotency, no payload hashing needed here
      status: IdempotencyStatus.IN_PROGRESS,
      // Set a reasonable expiry, e.g., 24 hours
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (error.code === 'P2002') {
      const racedKey = await IdempotencyRepo.findKey(idempotencyScope, eventId);

      if (racedKey) {
        if (racedKey.status === IdempotencyStatus.IN_PROGRESS) {
          throw new AppError('Request is already being processed.', httpStatus.CONFLICT);
        }
        return;
      }
    }
    throw error;
  }

  // 3. Process the event in a transaction
  try {
    // We use PaymentsRepo's access to prisma transaction or just use prisma directly if no other choice,
    // but better to have a repo method or use the common pattern.
    // Since WebhooksStation is cross-cutting, we might use prisma transaction here but use repos inside.
    await PaymentsRepo.transaction(async (tx) => {
      // Find the payment record
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { reservation: true },
      });

      if (!payment) {
        // We still need to mark the idempotency key as failed
        throw new AppError('Payment not found.', httpStatus.NOT_FOUND);
      }

      if (payment.provider && provider && payment.provider.toUpperCase() !== provider.toUpperCase()) {
        throw new AppError('Payment provider mismatch.', httpStatus.BAD_REQUEST);
      }

      if (amount !== undefined) {
        const expectedGatewayAmount = payment.amount - (payment.walletAmount || 0);
        if (amount !== expectedGatewayAmount && amount !== payment.amount) {
          throw new AppError('Payment amount mismatch.', httpStatus.BAD_REQUEST);
        }
      }

      // Apply the state machine logic
      switch (eventStatus) {
      case 'SUCCEEDED': {
        await PaymentsRepo.handleSuccessfulPayment(tx, paymentId);
        if (payment.bookingHoldId) {
          const { BookingHoldStation } = await import('../booking-hold/booking-hold.station');
          await BookingHoldStation.convertHoldToReservations(payment.bookingHoldId, payment.id, tx);
        }
        break;
      }
      case 'FAILED':
        if (payment.status !== PaymentStatus.PAID) {
          await PaymentsRepo.handleFailedPayment(tx, paymentId);
        }
        break;
      case 'EXPIRED':
        // Assuming EXPIRED is a type of failure for the reservation state
        if (payment.status !== PaymentStatus.PAID) {
          await PaymentsRepo.handleFailedPayment(tx, paymentId, PaymentStatus.CANCELED);
        }
        break;
      default:
        // Should not happen if payload validation is good
        throw new AppError(`Unknown event status: ${eventStatus}`, httpStatus.BAD_REQUEST);
      }

    });

    try {
      const refreshedPayment = typeof prisma.payment?.findUnique === 'function'
        ? await prisma.payment.findUnique({ where: { id: paymentId } })
        : null;

      if (eventStatus === 'SUCCEEDED' && refreshedPayment) {
        eventEmitter.emit(AppEvents.PAYMENT_SUCCESS, { payment: refreshedPayment });
      } else if (eventStatus === 'FAILED' && refreshedPayment) {
        eventEmitter.emit(AppEvents.PAYMENT_FAILED, {
          payment: refreshedPayment,
          failureReason: 'Webhook reported failure',
        });
      }
    } catch (evtErr) {
      logger.warn({ err: evtErr, paymentId }, 'Failed to emit payment webhook event');
    }

    // Sync analytics - properly awaited with structured logger
    try {
      await queueAnalyticsSync({ type: 'PAYMENT', entityId: paymentId });
    } catch (analyticsError) {
      logger.error({
        msg: 'Failed to queue analytics sync for payment webhook',
        paymentId,
        eventId,
        error: analyticsError,
      });
    }

    // Mark the idempotency key as completed outside the DB transaction
    await IdempotencyRepo.updateKey(idempotencyScope, eventId, { status: IdempotencyStatus.COMPLETED });
  } catch (error) {
    // If anything goes wrong, mark the key as failed to allow for potential retries
    await IdempotencyRepo.updateKey(idempotencyScope, eventId, { status: IdempotencyStatus.FAILED });
    // Re-throw the original error
    throw error;
  }
};

export const WebhooksStation = {
  processPaymentWebhook,
};
