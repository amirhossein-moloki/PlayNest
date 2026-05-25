import { RatingStatus, RatingTarget } from '@prisma/client';

export interface SubmitReviewInput {
  reservationId: string;
  target: RatingTarget;
  stationId?: string;
  rating: number;
  comment?: string;
}

export interface ModerateReviewInput {
  status: RatingStatus;
}
