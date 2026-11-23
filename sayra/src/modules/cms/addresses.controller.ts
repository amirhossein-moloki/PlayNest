import { Request, Response, NextFunction } from 'express';
import { AddressesStation } from './addresses.station';
import { invalidatePublicCacheByPrefix } from '../../common/utils/publicCache';

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
    const addressId = req.params.addressId || (req.body && (req.body.id || req.body.addressId));

    if (addressId) {
      const address = await AddressesStation.updateAddress(gamingCenterId, addressId, req.body);
      void invalidatePublicCacheByPrefix('public:gc:');
      return res.ok(address);
    }

    const existing = (await AddressesStation.getAddresses(gamingCenterId)) || [];
    if (existing && existing.length > 0 && req.body && req.body.createNew !== true) {
      const primary = existing.find((a) => a.isPrimary) || existing[0];
      const address = await AddressesStation.updateAddress(gamingCenterId, primary.id, req.body);
      void invalidatePublicCacheByPrefix('public:gc:');
      return res.ok(address);
    }

    const address = await AddressesStation.createAddress(gamingCenterId, req.body);
    void invalidatePublicCacheByPrefix('public:gc:');
    res.created(address);
  } catch (error) {
    next(error);
  }
};

export const updateAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId } = req.params;
    const addressId = req.params.addressId || (req.body && (req.body.id || req.body.addressId));

    if (!addressId) {
      const existing = (await AddressesStation.getAddresses(gamingCenterId)) || [];
      if (existing && existing.length > 0) {
        const primary = existing.find((a) => a.isPrimary) || existing[0];
        const address = await AddressesStation.updateAddress(gamingCenterId, primary.id, req.body);
        void invalidatePublicCacheByPrefix('public:gc:');
        return res.ok(address);
      } else {
        const created = await AddressesStation.createAddress(gamingCenterId, req.body);
        void invalidatePublicCacheByPrefix('public:gc:');
        return res.created(created);
      }
    }

    const address = await AddressesStation.updateAddress(gamingCenterId, addressId, req.body);
    void invalidatePublicCacheByPrefix('public:gc:');
    res.ok(address);
  } catch (error) {
    next(error);
  }
};

export const deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId, addressId } = req.params;
    await AddressesStation.deleteAddress(gamingCenterId, addressId);
    void invalidatePublicCacheByPrefix('public:gc:');
    res.noContent();
  } catch (error) {
    next(error);
  }
};
