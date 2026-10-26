import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AnalyticsStation } from '../../../../src/modules/analytics/analytics.station';
import { AnalyticsRepo } from '../../../../src/modules/analytics/analytics.repo';
import { resolveTimezoneAndBoundaries } from '../../../../src/modules/analytics/analytics.validators';

jest.mock('../../../../src/modules/analytics/analytics.validators');

const mockResolveTimezone = resolveTimezoneAndBoundaries as jest.MockedFunction<typeof resolveTimezoneAndBoundaries>;

describe('AnalyticsStation Phase 7 Benchmarking & Growth Insights Unit Tests', () => {
  const mockTenantId = 'gc-target';
  const startDate = new Date('2026-02-01T00:00:00Z');
  const endDate = new Date('2026-02-28T23:59:59Z');

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ENABLE_ANALYTICS_BENCHMARKING;

    mockResolveTimezone.mockResolvedValue({
      timeZone: 'UTC',
      dayStart: startDate,
      dayEnd: endDate,
    });

    // Mock summary stats
    jest.spyOn(AnalyticsRepo, 'getSummaryStats').mockResolvedValue({
      totalReservations: 10,
      completedReservations: 8,
      canceledReservations: 2,
      revenue: 1000,
      realizedCash: 1000,
    });

    jest.spyOn(AnalyticsRepo, 'getLiveReservationStats').mockResolvedValue({
      byStatus: [
        { status: 'COMPLETED', _count: { _all: 8 }, _sum: { totalPrice: 1000, totalHours: 16 } },
        { status: 'CANCELED', _count: { _all: 2 }, _sum: { totalPrice: 0, totalHours: 0 } },
      ],
      byStation: [],
      totalCount: 10,
    });

    jest.spyOn(AnalyticsRepo, 'getNewCustomersCount').mockResolvedValue(5);
    jest.spyOn(AnalyticsRepo, 'getLiveFinancialStats').mockResolvedValue({
      paidPayments: [{ currency: 'IRR', _sum: { amount: 1000 }, _count: { _all: 8 } }],
      paymentsByStatus: [],
      paymentsByMethod: [],
      paymentsByProvider: [],
      refunds: [],
      ledgerEntries: [],
    });

    jest.spyOn(AnalyticsRepo, 'getReservationListForTrends').mockResolvedValue([]);
    jest.spyOn(AnalyticsRepo, 'getStationDetails').mockResolvedValue([
      { id: 'st-1', name: 'PC 1', stationType: 'PC', isActive: true, hourlyPrice: 100 },
      { id: 'st-2', name: 'PC 2', stationType: 'PC', isActive: true, hourlyPrice: 100 },
    ]);

    jest.spyOn(AnalyticsRepo, 'getCompletedCustomerReservations').mockResolvedValue([]);
    jest.spyOn(AnalyticsRepo, 'getCustomerAllHistoricalFirstVisits').mockResolvedValue([]);
    jest.spyOn(AnalyticsRepo, 'getCustomerAllHistoricalVisits').mockResolvedValue([]);
  });

  describe('getBenchmarks', () => {
    it('should suppress benchmarking results when peer cohort size k < 5', async () => {
      // Mock 3 peers (k = 3 < 5)
      jest.spyOn(AnalyticsRepo, 'getEligiblePeerGamingCenters').mockResolvedValue([
        { id: 'gc-peer-1', name: 'Peer 1' },
        { id: 'gc-peer-2', name: 'Peer 2' },
        { id: 'gc-peer-3', name: 'Peer 3' },
      ]);

      const result = await AnalyticsStation.getBenchmarks(mockTenantId, startDate, endDate);

      expect(result.status).toBe('SUPPRESSED');
      expect(result.isSuppressed).toBe(true);
      expect(result.peerCohortCount).toBe(3);
      expect(result.minimumCohortThreshold).toBe(5);
      expect(result.benchmarks).toBeNull();
      expect(result.tenantMetrics.completionRate).toBe(100);
    });

    it('should publish aggregate benchmark metrics when peer cohort size k >= 5', async () => {
      const peerList = [
        { id: 'p-1', name: 'Peer 1' },
        { id: 'p-2', name: 'Peer 2' },
        { id: 'p-3', name: 'Peer 3' },
        { id: 'p-4', name: 'Peer 4' },
        { id: 'p-5', name: 'Peer 5' },
      ];
      jest.spyOn(AnalyticsRepo, 'getEligiblePeerGamingCenters').mockResolvedValue(peerList);

      jest.spyOn(AnalyticsRepo, 'getCrossTenantReservationStats').mockResolvedValue([
        { gamingCenterId: 'p-1', status: 'COMPLETED', _count: { _all: 10 }, _sum: { totalPrice: 1000, totalHours: 20 } },
        { gamingCenterId: 'p-2', status: 'COMPLETED', _count: { _all: 8 }, _sum: { totalPrice: 800, totalHours: 16 } },
        { gamingCenterId: 'p-3', status: 'COMPLETED', _count: { _all: 12 }, _sum: { totalPrice: 1200, totalHours: 24 } },
        { gamingCenterId: 'p-4', status: 'COMPLETED', _count: { _all: 6 }, _sum: { totalPrice: 600, totalHours: 12 } },
        { gamingCenterId: 'p-5', status: 'COMPLETED', _count: { _all: 15 }, _sum: { totalPrice: 1500, totalHours: 30 } },
      ]);

      jest.spyOn(AnalyticsRepo, 'getCrossTenantStationCounts').mockResolvedValue([
        { gamingCenterId: 'p-1', _count: { _all: 2 } },
        { gamingCenterId: 'p-2', _count: { _all: 2 } },
        { gamingCenterId: 'p-3', _count: { _all: 2 } },
        { gamingCenterId: 'p-4', _count: { _all: 2 } },
        { gamingCenterId: 'p-5', _count: { _all: 2 } },
      ]);

      jest.spyOn(AnalyticsRepo, 'getCrossTenantCustomerStats').mockResolvedValue([
        { gamingCenterId: 'p-1', customerAccountId: 'c-1', _count: { _all: 2 } },
        { gamingCenterId: 'p-2', customerAccountId: 'c-2', _count: { _all: 1 } },
        { gamingCenterId: 'p-3', customerAccountId: 'c-3', _count: { _all: 3 } },
        { gamingCenterId: 'p-4', customerAccountId: 'c-4', _count: { _all: 2 } },
        { gamingCenterId: 'p-5', customerAccountId: 'c-5', _count: { _all: 2 } },
      ]);

      const result = await AnalyticsStation.getBenchmarks(mockTenantId, startDate, endDate);

      expect(result.status).toBe('PUBLISHED');
      expect(result.isSuppressed).toBe(false);
      expect(result.peerCohortCount).toBe(5);
      expect(result.benchmarks).not.toBeNull();
      expect(result.benchmarks?.completionRate?.median).toBeDefined();
    });

    it('should return DISABLED status when ENABLE_ANALYTICS_BENCHMARKING is false', async () => {
      process.env.ENABLE_ANALYTICS_BENCHMARKING = 'false';

      const result = await AnalyticsStation.getBenchmarks(mockTenantId, startDate, endDate);

      expect(result.status).toBe('DISABLED');
      expect(result.isSuppressed).toBe(true);
    });
  });

  describe('getGrowthInsights', () => {
    it('should generate trend and benchmark growth insights correctly', async () => {
      jest.spyOn(AnalyticsRepo, 'getEligiblePeerGamingCenters').mockResolvedValue([
        { id: 'p-1', name: 'P1' },
        { id: 'p-2', name: 'P2' },
        { id: 'p-3', name: 'P3' },
        { id: 'p-4', name: 'P4' },
        { id: 'p-5', name: 'P5' },
      ]);

      const result = await AnalyticsStation.getGrowthInsights(mockTenantId, startDate, endDate);

      expect(result.insightCount).toBeGreaterThan(0);
      expect(result.insights[0].id).toBeDefined();
      expect(result.insights[0].observedChange).toBeDefined();
    });
  });
});
