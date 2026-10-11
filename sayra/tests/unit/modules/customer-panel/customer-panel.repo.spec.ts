import { describe, it, expect } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';
import { CustomerPanelRepo } from '../../../../src/modules/customer-panel/customer-panel.repo';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('CustomerPanelRepo', () => {
  const accountMock = prismaMock.customerAccount /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;
  const resMock = prismaMock.reservation /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any;

  it('findCustomerAccountById', async () => {
    accountMock.findUnique.mockResolvedValue({ id: 'ca-1' });
    await CustomerPanelRepo.findCustomerAccountById('ca-1');
    expect(accountMock.findUnique).toHaveBeenCalled();
  });

  it('findManyReservation', async () => {
    resMock.findMany.mockResolvedValue([]);
    await CustomerPanelRepo.findManyReservation({}, 0, 10);
    expect(resMock.findMany).toHaveBeenCalled();
  });

  it('countReservation', async () => {
    resMock.count.mockResolvedValue(0);
    await CustomerPanelRepo.countReservation({});
    expect(resMock.count).toHaveBeenCalled();
  });

  it('findReservationById', async () => {
    resMock.findFirst.mockResolvedValue({ id: 'res-1' });
    await CustomerPanelRepo.findReservationById('res-1', 'ca-1');
    expect(resMock.findFirst).toHaveBeenCalled();
  });

  it('updateReservation', async () => {
    resMock.updateMany.mockResolvedValue({ count: 1 });
    resMock.findUnique.mockResolvedValue({ id: 'res-1' });
    await CustomerPanelRepo.updateReservation('res-1', 'ca-1', { note: 'new' });
    expect(resMock.updateMany).toHaveBeenCalled();
  });
});
