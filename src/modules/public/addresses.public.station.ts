import * as PublicAddressesRepo from './addresses.public.repo';

export async function getPublicAddressesBySalon(gamingCenterId: string) {
  return PublicAddressesRepo.findPublicAddressesBySalonId(gamingCenterId);
}
