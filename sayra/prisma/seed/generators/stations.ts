import { PrismaClient, GameStationType, MaintenanceStatus, MaintenanceSeverity } from '@prisma/client';
import { PRNG } from '../prng';
import { SeedCenterDefinition } from './centers';
import { SEED_CONFIG } from '../config';

export interface SeedStationInfo {
  id: string;
  gamingCenterId: string;
  name: string;
  stationType: GameStationType;
  isVip: boolean;
  hourlyPrice: number;
}

export async function seedStations(
  prisma: PrismaClient,
  centers: { id: string; definition: SeedCenterDefinition }[],
  prng: PRNG
) {
  const allStations: SeedStationInfo[] = [];

  for (const center of centers) {
    const archetype = SEED_CONFIG.archetypes[center.definition.archetype];
    const totalCount = archetype.stationCount;

    for (let i = 1; i <= totalCount; i++) {
      let type: GameStationType = GameStationType.PC;
      let name = '';
      let isVip = false;

      if (center.definition.archetype === 'VIP_LOUNGE') {
        if (i <= 5) {
          type = GameStationType.PLAYSTATION;
          name = `PS5-VIP-${i}`;
          isVip = true;
        } else {
          type = GameStationType.PC;
          name = `PC-VIP-${i - 5}`;
          isVip = true;
        }
      } else if (center.definition.archetype === 'ESPORTS') {
        if (i <= 12) {
          type = GameStationType.PC;
          isVip = i <= 4;
          name = isVip ? `PRO-ARENA-${i}` : `PC-ESPORTS-${i}`;
        } else {
          type = GameStationType.PLAYSTATION;
          name = `PS5-${i - 12}`;
          isVip = false;
        }
      } else {
        const pcRatio = Math.floor(totalCount * 0.65);
        if (i <= pcRatio) {
          type = GameStationType.PC;
          isVip = i <= 2;
          name = isVip ? `PC-VIP-${i}` : `PC-${i}`;
        } else if (i <= totalCount - 1) {
          type = GameStationType.PLAYSTATION;
          isVip = i === pcRatio + 1;
          name = isVip ? `PS5-VIP-${i - pcRatio}` : `PS5-${i - pcRatio}`;
        } else {
          type = prng.pick([GameStationType.XBOX, GameStationType.VR]);
          isVip = true;
          name = type === GameStationType.XBOX ? 'XBOX-SX-1' : 'VR-ZONE-1';
        }
      }

      const hourlyPrice = isVip ? center.definition.vipHourlyRate : center.definition.hourlyRate;

      const station = await prisma.gameStation.create({
        data: {
          gamingCenterId: center.id,
          name,
          stationType: type,
          isVip,
          hourlyPrice,
          minRentHours: 1,
          maxRentHours: 6,
          isActive: true,
        },
      });

      allStations.push({
        id: station.id,
        gamingCenterId: center.id,
        name: station.name,
        stationType: station.stationType,
        isVip: station.isVip,
        hourlyPrice: station.hourlyPrice,
      });

      if (prng.chance(0.15)) {
        const isCurrentlyDown = prng.chance(0.2);
        const daysAgo = prng.randInt(2, 25);
        const startMaintenance = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
        const resolvedAt = isCurrentlyDown ? null : new Date(startMaintenance.getTime() + prng.randInt(2, 8) * 3600 * 1000);

        await prisma.stationMaintenance.create({
          data: {
            stationId: station.id,
            gamingCenterId: center.id,
            status: isCurrentlyDown ? MaintenanceStatus.IN_MAINTENANCE : MaintenanceStatus.REPAIRED,
            severity: prng.pick([MaintenanceSeverity.LOW, MaintenanceSeverity.MEDIUM, MaintenanceSeverity.HIGH]),
            reason: prng.pick([
              'تعویض پد حرارتی و سرویس خنک‌کننده پردازنده',
              'تعمیر جک صدای هدفون و کابل شبکه',
              'دریفت آنالوگ دسته بازی PS5 و تعویض ماژول پتانسیومتر',
              'سرویس دوره‌ای فن کارت گرافیک و گردگیری کیس',
              'نقص پورت HDMI مانیتور',
            ]),
            cost: isCurrentlyDown ? null : prng.randInt(150000, 850000),
            breakdownType: 'HARDWARE',
            reportedAt: startMaintenance,
            startTime: startMaintenance,
            endTime: resolvedAt,
            repairedAt: resolvedAt,
          },
        });
      }
    }
  }

  return allStations;
}
