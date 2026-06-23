import { Request, Response } from 'express';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { WebhooksStation } from './webhooks.station';

const handlePaymentWebhook = asyncHandler(async (_req: Request, res: Response) => {
  await WebhooksStation.processPaymentWebhook();

  res.ok({ message: 'Webhook received and processed.' });
});

export const WebhooksController = {
  handlePaymentWebhook,
};
