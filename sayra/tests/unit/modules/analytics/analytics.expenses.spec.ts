import { ExpenseService } from '../../../../src/modules/analytics/expense.service';
import { AnalyticsStation } from '../../../../src/modules/analytics/analytics.station';
import { AnalyticsRepo } from '../../../../src/modules/analytics/analytics.repo';
import { prisma } from '../../../../src/config/prisma';
import { ExpenseCategory } from '@prisma/client';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    gamingCenterExpense: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    settings: {
      findUnique: jest.fn().mockResolvedValue({ timeZone: 'Asia/Tehran' }),
    },
  },
}));

jest.mock('../../../../src/modules/analytics/analytics.repo', () => ({
  AnalyticsRepo: {
    getLiveFinancialStats: jest.fn(),
    getApprovedExpenses: jest.fn(),
    getDiscountFundingBreakdown: jest.fn(),
  },
}));

describe('ExpenseService & Net Profit Calculation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ExpenseService', () => {
    it('should create an approved expense record and write audit log', async () => {
      const mockExpense = {
        id: 'exp-1',
        gamingCenterId: 'center-1',
        category: 'RENT',
        amount: 5000000,
        currency: 'IRR',
        expenseDate: new Date('2025-01-01'),
        status: 'APPROVED',
      };

      (prisma.gamingCenterExpense.create as jest.Mock).mockResolvedValue(mockExpense);

      const result = await ExpenseService.createExpense({
        gamingCenterId: 'center-1',
        category: ExpenseCategory.RENT,
        amount: 5000000,
        expenseDate: new Date('2025-01-01'),
        createdById: 'user-1',
      });

      expect(result.id).toBe('exp-1');
      expect(prisma.gamingCenterExpense.create).toHaveBeenCalledTimes(1);
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it('should reject expense creation with non-positive amount', async () => {
      await expect(
        ExpenseService.createExpense({
          gamingCenterId: 'center-1',
          category: ExpenseCategory.RENT,
          amount: 0,
          expenseDate: new Date('2025-01-01'),
        })
      ).rejects.toThrow('Expense amount must be greater than zero.');
    });

    it('should void an expense and record audit log', async () => {
      (prisma.gamingCenterExpense.findFirst as jest.Mock).mockResolvedValue({
        id: 'exp-1',
        gamingCenterId: 'center-1',
        status: 'APPROVED',
      });
      (prisma.gamingCenterExpense.update as jest.Mock).mockResolvedValue({
        id: 'exp-1',
        status: 'VOID',
      });

      const result = await ExpenseService.voidExpense('center-1', 'exp-1', 'user-1');

      expect(result.status).toBe('VOID');
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Net Profit Calculation in AnalyticsStation', () => {
    it('should calculate net profit when approved expenses exist', async () => {
      (AnalyticsRepo.getLiveFinancialStats as jest.Mock).mockResolvedValue({
        paidPayments: [{ currency: 'IRR', _sum: { amount: 10000000 } }],
        refunds: [{ currency: 'IRR', _sum: { amount: 1000000 } }],
        paymentsByStatus: [],
        paymentsByMethod: [],
        paymentsByProvider: [],
        ledgerEntries: [],
      });

      (AnalyticsRepo.getApprovedExpenses as jest.Mock).mockResolvedValue({
        byCategory: [{ category: 'RENT', _sum: { amount: 3000000 } }],
        totalAmount: 3000000,
        count: 1,
      });

      (AnalyticsRepo.getDiscountFundingBreakdown as jest.Mock).mockResolvedValue({
        grossOriginalAmount: 11000000,
        totalDiscount: 1000000,
        platformFunded: 1000000,
        merchantFunded: 0,
      });

      const report = await AnalyticsStation.getFinancialReport(
        'center-1',
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(report.summary.grossCollected).toBe(10000000);
      expect(report.summary.totalRefunded).toBe(1000000);
      expect(report.summary.merchantRecognizedRevenue).toBe(9000000);

      expect(report.profitability.status).toBe('CALCULATED');
      expect(report.profitability.cost).toBe(3000000);
      expect(report.profitability.netProfit).toBe(6000000); // 9M - 3M
      expect(report.profitability.profitMargin).toBe(66.67);
    });

    it('should return NOT_CALCULABLE when no expense data exists for period', async () => {
      (AnalyticsRepo.getLiveFinancialStats as jest.Mock).mockResolvedValue({
        paidPayments: [{ currency: 'IRR', _sum: { amount: 5000000 } }],
        refunds: [],
        paymentsByStatus: [],
        paymentsByMethod: [],
        paymentsByProvider: [],
        ledgerEntries: [],
      });

      (AnalyticsRepo.getApprovedExpenses as jest.Mock).mockResolvedValue({
        byCategory: [],
        totalAmount: 0,
        count: 0,
      });

      (AnalyticsRepo.getDiscountFundingBreakdown as jest.Mock).mockResolvedValue({
        grossOriginalAmount: 5000000,
        totalDiscount: 0,
        platformFunded: 0,
        merchantFunded: 0,
      });

      const report = await AnalyticsStation.getFinancialReport(
        'center-1',
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(report.profitability.status).toBe('NOT_CALCULABLE');
      expect(report.profitability.netProfit).toBeNull();
    });
  });
});
