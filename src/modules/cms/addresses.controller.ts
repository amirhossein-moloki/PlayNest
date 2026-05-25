import { Request, Response, NextFunction } from 'express';
import { AddressesService } from './addresses.station';

export const getAddresses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId } = req.params;
    const addresses = await AddressesService.getAddresses(gamingCenterId);
    res.ok(addresses);
  } catch (error) {
    next(error);
  }
};

export const createAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId } = req.params;
    const address = await AddressesService.createAddress(gamingCenterId, req.body);
    res.created(address);
  } catch (error) {
    next(error);
  }
};

export const updateAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId, addressId } = req.params;
    const address = await AddressesService.updateAddress(gamingCenterId, addressId, req.body);
    res.ok(address);
  } catch (error) {
    next(error);
  }
};

export const deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId, addressId } = req.params;
    await AddressesService.deleteAddress(gamingCenterId, addressId);
    res.noContent();
  } catch (error) {
    next(error);
  }
};
