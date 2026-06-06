import { z } from 'zod';
import { ReservationStatus } from '@prisma/client';

const CUID_MESSAGE = 'Invalid CUID';

export const getCustomerReservationSchema = z.object({
  query: z.object({
    page: z.preprocess((val) => Number(val), z.number().int().min(1)).optional(),
    pageSize: z.preprocess((val) => Number(val), z.number().int().min(1).max(100)).optional(),
    status: z.nativeEnum(ReservationStatus).optional(),
    gamingCenterId: z.string().cuid(CUID_MESSAGE).optional(),
  }),
});

export const customerCancelReservationSchema = z.object({
  params: z.object({
    reservationId: z.string().cuid(CUID_MESSAGE),
  }),
  body: z.object({
    reason: z.string().max(500).optional(),
  }),
});

export const customerSubmitReviewSchema = z.object({
  params: z.object({
    reservationId: z.string().cuid(CUID_MESSAGE),
  }),
  body: z.object({
    stationId: z.string().cuid(CUID_MESSAGE).optional(),
    rating: z.number().min(1).max(5),
    comment: z.string().max(1000).optional(),
  }),
});

export type GetCustomerReservationQuery = z.infer<typeof getCustomerReservationSchema>['query'];
export type CustomerCancelReservationInput = z.infer<typeof customerCancelReservationSchema>['body'];
export type CustomerSubmitReviewInput = z.infer<typeof customerSubmitReviewSchema>['body'];
