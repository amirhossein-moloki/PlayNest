import { describe, it, expect, beforeAll } from '@jest/globals';
import { prisma } from '../../../../src/config/prisma';
import { RefundsStation } from '../../../../src/modules/payments/payments.refund.station';
import { PaymentStatus, RefundStatus, ReservationStatus, ReservationPaymentState } from '@prisma/client';

describe('Phase 6 — PostgreSQL Live Refund Concurrency & Invariants Integration Tests', () => {
  const gamingCenterId = 'gc-integration-p6';
  const customerAccountId = 'cust-acc-p6';
  const customerProfileId = 'cust-prof-p6';
  const createdByUserId = 'user-creator-p6';
  const stationId = 'station-p6';

  let isDbAvailable = false;

  beforeAll(async () => {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      isDbAvailable = true;
    } catch {
      isDbAvailable = false;
      console.warn('PostgreSQL is not reachable. Skipping live database concurrency tests.');
    }
  });

  it('PREVENT CONCURRENT OVER-REFUNDS: parallel requests cannot exceed refundable balance', async () => {
    if (!isDbAvailable) {
      console.warn('Skipped live PostgreSQL test: DB unreachable.');
      return;
    }

    await prisma.ledgerEntry.deleteMany({ where: { gamingCenterId } });
    await prisma.reconciliationRecord.deleteMany({ where: { gamingCenterId } });
    await prisma.refund.deleteMany({ where: { gamingCenterId } });
    await prisma.payment.deleteMany({ where: { gamingCenterId } });
    await prisma.reservation.deleteMany({ where: { gamingCenterId } });
    await prisma.gameStation.deleteMany({ where: { gamingCenterId } });
    await prisma.user.deleteMany({ where: { gamingCenterId } });
    await prisma.customerProfile.deleteMany({ where: { gamingCenterId } });
    await prisma.customerAccount.deleteMany({ where: { id: customerAccountId } });
    await prisma.gamingCenter.deleteMany({ where: { id: gamingCenterId } });

    await prisma.gamingCenter.create({
      data: {
        id: gamingCenterId,
        name: 'Phase 6 Concurrency Center',
        slug: 'phase6-center',
      },
    });

    await prisma.customerAccount.create({
      data: { id: customerAccountId, phone: '09120000006', fullName: 'Phase6 Customer' },
    });

    await prisma.customerProfile.create({
      data: {
        id: customerProfileId,
        gamingCenterId,
        customerAccountId,
        displayName: 'Phase6 Profile',
      },
    });

    await prisma.user.create({
      data: {
        id: createdByUserId,
        gamingCenterId,
        fullName: 'Admin User',
        phone: '09120000007',
        role: 'ADMIN',
      },
    });

    await prisma.gameStation.create({
      data: {
        id: stationId,
        gamingCenterId,
        name: 'PC-P6-01',
        hourlyPrice: 100,
      },
    });

    const reservation = await prisma.reservation.create({
      data: {
        gamingCenterId,
        customerProfileId,
        customerAccountId,
        stationId,
        createdByUserId,
        startTime: new Date('2026-12-10T10:00:00Z'),
        endTime: new Date('2026-12-10T12:00:00Z'),
        stationSnapshot: { currency: 'IRR', hourlyPrice: 100 },
        totalHours: 2,
        totalPrice: 100000,
        paymentState: ReservationPaymentState.PAID,
        status: ReservationStatus.CONFIRMED,
      },
    });

    const payment = await prisma.payment.create({
      data: {
        gamingCenterId,
        reservationId: reservation.id,
        amount: 100000,
        currency: 'IRR',
        provider: 'MANUAL',
        providerPaymentId: 'FAKE_AUTH_P6_1',
        status: PaymentStatus.PAID,
        paidAt: new Date(),
      },
    });

    const refundPromises = Array.from({ length: 10 }).map((_, index) =>
      RefundsStation.requestRefund({
        gamingCenterId,
        paymentId: payment.id,
        amount: 80000,
        currency: 'IRR',
        reason: 'Concurrent Test',
        idempotencyKey: `conc-refund-key-${index}`,
        providerName: 'FAKE',
      }).catch((err) => ({ error: err }))
    );

    const results = await Promise.all(refundPromises);

    const successfulCount = results.filter((r) => 'status' in r && r.status === RefundStatus.SUCCESSFUL).length;
    const failedCount = results.filter((r) => 'error' in r).length;

    expect(successfulCount).toBe(1);
    expect(failedCount).toBe(9);

    const dbRefunds = await prisma.refund.findMany({
      where: { paymentId: payment.id, status: RefundStatus.SUCCESSFUL },
    });

    const totalRefunded = dbRefunds.reduce((sum, r) => sum + r.amount, 0);
    expect(totalRefunded).toBe(80000);
    expect(totalRefunded).toBeLessThanOrEqual(payment.amount);
  });
});
