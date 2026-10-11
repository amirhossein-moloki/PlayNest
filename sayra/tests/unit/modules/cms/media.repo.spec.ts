import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import * as MediaRepo from '../../../../src/modules/cms/media.repo';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('MediaRepo', () => {
  const gamingCenterId = 'gc-1';
  const mediaMock = prismaMock.media /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;

  it('createMedia', async () => {
    mediaMock.create.mockResolvedValue({ id: 'm-1' });
    await MediaRepo.createMedia(gamingCenterId, { url: 'url' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
    expect(mediaMock.create).toHaveBeenCalled();
  });

  it('findMediaById', async () => {
    mediaMock.findFirst.mockResolvedValue({ id: 'm-1' });
    await MediaRepo.findMediaById(gamingCenterId, 'm-1');
    expect(mediaMock.findFirst).toHaveBeenCalled();
  });

  it('updateMedia', async () => {
    mediaMock.updateMany.mockResolvedValue({ count: 1 });
    mediaMock.findUnique.mockResolvedValue({ id: 'm-1' });
    await MediaRepo.updateMedia(gamingCenterId, 'm-1', { caption: 'new' });
    expect(mediaMock.updateMany).toHaveBeenCalled();
  });
});
