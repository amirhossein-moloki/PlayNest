import { Address } from '@prisma/client';
import { AddressesRepo } from './addresses.repo';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export const AddressesService = {
  async getAddresses(gamingCenterId: string): Promise<Address[]> {
    return AddressesRepo.findBySalonId(gamingCenterId);
  },

  async createAddress(gamingCenterId: string, data: any): Promise<Address> {
    return AddressesRepo.create(gamingCenterId, data);
  },

  async updateAddress(gamingCenterId: string, addressId: string, data: any): Promise<Address> {
    const address = await AddressesRepo.findById(addressId);
    if (!address || address.gamingCenterId !== gamingCenterId) {
      throw new AppError('Address not found', httpStatus.NOT_FOUND);
    }
    return AddressesRepo.update(addressId, data);
  },

  async deleteAddress(gamingCenterId: string, addressId: string): Promise<void> {
    const address = await AddressesRepo.findById(addressId);
    if (!address || address.gamingCenterId !== gamingCenterId) {
      throw new AppError('Address not found', httpStatus.NOT_FOUND);
    }
    await AddressesRepo.delete(addressId);
  },
};
