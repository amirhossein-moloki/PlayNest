import * as PublicMediaRepo from './media.public.repo';

export async function getPublicMediaBySalon(gamingCenterId: string) {
  return PublicMediaRepo.findPublicMediaBySalonId(gamingCenterId);
}
