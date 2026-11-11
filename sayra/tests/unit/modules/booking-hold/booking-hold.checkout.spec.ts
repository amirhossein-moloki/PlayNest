import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BookingHoldStation } from '../../../../src/modules/booking-hold/booking-hold.station';
import { BookingHoldRepo } from '../../../../src/modules/booking-hold/booking-hold.repo';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { DiscountsRepo } from '../../../../src/modules/discounts/discounts.repo';
import { PaymentsRepo } from '../../../../src/modules/payments/payments.repo';
import { PaymentProviderFactory } from '../../../../src/modules/payments/providers';
import { BookingHoldStatus, PaymentStatus } from '@prisma/client';
import AppError from '../../../../src/common/errors/AppError';

jest.mock('../../../../src/modules/booking-hold/booking-hold.repo');
jest.mock('../../../../src/modules/reservation/reservation.repo');
jest.mock('../../../../src/modules/discounts/discounts.repo');
jest.mock('../../../../src/modules/payments/payments.repo');
jest.mock('../../../../src/modules/payments/providers/payment-provider.factory');

const MockedBookingHoldRepo = BookingHoldRepo as jest.Mocked<typeof BookingHoldRepo>;
const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;
const MockedDiscountsRepo = DiscountsRepo as jest.Mocked<typeof DiscountsRepo>;
const MockedPaymentsRepo = PaymentsRepo as jest.Mocked<typeof PaymentsRepo>;
const MockedProviderFactory = PaymentProviderFactory as jest.Mocked<typeof PaymentProviderFactory>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('BookingHoldStation - Checkout & Idempotency Retries', () => {
  const gamingCenterSlug = 'kian';
  const gamingCenterId = 'gc-kian-1';
  const idempotencyKey = 'test-idemp-uuid-12345';
  const customer = { fullName: 'Test Gamer', phone: '09981385514' };
  const items = [{ stationId: 'station-1' }];

  beforeEach(() => {
    jest.clearAllMocks();
    MockedDiscountsRepo.findActiveApplicableDiscounts.mockResolvedValue([]);
  });

  it('should replay existing checkout details when active hold and initiated payment exist for idempotencyKey', async () => {
    const existingHold = {
      id: 'hold-active-1',
      gamingCenterId,
      status: BookingHoldStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 600000),
      totalAmount: 185000,
      currency: 'IRR',
      payment: {
        id: 'pay-init-1',
        status: PaymentStatus.INITIATED,
        providerCheckoutId: 'https://gateway.example/pay-init-1',
      },
    };

    MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue({
      id: gamingCenterId,
      slug: gamingCenterSlug,
      settings: { allowOnlineBooking: true },
    } as any);

    MockedBookingHoldRepo.findHoldByIdempotencyKey.mockResolvedValue(existingHold as any);

    const result = await BookingHoldStation.checkoutGroupReservation(gamingCenterSlug, {
      startTime: '2026-11-20T16:00:00Z',
      durationMinutes: 60,
      items,
      customer,
      idempotencyKey,
    });

    expect(result.holdId).toBe('hold-active-1');
    expect(result.paymentId).toBe('pay-init-1');
    expect(result.paymentUrl).toBe('https://gateway.example/pay-init-1');
    expect(MockedBookingHoldRepo.createBookingHold).not.toHaveBeenCalled();
  });

  it('should archive inactive hold and allow creating a new hold and payment on retry with same idempotencyKey', async () => {
    MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue({
      id: gamingCenterId,
      slug: gamingCenterSlug,
      settings: { allowOnlineBooking: true, minAdvanceBookingMinutes: 30 },
    } as any);

    // Initial check: no active hold found
    MockedBookingHoldRepo.findHoldByIdempotencyKey.mockResolvedValue(null);

    const txMock = {
      gameStation: {
        findMany: (jest.fn() as any).mockResolvedValue([
          { id: 'station-1', name: 'Station 1', hourlyPrice: 185000, minRentHours: 1, maxRentHours: 8, stationType: 'PC' },
        ]),
      },
      customerAccount: {
        findUnique: (jest.fn() as any).mockResolvedValue({ id: 'ca-1', phone: '09981385514' }),
      },
      customerProfile: {
        findUnique: (jest.fn() as any).mockResolvedValue({ id: 'cp-1', customerAccountId: 'ca-1' }),
      },
      payment: {
        findFirst: (jest.fn() as any).mockResolvedValue({ id: 'old-failed-pay', status: PaymentStatus.FAILED }),
        update: (jest.fn() as any).mockResolvedValue({ id: 'old-failed-pay' }),
        create: (jest.fn() as any).mockResolvedValue({ id: 'new-pay-1', status: PaymentStatus.INITIATED }),
      },
    };

    MockedBookingHoldRepo.transaction.mockImplementation(async (fn: any) => fn(txMock));
    MockedBookingHoldRepo.findOverlappingReservationsAndHoldsForStations.mockResolvedValue([]);

    const createdHold = {
      id: 'hold-new-2',
      gamingCenterId,
      status: BookingHoldStatus.ACTIVE,
      totalAmount: 185000,
      currency: 'IRR',
      expiresAt: new Date(Date.now() + 600000),
      items: [{ stationId: 'station-1', price: 185000 }],
    };
    MockedBookingHoldRepo.createBookingHold.mockResolvedValue(createdHold as any);

    MockedPaymentsRepo.transaction.mockImplementation(async (fn: any) => fn(txMock));

    const mockProvider = {
      name: 'ZIBAL',
      initiatePayment: (jest.fn() as any).mockResolvedValue({
        providerPaymentId: 'track-12345',
        providerCheckoutId: 'https://gateway.zibal.ir/start/track-12345',
        checkoutUrl: 'https://gateway.zibal.ir/start/track-12345',
      }),
    };
    MockedProviderFactory.getProvider.mockReturnValue(mockProvider as any);
    MockedPaymentsRepo.updatePayment.mockResolvedValue({ id: 'new-pay-1' } as any);

    const result = await BookingHoldStation.checkoutGroupReservation(gamingCenterSlug, {
      startTime: '2026-11-20T16:00:00Z',
      durationMinutes: 60,
      items,
      customer,
      idempotencyKey,
    });

    expect(MockedBookingHoldRepo.archiveInactiveHoldIdempotencyKey).toHaveBeenCalledWith(
      gamingCenterId,
      idempotencyKey,
      expect.anything()
    );
    expect(result.holdId).toBe('hold-new-2');
    expect(result.paymentUrl).toBe('https://gateway.zibal.ir/start/track-12345');
  });

  it('should mark payment FAILED and hold RELEASED with informative error when gateway initiation fails', async () => {
    MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue({
      id: gamingCenterId,
      slug: gamingCenterSlug,
      settings: { allowOnlineBooking: true, minAdvanceBookingMinutes: 30 },
    } as any);

    MockedBookingHoldRepo.findHoldByIdempotencyKey.mockResolvedValue(null);

    const txMock = {
      gameStation: {
        findMany: (jest.fn() as any).mockResolvedValue([
          { id: 'station-1', name: 'Station 1', hourlyPrice: 185000, minRentHours: 1, maxRentHours: 8, stationType: 'PC' },
        ]),
      },
      customerAccount: {
        findUnique: (jest.fn() as any).mockResolvedValue({ id: 'ca-1', phone: '09981385514' }),
      },
      customerProfile: {
        findUnique: (jest.fn() as any).mockResolvedValue({ id: 'cp-1', customerAccountId: 'ca-1' }),
      },
      payment: {
        findFirst: (jest.fn() as any).mockResolvedValue(null),
        create: (jest.fn() as any).mockResolvedValue({ id: 'pay-fail-1', status: PaymentStatus.INITIATED }),
        update: jest.fn(),
      },
      bookingHold: {
        update: jest.fn(),
      },
    };

    MockedBookingHoldRepo.transaction.mockImplementation(async (fn: any) => fn(txMock));
    MockedBookingHoldRepo.findOverlappingReservationsAndHoldsForStations.mockResolvedValue([]);

    const createdHold = {
      id: 'hold-fail-1',
      gamingCenterId,
      status: BookingHoldStatus.ACTIVE,
      totalAmount: 185000,
      currency: 'IRR',
      expiresAt: new Date(Date.now() + 600000),
      items: [{ stationId: 'station-1', price: 185000 }],
    };
    MockedBookingHoldRepo.createBookingHold.mockResolvedValue(createdHold as any);

    MockedPaymentsRepo.transaction.mockImplementation(async (fn: any) => fn(txMock));

    const mockProvider = {
      name: 'ZIBAL',
      initiatePayment: (jest.fn() as any).mockRejectedValue(
        new AppError('Payment provider request timed out. Please try again.', 504, { code: 'GATEWAY_TIMEOUT' })
      ),
    };
    MockedProviderFactory.getProvider.mockReturnValue(mockProvider as any);

    await expect(
      BookingHoldStation.checkoutGroupReservation(gamingCenterSlug, {
        startTime: '2026-11-20T16:00:00Z',
        durationMinutes: 60,
        items,
        customer,
        idempotencyKey,
      })
    ).rejects.toThrow('Payment provider request timed out. Please try again.');

    expect(txMock.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-fail-1' },
        data: expect.objectContaining({ status: PaymentStatus.FAILED }),
      })
    );
    expect(txMock.bookingHold.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'hold-fail-1' },
        data: expect.objectContaining({ status: BookingHoldStatus.RELEASED }),
      })
    );
  });
});
