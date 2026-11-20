import { z } from 'zod';
import { idSchema } from '../../common/validators/common.validators';

export const InitPaymentValidators = z.object({
  params: z.object({
    gamingCenterId: idSchema('Invalid gamingCenterId'),
    reservationId: idSchema('Invalid reservationId'),
  }),
  body: z
    .object({
      provider: z.string().optional(),
      useWallet: z.boolean().optional(),
    })
    .optional(),
});

export const CalculatePaymentValidators = z.object({
  params: z.object({
    gamingCenterId: idSchema('Invalid gamingCenterId'),
    reservationId: idSchema('Invalid reservationId'),
  }),
  query: z
    .object({
      useWallet: z
        .string()
        .optional()
        .transform((val) => val === 'true' || val === '1'),
    })
    .optional(),
});

export const VerifyPaymentValidators = z.object({
  params: z.object({
    gamingCenterId: idSchema('Invalid gamingCenterId'),
    reservationId: idSchema('Invalid reservationId'),
  }),
});

export const GetPaymentStatusValidators = z.object({
  params: z.object({
    gamingCenterId: idSchema('Invalid gamingCenterId'),
    reservationId: idSchema('Invalid reservationId'),
  }),
});

export const RequestRefundValidators = z.object({
  params: z.object({
    gamingCenterId: idSchema('Invalid gamingCenterId'),
    paymentId: idSchema('Invalid paymentId'),
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
    gamingCenterId: idSchema('Invalid gamingCenterId'),
    paymentId: idSchema('Invalid paymentId'),
    refundId: idSchema('Invalid refundId'),
  }),
});

export const ListRefundsValidators = z.object({
  params: z.object({
    gamingCenterId: idSchema('Invalid gamingCenterId'),
    paymentId: idSchema('Invalid paymentId'),
  }),
});

export const GetLedgerValidators = z.object({
  params: z.object({
    gamingCenterId: idSchema('Invalid gamingCenterId'),
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
    gamingCenterId: idSchema('Invalid gamingCenterId'),
  }),
  body: z.object({
    paymentId: z.string().optional(),
    limit: z.number().int().positive().optional(),
  }).optional(),
});
