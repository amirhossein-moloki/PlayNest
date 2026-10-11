import * as PublicLinksRepo from './links.public.repo';

export async function getPublicLinksByGamingCenter(gamingCenterId: string) {
  return PublicLinksRepo.findPublicLinksByGamingCenterId(gamingCenterId);
}
