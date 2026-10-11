import { Request, Response, NextFunction } from 'express';
import { AddressesStation } from './addresses.station';

export const getAddresses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId } = req.params;
    const addresses = await AddressesStation.getAddresses(gamingCenterId);
    res.ok(addresses);
  } catch (error) {
    next(error);
  }
};

export const createAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId } = req.params;
    const address = await AddressesStation.createAddress(gamingCenterId, req.body);
    res.created(address);
  } catch (error) {
    next(error);
  }
};

export const updateAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId, addressId } = req.params;
    const address = await AddressesStation.updateAddress(gamingCenterId, addressId, req.body);
    res.ok(address);
  } catch (error) {
    next(error);
  }
};

export const deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId, addressId } = req.params;
    await AddressesStation.deleteAddress(gamingCenterId, addressId);
    res.noContent();
  } catch (error) {
    next(error);
  }
};
