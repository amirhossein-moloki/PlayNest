import * as PublicMediaRepo from './media.public.repo';

export async function getPublicMediaByGamingCenter(gamingCenterId: string) {
  return PublicMediaRepo.findPublicMediaByGamingCenterId(gamingCenterId);
}
