import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import { LinksRepo } from '../../../../src/modules/cms/links.repo';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('LinksRepo', () => {
  const gamingCenterId = 'gc-1';
  const linkMock = prismaMock.socialLink /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;

  it('findByGamingCenterId', async () => {
    linkMock.findMany.mockResolvedValue([]);
    await LinksRepo.findByGamingCenterId(gamingCenterId);
    expect(linkMock.findMany).toHaveBeenCalled();
  });

  it('create', async () => {
    linkMock.create.mockResolvedValue({ id: 'l-1' });
    await LinksRepo.create(gamingCenterId, { value: 'inst' });
    expect(linkMock.create).toHaveBeenCalled();
  });

  it('delete', async () => {
    linkMock.deleteMany.mockResolvedValue({ count: 1 });
    await LinksRepo.delete('l-1', gamingCenterId);
    expect(linkMock.deleteMany).toHaveBeenCalled();
  });

  it('findById', async () => {
    linkMock.findUnique.mockResolvedValue({ id: 'l-1' });
    await LinksRepo.findById('l-1');
    expect(linkMock.findUnique).toHaveBeenCalled();
  });

  it('update', async () => {
    linkMock.updateMany.mockResolvedValue({ count: 1 });
    linkMock.findUnique.mockResolvedValue({ id: 'l-1' });
    await LinksRepo.update('l-1', gamingCenterId, { value: 'new' });
    expect(linkMock.updateMany).toHaveBeenCalled();
  });
});
