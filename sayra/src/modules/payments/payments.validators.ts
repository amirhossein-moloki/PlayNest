import { z } from 'zod';
import cuid from 'cuid';

export const InitPaymentValidators = z.object({
  params: z.object({
    gamingCenterId: z.string().refine((val) => cuid.isCuid(val), {
      message: 'Invalid gamingCenterId',
    }),
    reservationId: z.string().refine((val) => cuid.isCuid(val), {
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
    gamingCenterId: z.string().refine((val) => cuid.isCuid(val), {
      message: 'Invalid gamingCenterId',
    }),
    reservationId: z.string().refine((val) => cuid.isCuid(val), {
      message: 'Invalid reservationId',
    }),
  }),
});

export const GetPaymentStatusValidators = z.object({
  params: z.object({
    gamingCenterId: z.string().refine((val) => cuid.isCuid(val), {
      message: 'Invalid gamingCenterId',
    }),
    reservationId: z.string().refine((val) => cuid.isCuid(val), {
      message: 'Invalid reservationId',
    }),
  }),
});
