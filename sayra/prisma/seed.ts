import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';
import { seedFromDataset, SeedReportMetrics } from './seed/dataset-seeder';
import { AnalyticsRepo } from '../src/modules/analytics/analytics.repo';

const prisma = new PrismaClient();

async function syncAnalyticsSummaries(centerIds?: string[]) {
  console.log('📊 Running Safe Analytics Sync across seeded centers...');
  try {
    const whereClause = centerIds && centerIds.length > 0 ? { gamingCenterId: { in: centerIds } } : {};

    const reservationDates = await prisma.reservation.groupBy({
      by: ['gamingCenterId', 'startTime'],
      where: whereClause,
    });

    const uniqueCenterDates = new Map<string, Set<string>>();
    for (const r of reservationDates) {
      const dateStr = r.startTime.toISOString().split('T')[0];
      if (!uniqueCenterDates.has(r.gamingCenterId)) {
        uniqueCenterDates.set(r.gamingCenterId, new Set());
      }
      uniqueCenterDates.get(r.gamingCenterId)!.add(dateStr);
    }

    for (const [centerId, dates] of Array.from(uniqueCenterDates.entries())) {
      for (const dateStr of Array.from(dates)) {
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
          if (s.stationId) {
            await AnalyticsRepo.syncStationStats(centerId, s.stationId, date);
          }
        }
      }
    }
    console.log('✅ Safe analytics sync completed successfully.');
  } catch (err) {
    console.warn('⚠️ Analytics sync warning (continuing seed):', err instanceof Error ? err.message : String(err));
  }
}

function printSeedReport(metrics: SeedReportMetrics) {
  console.log('====================================================');
  console.log('              📊 PLAYNEST SEED REPORT              ');
  console.log('====================================================');
  console.log(`🏢 مراکز بازی جدید ایجادشده:        ${metrics.newCentersCreated}`);
  console.log(`🔄 مراکز بازی به‌روزرسانی‌شده:       ${metrics.centersUpdated}`);
  console.log(`⏸️ مراکز بازی بدون تغییر:           ${metrics.centersUnchanged}`);
  console.log(`🖥️ ایستگاه‌های بازی جدید ایجادشده:   ${metrics.newStationsCreated}`);
  console.log(`🔄 ایستگاه‌های به‌روزرسانی‌شده:      ${metrics.stationsUpdated}`);
  console.log(`🔗 رکوردهای وابسته ایجادشده:        ${metrics.dependentRecordsCreated}`);
  console.log(`🛡️ رکوردهای تکراری/موجود حفظ‌شده:   ${metrics.duplicateRecordsIdentified}`);
  console.log(`❌ عملیات ناموفق:                   ${metrics.failedOperationsCount}`);
  console.log(`⏱️ مدت زمان اجرای Seed:             ${(metrics.elapsedTimeMs / 1000).toFixed(2)} ثانیه`);
  console.log('====================================================');
}

async function main() {
  console.log('====================================================');
  console.log('   PlayNest - Production-Safe Database Seed Ecosystem');
  console.log('====================================================');

  const datasetPathCandidates = [
    path.resolve(__dirname, 'seed/playnest_seed_dataset_10_centers.json'),
    path.resolve(__dirname, '../../playnest_seed_dataset_10_centers.json'),
    path.resolve(process.cwd(), 'playnest_seed_dataset_10_centers.json'),
    path.resolve(process.cwd(), 'prisma/seed/playnest_seed_dataset_10_centers.json'),
  ];

  let datasetFilePath = '';
  for (const candidate of datasetPathCandidates) {
    if (fs.existsSync(candidate)) {
      datasetFilePath = candidate;
      break;
    }
  }

  if (!datasetFilePath) {
    throw new Error('❌ Dataset file playnest_seed_dataset_10_centers.json not found!');
  }

  console.log(`📁 Loading dataset from: ${datasetFilePath}`);
  const metrics = await seedFromDataset(prisma, datasetFilePath);

  // Sync analytics for seeded centers
  await syncAnalyticsSummaries();

  // Print execution summary report
  printSeedReport(metrics);

  console.log('🎉 Production-Safe PlayNest Seed Successfully Completed!');
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
