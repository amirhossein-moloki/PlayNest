
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../src/config/prisma';
import { AnalyticsRepo } from '../src/modules/analytics/analytics.repo';

async function backfill() {
  console.log('Starting backfill of analytics summary tables...');

  // 1. Get all unique (gamingCenterId, date) combinations from Bookings
  const bookingDates = await prisma.$queryRaw<any[]>` // eslint-disable-line @typescript-eslint/no-explicit-any
    SELECT DISTINCT "gamingCenterId", "startTime"::date as date
    FROM "Reservation"
  `;

  console.log(`Found ${bookingDates.length} unique gamingCenter-date pairs to sync from Bookings.`);

  for (const pair of bookingDates) {
    const date = new Date(pair.date);
    console.log(`Syncing stats for GamingCenter: ${pair.gamingCenterId} on Date: ${pair.date}`);
    await AnalyticsRepo.syncSalonStats(pair.gamingCenterId, date);

    // Sync for each staff on that date
    const staffIds = await prisma.$queryRaw<any[]>` // eslint-disable-line @typescript-eslint/no-explicit-any
      SELECT DISTINCT "staffId" FROM "Reservation"
      WHERE "gamingCenterId" = ${pair.gamingCenterId} AND "startTime"::date = ${pair.date}::date
    `;
    for (const s of staffIds) {
      await AnalyticsRepo.syncStaffStats(pair.gamingCenterId, s.staffId, date);
    }

    // Sync for each station on that date
    const serviceIds = await prisma.$queryRaw<any[]>` // eslint-disable-line @typescript-eslint/no-explicit-any
      SELECT DISTINCT "stationId" FROM "Reservation"
      WHERE "gamingCenterId" = ${pair.gamingCenterId} AND "startTime"::date = ${pair.date}::date
    `;
    for (const s of serviceIds) {
      await AnalyticsRepo.syncServiceStats(pair.gamingCenterId, s.stationId, date);
    }
  }

  // 2. Also handle payments that might be on different dates than reservations
  const paymentDates = await prisma.$queryRaw<any[]>` // eslint-disable-line @typescript-eslint/no-explicit-any
    SELECT DISTINCT "gamingCenterId", "paidAt"::date as date
    FROM "Payment"
    WHERE "status" = 'PAID' AND "paidAt" IS NOT NULL
  `;

  console.log(`Found ${paymentDates.length} unique gamingCenter-date pairs to sync from Payments.`);

  for (const pair of paymentDates) {
    await AnalyticsRepo.syncSalonStats(pair.gamingCenterId, new Date(pair.date));
  }

  console.log('Backfill completed successfully.');
}

backfill()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
