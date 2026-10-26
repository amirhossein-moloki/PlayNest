import { z } from 'zod';
import { isCuid } from '@paralleldrive/cuid2';

export const InitPaymentValidators = z.object({
  params: z.object({
    gamingCenterId: z.string().refine((val) => isCuid(val), {
      message: 'Invalid gamingCenterId',
    }),
    reservationId: z.string().refine((val) => isCuid(val), {
      message: 'Invalid reservationId',
    }),
  }),
  body: z
    .object({
      provider: z.string().optional(),
    })
    .optional(),
});

export const VerifyPaymentValidators = z.object({
  params: z.object({
    gamingCenterId: z.string().refine((val) => isCuid(val), {
      message: 'Invalid gamingCenterId',
    }),
    reservationId: z.string().refine((val) => isCuid(val), {
      message: 'Invalid reservationId',
    }),
  }),
});

export const GetPaymentStatusValidators = z.object({
  params: z.object({
    gamingCenterId: z.string().refine((val) => isCuid(val), {
      message: 'Invalid gamingCenterId',
    }),
    reservationId: z.string().refine((val) => isCuid(val), {
      message: 'Invalid reservationId',
    }),
  }),
});

export const RequestRefundValidators = z.object({
  params: z.object({
    gamingCenterId: z.string().refine((val) => isCuid(val), { message: 'Invalid gamingCenterId' }),
    paymentId: z.string().refine((val) => isCuid(val), { message: 'Invalid paymentId' }),
  }),
  body: z.object({
    amount: z.number().int().positive('Amount must be a positive integer'),
    currency: z.string().min(1, 'Currency is required'),
    reason: z.string().max(500).optional(),
    provider: z.string().optional(),
  }),
});

export const GetRefundValidators = z.object({
  params: z.object({
    gamingCenterId: z.string().refine((val) => isCuid(val), { message: 'Invalid gamingCenterId' }),
    paymentId: z.string().refine((val) => isCuid(val), { message: 'Invalid paymentId' }),
    refundId: z.string().refine((val) => isCuid(val), { message: 'Invalid refundId' }),
  }),
});

export const ListRefundsValidators = z.object({
  params: z.object({
    gamingCenterId: z.string().refine((val) => isCuid(val), { message: 'Invalid gamingCenterId' }),
    paymentId: z.string().refine((val) => isCuid(val), { message: 'Invalid paymentId' }),
  }),
});

export const GetLedgerValidators = z.object({
  params: z.object({
    gamingCenterId: z.string().refine((val) => isCuid(val), { message: 'Invalid gamingCenterId' }),
  }),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    entryType: z.enum(['PAYMENT_COLLECTION', 'REFUND_DISBURSEMENT', 'COMPENSATING_ADJUSTMENT']).optional(),
    paymentId: z.string().optional(),
    refundId: z.string().optional(),
  }).optional(),
});

export const ReconcileValidators = z.object({
  params: z.object({
    gamingCenterId: z.string().refine((val) => isCuid(val), { message: 'Invalid gamingCenterId' }),
  }),
  body: z.object({
    paymentId: z.string().optional(),
    limit: z.number().int().positive().optional(),
  }).optional(),
});
