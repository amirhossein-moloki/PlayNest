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

      const res = await AnalyticsStation.getCustomerSummary(gamingCenterId, startDate, endDate);

      expect(res.activeCustomers).toBe(2);
      expect(res.newCustomers).toBe(1); // Bob
      expect(res.returningCustomers).toBe(1); // Alice
      expect(res.repeatCustomers).toBe(1); // Alice (2 visits in period)
      expect(res.repeatVisitRate).toBe(50); // 1 / 2 * 100
      expect(res.totalRecordedSpend).toBe(450000);
      expect(res.avgSpendPerActiveCustomer).toBe(225000);
      expect(res.avgSpendPerVisit).toBe(150000);
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
});
