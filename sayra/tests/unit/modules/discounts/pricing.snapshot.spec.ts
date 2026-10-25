/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DiscountTargetType, DiscountValueType, Discount, ReservationStatus, ReservationPaymentState, PaymentStatus } from '@prisma/client';
import { calculateDiscountAmount, selectBestDiscount, discountsStation } from '../../../../src/modules/discounts/discounts.station';
import { DiscountsRepo } from '../../../../src/modules/discounts/discounts.repo';
import { PaymentsRepo } from '../../../../src/modules/payments/payments.repo';
import { PaymentsStation } from '../../../../src/modules/payments/payments.station';

jest.mock('../../../../src/modules/discounts/discounts.repo');
jest.mock('../../../../src/modules/payments/payments.repo');
jest.mock('../../../../src/modules/payments/providers', () => ({
  PaymentProviderFactory: {
    getProvider: jest.fn().mockReturnValue({
      name: 'FAKE',
      initiatePayment: (jest.fn() as any).mockResolvedValue({
        providerPaymentId: 'prov-pay-123',
        providerCheckoutId: 'chk-123',
        checkoutUrl: 'https://gateway.example.com/pay/123',
      }),
    }),
  },
}));

const MockedDiscountsRepo = DiscountsRepo as jest.Mocked<typeof DiscountsRepo>;
const MockedPaymentsRepo = PaymentsRepo as jest.Mocked<typeof PaymentsRepo>;

describe('Phase 10: Pricing, Discounts, and Snapshot Immutability Unit Tests', () => {
  const gamingCenterId = 'gc-phase10';
  const stationId = 'st-phase10';
  const userId = 'user-phase10';
  const reservationId = 'res-phase10';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Monetary Calculations & Precision', () => {
    it('should calculate exact percentage discount rounded to 2 decimal places', () => {
      // 333,333 IRR at 15% discount = 49,999.95
      const discountAmount = calculateDiscountAmount(333333, DiscountValueType.PERCENTAGE, 15);
      expect(discountAmount).toBe(49999.95);
      const finalPrice = Math.max(0, 333333 - discountAmount);
      expect(finalPrice).toBe(283333.05);
    });

    it('should cap discount amount at base price when fixed discount exceeds base price', () => {
      const discountAmount = calculateDiscountAmount(100000, DiscountValueType.FIXED_AMOUNT, 250000);
      expect(discountAmount).toBe(100000);
      const finalPrice = Math.max(0, 100000 - discountAmount);
      expect(finalPrice).toBe(0);
    });

    it('should return 0 for zero or negative base price and discount value', () => {
      expect(calculateDiscountAmount(0, DiscountValueType.PERCENTAGE, 20)).toBe(0);
      expect(calculateDiscountAmount(-5000, DiscountValueType.FIXED_AMOUNT, 1000)).toBe(0);
      expect(calculateDiscountAmount(100000, DiscountValueType.PERCENTAGE, 0)).toBe(0);
      expect(calculateDiscountAmount(100000, DiscountValueType.FIXED_AMOUNT, -500)).toBe(0);
    });
  });

  describe('Discount Target Precedence & Filtering', () => {
    const gcDiscount: Discount = {
      id: 'd-gc-50',
      gamingCenterId,
      code: null,
      maxUses: null,
      usedCount: 0,
      targetType: DiscountTargetType.GAMING_CENTER,
      targetId: gamingCenterId,
      valueType: DiscountValueType.PERCENTAGE,
      value: 50, // 50% = 250,000 on 500,000
      startAt: new Date(Date.now() - 3600000),
      endAt: new Date(Date.now() + 3600000),
      isActive: true,
      createdByUserId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const stationDiscount: Discount = {
      id: 'd-st-10',
      gamingCenterId,
      code: null,
      maxUses: null,
      usedCount: 0,
      targetType: DiscountTargetType.STATION,
      targetId: stationId,
      valueType: DiscountValueType.PERCENTAGE,
      value: 10, // 10% = 50,000 on 500,000
      startAt: new Date(Date.now() - 3600000),
      endAt: new Date(Date.now() + 3600000),
      isActive: true,
      createdByUserId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should prioritize STATION discount over GAMING_CENTER discount even if GAMING_CENTER yields higher amount', () => {
      const result = selectBestDiscount([gcDiscount, stationDiscount], 500000);
      expect(result.applicableDiscount?.id).toBe('d-st-10');
      expect(result.discountAmount).toBe(50000);
    });

    it('should validate voucher code and check usage limits correctly', async () => {
      const voucherDiscount: Discount = {
        ...gcDiscount,
        id: 'd-vouch-100',
        code: 'PROMO100',
        maxUses: 5,
        usedCount: 5, // limit reached
      };

      MockedDiscountsRepo.findByCode.mockResolvedValue(voucherDiscount);

      await expect(
        discountsStation.calculateApplicableDiscount(
          gamingCenterId,
          stationId,
          500000,
          new Date(),
          'PROMO100'
        )
      ).rejects.toThrow('Voucher code usage limit reached.');
    });

    it('should select maximum discount when multiple station-level discounts apply', () => {
      const stationDiscount2: Discount = {
        ...stationDiscount,
        id: 'd-st-25',
        value: 25, // 25% = 125,000 on 500,000
      };

      const result = selectBestDiscount([stationDiscount, stationDiscount2], 500000);
      expect(result.applicableDiscount?.id).toBe('d-st-25');
      expect(result.discountAmount).toBe(125000);
    });

    it('should query active discounts at specified reservation time window via repo', async () => {
      const resTime = new Date('2026-06-15T10:00:00Z');
      MockedDiscountsRepo.findActiveApplicableDiscounts.mockResolvedValue([stationDiscount]);

      const result = await discountsStation.calculateApplicableDiscount(
        gamingCenterId,
        stationId,
        500000,
        resTime
      );

      expect(MockedDiscountsRepo.findActiveApplicableDiscounts).toHaveBeenCalledWith(
        gamingCenterId,
        stationId,
        resTime,
        undefined
      );
      expect(result.applicableDiscount?.id).toBe('d-st-10');
      expect(result.discountAmount).toBe(50000);
    });
  });

  describe('Price Snapshot Immutability & Payment Integration', () => {
    it('should enforce payment initiation using persisted reservation totalPrice snapshot regardless of price list changes', async () => {
      // Historical reservation created when station hourly rate was 100,000 IRR/hr for 2 hours (totalPrice = 200,000)
      const historicalReservation = {
        id: reservationId,
        gamingCenterId,
        stationId,
        totalHours: 2,
        totalPrice: 200000, // Immutably recorded price snapshot
        discountAmount: 0,
        paymentState: ReservationPaymentState.UNPAID,
        status: ReservationStatus.CONFIRMED,
        stationSnapshot: {
          stationId,
          name: 'VIP Station 1',
          hourlyPrice: 100000,
          currency: 'IRR',
        },
      };

      MockedPaymentsRepo.findReservationForUpdate.mockResolvedValue(historicalReservation as any);
      MockedPaymentsRepo.createPaymentAndUpdateReservation.mockResolvedValue({
        payment: {
          id: 'pay-phase10-001',
          gamingCenterId,
          reservationId,
          amount: 200000,
          currency: 'IRR',
          status: PaymentStatus.INITIATED,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as any);

      const result = await PaymentsStation.initiatePayment({
        gamingCenterId,
        reservationId,
        idempotencyKey: 'idem-key-phase10-001',
      });

      expect(MockedPaymentsRepo.findReservationForUpdate).toHaveBeenCalledWith(reservationId, gamingCenterId);
      expect(MockedPaymentsRepo.createPaymentAndUpdateReservation).toHaveBeenCalledWith({
        reservationId,
        paymentData: expect.objectContaining({
          amount: 200000, // Exact persisted total price snapshot used
          currency: 'IRR', // Currency from stationSnapshot used
        }),
      });
      expect(result.paymentId).toBe('pay-phase10-001');
    });

    it('should reject payment initiation if reservation total price snapshot is <= 0', async () => {
      const zeroPriceReservation = {
        id: reservationId,
        gamingCenterId,
        stationId,
        totalHours: 1,
        totalPrice: 0,
        discountAmount: 100000,
        paymentState: ReservationPaymentState.UNPAID,
        status: ReservationStatus.CONFIRMED,
        stationSnapshot: { currency: 'IRR' },
      };

      MockedPaymentsRepo.findReservationForUpdate.mockResolvedValue(zeroPriceReservation as any);

      await expect(
        PaymentsStation.initiatePayment({
          gamingCenterId,
          reservationId,
          idempotencyKey: 'idem-key-phase10-zero',
        })
      ).rejects.toThrow('Invalid reservation total price for payment.');
    });
  });
});
