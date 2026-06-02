import { Request, Response } from 'express';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import * as PublicLinksService from './links.public.station';

type PublicGamingCenterRequest = Request & {
  tenant?: { gamingCenterId: string; gamingCenterSlug?: string };
};

export async function getPublicLinks(req: PublicGamingCenterRequest, res: Response) {
  const gamingCenterId = req.tenant?.gamingCenterId;

  if (!gamingCenterId) {
    throw new AppError('GamingCenter context is missing from the request.', httpStatus.BAD_REQUEST);
  }

  const links = await PublicLinksService.getPublicLinksByGamingCenter(gamingCenterId);
  res.ok(links);
}
