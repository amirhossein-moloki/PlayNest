import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import * as reviewsRepo from './ratings.repo';
import { SubmitReviewInput } from './ratings.types';
import { RatingStatus, ReservationStatus, NotificationType } from '@prisma/client';
import { queueAnalyticsSync } from '../../jobs/producers/analytics.producer';
import { NotificationStation } from '../notifications/notifications.station';
import logger from '../../config/logger';
import { recordGamingCenterChangeEvent } from '../integrations/outbox.service';

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

  void recordGamingCenterChangeEvent({
    gamingCenterId: reservation.gamingCenterId,
    gamingCenterSlug,
    eventType: 'GAMING_CENTER_REVIEW_CHANGED',
    changedFields: ['ratings'],
    metadata: { ratingId: rating.id, action: 'CREATED', status: rating.status },
  });

  // Notify GameCenter staff/managers of new review
  NotificationStation.notifyGameCenter({
    gamingCenterId: reservation.gamingCenterId,
    type: NotificationType.GAME_CENTER_REVIEW_RECEIVED,
    templateKey: 'GAME_CENTER_REVIEW_RECEIVED',
    templateParams: {
      gameCenterName: (reservation as any).gamingCenter?.name || gamingCenterSlug,
      customerName: (reservation as any).customerAccount?.fullName || 'Customer',
      rating: input.rating,
    },
    metadata: { reviewId: rating.id, reservationId: input.reservationId, rating: input.rating },
    entityType: 'Rating',
    entityId: rating.id,
  }).catch((err) => {
    logger.warn({ msg: 'Failed to notify GameCenter of review', error: err });
  });

  return rating;
}

export async function getPublishedReviews(gamingCenterSlug: string) {
  return reviewsRepo.findPublishedReviewsByGamingCenterSlug(gamingCenterSlug);
}

export async function getManagerReviews(gamingCenterId: string, status?: RatingStatus) {
  return reviewsRepo.findReviewsByGamingCenterId(gamingCenterId, status);
}

export async function moderateReview(gamingCenterId: string, reviewId: string, status: RatingStatus) {
  const rating = await reviewsRepo.findReviewById(reviewId, gamingCenterId);
  if (!rating) {
    throw new AppError('Rating not found', httpStatus.NOT_FOUND);
  }

  const updatedReview = await reviewsRepo.updateReviewStatus(reviewId, gamingCenterId, status);

  // Sync analytics
  queueAnalyticsSync({ type: 'REVIEW', entityId: reviewId }).catch(console.error);

  void recordGamingCenterChangeEvent({
    gamingCenterId,
    eventType: 'GAMING_CENTER_REVIEW_CHANGED',
    changedFields: ['ratings'],
    metadata: { ratingId: reviewId, action: 'MODERATED', status },
  });

  return updatedReview;
}

export async function replyToReview(
  gamingCenterId: string,
  reviewId: string,
  replyComment: string,
  repliedById?: string
) {
  const rating = await reviewsRepo.findReviewById(reviewId, gamingCenterId);
  if (!rating) {
    throw new AppError('Rating not found', httpStatus.NOT_FOUND);
  }

  return reviewsRepo.replyToReview(reviewId, gamingCenterId, replyComment, repliedById);
}

export async function deleteReviewReply(gamingCenterId: string, reviewId: string) {
  const rating = await reviewsRepo.findReviewById(reviewId, gamingCenterId);
  if (!rating) {
    throw new AppError('Rating not found', httpStatus.NOT_FOUND);
  }

  return reviewsRepo.deleteReviewReply(reviewId, gamingCenterId);
}
