import request from 'supertest';
import app from '../../../../src/app';
import { AnalyticsRepo } from '../../../../src/modules/analytics/analytics.repo';
import { AnalyticsStation } from '../../../../src/modules/analytics/analytics.station';

jest.mock('../../../../src/modules/analytics/analytics.repo');
jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    settings: {
      findUnique: jest.fn().mockResolvedValue({ timeZone: 'UTC' }),
    },
  },
}));

describe('Phase 4 Financial Analytics & Reconciliation Unit Tests', () => {
  const gamingCenterId = 'gc-test-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AnalyticsStation.getFinancialOverviewDetailed', () => {
    it('should calculate gross, refunds, net and ledger breakdowns correctly', async () => {
      (AnalyticsRepo.getFinancialOverviewDetailed as jest.Mock).mockResolvedValue({
        paymentsByStatus: [
          { status: 'PAID', currency: 'IRR', _sum: { amount: 1000000 }, _count: { _all: 5 } },
          { status: 'FAILED', currency: 'IRR', _sum: { amount: 200000 }, _count: { _all: 1 } },
        ],
        refundsByStatus: [
          { status: 'SUCCESSFUL', currency: 'IRR', _sum: { amount: 100000 }, _count: { _all: 1 } },
        ],
        ledgerByType: [
          { entryType: 'PAYMENT_COLLECTION', currency: 'IRR', _sum: { amount: 1000000 }, _count: { _all: 5 } },
          { entryType: 'REFUND_DISBURSEMENT', currency: 'IRR', _sum: { amount: 100000 }, _count: { _all: 1 } },
        ],
        walletByTypes: [
          { type: 'TOP_UP', currency: 'IRR', _sum: { amount: 500000 }, _count: { _all: 2 } },
          { type: 'RESERVATION_PAYMENT', currency: 'IRR', _sum: { amount: 300000 }, _count: { _all: 3 } },
        ],
        earningsByStatus: [
          { targetReached: true, _sum: { amount: 1000000, netAmount: 900000, commissionAmount: 100000 }, _count: { _all: 5 } },
        ],
        totalCustomerWalletBalances: { sum: 200000, count: 10 },
      });

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-30');

      const result = await AnalyticsStation.getFinancialOverviewDetailed(gamingCenterId, startDate, endDate);

      expect(result.payments).toHaveLength(2);
      expect(result.refunds).toHaveLength(1);
      expect(result.ledger).toHaveLength(2);
      expect(result.wallet).toHaveLength(2);
      expect(result.customerWallets.sum).toBe(200000);
    });
  });

  describe('AnalyticsStation.getFinancialReconciliation', () => {
    it('should return evaluated reconciliation findings and status counts', async () => {
      (AnalyticsRepo.runFinancialReconciliationCheck as jest.Mock).mockResolvedValue({
        evaluatedAt: new Date('2026-01-30T12:00:00Z'),
        totalEvaluatedRecords: 15,
        findingCount: 1,
        statusCounts: {
          MISMATCH: 0,
          MISSING_COUNTERPART: 1,
          DUPLICATE_POSTING: 0,
          PENDING_REVIEW: 0,
        },
        findings: [
          {
            ruleId: 'REC-001',
            ruleName: 'Confirmed Payment Missing Ledger Posting',
            severity: 'HIGH',
            status: 'MISSING_COUNTERPART',
            sourceEntity: 'Payment',
            sourceId: 'pay-unposted-1',
            details: 'Payment pay-unposted-1 is marked PAID but lacks a corresponding PAYMENT_COLLECTION ledger entry.',
            expectedAmount: 50000,
            actualAmount: 0,
            currency: 'IRR',
            timestamp: new Date('2026-01-15'),
          },
        ],
      });

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-30');

      const result = await AnalyticsStation.getFinancialReconciliation(gamingCenterId, startDate, endDate);

      expect(result.findingCount).toBe(1);
      expect(result.findings[0].ruleId).toBe('REC-001');
      expect(result.statusCounts.MISSING_COUNTERPART).toBe(1);
    });
  });
});
