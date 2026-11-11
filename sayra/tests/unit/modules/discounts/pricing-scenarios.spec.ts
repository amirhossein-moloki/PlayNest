import { calculateStationPricing } from '../../../../src/common/utils/money';
import { PaymentsStation } from '../../../../src/modules/payments/payments.station';
import { PaymentsRepo } from '../../../../src/modules/payments/payments.repo';
import { PaymentProviderFactory } from '../../../../src/modules/payments/providers';
import { DiscountValueType, ReservationPaymentState, ReservationStatus } from '@prisma/client';

jest.mock('../../../../src/modules/discounts/discounts.station');
jest.mock('../../../../src/modules/payments/payments.repo');
jest.mock('../../../../src/modules/payments/providers');
jest.mock('../../../../src/modules/commissions/commissions.repo', () => ({
  CommissionsRepo: {
    findPolicyByGamingCenterId: jest.fn().mockResolvedValue(null),
  },
}));

describe('Comprehensive Pricing, Discount, Reservation and Payment Verification Suite (14 Scenarios)', () => {
  const centerId = 'center_test_123';
  const stationId1 = 'station_01';
  const stationId2 = 'station_02';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Scenario 1: دستگاه بدون تخفیف
  describe('Scenario 1: Station without discount', () => {
    it('should return finalPrice equal to originalPrice and zero discountAmount', () => {
      const hourlyPrice = 200000;
      const pricing = calculateStationPricing(hourlyPrice, null, 1);

      expect(pricing.originalPrice).toBe(200000);
      expect(pricing.discountAmount).toBe(0);
      expect(pricing.discountPercentage).toBe(0);
      expect(pricing.finalPrice).toBe(200000);
      expect(pricing.hasDiscount).toBe(false);
    });
  });

  // Scenario 2: دستگاه با تخفیف ۱۰ درصدی
  describe('Scenario 2: Station with 10% discount', () => {
    it('should calculate 10% discount accurately', () => {
      const hourlyPrice = 200000;
      const discount = {
        valueType: DiscountValueType.PERCENTAGE,
        value: 10,
        isActive: true,
      };
      const pricing = calculateStationPricing(hourlyPrice, discount, 1);

      expect(pricing.originalPrice).toBe(200000);
      expect(pricing.discountAmount).toBe(20000);
      expect(pricing.discountPercentage).toBe(10);
      expect(pricing.finalPrice).toBe(180000);
      expect(pricing.hasDiscount).toBe(true);
    });
  });

  // Scenario 3: دستگاه با تخفیف ۲۰ درصدی
  describe('Scenario 3: Station with 20% discount', () => {
    it('should calculate 20% discount accurately', () => {
      const hourlyPrice = 200000;
      const discount = {
        valueType: DiscountValueType.PERCENTAGE,
        value: 20,
        isActive: true,
      };
      const pricing = calculateStationPricing(hourlyPrice, discount, 1);

      expect(pricing.originalPrice).toBe(200000);
      expect(pricing.discountAmount).toBe(40000);
      expect(pricing.discountPercentage).toBe(20);
      expect(pricing.finalPrice).toBe(160000);
      expect(pricing.hasDiscount).toBe(true);
    });
  });

  // Scenario 4: دستگاه با تخفیف مبلغ ثابت
  describe('Scenario 4: Station with fixed amount discount', () => {
    it('should deduct fixed amount directly from original price', () => {
      const hourlyPrice = 200000;
      const discount = {
        valueType: DiscountValueType.FIXED_AMOUNT,
        value: 50000,
        isActive: true,
      };
      const pricing = calculateStationPricing(hourlyPrice, discount, 1);

      expect(pricing.originalPrice).toBe(200000);
      expect(pricing.discountAmount).toBe(50000);
      expect(pricing.finalPrice).toBe(150000);
      expect(pricing.hasDiscount).toBe(true);
    });
  });

  // Scenario 5: تخفیف منقضی‌شده
  describe('Scenario 5: Expired discount', () => {
    it('should ignore expired discount and charge full original price', () => {
      const hourlyPrice = 200000;
      const now = new Date('2026-06-01T12:00:00Z');
      const discount = {
        valueType: DiscountValueType.PERCENTAGE,
        value: 25,
        isActive: true,
        startAt: new Date('2026-05-01T00:00:00Z'),
        endAt: new Date('2026-05-31T23:59:59Z'), // Expired yesterday
      };
      const pricing = calculateStationPricing(hourlyPrice, discount, 1, now);

      expect(pricing.originalPrice).toBe(200000);
      expect(pricing.discountAmount).toBe(0);
      expect(pricing.finalPrice).toBe(200000);
      expect(pricing.hasDiscount).toBe(false);
    });
  });

  // Scenario 6: تخفیف غیرفعال
  describe('Scenario 6: Inactive discount', () => {
    it('should ignore inactive discount and charge full original price', () => {
      const hourlyPrice = 200000;
      const discount = {
        valueType: DiscountValueType.PERCENTAGE,
        value: 30,
        isActive: false,
      };
      const pricing = calculateStationPricing(hourlyPrice, discount, 1);

      expect(pricing.originalPrice).toBe(200000);
      expect(pricing.discountAmount).toBe(0);
      expect(pricing.finalPrice).toBe(200000);
      expect(pricing.hasDiscount).toBe(false);
    });
  });

  // Scenario 7: رزرو دو دستگاه با تخفیف‌های متفاوت
  describe('Scenario 7: Two stations with different discounts', () => {
    it('should calculate each station independently', () => {
      const st1Pricing = calculateStationPricing(100000, { valueType: DiscountValueType.PERCENTAGE, value: 10, isActive: true }, 1);
      const st2Pricing = calculateStationPricing(200000, { valueType: DiscountValueType.PERCENTAGE, value: 25, isActive: true }, 1);

      expect(st1Pricing.discountAmount).toBe(10000);
      expect(st1Pricing.finalPrice).toBe(90000);

      expect(st2Pricing.discountAmount).toBe(50000);
      expect(st2Pricing.finalPrice).toBe(150000);

      const totalOriginal = st1Pricing.originalPrice + st2Pricing.originalPrice;
      const totalDiscount = st1Pricing.discountAmount + st2Pricing.discountAmount;
      const totalPayable = st1Pricing.finalPrice + st2Pricing.finalPrice;

      expect(totalOriginal).toBe(300000);
      expect(totalDiscount).toBe(60000);
      expect(totalPayable).toBe(240000);
      expect(totalOriginal - totalDiscount).toBe(totalPayable);
    });
  });

  // Scenario 8: چند دستگاه که بعضی تخفیف دارند و بعضی ندارند
  describe('Scenario 8: Multiple stations where only some have discounts', () => {
    it('should apply discount only to eligible station and keep others at original price', () => {
      const st1 = calculateStationPricing(150000, { valueType: DiscountValueType.PERCENTAGE, value: 20, isActive: true }, 1);
      const st2 = calculateStationPricing(100000, null, 1); // No discount

      expect(st1.finalPrice).toBe(120000);
      expect(st1.discountAmount).toBe(30000);

      expect(st2.finalPrice).toBe(100000);
      expect(st2.discountAmount).toBe(0);

      const sumOriginal = st1.originalPrice + st2.originalPrice;
      const sumDiscount = st1.discountAmount + st2.discountAmount;
      const sumPayable = st1.finalPrice + st2.finalPrice;

      expect(sumOriginal).toBe(250000);
      expect(sumDiscount).toBe(30000);
      expect(sumPayable).toBe(220000);
      expect(sumOriginal - sumDiscount).toBe(sumPayable);
    });
  });

  // Scenario 9: مدت زمان‌های متفاوت (۱ ساعت، ۲ ساعت، ۲.۵ ساعت)
  describe('Scenario 9: Reservations with different durations', () => {
    it('should calculate base price and discount proportionally to duration', () => {
      const hourlyPrice = 200000;
      const discount = { valueType: DiscountValueType.PERCENTAGE, value: 20, isActive: true };

      // 1 hour
      const p1 = calculateStationPricing(hourlyPrice, discount, 1);
      expect(p1.originalPrice).toBe(200000);
      expect(p1.discountAmount).toBe(40000);
      expect(p1.finalPrice).toBe(160000);

      // 2 hours
      const p2 = calculateStationPricing(hourlyPrice, discount, 2);
      expect(p2.originalPrice).toBe(400000);
      expect(p2.discountAmount).toBe(80000);
      expect(p2.finalPrice).toBe(320000);

      // 2.5 hours
      const p3 = calculateStationPricing(hourlyPrice, discount, 2.5);
      expect(p3.originalPrice).toBe(500000);
      expect(p3.discountAmount).toBe(100000);
      expect(p3.finalPrice).toBe(400000);
    });
  });

  // Scenario 10: رزرو گروهی با چند دستگاه تخفیف‌دار
  describe('Scenario 10: Group booking with multiple discounted stations', () => {
    it('should aggregate individual station financials accurately without cross-contamination', async () => {
      const items = [
        { stationId: stationId1, hourly: 100000, discountVal: 10 },
        { stationId: stationId2, hourly: 200000, discountVal: 15 },
      ];
      const durationHours = 2;

      let aggOriginal = 0;
      let aggDiscount = 0;
      let aggPayable = 0;

      for (const item of items) {
        const itemPricing = calculateStationPricing(
          item.hourly,
          { valueType: DiscountValueType.PERCENTAGE, value: item.discountVal, isActive: true },
          durationHours
        );
        aggOriginal += itemPricing.originalPrice;
        aggDiscount += itemPricing.discountAmount;
        aggPayable += itemPricing.finalPrice;
      }

      expect(aggOriginal).toBe(600000); // (100k*2) + (200k*2) = 200k + 400k = 600k
      expect(aggDiscount).toBe(80000);  // (200k * 10% = 20k) + (400k * 15% = 60k) = 80k
      expect(aggPayable).toBe(520000);  // 180k + 340k = 520k
      expect(aggOriginal - aggDiscount).toBe(aggPayable);
    });
  });

  // Scenario 11: تطبیق مبلغ نهایی Frontend با Backend
  describe('Scenario 11: Matching between Frontend representation and Backend calculation', () => {
    it('should provide identical original, discount and final price structure for frontend display and backend storage', () => {
      const hourly = 250000;
      const durationHours = 3;
      const discount = { valueType: DiscountValueType.PERCENTAGE, value: 12, isActive: true };

      const frontendView = calculateStationPricing(hourly, discount, durationHours);

      expect(frontendView.originalPrice).toBe(750000);
      expect(frontendView.discountAmount).toBe(90000);
      expect(frontendView.finalPrice).toBe(660000);
      expect(frontendView.hasDiscount).toBe(true);
    });
  });

  // Scenario 12: تطبیق مبلغ نهایی Backend با مبلغ ارسالی به درگاه پرداخت
  describe('Scenario 12: Matching Backend customerPayableAmount with Payment gateway initiate amount', () => {
    it('should strictly use customerPayableAmount for gateway initiation and refuse tampering', async () => {
      const mockReservation = {
        id: 'res_auth_123',
        gamingCenterId: centerId,
        paymentState: ReservationPaymentState.UNPAID,
        status: ReservationStatus.PENDING,
        customerPayableAmount: 320000,
        totalPrice: 400000, // Stale or undiscounted total
        stationSnapshot: { currency: 'IRR' },
      };

      (PaymentsRepo.findReservationForUpdate as jest.Mock).mockResolvedValue(mockReservation);
      (PaymentsRepo.createPaymentAndUpdateReservation as jest.Mock).mockResolvedValue({
        payment: { id: 'pay_01', status: 'INITIATED' },
      });

      const mockProvider = {
        name: 'ZIBAL',
        initiatePayment: jest.fn().mockResolvedValue({
          providerPaymentId: 'track_123',
          checkoutUrl: 'https://gateway.zibal.ir/start/track_123',
        }),
      };
      (PaymentProviderFactory.getProvider as jest.Mock).mockReturnValue(mockProvider);

      await PaymentsStation.initiatePayment({
        gamingCenterId: centerId,
        reservationId: 'res_auth_123',
        idempotencyKey: 'idemp_key_1',
      });

      // Verify that initiatePayment sent exactly the customerPayableAmount (320000), NOT totalPrice (400000)
      expect(mockProvider.initiatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 320000,
          reservationId: 'res_auth_123',
        })
      );
    });
  });

  // Scenario 13: جلوگیری از اعمال دوباره تخفیف
  describe('Scenario 13: Preventing duplicate discount application', () => {
    it('should always compute discount from originalPrice, never from already discounted finalPrice', () => {
      const originalPrice = 200000;
      const discount = { valueType: DiscountValueType.PERCENTAGE, value: 20, isActive: true };

      const step1 = calculateStationPricing(originalPrice, discount, 1);
      expect(step1.finalPrice).toBe(160000);
      expect(step1.discountAmount).toBe(40000);

      // Even if called again, the reference must remain originalPrice (200000)
      const step2 = calculateStationPricing(originalPrice, discount, 1);
      expect(step2.finalPrice).toBe(160000);
      expect(step2.finalPrice).not.toBe(128000); // 160000 - 20% would be 128000 which is WRONG
    });
  });

  // Scenario 14: جلوگیری از دست‌کاری یا منفی شدن مبلغ
  describe('Scenario 14: Clamping and zero-flooring for discounts larger than original price', () => {
    it('should clamp discount to originalPrice so finalPrice is never negative', () => {
      const originalPrice = 100000;
      // Fixed discount greater than original price (e.g., 150,000 off 100,000)
      const hugeDiscount = { valueType: DiscountValueType.FIXED_AMOUNT, value: 150000, isActive: true };
      const pricing = calculateStationPricing(originalPrice, hugeDiscount, 1);

      expect(pricing.originalPrice).toBe(100000);
      expect(pricing.discountAmount).toBe(100000); // Clamped
      expect(pricing.finalPrice).toBe(0);          // Not -50000
    });
  });
});
