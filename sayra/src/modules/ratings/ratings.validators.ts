import { z } from 'zod';
import { RatingStatus } from '@prisma/client';
import { idSchema } from '../../common/validators/common.validators';

export const submitReviewSchema = z.object({
  body: z.object({
    reservationId: idSchema('Invalid reservationId format'),
    stationId: idSchema('Invalid stationId format').optional(),
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
    gamingCenterId: idSchema('Invalid gamingCenterId format'),
    id: idSchema('Invalid review ID format'),
  }),
});

export const getReviewsSchema = z.object({
  params: z.object({
    gamingCenterSlug: z.string(),
  }),
});
