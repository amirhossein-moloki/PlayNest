import { Request, Response } from 'express';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import * as PublicAddressesService from './addresses.public.station';

type PublicSalonRequest = Request & {
  tenant?: { gamingCenterId: string; gamingCenterSlug: string };
};

export async function getPublicAddresses(req: PublicSalonRequest, res: Response) {
  const gamingCenterId = req.tenant?.gamingCenterId;

  if (!gamingCenterId) {
    throw new AppError('GamingCenter context is missing from the request.', httpStatus.BAD_REQUEST);
  }

  const addresses = await PublicAddressesService.getPublicAddressesBySalon(gamingCenterId);
  res.ok(addresses);
}
