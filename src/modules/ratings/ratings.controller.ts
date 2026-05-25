import { Request, Response, NextFunction } from 'express';
import * as reviewsService from './ratings.station';

export async function submitReview(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterSlug } = req.params;
    const rating = await reviewsService.submitReview(gamingCenterSlug, req.body);
    res.created(rating);
  } catch (error) {
    next(error);
  }
}

export async function getReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterSlug } = req.params;
    const ratings = await reviewsService.getPublishedReviews(gamingCenterSlug);
    res.ok(ratings);
  } catch (error) {
    next(error);
  }
}

export async function moderateReview(req: Request, res: Response, next: NextFunction) {
  try {
    const { gamingCenterId, id } = req.params;
    const { status } = req.body;
    const rating = await reviewsService.moderateReview(gamingCenterId, id, status);
    res.ok(rating);
  } catch (error) {
    next(error);
  }
}
