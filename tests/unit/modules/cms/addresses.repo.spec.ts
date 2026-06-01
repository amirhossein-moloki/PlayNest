import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import { AddressesRepo } from '../../../../src/modules/cms/addresses.repo';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('AddressesRepo', () => {
  const gamingCenterId = 'gc-1';
  const addressMock = prismaMock.address /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;

  it('findBySalonId', async () => {
    addressMock.findMany.mockResolvedValue([]);
    await AddressesRepo.findBySalonId(gamingCenterId);
    expect(addressMock.findMany).toHaveBeenCalled();
  });

  it('create', async () => {
    addressMock.create.mockResolvedValue({ id: 'a-1' });
    await AddressesRepo.create(gamingCenterId, { city: 'Tehran' });
    expect(addressMock.create).toHaveBeenCalled();
  });

  it('update', async () => {
    addressMock.updateMany.mockResolvedValue({ count: 1 });
    addressMock.findUnique.mockResolvedValue({ id: 'a-1' });
    await AddressesRepo.update('a-1', gamingCenterId, { city: 'Updated' });
    expect(addressMock.updateMany).toHaveBeenCalled();
  });

  it('delete', async () => {
    addressMock.deleteMany.mockResolvedValue({ count: 1 });
    const result = await AddressesRepo.delete('a-1', gamingCenterId);
    expect(result).toBe(true);
    expect(addressMock.deleteMany).toHaveBeenCalled();
  });

  it('findById', async () => {
    addressMock.findUnique.mockResolvedValue({ id: 'a-1' });
    await AddressesRepo.findById('a-1');
    expect(addressMock.findUnique).toHaveBeenCalled();
  });
});
