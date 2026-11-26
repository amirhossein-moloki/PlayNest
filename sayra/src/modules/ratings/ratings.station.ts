import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import * as reviewsRepo from './ratings.repo';
import { SubmitReviewInput } from './ratings.types';
import { RatingStatus, ReservationStatus, NotificationType, Prisma } from '@prisma/client';
import { queueAnalyticsSync } from '../../jobs/producers/analytics.producer';
import { NotificationStation } from '../notifications/notifications.station';
import logger from '../../config/logger';
import { recordGamingCenterChangeEvent } from '../integrations/outbox.service';
import {
  SAYRA_RATING_CUTOFF_REVIEWS,
  SAYRA_RATING_WEIGHT,
} from '../public-gamecenters/bayesian.ranking';

export async function submitReview(
  gamingCenterSlug: string,
  reservationId: string,
  customerAccountId: string,
  input: Omit<SubmitReviewInput, 'reservationId'> & { reservationId?: string }
) {
  if (input.reservationId && input.reservationId !== reservationId) {
    throw new AppError('Reservation ID in body does not match route parameter', httpStatus.BAD_REQUEST);
  }

  // 1. Verify reservation exists and belongs to the gamingCenter (by slug)
  const reservation = await reviewsRepo.findReservationForReview(reservationId, gamingCenterSlug);

  if (!reservation) {
    throw new AppError('Reservation not found', httpStatus.NOT_FOUND);
  }

  // 2. Verify reservation ownership
  if (reservation.customerAccountId !== customerAccountId) {
    throw new AppError('Forbidden: You can only review your own reservation', httpStatus.FORBIDDEN);
  }

  // 3. Check if reservation is completed
  if (reservation.status !== ReservationStatus.COMPLETED) {
    throw new AppError('Only completed reservation can be reviewed', httpStatus.BAD_REQUEST);
  }

  // 4. Derive stationId strictly from the persisted reservation
  const resolvedStationId = reservation.stationId ?? null;
  if (input.stationId && input.stationId !== resolvedStationId) {
    throw new AppError('Station ID does not match reservation', httpStatus.BAD_REQUEST);
  }

  // 5. Prevent duplicate reviews per reservation (including stationId === null)
  if (typeof reviewsRepo.findExistingReviewForReservation === 'function') {
    const existing = await reviewsRepo.findExistingReviewForReservation(
      reservation.id,
      resolvedStationId
    );
    if (existing) {
      throw new AppError('Rating already exists for this reservation/target', httpStatus.CONFLICT);
    }
  }

  // 6. Create the rating bound to authenticated customer and DB reservation
  let rating;
  try {
    rating = await reviewsRepo.createReview(reservation.gamingCenterId, customerAccountId, {
      reservationId: reservation.id,
      stationId: resolvedStationId ?? undefined,
      rating: input.rating,
      comment: input.comment,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('Rating already exists for this reservation/target', httpStatus.CONFLICT);
    }
    throw error;
  }

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
    metadata: { reviewId: rating.id, reservationId: reservation.id, rating: input.rating },
    entityType: 'Rating',
    entityId: rating.id,
  }).catch((err) => {
    logger.warn({ msg: 'Failed to notify GameCenter of review', error: err });
  });

  return rating;
}

export async function getPublishedReviews(gamingCenterSlug: string) {
  const [reviews, center] = await Promise.all([
    reviewsRepo.findPublishedReviewsByGamingCenterSlug(gamingCenterSlug),
    typeof reviewsRepo.findSayraBaselineReviewBySlug === 'function'
      ? reviewsRepo.findSayraBaselineReviewBySlug(gamingCenterSlug)
      : Promise.resolve(null),
  ]);

  if (
    center &&
    typeof center.sayraRating === 'number' &&
    Number.isFinite(center.sayraRating) &&
    center.sayraRating >= 1 &&
    center.sayraRating <= 5
  ) {
    const isActiveInScore = reviews.length < SAYRA_RATING_CUTOFF_REVIEWS;
    const sayraWeight = reviews.length === 0 ? 1 : isActiveInScore ? SAYRA_RATING_WEIGHT : 0;

    const sayraReview = {
      id: `sayra-${center.id}`,
      gamingCenterId: center.id,
      rating: center.sayraRating,
      comment: center.sayraReviewComment ?? null,
      status: RatingStatus.PUBLISHED,
      isSayraOfficial: true,
      isActiveInScore,
      sayraWeight,
      createdAt: center.sayraRatedAt ?? center.verifiedAt ?? center.createdAt,
      customerAccount: {
        fullName: 'کارشناس سایرا',
      },
      station: null,
      replyComment: null,
      replyAt: null,
      repliedBy: null,
    };

    return [sayraReview, ...reviews];
  }

  return reviews;
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
