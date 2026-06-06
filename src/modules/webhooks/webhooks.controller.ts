import { Request, Response } from 'express';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { WebhooksStation } from './webhooks.station';

const handlePaymentWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { provider } = req.params;
  const payload = req.body;
  const signature = req.header('X-Signature'); // Example signature header

  await WebhooksStation.processPaymentWebhook({
    provider,
    payload,
    signature: signature ?? null,
  });

  res.ok({ message: 'Webhook received and processed.' });
});

export const WebhooksController = {
  handlePaymentWebhook,
};
