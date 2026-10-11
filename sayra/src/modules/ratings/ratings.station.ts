import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import * as reviewsRepo from './ratings.repo';
import { SubmitReviewInput } from './ratings.types';
import { RatingStatus, ReservationStatus } from '@prisma/client';
import { queueAnalyticsSync } from '../../jobs/producers/analytics.producer';

export async function submitReview(gamingCenterSlug: string, input: SubmitReviewInput) {
  // 1. Verify reservation exists and belongs to the gamingCenter (by slug)
  const reservation = await reviewsRepo.findReservationForReview(input.reservationId, gamingCenterSlug);

  if (!reservation) {
    throw new AppError('Reservation not found', httpStatus.NOT_FOUND);
  }

  // 2. check if reservation is completed
  if (reservation.status !== ReservationStatus.COMPLETED) {
    throw new AppError('Only completed reservation can be reviewed', httpStatus.BAD_REQUEST);
  }

  // 3. Create the rating
  // Use the customerAccountId from the reservation
  const rating = await reviewsRepo.createReview(reservation.gamingCenterId, reservation.customerAccountId, input);

  // Sync analytics
  queueAnalyticsSync({ type: 'REVIEW', entityId: rating.id }).catch(console.error);

  return rating;
}

export async function getPublishedReviews(gamingCenterSlug: string) {
  return reviewsRepo.findPublishedReviewsByGamingCenterSlug(gamingCenterSlug);
}

export async function moderateReview(gamingCenterId: string, reviewId: string, status: RatingStatus) {
  const rating = await reviewsRepo.findReviewById(reviewId, gamingCenterId);
  if (!rating) {
    throw new AppError('Rating not found', httpStatus.NOT_FOUND);
  }

  const updatedReview = await reviewsRepo.updateReviewStatus(reviewId, gamingCenterId, status);

  // Sync analytics
  queueAnalyticsSync({ type: 'REVIEW', entityId: reviewId }).catch(console.error);

  return updatedReview;
}
