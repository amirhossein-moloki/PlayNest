import { Request, Response } from 'express';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import * as PublicMediaService from './media.public.station';

type PublicSalonRequest = Request & {
  tenant?: { gamingCenterId: string; gamingCenterSlug: string };
};

export async function getPublicMedia(req: PublicSalonRequest, res: Response) {
  const gamingCenterId = req.tenant?.gamingCenterId;

  if (!gamingCenterId) {
    throw new AppError('GamingCenter context is missing from the request.', httpStatus.BAD_REQUEST);
  }

  const media = await PublicMediaService.getPublicMediaBySalon(gamingCenterId);
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=300');
  res.ok(media);
}
