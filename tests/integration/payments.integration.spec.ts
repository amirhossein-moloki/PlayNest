import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';
import { PaymentsService } from '../../src/modules/payments/payments.station';
import { prisma } from '../../src/config/prisma';
import { cleanupDatabase } from '../helpers/db-cleanup';

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as any;

describe('Payments Integration', () => {
  beforeEach(async () => { await cleanupDatabase(); jest.clearAllMocks(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it('should initiate payment successfully', async () => {
    const gc = await prisma.gamingCenter.create({ data: { name: 'GC 1', slug: 'gc-1' } });
    const user = await prisma.user.create({ data: { gamingCenterId: gc.id, fullName: 'A', phone: '0' } });
    const acc = await prisma.customerAccount.create({ data: { phone: '1' } });
    const prof = await prisma.customerProfile.create({ data: { gamingCenterId: gc.id, customerAccountId: acc.id } });
    const st = await prisma.gameStation.create({ data: { gamingCenterId: gc.id, name: 'S', hourlyPrice: 10 } });

    const res = await (prisma as any).reservation.create({
      data: {
        gamingCenterId: gc.id, stationId: st.id, customerAccountId: acc.id, customerProfileId: prof.id,
        createdByUserId: user.id, startTime: new Date(), endTime: new Date(), totalHours: 1, totalPrice: 10,
        stationSnapshot: '{}', status: 'CONFIRMED',
      }
    });

    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ data: { authority: 'A1', code: 100 } }) } as any);

    const result = await PaymentsService.initiatePayment({ gamingCenterId: gc.id, reservationId: res.id, idempotencyKey: 'id1' });
    expect(result).toHaveProperty('checkoutUrl');
    const payInDb = await prisma.payment.findFirst({ where: { reservationId: res.id } });
    expect(payInDb).toBeDefined();
  });
});
