import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { prismaMock } from '../../../mocks/prisma';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: prismaMock,
}));

jest.mock('../../../../src/modules/analytics/analytics.repo');

import { AnalyticsStation } from '../../../../src/modules/analytics/analytics.station';
import { AnalyticsRepo } from '../../../../src/modules/analytics/analytics.repo';

/* eslint-disable @typescript-eslint/no-explicit-any */

const MockedRepo = AnalyticsRepo as jest.Mocked<typeof AnalyticsRepo>;
const settingsMock = prismaMock.settings as any;

describe('AnalyticsStation', () => {
  const gamingCenterId = 'gc-100';
  const startDate = new Date('2026-01-01');
  const endDate = new Date('2026-01-10');

  beforeEach(() => {
    jest.clearAllMocks();
    settingsMock.findUnique.mockResolvedValue({ timeZone: 'UTC' });
  });

  describe('getSummary', () => {
    it('should calculate summary metrics accurately', async () => {
      MockedRepo.getSummaryStats.mockResolvedValue({
        totalReservations: 10,
        completedReservations: 8,
        canceledReservations: 2,
        revenue: 1000,
        realizedCash: 1000,
      } as any);

      MockedRepo.getLiveReservationStats.mockResolvedValue({
        byStatus: [
          { status: 'COMPLETED', _count: { _all: 8 }, _sum: { totalPrice: 1000, totalHours: 16 } },
          { status: 'CANCELED', _count: { _all: 2 }, _sum: { totalPrice: 200, totalHours: 4 } },
        ],
        byStation: [],
        totalCount: 10,
      } as any);

      MockedRepo.getNewCustomersCount.mockResolvedValue(3);

      MockedRepo.getLiveFinancialStats.mockResolvedValue({
        paidPayments: [{ currency: 'IRR', _sum: { amount: 1000 }, _count: { _all: 8 } }],
        paymentsByStatus: [],
        paymentsByMethod: [],
        paymentsByProvider: [],
        refunds: [],
        ledgerEntries: [],
      } as any);

      const result = await AnalyticsStation.getSummary(gamingCenterId, startDate, endDate);

      expect(result.totalReservations).toBe(10);
      expect(result.completedReservations).toBe(8);
      expect(result.canceledReservations).toBe(2);
      expect(result.totalRevenue).toBe(1000);
      expect(result.completionRate).toBe(100);
      expect(result.averageReservationValue).toBe(125);
      expect(result.newCustomers).toBe(3);
      expect(result.period.timeZone).toBe('UTC');
    });
  });

  describe('getReservationReport', () => {
    it('should return reservation metrics, lead time, duration comparison, and anomaly breakdown', async () => {
      MockedRepo.getLiveReservationStats.mockResolvedValue({
        byStatus: [
          { status: 'COMPLETED', _count: { _all: 8 }, _sum: { totalPrice: 800, totalHours: 16 } },
          { status: 'CANCELED', _count: { _all: 2 }, _sum: { totalPrice: 200, totalHours: 4 } },
        ],
        byStation: [{ stationId: 'st-1', _count: { _all: 8 }, _sum: { totalPrice: 800, totalHours: 16 } }],
        totalCount: 10,
      } as any);

      MockedRepo.getReservationListForTrends.mockResolvedValue([
        { startTime: new Date('2026-01-01T10:00:00Z'), status: 'COMPLETED', totalPrice: 100, totalHours: 2 },
      ] as any);

      MockedRepo.getStationDetails.mockResolvedValue([
        { id: 'st-1', name: 'PC 1', stationType: 'PC', isActive: true, hourlyPrice: 50 },
      ] as any);

      MockedRepo.getReservationLeadTimeStats.mockResolvedValue([
        { id: 'res-1', createdAt: new Date('2026-01-01T08:00:00Z'), startTime: new Date('2026-01-01T10:00:00Z'), status: 'COMPLETED', totalHours: 2 },
        { id: 'res-2', createdAt: new Date('2026-01-01T09:00:00Z'), startTime: new Date('2026-01-01T10:00:00Z'), status: 'COMPLETED', totalHours: 2 },
      ] as any);

      MockedRepo.getCanceledWithPaidStats.mockResolvedValue([
        {
          id: 'res-canc-1',
          totalPrice: 100,
          startTime: new Date('2026-01-02T10:00:00Z'),
          createdAt: new Date('2026-01-02T08:00:00Z'),
          canceledAt: new Date('2026-01-02T09:00:00Z'),
          cancelReason: 'Customer request',
          payments: [{ id: 'p-1', amount: 100, paidAt: new Date(), refunds: [] }],
        },
      ] as any);

      MockedRepo.getStationGamingSessionStats.mockResolvedValue([
        { id: 'gs-1', stationId: 'st-1', reservationId: 'res-1', startTime: new Date('2026-01-01T10:00:00Z'), endTime: new Date('2026-01-01T12:00:00Z'), actualHours: 2, pausedMinutes: 0, status: 'COMPLETED' },
      ] as any);

      const result = await AnalyticsStation.getReservationReport(gamingCenterId, startDate, endDate);

      expect(result.totalReservations).toBe(10);
      expect(result.metrics.completionRate).toBe(80);
      expect(result.metrics.cancellationRate).toBe(20);
      expect(result.metrics.averageLeadTimeMinutes).toBe(90);
      expect(result.metrics.medianLeadTimeMinutes).toBe(90);
      expect(result.metrics.totalPlannedHours).toBe(20);
      expect(result.metrics.totalActualHours).toBe(2);
      expect(result.anomalies.canceledWithPaidCount).toBe(1);
      expect(result.anomalies.unrefundedCanceledAmount).toBe(100);
      expect(result.statusDistribution).toHaveLength(7);
      expect(result.stationBreakdown).toHaveLength(1);
      expect(result.trends).toHaveLength(1);
    });

    it('should handle zero reservations safely without NaN or division by zero', async () => {
      MockedRepo.getLiveReservationStats.mockResolvedValue({
        byStatus: [],
        byStation: [],
        totalCount: 0,
      } as any);

      MockedRepo.getReservationListForTrends.mockResolvedValue([]);
      MockedRepo.getStationDetails.mockResolvedValue([]);
      MockedRepo.getReservationLeadTimeStats.mockResolvedValue([]);
      MockedRepo.getCanceledWithPaidStats.mockResolvedValue([]);
      MockedRepo.getStationGamingSessionStats.mockResolvedValue([]);

      const result = await AnalyticsStation.getReservationReport(gamingCenterId, startDate, endDate);

      expect(result.totalReservations).toBe(0);
      expect(result.metrics.completionRate).toBe(0);
      expect(result.metrics.cancellationRate).toBe(0);
      expect(result.metrics.noShowRate).toBe(0);
      expect(result.metrics.averageLeadTimeMinutes).toBe(0);
      expect(result.metrics.medianLeadTimeMinutes).toBe(0);
      expect(result.anomalies.canceledWithPaidCount).toBe(0);
      expect(result.anomalies.unrefundedCanceledAmount).toBe(0);
    });
  });

  describe('getStationPerformance', () => {
    it('should calculate capacity, maintenance downtime, booking rate, and actual utilization rate accurately', async () => {
      MockedRepo.getLiveReservationStats.mockResolvedValue({
        byStatus: [],
        byStation: [{ stationId: 'st-1', _count: { _all: 5 }, _sum: { totalPrice: 500, totalHours: 10 } }],
        totalCount: 5,
      } as any);

      MockedRepo.getStationDetails.mockResolvedValue([
        { id: 'st-1', name: 'PC 1', stationType: 'PC', isActive: true, hourlyPrice: 50 },
      ] as any);

      MockedRepo.getGamingCenterDetails.mockResolvedValue({
        id: gamingCenterId,
        name: 'Center 1',
        openingTime: '10:00',
        closingTime: '22:00', // 12 hours per day * 9 days = 108 hours total operating capacity
        pcCount: 10,
        consoleCount: 5,
        isActive: true,
      } as any);

      MockedRepo.getStationMaintenanceStats.mockResolvedValue([
        {
          id: 'm-1',
          stationId: 'st-1',
          startTime: new Date('2026-01-02T10:00:00Z'),
          endTime: new Date('2026-01-02T18:00:00Z'), // 8 hours downtime
          reason: 'GPU Repair',
          cost: 150,
        },
      ] as any);

      MockedRepo.getStationGamingSessionStats.mockResolvedValue([
        {
          id: 'gs-1',
          stationId: 'st-1',
          reservationId: 'res-1',
          startTime: new Date('2026-01-01T10:00:00Z'),
          endTime: new Date('2026-01-01T18:00:00Z'),
          actualHours: 8,
          pausedMinutes: 0,
          status: 'COMPLETED',
        },
      ] as any);

      const result = await AnalyticsStation.getStationPerformance(gamingCenterId, startDate, endDate);

      expect(result).toHaveLength(1);
      const st = result[0];
      expect(st.stationId).toBe('st-1');
      expect(st.plannedHoursBooked).toBe(10);
      expect(st.actualSessionHours).toBe(8);
      expect(st.downtimeHours).toBe(8);
      // availableOperationalHours = 108 - 8 = 100
      expect(st.availableOperationalHours).toBe(100);
      // bookingRate = 10 / 100 = 10%
      expect(st.bookingRate).toBe(10);
      // utilizationRate = 8 / 100 = 8%
      expect(st.utilizationRate).toBe(8);
      // revenuePerAvailableStationHour = 500 / 100 = 5
      expect(st.revenuePerAvailableStationHour).toBe(5);
    });

    it('should handle zero available operational hours cleanly without error', async () => {
      MockedRepo.getLiveReservationStats.mockResolvedValue({
        byStatus: [],
        byStation: [],
        totalCount: 0,
      } as any);

      MockedRepo.getStationDetails.mockResolvedValue([
        { id: 'st-1', name: 'PC 1', stationType: 'PC', isActive: true, hourlyPrice: 50 },
      ] as any);

      MockedRepo.getGamingCenterDetails.mockResolvedValue({
        id: gamingCenterId,
        name: 'Center 1',
        openingTime: '10:00',
        closingTime: '10:00', // 0 operating hours
        pcCount: 1,
        consoleCount: 0,
        isActive: true,
      } as any);

      MockedRepo.getStationMaintenanceStats.mockResolvedValue([]);
      MockedRepo.getStationGamingSessionStats.mockResolvedValue([]);

      const result = await AnalyticsStation.getStationPerformance(gamingCenterId, startDate, endDate);

      expect(result).toHaveLength(1);
      const st = result[0];
      expect(st.bookingRate).toBe(0);
      expect(st.utilizationRate).toBe(0);
      expect(st.revenuePerAvailableStationHour).toBe(0);
    });
  });

  describe('getFinancialReport', () => {
    it('should return multi-currency safe gross, refund, and net financial summary', async () => {
      MockedRepo.getLiveFinancialStats.mockResolvedValue({
        paidPayments: [{ currency: 'IRR', _sum: { amount: 500000 }, _count: { _all: 5 } }],
        paymentsByStatus: [{ status: 'PAID', currency: 'IRR', _sum: { amount: 500000 }, _count: { _all: 5 } }],
        paymentsByMethod: [{ method: 'ONLINE', currency: 'IRR', _sum: { amount: 500000 }, _count: { _all: 5 } }],
        paymentsByProvider: [{ provider: 'ZARINPAL', currency: 'IRR', _sum: { amount: 500000 }, _count: { _all: 5 } }],
        refunds: [{ currency: 'IRR', _sum: { amount: 50000 }, _count: { _all: 1 } }],
        ledgerEntries: [{ entryType: 'PAYMENT_COLLECTION', currency: 'IRR', _sum: { amount: 500000 }, _count: { _all: 5 } }],
      } as any);

      const result = await AnalyticsStation.getFinancialReport(gamingCenterId, startDate, endDate);

      expect(result.summary.grossCollected).toBe(500000);
      expect(result.summary.totalRefunded).toBe(50000);
      expect(result.summary.netCollected).toBe(450000);
      expect(result.paymentsByStatus).toHaveLength(1);
      expect(result.paymentsByMethod).toHaveLength(1);
    });
  });

  describe('getWaitlistReport', () => {
    it('should calculate waitlist entry and offer conversion metrics', async () => {
      MockedRepo.getWaitlistAnalyticsStats.mockResolvedValue({
        entriesByStatus: [{ status: 'CONVERTED', _count: { _all: 4 } }],
        offersByStatus: [{ status: 'ACCEPTED', _count: { _all: 4 } }],
        totalEntries: 5,
      } as any);

      const result = await AnalyticsStation.getWaitlistReport(gamingCenterId, startDate, endDate);

      expect(result.totalEntries).toBe(5);
      expect(result.conversionRate).toBe(80);
      expect(result.offersSummary.totalOffers).toBe(4);
      expect(result.offersSummary.offerAcceptanceRate).toBe(100);
    });
  });

  describe('getNotificationReport', () => {
    it('should calculate notification dispatch logs and failure rate', async () => {
      MockedRepo.getNotificationAnalyticsStats.mockResolvedValue({
        byStatus: [
          { status: 'SENT', _count: { _all: 9 } },
          { status: 'FAILED', _count: { _all: 1 } },
        ],
        byChannel: [{ channel: 'SMS', _count: { _all: 10 } }],
        byType: [{ type: 'RESERVATION_CREATED', _count: { _all: 10 } }],
        totalLogs: 10,
      } as any);

      const result = await AnalyticsStation.getNotificationReport(gamingCenterId, startDate, endDate);

      expect(result.totalLogs).toBe(10);
      expect(result.failureRate).toBe(10);
      expect(result.statusDistribution).toHaveLength(2);
    });
  });
});
