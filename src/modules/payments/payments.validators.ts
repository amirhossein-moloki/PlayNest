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
});