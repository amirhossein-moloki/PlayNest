import { z } from 'zod';

export const chargeWalletSchema = z.object({
  body: z.object({
    amount: z.number().int().positive('Amount must be a positive integer'),
    currency: z.string().optional().default('IRT'),
  }),
});

export const getChargeStatusSchema = z.object({
  params: z.object({
    chargeId: z.string().min(1, 'Charge ID is required'),
  }),
});
