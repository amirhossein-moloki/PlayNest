import { AnalyticsStation } from '../../../../src/modules/analytics/analytics.station';
import { AnalyticsRepo } from '../../../../src/modules/analytics/analytics.repo';
import { resolveTimezoneAndBoundaries } from '../../../../src/modules/analytics/analytics.validators';

jest.mock('../../../../src/modules/analytics/analytics.repo');
jest.mock('../../../../src/modules/analytics/analytics.validators');

describe('AnalyticsStation - Phase 3 Customer Analytics', () => {
  const gamingCenterId = 'gc_test_123';
  const startDate = new Date('2026-03-01T00:00:00Z');
  const endDate = new Date('2026-03-31T23:59:59Z');

  beforeEach(() => {
    jest.clearAllMocks();
    (resolveTimezoneAndBoundaries as jest.Mock).mockResolvedValue({
      timeZone: 'UTC',
      dayStart: startDate,
      dayEnd: endDate,
    });
  });

  describe('getCustomerSummary', () => {
    it('should calculate active customers, repeat visit rate, and spend metrics correctly', async () => {
      const mockPeriodReservations = [
        {
          id: 'res_1',
          customerAccountId: 'cust_1',
          startTime: new Date('2026-03-05T10:00:00Z'),
          endTime: new Date('2026-03-05T12:00:00Z'),
          totalPrice: 100000,
          customerAccount: { phone: '09121111111', fullName: 'Alice' },
        },
        {
          id: 'res_2',
          customerAccountId: 'cust_1',
          startTime: new Date('2026-03-10T10:00:00Z'),
          endTime: new Date('2026-03-10T12:00:00Z'),
          totalPrice: 150000,
          customerAccount: { phone: '09121111111', fullName: 'Alice' },
        },
        {
          id: 'res_3',
          customerAccountId: 'cust_2',
          startTime: new Date('2026-03-15T10:00:00Z'),
          endTime: new Date('2026-03-15T12:00:00Z'),
          totalPrice: 200000,
          customerAccount: { phone: '09122222222', fullName: 'Bob' },
        },
        {
          id: 'res_unlinked',
          customerAccountId: null,
          startTime: new Date('2026-03-16T10:00:00Z'),
          endTime: new Date('2026-03-16T12:00:00Z'),
          totalPrice: 50000,
          customerAccount: null,
        },
      ];

      const mockHistoricalFirstVisits = [
        { customerAccountId: 'cust_1', _min: { startTime: new Date('2026-01-01T10:00:00Z') } },
        { customerAccountId: 'cust_2', _min: { startTime: new Date('2026-03-15T10:00:00Z') } },
        { customerAccountId: null, _min: { startTime: new Date('2026-03-16T10:00:00Z') } },
      ];

      const mockHistoricalVisits = [
        { customerAccountId: 'cust_1', startTime: new Date('2026-01-01T10:00:00Z') },
        { customerAccountId: 'cust_1', startTime: new Date('2026-03-05T10:00:00Z') },
        { customerAccountId: 'cust_1', startTime: new Date('2026-03-10T10:00:00Z') },
        { customerAccountId: 'cust_2', startTime: new Date('2026-03-15T10:00:00Z') },
        { customerAccountId: null, startTime: new Date('2026-03-16T10:00:00Z') },
      ];

      (AnalyticsRepo.getCompletedCustomerReservations as jest.Mock).mockResolvedValue(mockPeriodReservations);
      (AnalyticsRepo.getCustomerAllHistoricalFirstVisits as jest.Mock).mockResolvedValue(mockHistoricalFirstVisits);
      (AnalyticsRepo.getCustomerAllHistoricalVisits as jest.Mock).mockResolvedValue(mockHistoricalVisits);
      (AnalyticsRepo.getRegisteredAccountsStats as jest.Mock).mockResolvedValue({ registeredInPeriod: 10, totalRegistered: 100 });
      (AnalyticsRepo.getReservingCustomersCount as jest.Mock).mockResolvedValue(5);
      (AnalyticsRepo.getPayingCustomersCount as jest.Mock).mockResolvedValue(4);

      const res = await AnalyticsStation.getCustomerSummary(gamingCenterId, startDate, endDate);

      expect(res.activeCustomers).toBe(2);
      expect(res.newCustomers).toBe(1); // Bob
      expect(res.returningCustomers).toBe(1); // Alice
      expect(res.repeatCustomers).toBe(1); // Alice (2 visits in period)
      expect(res.repeatVisitRate).toBe(50); // 1 / 2 * 100
      expect(res.totalRecordedSpend).toBe(450000);
      expect(res.avgSpendPerActiveCustomer).toBe(225000);
      expect(res.avgSpendPerVisit).toBe(150000);

      // Verify Entity Taxonomy Breakdown
      expect(res.entityTaxonomyBreakdown.registeredAccountsInPeriod).toBe(10);
      expect(res.entityTaxonomyBreakdown.totalRegisteredAccounts).toBe(100);
      expect(res.entityTaxonomyBreakdown.reservingCustomersCount).toBe(5);
      expect(res.entityTaxonomyBreakdown.payingCustomersCount).toBe(4);
      expect(res.entityTaxonomyBreakdown.completedSessionCustomersCount).toBe(2);
    });

    it('should handle zero active customers safely without division errors', async () => {
      (AnalyticsRepo.getCompletedCustomerReservations as jest.Mock).mockResolvedValue([]);
      (AnalyticsRepo.getCustomerAllHistoricalFirstVisits as jest.Mock).mockResolvedValue([]);
      (AnalyticsRepo.getCustomerAllHistoricalVisits as jest.Mock).mockResolvedValue([]);
      (AnalyticsRepo.getRegisteredAccountsStats as jest.Mock).mockResolvedValue({ registeredInPeriod: 0, totalRegistered: 10 });
      (AnalyticsRepo.getReservingCustomersCount as jest.Mock).mockResolvedValue(0);
      (AnalyticsRepo.getPayingCustomersCount as jest.Mock).mockResolvedValue(0);

      const res = await AnalyticsStation.getCustomerSummary(gamingCenterId, startDate, endDate);

      expect(res.activeCustomers).toBe(0);
      expect(res.newCustomers).toBe(0);
      expect(res.returningCustomers).toBe(0);
      expect(res.repeatCustomers).toBe(0);
      expect(res.repeatVisitRate).toBe(0);
      expect(res.totalRecordedSpend).toBe(0);
      expect(res.avgSpendPerActiveCustomer).toBe(0);
      expect(res.avgSpendPerVisit).toBe(0);
    });
  });

  describe('getTopSpenders', () => {
    it('should return sorted spenders with masked phone numbers and safely handle unlinked walk-ins', async () => {
      const mockPeriodReservations = [
        {
          id: 'res_1',
          customerAccountId: 'cust_1',
          startTime: new Date('2026-03-05T10:00:00Z'),
          endTime: new Date('2026-03-05T12:00:00Z'),
          totalPrice: 100000,
          customerAccount: { phone: '09121111111', fullName: 'Alice' },
        },
        {
          id: 'res_2',
          customerAccountId: 'cust_2',
          startTime: new Date('2026-03-15T10:00:00Z'),
          endTime: new Date('2026-03-15T12:00:00Z'),
          totalPrice: 300000,
          customerAccount: { phone: '09122222222', fullName: 'Bob' },
        },
        {
          id: 'res_walkin',
          customerAccountId: null,
          startTime: new Date('2026-03-20T10:00:00Z'),
          endTime: new Date('2026-03-20T12:00:00Z'),
          totalPrice: 500000,
          customerAccount: null,
        },
      ];

      (AnalyticsRepo.getCompletedCustomerReservations as jest.Mock).mockResolvedValue(mockPeriodReservations);

      const res = await AnalyticsStation.getTopSpenders(gamingCenterId, startDate, endDate, 10);

      expect(res.topSpenders).toHaveLength(2);
      expect(res.topSpenders[0].customerAccountId).toBe('cust_2'); // Bob higher spend
      expect(res.topSpenders[0].phone).toBe('0912***2222'); // Masked
      expect(res.topSpenders[1].phone).toBe('0912***1111'); // Masked
    });
  });

  describe('getCustomerSegmentation', () => {
    it('should classify customer segments deterministically', async () => {
      const mockPeriodReservations = [
        {
          id: 'res_1',
          customerAccountId: 'cust_new',
          startTime: new Date('2026-03-05T10:00:00Z'),
          endTime: new Date('2026-03-05T12:00:00Z'),
          totalPrice: 50000,
          customerAccount: { phone: '09123333333', fullName: 'Charlie' },
        },
      ];

      const mockHistoricalFirstVisits = [
        { customerAccountId: 'cust_new', _min: { startTime: new Date('2026-03-05T10:00:00Z') } },
      ];

      const mockHistoricalVisits = [
        { customerAccountId: 'cust_new', startTime: new Date('2026-03-05T10:00:00Z') },
        // cust_at_risk had visits 40 days ago, none in current period
        { customerAccountId: 'cust_at_risk', startTime: new Date('2026-02-01T10:00:00Z') },
        { customerAccountId: 'cust_at_risk', startTime: new Date('2026-02-05T10:00:00Z') },
        { customerAccountId: 'cust_at_risk', startTime: new Date('2026-02-10T10:00:00Z') },
      ];

      (AnalyticsRepo.getCompletedCustomerReservations as jest.Mock).mockResolvedValue(mockPeriodReservations);
      (AnalyticsRepo.getCustomerAllHistoricalFirstVisits as jest.Mock).mockResolvedValue(mockHistoricalFirstVisits);
      (AnalyticsRepo.getCustomerAllHistoricalVisits as jest.Mock).mockResolvedValue(mockHistoricalVisits);

      const res = await AnalyticsStation.getCustomerSegmentation(gamingCenterId, startDate, endDate);

      expect(res.totalActiveInPeriod).toBe(1);
      const newSeg = res.segments.find((s) => s.key === 'NEW');
      const atRiskSeg = res.segments.find((s) => s.key === 'AT_RISK');

      expect(newSeg?.count).toBe(1);
      expect(atRiskSeg?.count).toBe(1);
    });
  });

  describe('getConversionFunnel', () => {
    it('should compute operational state transitions, stage conversion rates, and handle missing web tracking notice', async () => {
      const createdAt = new Date('2026-03-01T10:00:00Z');
      const paidAt = new Date('2026-03-01T10:05:00Z');
      const sessionStart = new Date('2026-03-01T10:15:00Z');

      const mockFunnelReservations = [
        {
          id: 'res_1',
          createdAt,
          status: 'COMPLETED',
          paymentState: 'PAID',
          completedAt: new Date('2026-03-01T12:00:00Z'),
          payments: [{ id: 'p_1', paidAt, amount: 100000 }],
          gamingSessions: [{ id: 'gs_1', startTime: sessionStart, actualHours: 2 }],
        },
        {
          id: 'res_2',
          createdAt,
          status: 'CANCELED',
          paymentState: 'UNPAID',
          completedAt: null,
          payments: [],
          gamingSessions: [],
        },
      ];

      (AnalyticsRepo.getFunnelReservations as jest.Mock).mockResolvedValue(mockFunnelReservations);

      const res = await AnalyticsStation.getConversionFunnel(gamingCenterId, startDate, endDate);

      expect(res.webTrafficFunnelStatus).toBe('DATA_COLLECTION_MISSING');
      expect(res.funnel).toHaveLength(4);

      const stage1 = res.funnel.find((f) => f.stageKey === 'RESERVATION_CREATED');
      const stage2 = res.funnel.find((f) => f.stageKey === 'PAYMENT_SUCCEEDED');
      const stage3 = res.funnel.find((f) => f.stageKey === 'SESSION_STARTED');
      const stage4 = res.funnel.find((f) => f.stageKey === 'RESERVATION_COMPLETED');

      expect(stage1?.count).toBe(2);
      expect(stage2?.count).toBe(1);
      expect(stage3?.count).toBe(1);
      expect(stage4?.count).toBe(1);

      expect(stage2?.conversionFromInitial).toBe(50);
      expect(stage2?.droppedCount).toBe(1);

      expect(stage3?.conversionFromInitial).toBe(50);
      expect(stage3?.conversionFromPrevious).toBe(100);

      expect(stage4?.conversionFromInitial).toBe(50);
      expect(stage4?.conversionFromPrevious).toBe(100);

      expect(res.summary.totalReservationsCreated).toBe(2);
      expect(res.summary.totalReservationsCompleted).toBe(1);
      expect(res.summary.overallConversionRate).toBe(50);
    });

    it('should handle zero reservations safely without division by zero', async () => {
      (AnalyticsRepo.getFunnelReservations as jest.Mock).mockResolvedValue([]);

      const res = await AnalyticsStation.getConversionFunnel(gamingCenterId, startDate, endDate);

      expect(res.summary.totalReservationsCreated).toBe(0);
      expect(res.summary.overallConversionRate).toBe(0);
      expect(res.funnel[0].count).toBe(0);
    });

    it('should safely process out-of-order timestamps and late arriving events', async () => {
      const createdAt = new Date('2026-03-01T10:00:00Z');
      // paidAt before createdAt due to clock drift (should be ignored for lead time calculation)
      const paidAt = new Date('2026-03-01T09:59:00Z');

      const mockFunnelReservations = [
        {
          id: 'res_late',
          createdAt,
          status: 'COMPLETED',
          paymentState: 'PAID',
          completedAt: new Date('2026-03-01T11:00:00Z'),
          payments: [{ id: 'p_late', paidAt, amount: 50000 }],
          gamingSessions: [{ id: 'gs_late', startTime: new Date('2026-03-01T10:10:00Z'), actualHours: 1 }],
        },
      ];

      (AnalyticsRepo.getFunnelReservations as jest.Mock).mockResolvedValue(mockFunnelReservations);

      const res = await AnalyticsStation.getConversionFunnel(gamingCenterId, startDate, endDate);

      expect(res.funnel[0].count).toBe(1);
      expect(res.summary.overallConversionRate).toBe(100);
    });
  });

  describe('getDiscountAnalytics', () => {
    it('should calculate discount usage, completion rates, and include causality disclaimer', async () => {
      const mockDiscountReservations = [
        {
          id: 'res_disc_1',
          totalPrice: 80000,
          discountAmount: 20000,
          voucherCode: 'NOWRUZ2026',
          discountId: 'disc_1',
          status: 'COMPLETED',
          paymentState: 'PAID',
        },
        {
          id: 'res_nodisc_1',
          totalPrice: 100000,
          discountAmount: 0,
          voucherCode: null,
          discountId: null,
          status: 'COMPLETED',
          paymentState: 'PAID',
        },
      ];

      (AnalyticsRepo.getDiscountPerformanceReservations as jest.Mock).mockResolvedValue(mockDiscountReservations);

      const res = await AnalyticsStation.getDiscountAnalytics(gamingCenterId, startDate, endDate);

      expect(res.summary.totalReservations).toBe(2);
      expect(res.summary.discountedReservationsCount).toBe(1);
      expect(res.summary.nonDiscountedReservationsCount).toBe(1);
      expect(res.summary.discountPenetrationRate).toBe(50);
      expect(res.summary.totalDiscountAmountGiven).toBe(20000);
      expect(res.summary.avgDiscountAmount).toBe(20000);

      expect(res.performanceComparison.discounted.completedCount).toBe(1);
      expect(res.performanceComparison.nonDiscounted.completedCount).toBe(1);

      expect(res.voucherCodeBreakdown).toHaveLength(1);
      expect(res.voucherCodeBreakdown[0].voucherCode).toBe('NOWRUZ2026');

      expect(res.causalityDisclaimer).toContain('do NOT prove campaign incrementality');
    });

    it('should handle zero discount reservations safely', async () => {
      (AnalyticsRepo.getDiscountPerformanceReservations as jest.Mock).mockResolvedValue([]);

      const res = await AnalyticsStation.getDiscountAnalytics(gamingCenterId, startDate, endDate);

      expect(res.summary.totalReservations).toBe(0);
      expect(res.summary.discountedReservationsCount).toBe(0);
      expect(res.summary.discountPenetrationRate).toBe(0);
      expect(res.summary.totalDiscountAmountGiven).toBe(0);
    });
  });

  describe('getInstrumentationGaps', () => {
    it('should return catalog of missing web events and architectural open decisions', async () => {
      const res = await AnalyticsStation.getInstrumentationGaps();

      expect(res.statusOverview.webTrafficTracking).toBe('DATA_COLLECTION_MISSING');
      expect(res.gapDetails.length).toBeGreaterThanOrEqual(3);
      expect(res.requiredEventCatalog.map((e) => e.eventName)).toContain('page_view');
      expect(res.requiredEventCatalog.map((e) => e.eventName)).toContain('booking_completed');
      expect(res.openDecisionsRequired.length).toBeGreaterThanOrEqual(2);
    });
  });
});
