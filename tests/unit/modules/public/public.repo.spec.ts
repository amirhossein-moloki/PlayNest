import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import * as AddressesPublicRepo from '../../../../src/modules/public/addresses.public.repo';
import * as LinksPublicRepo from '../../../../src/modules/public/links.public.repo';
import * as MediaPublicRepo from '../../../../src/modules/public/media.public.repo';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Public Repositories', () => {
  const gamingCenterId = 'gc-1';

  it('findPublicAddressesByGamingCenterId', async () => {
    (prismaMock.address /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).findMany.mockResolvedValue([]);
    await AddressesPublicRepo.findPublicAddressesByGamingCenterId(gamingCenterId);
    expect((prismaMock.address /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).findMany).toHaveBeenCalledWith({ where: { gamingCenterId } });
  });

  it('findPublicLinksByGamingCenterId', async () => {
    (prismaMock.socialLink /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).findMany.mockResolvedValue([]);
    await LinksPublicRepo.findPublicLinksByGamingCenterId(gamingCenterId);
    expect((prismaMock.socialLink /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).findMany).toHaveBeenCalled();
  });

  it('findPublicMediaByGamingCenterId', async () => {
    (prismaMock.media /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).findMany.mockResolvedValue([]);
    await MediaPublicRepo.findPublicMediaByGamingCenterId(gamingCenterId);
    expect((prismaMock.media /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any).findMany).toHaveBeenCalled();
  });
});
