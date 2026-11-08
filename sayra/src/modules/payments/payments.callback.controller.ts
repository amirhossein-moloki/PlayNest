import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { PaymentsRepo } from './payments.repo';
import { PaymentProviderFactory } from './providers';
import { PaymentStatus } from '@prisma/client';
import { renderPaymentSuccessPage, renderPaymentFailurePage } from './views/payment-result.view';
import logger from '../../config/logger';

export async function handleZibalCallback(req: Request, res: Response): Promise<void> {
  const trackIdQuery = req.query.trackId;
  const statusQuery = req.query.status;
  const successQuery = req.query.success;
  const orderIdQuery = req.query.orderId;

  const trackId = trackIdQuery ? String(trackIdQuery) : undefined;
  const orderId = orderIdQuery ? String(orderIdQuery) : undefined;

  if (!trackId) {
    res.status(400).type('html').send(
      renderPaymentFailurePage({
        message: 'شناسه پیگیری (trackId) در درخواست بازگشت درگاه یافت نشد.',
      })
    );
    return;
  }

  // 1. Locate payment durable record by trackId (stored in providerPaymentId) or orderId
  let payment = await prisma.payment.findFirst({
    where: {
      providerPaymentId: trackId,
    },
    include: {
      reservation: true,
    },
  });

  if (!payment && orderId) {
    payment = await prisma.payment.findFirst({
      where: {
        OR: [{ reservationId: orderId }, { id: orderId }],
      },
      include: {
        reservation: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!payment) {
    logger.warn({ trackId, orderId }, 'Zibal Callback: Payment record not found in database');
    res.status(404).type('html').send(
      renderPaymentFailurePage({
        trackId,
        orderId,
        message: 'تراکنش پرداخت متناظر در سیستم یافت نشد.',
      })
    );
    return;
  }

  // 2. Idempotency check: If already paid, render success page without repeating transactions/ledger/commissions
  if (payment.status === PaymentStatus.PAID) {
    res.status(200).type('html').send(
      renderPaymentSuccessPage({
        orderId: payment.reservationId || payment.id,
        amount: payment.amount,
        currency: payment.currency,
        trackId: payment.providerPaymentId || trackId,
        refNumber: payment.referenceCode,
        message: 'این پرداخت قبلاً با موفقیت تأیید و ثبت شده است.',
      })
    );
    return;
  }

  // 3. Check gateway preliminary status before calling verify
  const isFailedStatus =
    (statusQuery !== undefined && Number(statusQuery) !== 1 && Number(statusQuery) !== 2) ||
    successQuery === '0' ||
    successQuery === 'false';

  if (isFailedStatus) {
    await PaymentsRepo.transaction(async (tx) => {
      await PaymentsRepo.handleFailedPayment(
        tx,
        payment.id,
        PaymentStatus.FAILED,
        `Zibal callback returned unfulfilled status: status=${statusQuery}, success=${successQuery}`
      );
    });

    res.status(400).type('html').send(
      renderPaymentFailurePage({
        orderId: payment.reservationId || payment.id,
        trackId,
        failureReason: 'پرداخت در درگاه بانکی لغو شد یا با خطا متوقف گردید.',
      })
    );
    return;
  }

  // 4. Server-to-server authoritative verification via SDK
  const provider = PaymentProviderFactory.getProvider('ZIBAL');

  const verifyResult = await provider.verifyPayment({
    authority: trackId,
    amount: payment.amount,
    metadata: {
      orderId: payment.reservationId || payment.id,
      reservationId: payment.reservationId,
    },
  });

  // 5. Atomic database status update based strictly on verify result
  try {
    const finalPayment = await PaymentsRepo.transaction(async (tx) => {
      if (verifyResult.success) {
        return PaymentsRepo.handleSuccessfulPayment(tx, payment.id, verifyResult.refId);
      } else {
        return PaymentsRepo.handleFailedPayment(
          tx,
          payment.id,
          verifyResult.status,
          verifyResult.failureReason
        );
      }
    });

    if (verifyResult.success) {
      res.status(200).type('html').send(
        renderPaymentSuccessPage({
          orderId: finalPayment.reservationId || finalPayment.id,
          amount: finalPayment.amount,
          currency: finalPayment.currency,
          trackId: finalPayment.providerPaymentId || trackId,
          refNumber: finalPayment.referenceCode,
        })
      );
    } else {
      res.status(400).type('html').send(
        renderPaymentFailurePage({
          orderId: finalPayment.reservationId || finalPayment.id,
          trackId,
          failureReason: finalPayment.failureReason || 'تأییدیه نهایی توسط زیبال صادر نشد.',
        })
      );
    }
  } catch (error) {
    logger.error({ error, paymentId: payment.id, trackId }, 'Error processing verified payment transaction');
    res.status(500).type('html').send(
      renderPaymentFailurePage({
        orderId: payment.reservationId || payment.id,
        trackId,
        failureReason: 'خطای داخلی سرور در به‌روزرسانی وضعیت سفارش.',
      })
    );
  }
}
