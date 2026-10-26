import { AnalyticsStation } from '../../../../src/modules/analytics/analytics.station';
import { AnalyticsRepo } from '../../../../src/modules/analytics/analytics.repo';
import { prisma } from '../../../../src/config/prisma';
import { subDays } from 'date-fns';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    settings: {
      findUnique: jest.fn().mockResolvedValue({ timeZone: 'Asia/Tehran' }),
    },
  },
}));

jest.mock('../../../../src/modules/analytics/analytics.repo', () => ({
  AnalyticsRepo: {
    getDiscountCohortReservations: jest.fn(),
  },
}));

describe('Discount Impact on Retention Analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should compare retention rates across platform discounted, merchant discounted, and non-discounted cohorts', async () => {
    const now = new Date();
    const day100Ago = subDays(now, 100);
    const day50Ago = subDays(now, 50);

    (AnalyticsRepo.getDiscountCohortReservations as jest.Mock).mockResolvedValue([
      // Customer 1: Platform Discounted, repeated at day 50 ago
      {
        id: 'res-1',
        customerAccountId: 'cust-1',
        startTime: day100Ago,
        totalPrice: 100000,
        discountAmount: 20000,
        discountFundingSource: 'PLATFORM',
        voucherCode: 'PLATFORM20',
      },
      {
        id: 'res-1-repeat',
        customerAccountId: 'cust-1',
        startTime: day50Ago,
        totalPrice: 120000,
        discountAmount: 0,
        discountFundingSource: null,
        voucherCode: null,
      },

      // Customer 2: Merchant Discounted, no repeat
      {
        id: 'res-2',
        customerAccountId: 'cust-2',
        startTime: day100Ago,
        totalPrice: 80000,
        discountAmount: 10000,
        discountFundingSource: 'MERCHANT_FUNDED',
        voucherCode: 'MERCHANT10',
      },

      // Customer 3: Non-Discounted, no repeat
      {
        id: 'res-3',
        customerAccountId: 'cust-3',
        startTime: day100Ago,
        totalPrice: 100000,
        discountAmount: 0,
        discountFundingSource: null,
        voucherCode: null,
      },
    ]);

    const report = await AnalyticsStation.getDiscountRetentionAnalytics(
      'center-1',
      subDays(now, 120),
      now
    );

    expect(report.totalCustomersEvaluated).toBe(3);

    const platformCohort = report.cohortComparison.platformDiscounted;
    expect(platformCohort.totalCustomers).toBe(1);
    expect(platformCohort.retention60d.retainedCount).toBe(1);
    expect(platformCohort.retention60d.retentionRate).toBe(100);

    const merchantCohort = report.cohortComparison.merchantDiscounted;
    expect(merchantCohort.totalCustomers).toBe(1);
    expect(merchantCohort.retention60d.retainedCount).toBe(0);
    expect(merchantCohort.retention60d.retentionRate).toBe(0);

    const nonDiscountedCohort = report.cohortComparison.nonDiscounted;
    expect(nonDiscountedCohort.totalCustomers).toBe(1);
    expect(nonDiscountedCohort.retention60d.retainedCount).toBe(0);
  });
});
