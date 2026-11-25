import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../../../config/env';
import AppError from '../../../common/errors/AppError';
import httpStatus from 'http-status';

export const verifyPaymentWebhookSignature = (req: Request, res: Response, next: NextFunction) => {
  const signature = req.header('X-Signature');

  if (!signature) {
    return next(new AppError('Signature missing.', httpStatus.UNAUTHORIZED));
  }

  if (!req.rawBody || !env.PAYMENT_PROVIDER_WEBHOOK_SECRET) {
    return next(
      new AppError('Webhook verification is misconfigured or raw body is unavailable.', httpStatus.INTERNAL_SERVER_ERROR)
    );
  }

  try {
    const hmac = crypto.createHmac('sha256', env.PAYMENT_PROVIDER_WEBHOOK_SECRET);
    const computedSignature = hmac.update(req.rawBody).digest('hex');

    const isVerified = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature));

    if (!isVerified) {
      return next(new AppError('Invalid signature.', httpStatus.UNAUTHORIZED));
    }

    next();
  } catch (error) {
    return next(new AppError('Invalid signature format.', httpStatus.BAD_REQUEST));
  }
};
