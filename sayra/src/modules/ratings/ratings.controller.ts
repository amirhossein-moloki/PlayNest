import { Request, Response, NextFunction } from 'express';
import * as reviewsStation from './ratings.station';
import { RatingStatus } from '@prisma/client';

export async function submitReview(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterSlug } = req.params;
    const rating = await reviewsStation.submitReview(gamingCenterSlug, req.body);
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
    res.ok(rating);
  } catch (error) {
    next(error);
  }
}

export async function deleteReviewReply(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterId, id } = req.params;
    await reviewsStation.deleteReviewReply(gamingCenterId, id);
    res.noContent();
  } catch (error) {
    next(error);
  }
}
