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

  // Ensure rawBody is available. This requires a specific Express setup for the route.
  if (!req.rawBody) {
    return next(new AppError('Raw body not available for signature verification.', httpStatus.INTERNAL_SERVER_ERROR));
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
