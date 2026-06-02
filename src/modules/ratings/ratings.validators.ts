import { z } from 'zod';
import { RatingStatus } from '@prisma/client';

export const submitReviewSchema = z.object({
  body: z.object({
    reservationId: z.string().cuid(),
    stationId: z.string().cuid().optional(),
    rating: z.number().min(1).max(5),
    comment: z.string().optional(),
  }),
  params: z.object({
    gamingCenterSlug: z.string(),
  }),
});

export const moderateReviewSchema = z.object({
  body: z.object({
    status: z.nativeEnum(RatingStatus),
  }),
  params: z.object({
    gamingCenterId: z.string().cuid(),
    id: z.string().cuid(),
  }),
});

export const getReviewsSchema = z.object({
  params: z.object({
    gamingCenterSlug: z.string(),
  }),
});
