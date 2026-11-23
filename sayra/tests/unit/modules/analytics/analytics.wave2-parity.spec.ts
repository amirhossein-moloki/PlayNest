/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { computeAnalyticsTtlSeconds } from '../../../../src/modules/analytics/analytics.cache';
import { AnalyticsStation } from '../../../../src/modules/analytics/analytics.station';
import { AnalyticsRepo } from '../../../../src/modules/analytics/analytics.repo';
import { prisma } from '../../../../src/config/prisma';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    settings: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../../../src/modules/analytics/analytics.repo');

const MockedRepo = AnalyticsRepo as jest.Mocked<typeof AnalyticsRepo>;

describe('Wave 2 Analytics Caching & SQL Aggregation Parity (AMI-37)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ((prisma as any).settings.findUnique as jest.MockedFunction<any>).mockResolvedValue({
      timeZone: 'Asia/Tehran',
    });
  });

  it('should assign 300s TTL for strictly historical windows and 60s TTL for current-day windows', () => {
    const now = new Date('2026-11-23T12:00:00Z');
    const historicalEnd = new Date('2026-11-22T20:29:59.999Z'); // 23:59:59 Tehran on Nov 22
    const todayEnd = new Date('2026-11-23T20:29:59.999Z'); // Nov 23 Tehran

    expect(computeAnalyticsTtlSeconds(historicalEnd, 'Asia/Tehran', now)).toBe(300);
    expect(computeAnalyticsTtlSeconds(todayEnd, 'Asia/Tehran', now)).toBe(60);
  });

  it('should preserve getRevenueChart daily filtering using SQL trends', async () => {
    MockedRepo.getDailyReservationTrends.mockResolvedValue([
      { date: '2026-11-20', total: 4, completed: 2, canceled: 1, revenue: 300000 },
      { date: '2026-11-21', total: 1, completed: 0, canceled: 1, revenue: 0 },
      { date: '2026-11-22', total: 3, completed: 3, canceled: 0, revenue: 450000 },
    ]);

    const chart = await AnalyticsStation.getRevenueChart(
      'gc-1',
      new Date('2026-11-20'),
      new Date('2026-11-22')
    );

    expect(chart).toEqual([
      { date: '2026-11-20', revenue: 300000 },
      { date: '2026-11-22', revenue: 450000 },
    ]);
  });

  it('should map 7-stage funnel floor invariants accurately when web events exist', async () => {
    MockedRepo.getFunnelEventCounts.mockResolvedValue({
      totalEvents: 5,
      byEventType: {
        page_view: 2,
        center_view: 1,
        station_view: 0,
        booking_started: 1,
        checkout_started: 1,
      },
    });
    MockedRepo.getFunnelReservationCounts.mockResolvedValue({
      totalCreated: 5,
      paidCount: 3,
      completedCount: 2,
      sessionStartedCount: 2,
    });

    const funnel = await AnalyticsStation.getConversionFunnel(
      'gc-1',
      new Date('2026-11-01'),
      new Date('2026-11-10')
    );

    expect(funnel.webTrafficFunnelStatus).toBe('INSTRUMENTED');
    expect(funnel.funnel.map((s) => s.count)).toEqual([5, 5, 5, 5, 3, 3, 2]);
    expect(funnel.summary.overallConversionRate).toBe(40);
  });
});
