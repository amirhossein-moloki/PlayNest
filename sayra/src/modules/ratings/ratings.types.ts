import { RatingStatus } from '@prisma/client';

export interface SubmitReviewInput {
  reservationId: string;
  stationId?: string;
  rating: number;
  comment?: string;
}

export interface ModerateReviewInput {
  status: RatingStatus;
}
