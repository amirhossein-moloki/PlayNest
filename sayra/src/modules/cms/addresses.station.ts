import { Address } from '@prisma/client';
import { AddressesRepo } from './addresses.repo';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export const AddressesStation = {
  async getAddresses(gamingCenterId: string): Promise<Address[]> {
    return AddressesRepo.findByGamingCenterId(gamingCenterId);
  },

  async createAddress(gamingCenterId: string, data: Record<string, unknown>): Promise<Address> {
    const explicitId = (data.id || data.addressId) as string | undefined;

    if (explicitId) {
      const existing = await AddressesRepo.findById(explicitId);
      if (existing && existing.gamingCenterId === gamingCenterId) {
        return this.updateAddress(gamingCenterId, explicitId, data);
      }
    }

    const existingList = (await AddressesRepo.findByGamingCenterId(gamingCenterId)) || [];
    if (existingList && existingList.length > 0 && data.createNew !== true) {
      const target = existingList.find((a) => a.isPrimary) || existingList[0];
      return this.updateAddress(gamingCenterId, target.id, data);
    }

    return AddressesRepo.create(gamingCenterId, data);
  },

  async updateAddress(gamingCenterId: string, addressId: string, data: Record<string, unknown>): Promise<Address> {
    const address = await AddressesRepo.findById(addressId);
    if (!address || address.gamingCenterId !== gamingCenterId) {
      throw new AppError('Address not found', httpStatus.NOT_FOUND);
    }
    const result = await AddressesRepo.update(addressId, gamingCenterId, data);
    if (!result) {
      throw new AppError('Address not found', httpStatus.NOT_FOUND);
    }
    return result;
  },

  async deleteAddress(gamingCenterId: string, addressId: string): Promise<void> {
    const success = await AddressesRepo.delete(addressId, gamingCenterId);
    if (!success) {
      throw new AppError('Address not found', httpStatus.NOT_FOUND);
    }
  },
};
