import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import * as reviewsStation from './ratings.station';
import { RatingStatus } from '@prisma/client';
import AppError from '../../common/errors/AppError';
import { invalidatePublicCacheByPrefix } from '../../common/utils/publicCache';

export async function submitReview(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterSlug, reservationId } = req.params;
    const customerAccountId = req.actor?.id;
    if (!customerAccountId) {
      throw new AppError('Unauthorized', httpStatus.UNAUTHORIZED);
    }
    const rating = await reviewsStation.submitReview(
      gamingCenterSlug,
      reservationId,
      customerAccountId,
      req.body
    );
    void invalidatePublicCacheByPrefix('public:gc:');
    res.created(rating);
  } catch (error) {
    next(error);
  }
}

export async function getReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterSlug } = req.params;
    const ratings = await reviewsStation.getPublishedReviews(gamingCenterSlug);
    res.ok(ratings);
  } catch (error) {
    next(error);
  }
}

export async function getManagerReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterId } = req.params;
    const status = req.query.status as RatingStatus | undefined;
    const ratings = await reviewsStation.getManagerReviews(gamingCenterId, status);
    res.ok(ratings);
  } catch (error) {
    next(error);
  }
}

export async function moderateReview(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterId, id } = req.params;
    const { status } = req.body;
    const rating = await reviewsStation.moderateReview(gamingCenterId, id, status);
    void invalidatePublicCacheByPrefix('public:gc:');
    res.ok(rating);
  } catch (error) {
    next(error);
  }
}

export async function replyToReview(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterId, id } = req.params;
    const replyText = (req.body.replyComment || req.body.reply || '').trim();
    const rating = await reviewsStation.replyToReview(
      gamingCenterId,
      id,
      replyText,
      req.actor?.id
    );
    void invalidatePublicCacheByPrefix('public:gc:');
    res.ok(rating);
  } catch (error) {
    next(error);
  }
}

export async function deleteReviewReply(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterId, id } = req.params;
    await reviewsStation.deleteReviewReply(gamingCenterId, id);
    void invalidatePublicCacheByPrefix('public:gc:');
    res.noContent();
  } catch (error) {
    next(error);
  }
}
