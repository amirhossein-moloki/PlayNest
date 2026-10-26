import { AnalyticsStation } from '../../../../src/modules/analytics/analytics.station';
import { AnalyticsRepo } from '../../../../src/modules/analytics/analytics.repo';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    settings: {
      findUnique: jest.fn().mockResolvedValue({ timeZone: 'Asia/Tehran' }),
    },
  },
}));

jest.mock('../../../../src/modules/analytics/analytics.repo', () => ({
  AnalyticsRepo: {
    getCancellationAnalyticsStats: jest.fn(),
  },
}));

describe('Structured Cancellation Reasons Analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should categorize cancellations by category, actor, and discount status', async () => {
    (AnalyticsRepo.getCancellationAnalyticsStats as jest.Mock).mockResolvedValue({
      totalReservationsCount: 10,
      canceledReservations: [
        {
          id: 'res-1',
          cancelCategory: 'CUSTOMER_CANCEL',
          cancelActor: 'CUSTOMER',
          discountAmount: 1000,
          voucherCode: 'PROMO10',
        },
        {
          id: 'res-2',
          cancelCategory: 'PAYMENT_FAILED',
          cancelActor: 'SYSTEM',
          discountAmount: 0,
          voucherCode: null,
        },
        {
          id: 'res-3',
          cancelCategory: null, // Legacy cancellation
          cancelActor: null,
          discountAmount: 0,
          voucherCode: null,
        },
      ],
    });

    const report = await AnalyticsStation.getCancellationAnalytics(
      'center-1',
      new Date('2025-01-01'),
      new Date('2025-01-31')
    );

    expect(report.totalReservationsCount).toBe(10);
    expect(report.totalCanceledCount).toBe(3);
    expect(report.cancellationRate).toBe(30);

    const customerCategory = report.byCategory.find((c) => c.category === 'CUSTOMER_CANCEL');
    expect(customerCategory?.count).toBe(1);

    const unknownCategory = report.byCategory.find((c) => c.category === 'UNKNOWN');
    expect(unknownCategory?.count).toBe(1); // Legacy cancellation remains UNKNOWN

    expect(report.discountedvsNonDiscounted.discountedCanceledCount).toBe(1);
    expect(report.discountedvsNonDiscounted.nonDiscountedCanceledCount).toBe(2);
  });
});
