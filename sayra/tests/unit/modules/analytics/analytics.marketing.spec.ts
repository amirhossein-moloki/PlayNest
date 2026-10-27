import { MarketingSpendService } from '../../../../src/modules/analytics/marketing-spend.service';
import { AnalyticsStation } from '../../../../src/modules/analytics/analytics.station';
import { AnalyticsRepo } from '../../../../src/modules/analytics/analytics.repo';
import { prisma } from '../../../../src/config/prisma';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    marketingCampaignSpend: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    settings: {
      findUnique: jest.fn().mockResolvedValue({ timeZone: 'Asia/Tehran' }),
    },
  },
}));

jest.mock('../../../../src/modules/analytics/analytics.repo', () => ({
  AnalyticsRepo: {
    getMarketingAttributionData: jest.fn(),
  },
}));

describe('Marketing Spend & CAC/ROAS Campaign Attribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create marketing spend with valid input', async () => {
    (prisma.marketingCampaignSpend.create as jest.Mock).mockResolvedValue({
      id: 'spend-1',
      campaignName: 'Summer Launch',
      source: 'google',
      amount: 10000000,
    });

    const spend = await MarketingSpendService.createMarketingSpend({
      gamingCenterId: 'center-1',
      campaignName: 'Summer Launch',
      source: 'google',
      amount: 10000000,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-31'),
    });

    expect(spend.id).toBe('spend-1');
    expect(prisma.marketingCampaignSpend.create).toHaveBeenCalledTimes(1);
  });

  it('should calculate CAC and ROAS for attributed campaign and handle unattributed customers', async () => {
    (AnalyticsRepo.getMarketingAttributionData as jest.Mock).mockResolvedValue({
      spends: [
        {
          id: 'spend-1',
          campaignId: 'camp-google',
          campaignName: 'Google Ads Jan',
          source: 'google',
          amount: 5000000, // 5M IRR
        },
      ],
      campaigns: [
        { id: 'camp-google', name: 'Google Ads Jan', code: 'GOOG10' },
      ],
      reservations: [
        {
          id: 'res-1',
          customerAccountId: 'cust-new-1',
          totalPrice: 10000000,
          discountAmount: 1000000,
          platformFundedDiscount: 1000000,
          campaignId: 'camp-google',
          voucherCode: 'GOOG10',
          utmSource: 'google',
          utmMedium: 'cpc',
          utmCampaign: 'camp-google',
        },
        {
          id: 'res-2',
          customerAccountId: 'cust-unattributed',
          totalPrice: 3000000,
          discountAmount: 0,
          platformFundedDiscount: 0,
          campaignId: null,
          voucherCode: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
        },
      ],
      newCustomers: [
        { customerAccountId: 'cust-new-1', createdAt: new Date() },
        { customerAccountId: 'cust-unattributed', createdAt: new Date() },
      ],
    });

    const report = await AnalyticsStation.getMarketingAttributionAnalytics(
      'center-1',
      new Date('2025-01-01'),
      new Date('2025-01-31')
    );

    expect(report.summary.totalMarketingSpend).toBe(5000000);
    expect(report.summary.totalAttributedNewCustomers).toBe(1);
    expect(report.summary.unattributedNewCustomersCount).toBe(1);
    expect(report.summary.overallCAC).toBe(5000000); // 5M spend / 1 new customer
    expect(report.summary.overallROAS).toBe(2); // 10M revenue / 5M spend

    const campaign = report.campaignBreakdown.find((c) => c.campaignKey === 'camp-google');
    expect(campaign?.cac).toBe(5000000);
    expect(campaign?.roas).toBe(2);
  });
});
