import { AnalyticsIngestionService, analyticsIngestionService, ANALYTICS_ENTITIES } from '../../../../src/modules/analytics/analyticsIngestionService';
import { AnalyticsStation } from '../../../../src/modules/analytics/analytics.station';
import { AnalyticsRepo } from '../../../../src/modules/analytics/analytics.repo';
import { prisma } from '../../../../src/config/prisma';

describe('Phase 5 — Hardening, Security & Ingestion Unit Tests', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(prisma.settings, 'findUnique').mockResolvedValue({ timeZone: 'Asia/Tehran' } as any);
  });
  describe('AnalyticsIngestionService Ingestion Pipeline Invariants', () => {
    it('should expose ANALYTICS_ENTITIES in proper dependency order', () => {
      expect(ANALYTICS_ENTITIES).toEqual([
        'Tenant',
        'Customer',
        'Station',
        'Reservation',
        'GamingSession',
        'Payment',
        'LedgerEntry',
        'Refund',
      ]);
    });

    it('should correctly calculate default lookback window and batch size', () => {
      const service = new AnalyticsIngestionService();
      expect(service['defaultLookbackMinutes']).toBe(120);
      expect(service['defaultBatchSize']).toBe(500);
    });
  });

  describe('Security & Sensitive Data Protection Invariants', () => {
    it('should mask phone numbers correctly in top spenders reports', async () => {
      jest.spyOn(AnalyticsRepo, 'getCompletedCustomerReservations').mockResolvedValue([
        {
          id: 'res_1',
          customerAccountId: 'cust_1',
          startTime: new Date('2026-03-01T10:00:00Z'),
          endTime: new Date('2026-03-01T12:00:00Z'),
          totalPrice: 100000,
          customerAccount: {
            phone: '09123456789',
            fullName: 'Test Customer',
          },
        },
      ] as any);

      const startDate = new Date('2026-03-01T00:00:00Z');
      const endDate = new Date('2026-03-31T23:59:59Z');

      const result = await AnalyticsStation.getTopSpenders('gc_test', startDate, endDate, 10);

      expect(result.topSpenders).toHaveLength(1);
      expect(result.topSpenders[0].phone).toBe('0912***6789');
      expect(result.topSpenders[0].fullName).toBe('Test Customer');
    });

    it('should handle missing or short phone numbers defensively without exposing PII', async () => {
      jest.spyOn(AnalyticsRepo, 'getCompletedCustomerReservations').mockResolvedValue([
        {
          id: 'res_2',
          customerAccountId: 'cust_2',
          startTime: new Date('2026-03-01T10:00:00Z'),
          endTime: new Date('2026-03-01T12:00:00Z'),
          totalPrice: 50000,
          customerAccount: {
            phone: '1234',
            fullName: 'Short Phone User',
          },
        },
      ] as any);

      const startDate = new Date('2026-03-01T00:00:00Z');
      const endDate = new Date('2026-03-31T23:59:59Z');

      const result = await AnalyticsStation.getTopSpenders('gc_test', startDate, endDate, 10);

      expect(result.topSpenders[0].phone).toBe('***');
    });
  });

  describe('Financial Non-Mutation & Integer Precision Invariants', () => {
    it('should execute financial reconciliation audit check without mutating operational tables', async () => {
      jest.spyOn(AnalyticsRepo, 'runFinancialReconciliationCheck').mockResolvedValue({
        evaluatedAt: new Date(),
        totalEvaluatedRecords: 10,
        findingCount: 0,
        statusCounts: {
          MISMATCH: 0,
          MISSING_COUNTERPART: 0,
          DUPLICATE_POSTING: 0,
          PENDING_REVIEW: 0,
        },
        findings: [],
      });

      const startDate = new Date('2026-03-01T00:00:00Z');
      const endDate = new Date('2026-03-31T23:59:59Z');

      const reconciliation = await AnalyticsStation.getFinancialReconciliation('gc_test', startDate, endDate, 'ALL');

      expect(reconciliation.findingCount).toBe(0);
      expect(reconciliation.findings).toEqual([]);
    });
  });
});
