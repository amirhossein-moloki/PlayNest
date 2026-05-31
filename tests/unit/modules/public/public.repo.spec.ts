import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import * as AddressesPublicRepo from '../../../../src/modules/public/addresses.public.repo';
import * as LinksPublicRepo from '../../../../src/modules/public/links.public.repo';
import * as MediaPublicRepo from '../../../../src/modules/public/media.public.repo';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Public Repositories', () => {
  const gamingCenterId = 'gc-1';

  it('findPublicAddressesBySalonId', async () => {
    (prismaMock.address as any).findMany.mockResolvedValue([]);
    await AddressesPublicRepo.findPublicAddressesBySalonId(gamingCenterId);
    expect((prismaMock.address as any).findMany).toHaveBeenCalledWith({ where: { gamingCenterId } });
  });

  it('findPublicLinksBySalonId', async () => {
    (prismaMock.socialLink as any).findMany.mockResolvedValue([]);
    await LinksPublicRepo.findPublicLinksBySalonId(gamingCenterId);
    expect((prismaMock.socialLink as any).findMany).toHaveBeenCalled();
  });

  it('findPublicMediaBySalonId', async () => {
    (prismaMock.media as any).findMany.mockResolvedValue([]);
    await MediaPublicRepo.findPublicMediaBySalonId(gamingCenterId);
    expect((prismaMock.media as any).findMany).toHaveBeenCalled();
  });
});
