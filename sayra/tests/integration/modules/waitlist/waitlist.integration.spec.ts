import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../../../../src/config/prisma';
import { waitlistStation } from '../../../../src/modules/waitlist/waitlist.station';
import { ReservationStatus, SessionActorType, WaitlistStatus, WaitlistOfferStatus } from '@prisma/client';

describe('Phase 11 — Waitlist Concurrency & Integration Tests', () => {
  const gamingCenterId = 'gc-waitlist-p11';
  const customerAccountId1 = 'cust-acc-p11-1';
  const customerAccountId2 = 'cust-acc-p11-2';
  const customerProfileId1 = 'cust-prof-p11-1';
  const customerProfileId2 = 'cust-prof-p11-2';
  const createdByUserId = 'user-creator-p11';
  const stationId = 'station-p11';

  let isDbAvailable = false;

  beforeAll(async () => {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      isDbAvailable = true;
    } catch {
      isDbAvailable = false;
      console.warn('PostgreSQL is not reachable. Skipping live database waitlist tests.');
    }
  });

  afterAll(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // Ignore
    }
  });

  it('ENFORCE DB DUPLICATE ACTIVE WAITLIST CONSTRAINT & CONCURRENT OFFER ACCEPTANCE', async () => {
    if (!isDbAvailable) {
      console.warn('Skipped live PostgreSQL test: DB unreachable.');
      return;
    }

    // Cleanup
    await prisma.waitlistOffer.deleteMany({ where: { gamingCenterId } });
    await prisma.waitlistEntry.deleteMany({ where: { gamingCenterId } });
    await prisma.reservationHistory.deleteMany({ where: { reservation: { gamingCenterId } } });
    await prisma.reservation.deleteMany({ where: { gamingCenterId } });
    await prisma.gameStation.deleteMany({ where: { gamingCenterId } });
    await prisma.user.deleteMany({ where: { gamingCenterId } });
    await prisma.customerProfile.deleteMany({ where: { gamingCenterId } });
    await prisma.customerAccount.deleteMany({ where: { id: { in: [customerAccountId1, customerAccountId2] } } });
    await prisma.gamingCenter.deleteMany({ where: { id: gamingCenterId } });

    await prisma.gamingCenter.create({
      data: {
        id: gamingCenterId,
        name: 'Waitlist Test Center',
        slug: 'waitlist-center',
        settings: {
          create: {
            minAdvanceBookingMinutes: 0,
            allowOnlineBooking: true,
          },
        },
      },
    });

    await prisma.customerAccount.createMany({
      data: [
        { id: customerAccountId1, phone: '09120000011', fullName: 'Customer 1' },
        { id: customerAccountId2, phone: '09120000012', fullName: 'Customer 2' },
      ],
    });

    await prisma.customerProfile.createMany({
      data: [
        { id: customerProfileId1, gamingCenterId, customerAccountId: customerAccountId1, displayName: 'Cust 1' },
        { id: customerProfileId2, gamingCenterId, customerAccountId: customerAccountId2, displayName: 'Cust 2' },
      ],
    });

    await prisma.user.create({
      data: {
        id: createdByUserId,
        gamingCenterId,
        fullName: 'Admin User',
        phone: '09120000013',
        role: 'ADMIN',
      },
    });

    await prisma.gameStation.create({
      data: {
        id: stationId,
        gamingCenterId,
        name: 'VIP Station 1',
        hourlyPrice: 150000,
        defaultDurationHours: 1,
        isActive: true,
      },
    });

    const startTime = new Date('2027-01-10T14:00:00Z');
    const endTime = new Date('2027-01-10T15:00:00Z');

    // Create an initial reservation so slot is unavailable
    const initialRes = await prisma.reservation.create({
      data: {
        gamingCenterId,
        customerProfileId: customerProfileId1,
        customerAccountId: customerAccountId1,
        stationId,
        createdByUserId,
        startTime,
        endTime,
        stationSnapshot: { name: 'VIP Station 1', hourlyPrice: 150000, stationType: 'PC' },
        totalHours: 1,
        totalPrice: 150000,
        status: ReservationStatus.CONFIRMED,
      },
    });

    // Customer 1 registers interest for this unavailable slot
    const entry1 = await waitlistStation.createEntry(gamingCenterId, {
      stationId,
      startTime,
      endTime,
      customer: { fullName: 'Customer 1', phone: '09120000011' },
    }, {
      id: customerAccountId1,
      actorType: SessionActorType.CUSTOMER,
      customerAccountId: customerAccountId1,
    });

    expect(entry1.status).toBe(WaitlistStatus.ACTIVE);

    // Duplicate active registration attempt for Customer 1 should fail
    await expect(
      waitlistStation.createEntry(gamingCenterId, {
        stationId,
        startTime,
        endTime,
        customer: { fullName: 'Customer 1', phone: '09120000011' },
      }, {
        id: customerAccountId1,
        actorType: SessionActorType.CUSTOMER,
        customerAccountId: customerAccountId1,
      })
    ).rejects.toThrow('You already have an active waitlist entry for this station and time slot.');

    // Cancel initial reservation -> frees up slot
    await prisma.reservation.update({
      where: { id: initialRes.id },
      data: { status: ReservationStatus.CANCELED },
    });

    // Run matching
    const offer = await waitlistStation.processAvailableSlot(gamingCenterId, stationId, startTime, endTime);

    expect(offer).not.toBeNull();
    expect(offer?.waitlistEntryId).toBe(entry1.id);
    expect(offer?.status).toBe(WaitlistOfferStatus.PENDING);

    // Test concurrent acceptance requests
    const acceptPromises = Array.from({ length: 5 }).map(() =>
      waitlistStation.acceptOffer(offer!.id, gamingCenterId, {
        id: customerAccountId1,
        actorType: SessionActorType.CUSTOMER,
        customerAccountId: customerAccountId1,
      }).catch((err) => ({ error: err }))
    );

    const acceptResults = await Promise.all(acceptPromises);
    const successfulAccepts = acceptResults.filter((r) => 'id' in r);
    const failedAccepts = acceptResults.filter((r) => 'error' in r);

    expect(successfulAccepts.length).toBe(1);
    expect(failedAccepts.length).toBe(4);

    // Verify reservation was created
    const finalReservations = await prisma.reservation.findMany({
      where: { gamingCenterId, stationId, status: ReservationStatus.CONFIRMED },
    });
    expect(finalReservations.length).toBe(1);

    // Verify offer status
    const updatedOffer = await prisma.waitlistOffer.findUnique({ where: { id: offer!.id } });
    expect(updatedOffer?.status).toBe(WaitlistOfferStatus.ACCEPTED);

    // Verify entry status
    const updatedEntry = await prisma.waitlistEntry.findUnique({ where: { id: entry1.id } });
    expect(updatedEntry?.status).toBe(WaitlistStatus.CONVERTED);
  });
});
