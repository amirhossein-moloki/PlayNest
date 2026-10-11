
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../src/config/prisma';
import { AnalyticsRepo } from '../src/modules/analytics/analytics.repo';

async function backfill() {
  console.log('Starting backfill of analytics summary tables...');

  // 1. Get all unique (gamingCenterId, date) combinations from Reservations
  const reservationGroups = await prisma.reservation.groupBy({
    by: ['gamingCenterId', 'startTime'],
  });

  // Extract unique dates per gamingCenter
  const uniquePairs = new Map<string, Set<string>>();
  for (const r of reservationGroups) {
    const dateStr = r.startTime.toISOString().split('T')[0];
    if (!uniquePairs.has(r.gamingCenterId)) {
      uniquePairs.set(r.gamingCenterId, new Set());
    }
    uniquePairs.get(r.gamingCenterId)!.add(dateStr);
  }

  console.log(`Found ${uniquePairs.size} gaming centers with reservations to sync.`);

  for (const [gamingCenterId, dates] of uniquePairs.entries()) {
    for (const dateStr of dates) {
      const date = new Date(dateStr);
      console.log(`Syncing stats for GamingCenter: ${gamingCenterId} on Date: ${dateStr}`);
      await AnalyticsRepo.syncGamingCenterStats(gamingCenterId, date);

      // Sync for each staff on that date
      const staffReservations = await prisma.reservation.groupBy({
        by: ['staffId'],
        where: {
          gamingCenterId,
          startTime: {
            gte: new Date(`${dateStr}T00:00:00Z`),
            lte: new Date(`${dateStr}T23:59:59Z`),
          },
          staffId: { not: null },
        },
      });

      for (const s of staffReservations) {
        if (s.staffId) {
          await AnalyticsRepo.syncStaffStats(gamingCenterId, s.staffId, date);
        }
      }

      // Sync for each station on that date
      const stationReservations = await prisma.reservation.groupBy({
        by: ['stationId'],
        where: {
          gamingCenterId,
          startTime: {
            gte: new Date(`${dateStr}T00:00:00Z`),
            lte: new Date(`${dateStr}T23:59:59Z`),
          },
        },
      });

      for (const s of stationReservations) {
        await AnalyticsRepo.syncServiceStats(gamingCenterId, s.stationId, date);
      }
    }
  }

  // 2. Also handle payments that might be on different dates than reservations
  const paymentGroups = await prisma.payment.groupBy({
    by: ['gamingCenterId', 'paidAt'],
    where: {
      status: 'PAID',
      paidAt: { not: null },
    },
  });

  const uniquePaymentPairs = new Map<string, Set<string>>();
  for (const p of paymentGroups) {
    if (p.paidAt) {
      const dateStr = p.paidAt.toISOString().split('T')[0];
      if (!uniquePaymentPairs.has(p.gamingCenterId)) {
        uniquePaymentPairs.set(p.gamingCenterId, new Set());
      }
      uniquePaymentPairs.get(p.gamingCenterId)!.add(dateStr);
    }
  }

  console.log(`Found ${uniquePaymentPairs.size} gaming centers with payments to sync.`);

  for (const [gamingCenterId, dates] of uniquePaymentPairs.entries()) {
    for (const dateStr of dates) {
      await AnalyticsRepo.syncGamingCenterStats(gamingCenterId, new Date(dateStr));
    }
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
