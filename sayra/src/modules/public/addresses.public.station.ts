import * as PublicAddressesRepo from './addresses.public.repo';

export async function getPublicAddressesByGamingCenter(gamingCenterId: string) {
  return PublicAddressesRepo.findPublicAddressesByGamingCenterId(gamingCenterId);
}
