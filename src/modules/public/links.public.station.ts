import * as PublicLinksRepo from './links.public.repo';

export async function getPublicLinksBySalon(gamingCenterId: string) {
  return PublicLinksRepo.findPublicLinksBySalonId(gamingCenterId);
}
