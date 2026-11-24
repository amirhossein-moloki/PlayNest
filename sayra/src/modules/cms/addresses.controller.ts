import { Request, Response, NextFunction } from 'express';
import { AddressesStation } from './addresses.station';
import { recordGamingCenterChangeEvent } from '../integrations/outbox.service';

function emitAddressChanged(gamingCenterId: string, action: string) {
  void recordGamingCenterChangeEvent({
    gamingCenterId,
    eventType: 'GAMING_CENTER_ADDRESS_CHANGED',
    changedFields: ['addresses'],
    metadata: { action },
  });
}

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
      emitAddressChanged(gamingCenterId, 'updated');
      return res.ok(address);
    }

    const existing = (await AddressesStation.getAddresses(gamingCenterId)) || [];
    if (existing && existing.length > 0 && req.body && req.body.createNew !== true) {
      const primary = existing.find((a) => a.isPrimary) || existing[0];
      const address = await AddressesStation.updateAddress(gamingCenterId, primary.id, req.body);
      emitAddressChanged(gamingCenterId, 'updated');
      return res.ok(address);
    }

    const address = await AddressesStation.createAddress(gamingCenterId, req.body);
    emitAddressChanged(gamingCenterId, 'created');
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
        emitAddressChanged(gamingCenterId, 'updated');
        return res.ok(address);
      } else {
        const created = await AddressesStation.createAddress(gamingCenterId, req.body);
        emitAddressChanged(gamingCenterId, 'created');
        return res.created(created);
      }
    }

    const address = await AddressesStation.updateAddress(gamingCenterId, addressId, req.body);
    emitAddressChanged(gamingCenterId, 'updated');
    res.ok(address);
  } catch (error) {
    next(error);
  }
};

export const deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gamingCenterId, addressId } = req.params;
    await AddressesStation.deleteAddress(gamingCenterId, addressId);
    emitAddressChanged(gamingCenterId, 'deleted');
    res.noContent();
  } catch (error) {
    next(error);
  }
};
