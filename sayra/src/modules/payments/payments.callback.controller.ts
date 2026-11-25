import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { PaymentsRepo } from './payments.repo';
import { PaymentProviderFactory } from './providers';
import { PaymentStatus } from '@prisma/client';
import logger from '../../config/logger';
import { env } from '../../config/env';
import { eventEmitter, AppEvents } from '../../common/events/event-emitter';

/**
 * Builds a redirect URL safely attaching query parameters.
 */
function buildRedirectUrl(baseUrl: string, params: Record<string, string | number | undefined | null>): string {
  try {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  } catch {
    const queryParts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      }
    }
    const separator = baseUrl.includes('?') ? '&' : '?';
    return queryParts.length > 0 ? `${baseUrl}${separator}${queryParts.join('&')}` : baseUrl;
  }
}

export function getPaymentSuccessRedirectUrl(params: {
  orderId?: string | null;
  amount?: number | null;
  currency?: string | null;
  trackId?: string | number | null;
  refNumber?: string | null;
  message?: string | null;
  type?: string | null;
}): string {
  const baseUrl = env.PAYMENT_SUCCESS_URL || `${env.FRONTEND_URL.replace(/\/+$/, '')}/payment/success`;
  return buildRedirectUrl(baseUrl, {
    orderId: params.orderId,
    amount: params.amount,
    currency: params.currency,
    trackId: params.trackId,
    refNumber: params.refNumber,
    message: params.message,
    type: params.type,
    status: 'success',
  });
}

export function getPaymentFailedRedirectUrl(params: {
  orderId?: string | null;
  trackId?: string | number | null;
  failureReason?: string | null;
  message?: string | null;
  type?: string | null;
}): string {
  const baseUrl = env.PAYMENT_FAILED_URL || `${env.FRONTEND_URL.replace(/\/+$/, '')}/payment/failed`;
  return buildRedirectUrl(baseUrl, {
    orderId: params.orderId,
    trackId: params.trackId,
    failureReason: params.failureReason,
    message: params.message,
    type: params.type,
    status: 'failed',
  });
}

export async function handlePaymentCallback(req: Request, res: Response): Promise<void> {
  const authorityQuery =
    req.query.Authority ||
    req.query.authority ||
    req.query.trackId ||
    req.body?.Authority ||
    req.body?.authority ||
    req.body?.trackId;
  const statusQuery = req.query.Status || req.query.status || req.body?.Status || req.body?.status;
  const successQuery = req.query.success || req.body?.success;
  const orderIdQuery = req.query.orderId || req.body?.orderId;

  const authority = authorityQuery ? String(authorityQuery) : undefined;
  const orderId = orderIdQuery ? String(orderIdQuery) : undefined;
  const status = statusQuery ? String(statusQuery).toUpperCase() : undefined;

  if (!authority) {
    logger.warn({ orderId }, 'Payment Callback: Missing Authority/trackId in callback');
    const redirectUrl = getPaymentFailedRedirectUrl({
      orderId,
      message: 'شناسه پیگیری پرداخت در درخواست بازگشت درگاه یافت نشد.',
    });
    res.redirect(302, redirectUrl);
    return;
  }

  // 1. Locate payment durable record strictly by authoritative providerPaymentId
  const payment = await prisma.payment.findFirst({
    where: {
      providerPaymentId: authority,
    },
    include: {
      reservation: true,
      bookingHold: true,
      groupBooking: true,
    },
  });

  if (!payment) {
    logger.warn({ authority, orderId }, 'Payment Callback: Payment record not found in database');
    const redirectUrl = getPaymentFailedRedirectUrl({
      trackId: authority,
      orderId,
      message: 'تراکنش پرداخت متناظر در سیستم یافت نشد.',
    });
    res.redirect(302, redirectUrl);
    return;
  }

  if (payment.providerPaymentId !== authority) {
    logger.warn({ authority, orderId, paymentId: payment.id }, 'Payment Callback: Authority mismatch');
    const redirectUrl = getPaymentFailedRedirectUrl({
      trackId: authority,
      orderId,
      message: 'شناسه پیگیری پرداخت با تراکنش ثبت‌شده مطابقت ندارد.',
    });
    res.redirect(302, redirectUrl);
    return;
  }

  // 2. Idempotency check: If already paid, redirect to success URL
  const paymentInitialOrderId = payment.reservationId || payment.bookingHoldId || payment.groupBookingId || payment.id;
  if (payment.status === PaymentStatus.PAID) {
    const redirectUrl = getPaymentSuccessRedirectUrl({
      orderId: paymentInitialOrderId,
      amount: payment.amount,
      currency: payment.currency,
      trackId: payment.providerPaymentId || authority,
      refNumber: payment.referenceCode,
      message: 'این پرداخت قبلاً با موفقیت تأیید و ثبت شده است.',
    });
    res.redirect(302, redirectUrl);
    return;
  }

  // 3. Check gateway preliminary status before calling verify (e.g. NOK or user cancel)
  const isFailedStatus =
    (status && status !== 'OK' && status !== '1' && status !== '2') ||
    successQuery === '0' ||
    successQuery === 'false';

  if (isFailedStatus) {
    const failedPayment = await PaymentsRepo.transaction(async (tx) => {
      return await PaymentsRepo.handleFailedPayment(
        tx,
        payment.id,
        PaymentStatus.FAILED,
        `Gateway callback returned unfulfilled status: status=${statusQuery}`
      );
    });

    eventEmitter.emit(AppEvents.PAYMENT_FAILED, {
      payment: failedPayment,
      failureReason: 'پرداخت در درگاه بانکی لغو شد یا با خطا متوقف گردید.',
    });

    const redirectUrl = getPaymentFailedRedirectUrl({
      orderId: paymentInitialOrderId,
      trackId: authority,
      failureReason: 'پرداخت در درگاه بانکی لغو شد یا با خطا متوقف گردید.',
    });
    res.redirect(302, redirectUrl);
    return;
  }

  // 4. Server-to-server authoritative verification via SDK
  const provider = PaymentProviderFactory.getProvider(payment.provider || 'ZARINPAL');
  const gatewayExpectedAmount = payment.amount - (payment.walletAmount || 0);

  const verifyResult = await provider.verifyPayment({
    authority,
    amount: gatewayExpectedAmount,
    metadata: {
      orderId: paymentInitialOrderId,
      reservationId: payment.reservationId,
      paymentId: payment.id,
    },
  });

  // 5. Atomic database status update based strictly on verify result
  try {
    const finalPayment = await PaymentsRepo.transaction(async (tx) => {
      if (verifyResult.success) {
        let updated = await PaymentsRepo.handleSuccessfulPayment(tx, payment.id, verifyResult.refId);
        if (payment.bookingHoldId) {
          const { BookingHoldStation } = await import('../booking-hold/booking-hold.station');
          await BookingHoldStation.convertHoldToReservations(payment.bookingHoldId, payment.id, tx);
          if (typeof tx.payment?.findUnique === 'function') {
            const refreshed = await tx.payment.findUnique({
              where: { id: payment.id },
            });
            if (refreshed) {
              updated = refreshed;
            }
          }
        }
        return updated;
      } else {
        return PaymentsRepo.handleFailedPayment(
          tx,
          payment.id,
          verifyResult.status,
          verifyResult.failureReason
        );
      }
    });

    const finalOrderId = finalPayment.reservationId || finalPayment.bookingHoldId || finalPayment.id;
    if (verifyResult.success) {
      eventEmitter.emit(AppEvents.PAYMENT_SUCCESS, { payment: finalPayment });

      const redirectUrl = getPaymentSuccessRedirectUrl({
        orderId: finalOrderId,
        amount: finalPayment.amount,
        currency: finalPayment.currency,
        trackId: finalPayment.providerPaymentId || authority,
        refNumber: finalPayment.referenceCode,
      });
      res.redirect(302, redirectUrl);
    } else {
      eventEmitter.emit(AppEvents.PAYMENT_FAILED, {
        payment: finalPayment,
        failureReason: finalPayment.failureReason || 'تأییدیه نهایی توسط درگاه بانکی صادر نشد.',
      });

      const redirectUrl = getPaymentFailedRedirectUrl({
        orderId: finalOrderId,
        trackId: authority,
        failureReason: finalPayment.failureReason || 'تأییدیه نهایی توسط درگاه بانکی صادر نشد.',
      });
      res.redirect(302, redirectUrl);
    }
  } catch (error) {
    logger.error({ error, paymentId: payment.id, authority }, 'Error processing verified payment transaction');
    const redirectUrl = getPaymentFailedRedirectUrl({
      orderId: paymentInitialOrderId,
      trackId: authority,
      failureReason: 'خطای داخلی سرور در به‌روزرسانی وضعیت سفارش.',
    });
    res.redirect(302, redirectUrl);
  }
}

export async function handleZibalWalletCallback(req: Request, res: Response): Promise<void> {
  const trackIdQuery = req.query.trackId;
  const statusQuery = req.query.status;
  const successQuery = req.query.success;
  const orderIdQuery = req.query.orderId;

  const trackId = trackIdQuery ? String(trackIdQuery) : undefined;
  const orderId = orderIdQuery ? String(orderIdQuery) : undefined;

  if (!trackId && !orderId) {
    const redirectUrl = getPaymentFailedRedirectUrl({
      type: 'wallet_charge',
      message: 'شناسه پیگیری (trackId) یا شماره سفارش در درخواست بازگشت درگاه یافت نشد.',
    });
    res.redirect(302, redirectUrl);
    return;
  }

  const { WalletChargeStation } = await import('../wallet/charge.station');

  try {
    const result = await WalletChargeStation.verifyCharge({
      trackId: trackId || '',
      orderId,
      statusQuery: statusQuery as string | number | undefined,
      successQuery: successQuery as string | number | undefined,
    });

    if (result.success && result.charge) {
      const redirectUrl = getPaymentSuccessRedirectUrl({
        orderId: result.charge.id,
        amount: result.charge.amount,
        currency: result.charge.currency,
        trackId: result.charge.trackId || trackId,
        refNumber: result.refNumber || result.charge.refNumber,
        type: 'wallet_charge',
        message: result.alreadyProcessed ? 'این شارژ کیف پول قبلاً با موفقیت تأیید و ثبت شده است.' : undefined,
      });
      res.redirect(302, redirectUrl);
      return;
    } else {
      const redirectUrl = getPaymentFailedRedirectUrl({
        orderId: result.charge?.id || orderId,
        trackId,
        type: 'wallet_charge',
        failureReason: result.failureReason || 'پرداخت شارژ کیف پول ناموفق بود یا توسط درگاه رد شد.',
      });
      res.redirect(302, redirectUrl);
      return;
    }
  } catch (error) {
    logger.error({ error, trackId, orderId }, 'Error processing verified wallet charge callback');
    const redirectUrl = getPaymentFailedRedirectUrl({
      orderId,
      trackId,
      type: 'wallet_charge',
      failureReason: 'خطای داخلی سرور در به‌روزرسانی موجودی کیف پول.',
    });
    res.redirect(302, redirectUrl);
  }
}

export async function handleZibalCallback(req: Request, res: Response): Promise<void> {
  const trackIdQuery = req.query.trackId;
  const statusQuery = req.query.status;
  const successQuery = req.query.success;
  const orderIdQuery = req.query.orderId;

  const trackId = trackIdQuery ? String(trackIdQuery) : undefined;
  const orderId = orderIdQuery ? String(orderIdQuery) : undefined;

  if (!trackId) {
    const redirectUrl = getPaymentFailedRedirectUrl({
      message: 'شناسه پیگیری (trackId) در درخواست بازگشت درگاه یافت نشد.',
    });
    res.redirect(302, redirectUrl);
    return;
  }

  // 1. Locate payment durable record strictly by authoritative trackId (stored in providerPaymentId)
  const payment = await prisma.payment.findFirst({
    where: {
      providerPaymentId: trackId,
    },
    include: {
      reservation: true,
      bookingHold: true,
      groupBooking: true,
    },
  });

  if (!payment) {
    // Check if this callback belongs to a WalletCharge matching trackId strictly
    const walletCharge = await prisma.walletCharge.findFirst({
      where: {
        trackId,
      },
    });

    if (walletCharge) {
      return handleZibalWalletCallback(req, res);
    }

    logger.warn({ trackId, orderId }, 'Zibal Callback: Payment record not found in database');
    const redirectUrl = getPaymentFailedRedirectUrl({
      trackId,
      orderId,
      message: 'تراکنش پرداخت متناظر در سیستم یافت نشد.',
    });
    res.redirect(302, redirectUrl);
    return;
  }

  if (payment.providerPaymentId !== trackId) {
    logger.warn({ trackId, orderId, paymentId: payment.id }, 'Zibal Callback: trackId mismatch');
    const redirectUrl = getPaymentFailedRedirectUrl({
      trackId,
      orderId,
      message: 'شناسه پیگیری با تراکنش ثبت‌شده مطابقت ندارد.',
    });
    res.redirect(302, redirectUrl);
    return;
  }

  // 2. Idempotency check: If already paid, redirect to success URL without repeating transactions/ledger/commissions
  const paymentInitialOrderId = payment.reservationId || payment.bookingHoldId || payment.id;
  if (payment.status === PaymentStatus.PAID) {
    const redirectUrl = getPaymentSuccessRedirectUrl({
      orderId: paymentInitialOrderId,
      amount: payment.amount,
      currency: payment.currency,
      trackId: payment.providerPaymentId || trackId,
      refNumber: payment.referenceCode,
      message: 'این پرداخت قبلاً با موفقیت تأیید و ثبت شده است.',
    });
    res.redirect(302, redirectUrl);
    return;
  }

  // 3. Check gateway preliminary status before calling verify
  const isFailedStatus =
    (statusQuery !== undefined && Number(statusQuery) !== 1 && Number(statusQuery) !== 2) ||
    successQuery === '0' ||
    successQuery === 'false';

  if (isFailedStatus) {
    const failedPayment = await PaymentsRepo.transaction(async (tx) => {
      return await PaymentsRepo.handleFailedPayment(
        tx,
        payment.id,
        PaymentStatus.FAILED,
        `Zibal callback returned unfulfilled status: status=${statusQuery}, success=${successQuery}`
      );
    });

    eventEmitter.emit(AppEvents.PAYMENT_FAILED, {
      payment: failedPayment,
      failureReason: 'پرداخت در درگاه بانکی لغو شد یا با خطا متوقف گردید.',
    });

    const redirectUrl = getPaymentFailedRedirectUrl({
      orderId: paymentInitialOrderId,
      trackId,
      failureReason: 'پرداخت در درگاه بانکی لغو شد یا با خطا متوقف گردید.',
    });
    res.redirect(302, redirectUrl);
    return;
  }

  // 4. Server-to-server authoritative verification via SDK
  const provider = PaymentProviderFactory.getProvider('ZIBAL');
  const gatewayExpectedAmount = payment.amount - (payment.walletAmount || 0);

  const verifyResult = await provider.verifyPayment({
    authority: trackId,
    amount: gatewayExpectedAmount,
    metadata: {
      orderId: paymentInitialOrderId,
      reservationId: payment.reservationId,
      paymentId: payment.id,
    },
  });

  // 5. Atomic database status update based strictly on verify result
  try {
    const finalPayment = await PaymentsRepo.transaction(async (tx) => {
      if (verifyResult.success) {
        let updated = await PaymentsRepo.handleSuccessfulPayment(tx, payment.id, verifyResult.refId);
        if (payment.bookingHoldId) {
          const { BookingHoldStation } = await import('../booking-hold/booking-hold.station');
          await BookingHoldStation.convertHoldToReservations(payment.bookingHoldId, payment.id, tx);
          if (typeof tx.payment?.findUnique === 'function') {
            const refreshed = await tx.payment.findUnique({
              where: { id: payment.id },
            });
            if (refreshed) {
              updated = refreshed;
            }
          }
        }
        return updated;
      } else {
        return PaymentsRepo.handleFailedPayment(
          tx,
          payment.id,
          verifyResult.status,
          verifyResult.failureReason
        );
      }
    });

    const finalOrderId = finalPayment.reservationId || finalPayment.bookingHoldId || finalPayment.id;
    if (verifyResult.success) {
      eventEmitter.emit(AppEvents.PAYMENT_SUCCESS, { payment: finalPayment });

      const redirectUrl = getPaymentSuccessRedirectUrl({
        orderId: finalOrderId,
        amount: finalPayment.amount,
        currency: finalPayment.currency,
        trackId: finalPayment.providerPaymentId || trackId,
        refNumber: finalPayment.referenceCode,
      });
      res.redirect(302, redirectUrl);
    } else {
      eventEmitter.emit(AppEvents.PAYMENT_FAILED, {
        payment: finalPayment,
        failureReason: finalPayment.failureReason || 'تأییدیه نهایی توسط زیبال صادر نشد.',
      });

      const redirectUrl = getPaymentFailedRedirectUrl({
        orderId: finalOrderId,
        trackId,
        failureReason: finalPayment.failureReason || 'تأییدیه نهایی توسط زیبال صادر نشد.',
      });
      res.redirect(302, redirectUrl);
    }
  } catch (error) {
    logger.error({ error, paymentId: payment.id, trackId }, 'Error processing verified payment transaction');
    const redirectUrl = getPaymentFailedRedirectUrl({
      orderId: paymentInitialOrderId,
      trackId,
      failureReason: 'خطای داخلی سرور در به‌روزرسانی وضعیت سفارش.',
    });
    res.redirect(302, redirectUrl);
  }
}
