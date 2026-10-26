import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CommissionType, DiscountCampaign, DiscountFundingSource, DiscountTargetType, DiscountValueType } from '@prisma/client';
import {
  calculateCampaignDiscountAmount,
  validateCampaignForReservation,
} from '../../../../src/modules/discounts/discounts.station';
import { calculateReservationFinancials } from '../../../../src/modules/reservation/reservation.station';
import { DiscountsRepo } from '../../../../src/modules/discounts/discounts.repo';
import { CommissionsRepo } from '../../../../src/modules/commissions/commissions.repo';

jest.mock('../../../../src/modules/discounts/discounts.repo');
jest.mock('../../../../src/modules/commissions/commissions.repo');

const MockedDiscountsRepo = DiscountsRepo as jest.Mocked<typeof DiscountsRepo>;
const MockedCommissionsRepo = CommissionsRepo as jest.Mocked<typeof CommissionsRepo>;

describe('Campaign Discount Engine & Merchant Revenue Protection Tests', () => {
  const gamingCenterId = 'gc-100';
  const stationId = 'st-200';
  const customerAccountId = 'cust-300';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateCampaignDiscountAmount', () => {
    it('should calculate standard percentage discount', () => {
      const discount = calculateCampaignDiscountAmount(1000000, DiscountValueType.PERCENTAGE, 20);
      expect(discount).toBe(200000);
    });

    it('should cap percentage discount at maxDiscountAmount', () => {
      const discount = calculateCampaignDiscountAmount(1000000, DiscountValueType.PERCENTAGE, 30, 150000);
      expect(discount).toBe(150000); // 30% of 1M = 300k, capped at 150k
    });

    it('should calculate fixed amount discount correctly', () => {
      const discount = calculateCampaignDiscountAmount(1000000, DiscountValueType.FIXED_AMOUNT, 250000);
      expect(discount).toBe(250000);
    });

    it('should cap discount at basePrice if discount exceeds base price', () => {
      const discount = calculateCampaignDiscountAmount(100000, DiscountValueType.FIXED_AMOUNT, 150000);
      expect(discount).toBe(100000);
    });
  });

  describe('Campaign Validation Logic', () => {
    const activeCampaign: DiscountCampaign = {
      id: 'camp-1',
      gamingCenterId,
      name: 'Summer Sale',
      code: 'SUMMER20',
      codeType: 'PROMO_CODE',
      description: '20% off',
      targetType: DiscountTargetType.GAMING_CENTER,
      targetId: gamingCenterId,
      valueType: DiscountValueType.PERCENTAGE,
      value: 20,
      maxDiscountAmount: 300000,
      minReservationAmount: 500000,
      fundingSource: DiscountFundingSource.PLATFORM,
      totalBudget: 1000000,
      usedBudget: 200000,
      maxUsageCount: 100,
      currentUsageCount: 5,
      maxUsagePerUser: 2,
      startAt: new Date(Date.now() - 3600000),
      endAt: new Date(Date.now() + 86400000),
      isActive: true,
      createdByUserId: 'admin-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should validate an eligible campaign successfully', async () => {
      MockedDiscountsRepo.countUserCampaignUsages.mockResolvedValue(0);

      const result = await validateCampaignForReservation(
        activeCampaign,
        stationId,
        1000000,
        customerAccountId
      );

      expect(result.isValid).toBe(true);
      expect(result.discountAmount).toBe(200000);
    });

    it('should reject inactive campaign', async () => {
      const inactive = { ...activeCampaign, isActive: false };
      const result = await validateCampaignForReservation(inactive, stationId, 1000000, customerAccountId);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('inactive');
    });

    it('should reject expired campaign', async () => {
      const expired = { ...activeCampaign, endAt: new Date(Date.now() - 1000) };
      const result = await validateCampaignForReservation(expired, stationId, 1000000, customerAccountId);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('expired');
    });

    it('should reject when base price is below minReservationAmount', async () => {
      const result = await validateCampaignForReservation(
        activeCampaign,
        stationId,
        400000, // min is 500,000
        customerAccountId
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Reservation amount must be at least');
    });

    it('should reject when total campaign budget is exhausted', async () => {
      const exhausted = { ...activeCampaign, totalBudget: 200000, usedBudget: 200000 };
      const result = await validateCampaignForReservation(exhausted, stationId, 1000000, customerAccountId);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('budget is insufficient');
    });

    it('should reject when user usage limit is reached', async () => {
      MockedDiscountsRepo.countUserCampaignUsages.mockResolvedValue(2); // max is 2

      const result = await validateCampaignForReservation(activeCampaign, stationId, 1000000, customerAccountId);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('User usage limit reached');
    });
  });

  describe('CORE FINANCIAL INVARIANT & MERCHANT REVENUE PROTECTION', () => {
    it('PLATFORM FUNDED DISCOUNT: Merchant payout MUST equal originalAmount minus platform commission (100% revenue protection)', async () => {
      const basePrice = 1000000; // 1,000,000 IRR
      const voucherCode = 'PLATFORM20';

      const campaign: DiscountCampaign = {
        id: 'camp-plat',
        gamingCenterId,
        name: 'Platform Subsidy Campaign',
        code: voucherCode,
        codeType: 'PROMO_CODE',
        description: '20% platform discount',
        targetType: DiscountTargetType.GAMING_CENTER,
        targetId: gamingCenterId,
        valueType: DiscountValueType.PERCENTAGE,
        value: 20, // 200,000 IRR discount
        maxDiscountAmount: null,
        minReservationAmount: null,
        fundingSource: DiscountFundingSource.PLATFORM,
        totalBudget: 10000000,
        usedBudget: 0,
        maxUsageCount: 1000,
        currentUsageCount: 0,
        maxUsagePerUser: 5,
        startAt: new Date(Date.now() - 3600000),
        endAt: new Date(Date.now() + 86400000),
        isActive: true,
        createdByUserId: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      MockedDiscountsRepo.findCampaignByCode.mockResolvedValue(campaign);
      MockedDiscountsRepo.findCampaignByCodeForUpdate.mockResolvedValue(campaign);
      MockedDiscountsRepo.countUserCampaignUsages.mockResolvedValue(0);

      // 10% platform commission policy
      MockedCommissionsRepo.findPolicyByGamingCenterId.mockResolvedValue({
        id: 'pol-1',
        gamingCenterId,
        type: CommissionType.PERCENT,
        percentBps: 1000, // 10%
        fixedAmount: null,
        currency: 'IRR',
        monthlyTarget: null,
        maxPercentBps: 10000,
        applyToOnlineOnly: true,
        minimumFeeAmount: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const financials = await calculateReservationFinancials(
        gamingCenterId,
        stationId,
        basePrice,
        new Date(),
        customerAccountId,
        voucherCode
      );

      // Financial breakdown assertions
      expect(financials.originalAmount).toBe(1000000);
      expect(financials.discountAmount).toBe(200000);
      expect(financials.customerPayableAmount).toBe(800000); // User pays 800k
      expect(financials.platformFundedDiscount).toBe(200000); // Platform pays 200k subsidy
      expect(financials.platformCommission).toBe(100000); // 10% of 1M original price = 100k

      // INVARIANT: Merchant Payout = Original Amount (1,000,000) - Platform Commission (100,000) = 900,000
      expect(financials.merchantPayoutAmount).toBe(900000);
      expect(financials.merchantPayoutAmount).toBe(financials.originalAmount - financials.platformCommission);
    });

    it('MERCHANT FUNDED DISCOUNT: Merchant payout reflects discount absorbed by merchant', async () => {
      const basePrice = 1000000;
      const voucherCode = 'MERCHANT10';

      const campaign: DiscountCampaign = {
        id: 'camp-merch',
        gamingCenterId,
        name: 'Merchant Local Discount',
        code: voucherCode,
        codeType: 'PROMO_CODE',
        description: '10% merchant funded',
        targetType: DiscountTargetType.GAMING_CENTER,
        targetId: gamingCenterId,
        valueType: DiscountValueType.PERCENTAGE,
        value: 10, // 100,000 IRR discount
        maxDiscountAmount: null,
        minReservationAmount: null,
        fundingSource: DiscountFundingSource.MERCHANT_FUNDED,
        totalBudget: null,
        usedBudget: 0,
        maxUsageCount: null,
        currentUsageCount: 0,
        maxUsagePerUser: 10,
        startAt: new Date(Date.now() - 3600000),
        endAt: new Date(Date.now() + 86400000),
        isActive: true,
        createdByUserId: 'merchant-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      MockedDiscountsRepo.findCampaignByCode.mockResolvedValue(campaign);
      MockedDiscountsRepo.findCampaignByCodeForUpdate.mockResolvedValue(campaign);
      MockedDiscountsRepo.countUserCampaignUsages.mockResolvedValue(0);

      MockedCommissionsRepo.findPolicyByGamingCenterId.mockResolvedValue({
        id: 'pol-1',
        gamingCenterId,
        type: CommissionType.PERCENT,
        percentBps: 1000, // 10% = 100k
        fixedAmount: null,
        currency: 'IRR',
        monthlyTarget: null,
        maxPercentBps: 10000,
        applyToOnlineOnly: true,
        minimumFeeAmount: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const financials = await calculateReservationFinancials(
        gamingCenterId,
        stationId,
        basePrice,
        new Date(),
        customerAccountId,
        voucherCode
      );

      expect(financials.originalAmount).toBe(1000000);
      expect(financials.discountAmount).toBe(100000);
      expect(financials.platformFundedDiscount).toBe(0); // Platform does NOT fund merchant discount
      expect(financials.customerPayableAmount).toBe(900000);

      // Merchant payout = (Original 1M - 100k merchant discount) - 100k commission = 800,000
      expect(financials.merchantPayoutAmount).toBe(800000);
    });
  });
});
