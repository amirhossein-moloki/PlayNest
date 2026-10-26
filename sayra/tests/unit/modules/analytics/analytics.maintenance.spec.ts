import { MaintenanceService } from '../../../../src/modules/analytics/maintenance.service';
import { AnalyticsStation } from '../../../../src/modules/analytics/analytics.station';
import { AnalyticsRepo } from '../../../../src/modules/analytics/analytics.repo';
import { prisma } from '../../../../src/config/prisma';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    gameStation: {
      findFirst: jest.fn(),
    },
    stationMaintenance: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    settings: {
      findUnique: jest.fn().mockResolvedValue({ timeZone: 'Asia/Tehran' }),
    },
  },
}));

jest.mock('../../../../src/modules/analytics/analytics.repo', () => ({
  AnalyticsRepo: {
    getStationDetails: jest.fn(),
    getStationMaintenanceStats: jest.fn(),
    getGamingCenterDetails: jest.fn(),
  },
}));

describe('MaintenanceService & Maintenance Analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('MaintenanceService', () => {
    it('should create a maintenance record for a valid station', async () => {
      (prisma.gameStation.findFirst as jest.Mock).mockResolvedValue({ id: 'st-1', gamingCenterId: 'center-1' });
      (prisma.stationMaintenance.create as jest.Mock).mockImplementation(async ({ data }) => ({
        id: 'maint-1',
        ...data,
      }));

      const result = await MaintenanceService.createMaintenance({
        gamingCenterId: 'center-1',
        stationId: 'st-1',
        startTime: new Date('2025-01-01T10:00:00Z'),
        endTime: new Date('2025-01-01T12:00:00Z'),
        reason: 'GPU malfunction',
        breakdownType: 'HARDWARE',
      });

      expect(result.id).toBe('maint-1');
      expect(prisma.stationMaintenance.create).toHaveBeenCalledTimes(1);
    });

    it('should reject maintenance when endTime is before startTime', async () => {
      (prisma.gameStation.findFirst as jest.Mock).mockResolvedValue({ id: 'st-1', gamingCenterId: 'center-1' });

      await expect(
        MaintenanceService.createMaintenance({
          gamingCenterId: 'center-1',
          stationId: 'st-1',
          startTime: new Date('2025-01-01T12:00:00Z'),
          endTime: new Date('2025-01-01T10:00:00Z'),
          reason: 'Invalid time bounds',
        })
      ).rejects.toThrow('Maintenance end time cannot be before start time.');
    });
  });

  describe('Maintenance Analytics in AnalyticsStation', () => {
    it('should calculate MTTR, MTBF, availability rate, and deduplicate overlapping downtime', async () => {
      (AnalyticsRepo.getStationDetails as jest.Mock).mockResolvedValue([
        { id: 'st-1', name: 'PC-1', hourlyPrice: 50000 },
      ]);
      (AnalyticsRepo.getGamingCenterDetails as jest.Mock).mockResolvedValue({
        openingTime: '00:00',
        closingTime: '24:00',
      });

      // Two overlapping maintenance intervals: 10:00-12:00 and 11:00-13:00 -> Merged downtime = 3 hours (10:00-13:00)
      (AnalyticsRepo.getStationMaintenanceStats as jest.Mock).mockResolvedValue([
        {
          id: 'm-1',
          stationId: 'st-1',
          startTime: new Date('2025-01-01T10:00:00Z'),
          endTime: new Date('2025-01-01T12:00:00Z'),
          reason: 'Hardware 1',
        },
        {
          id: 'm-2',
          stationId: 'st-1',
          startTime: new Date('2025-01-01T11:00:00Z'),
          endTime: new Date('2025-01-01T13:00:00Z'),
          reason: 'Hardware 2',
        },
      ]);

      const analytics = await AnalyticsStation.getMaintenanceAnalytics(
        'center-1',
        new Date('2025-01-01T00:00:00Z'),
        new Date('2025-01-01T23:59:59Z')
      );

      expect(analytics.summary.totalBreakdownsCount).toBe(2);
      expect(analytics.summary.totalDowntimeHours).toBe(3); // 3 hours deduplicated
      expect(analytics.summary.mttrHours).toBe(2); // Avg of 2h and 2h = 2h
      expect(analytics.summary.estimatedPotentialLostRevenue).toBe(150000); // 3h * 50,000 IRR
      expect(analytics.summary.availabilityRate).toBe(87.5); // (24 - 3)/24 = 87.5%
    });
  });
});
