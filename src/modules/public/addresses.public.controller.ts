import { Request, Response } from 'express';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import * as PublicAddressesStation from './addresses.public.station';

type PublicGamingCenterRequest = Request & {
  tenant?: { gamingCenterId: string; gamingCenterSlug?: string };
};

export async function getPublicAddresses(req: PublicGamingCenterRequest, res: Response) {
  const gamingCenterId = req.tenant?.gamingCenterId;

  if (!gamingCenterId) {
    throw new AppError('GamingCenter context is missing from the request.', httpStatus.BAD_REQUEST);
  }

  const addresses = await PublicAddressesStation.getPublicAddressesByGamingCenter(gamingCenterId);
  res.ok(addresses);
}
