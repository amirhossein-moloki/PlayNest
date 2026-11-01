import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { PRNG } from './seed/prng';
import { SEED_CONFIG } from './seed/config';
import { seedGamingCenters } from './seed/generators/centers';
import { seedStations } from './seed/generators/stations';
import { seedUsersAndCustomers } from './seed/generators/users';
import { seedDiscountsAndCampaigns } from './seed/generators/discounts-campaigns';
import { seedReservations } from './seed/generators/reservations';
import { seedSessionsAndFinancials } from './seed/generators/sessions-payments';
import { seedTournamentsCmsAndRatings } from './seed/generators/tournaments-cms';
import { AnalyticsRepo } from '../src/modules/analytics/analytics.repo';

const prisma = new PrismaClient();

async function clearAllData() {
  if (process.env.NODE_ENV === 'production' && process.env.FORCE_SEED !== 'true') {
    throw new Error('🛑 SEED REFUSED: Cannot run database seed in production environment without explicit FORCE_SEED=true.');
  }

  console.log('🧹 Purging existing database tables in strict dependency order...');

  // Analytics aggregate & fact tables
  await prisma.gamingCenterAnalytics.deleteMany({});
  await prisma.staffAnalytics.deleteMany({});
  await prisma.stationAnalytics.deleteMany({});
  await prisma.revenueForecastRun.deleteMany({});
  await prisma.marketingCampaignSpend.deleteMany({});
  await prisma.analyticsEvent.deleteMany({});
  await prisma.analyticsRefund.deleteMany({});
  await prisma.analyticsPayment.deleteMany({});
  await prisma.analyticsGamingSession.deleteMany({});
  await prisma.analyticsReservation.deleteMany({});
  await prisma.analyticsStation.deleteMany({});
  await prisma.analyticsCustomer.deleteMany({});
  await prisma.analyticsTenant.deleteMany({});
  await prisma.analyticsWatermark.deleteMany({});
  await prisma.analyticsIngestionRun.deleteMany({});
  await prisma.analyticsLedgerEntry.deleteMany({});

  // Operational & Business tables
  await prisma.waitlistOffer.deleteMany({});
  await prisma.waitlistEntry.deleteMany({});
  await prisma.notificationLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.ticketMessage.deleteMany({});
  await prisma.ticket.deleteMany({});
  await prisma.reconciliationRecord.deleteMany({});
  await prisma.ledgerEntry.deleteMany({});
  await prisma.refund.deleteMany({});
  await prisma.walletTransaction.deleteMany({});
  await prisma.earningPayment.deleteMany({});
  await prisma.earning.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.rating.deleteMany({});
  await prisma.gamingSession.deleteMany({});
  await prisma.reservationHistory.deleteMany({});
  await prisma.reservationTimeProposal.deleteMany({});
  await prisma.groupBookingItem.deleteMany({});
  await prisma.groupBooking.deleteMany({});
  await prisma.reservation.deleteMany({});
  await prisma.stationMaintenance.deleteMany({});
  await prisma.staffStationSkill.deleteMany({});
  await prisma.staffShift.deleteMany({});
  await prisma.gameStation.deleteMany({});
  await prisma.discountUsage.deleteMany({});
  await prisma.discountCampaign.deleteMany({});
  await prisma.discount.deleteMany({});
  await prisma.gamingCenterExpense.deleteMany({});
  await prisma.tournament.deleteMany({});
  await prisma.customerProfile.deleteMany({});
  await prisma.customerAccount.deleteMany({});
  await prisma.phoneOtp.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.membership.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.authorProfile.deleteMany({});
  await prisma.platformAdmin.deleteMany({});
  await prisma.pageMedia.deleteMany({});
  await prisma.pageSlugHistory.deleteMany({});
  await prisma.pageSection.deleteMany({});
  await prisma.page.deleteMany({});
  await prisma.socialLink.deleteMany({});
  await prisma.commissionPolicy.deleteMany({});
  await prisma.settings.deleteMany({});
  await prisma.siteSettings.deleteMany({});
  await prisma.address.deleteMany({});
  await prisma.gamingCenter.deleteMany({});

  console.log('✨ Purge completed successfully.');
}

async function syncAnalyticsSummaries() {
  console.log('📊 Running Analytics Sync across seeded reservations & payments...');
  try {
    const reservationDates = await prisma.reservation.groupBy({
      by: ['gamingCenterId', 'startTime'],
    });

    const uniqueCenterDates = new Map<string, Set<string>>();
    for (const r of reservationDates) {
      const dateStr = r.startTime.toISOString().split('T')[0];
      if (!uniqueCenterDates.has(r.gamingCenterId)) {
        uniqueCenterDates.set(r.gamingCenterId, new Set());
      }
      uniqueCenterDates.get(r.gamingCenterId)!.add(dateStr);
    }

    for (const [centerId, dates] of uniqueCenterDates.entries()) {
      for (const dateStr of dates) {
        const date = new Date(dateStr);
        await AnalyticsRepo.syncGamingCenterStats(centerId, date);

        const stationReservations = await prisma.reservation.groupBy({
          by: ['stationId'],
          where: {
            gamingCenterId: centerId,
            startTime: {
              gte: new Date(`${dateStr}T00:00:00Z`),
              lte: new Date(`${dateStr}T23:59:59Z`),
            },
          },
        });
        for (const s of stationReservations) {
          await AnalyticsRepo.syncStationStats(centerId, s.stationId, date);
        }
      }
    }
    console.log('✅ Analytics sync completed successfully.');
  } catch (err) {
    console.warn('⚠️ Analytics sync warning (continuing seed):', err instanceof Error ? err.message : String(err));
  }
}

async function main() {
  console.log('====================================================');
  console.log('   PlayNest - Professional Database Seed Ecosystem   ');
  console.log('====================================================');

  const prng = new PRNG(SEED_CONFIG.randomSeed);

  // 1. Purge data
  await clearAllData();

  // 2. Seed Centers
  console.log('🏢 [1/7] Seeding Gaming Centers & Associated Settings...');
  const centers = await seedGamingCenters(prisma);
  console.log(`       Created ${centers.length} gaming centers.`);

  // 3. Seed Stations
  console.log('🖥️ [2/7] Seeding Stations & Hardware Maintenance...');
  const stations = await seedStations(prisma, centers, prng);
  console.log(`       Created ${stations.length} game stations.`);

  // 4. Seed Users & Customers
  console.log('👥 [3/7] Seeding Platform Admin, Staff, Shifts & Customers...');
  const { staff, customers } = await seedUsersAndCustomers(prisma, centers, stations, prng);
  console.log(`       Created Platform Admin, ${Object.keys(staff.managerIdByCenter).length} managers, staff shifts & ${customers.customerAccountIds.length} customer accounts.`);

  // 5. Seed Discounts & Campaigns
  console.log('🏷️ [4/7] Seeding Discounts & Marketing Campaigns...');
  const discounts = await seedDiscountsAndCampaigns(prisma, centers, staff.managerIdByCenter, prng);
  console.log(`       Created ${discounts.length} discount policies.`);

  // 6. Seed Reservations
  console.log('📅 [5/7] Seeding Conflict-Free Reservations Across 35 Days...');
  const reservations = await seedReservations(prisma, stations, staff, customers, discounts, prng);
  console.log(`       Created ${reservations.length} conflict-free reservations.`);

  // 7. Seed Gaming Sessions & Financials
  console.log('💳 [6/7] Seeding Sessions, Payments, Refunds, Ledger & Wallets...');
  await seedSessionsAndFinancials(prisma, reservations, prng);

  // 8. Seed Tournaments, CMS & Ratings
  console.log('🏆 [7/7] Seeding Tournaments, CMS Pages, Expenses & Ratings...');
  await seedTournamentsCmsAndRatings(prisma, centers, reservations, prng);

  // 9. Sync Analytics
  await syncAnalyticsSummaries();

  console.log('====================================================');
  console.log('🎉 Professional PlayNest Seed Ecosystem Successfully Completed!');
  console.log('====================================================');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
