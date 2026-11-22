import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BookingHoldStation } from '../../../../src/modules/booking-hold/booking-hold.station';
import { BookingHoldRepo } from '../../../../src/modules/booking-hold/booking-hold.repo';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { DiscountsRepo } from '../../../../src/modules/discounts/discounts.repo';
import { PaymentsRepo } from '../../../../src/modules/payments/payments.repo';
import { PaymentProviderFactory } from '../../../../src/modules/payments/providers';
import { BookingHoldStatus, PaymentStatus } from '@prisma/client';
import AppError from '../../../../src/common/errors/AppError';
import { eventEmitter, AppEvents } from '../../../../src/common/events/event-emitter';

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
      startTime: '2027-01-01T16:00:00Z',
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
      startTime: '2027-01-01T16:00:00Z',
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
        findUnique: (jest.fn() as any).mockResolvedValue({ id: 'pay-fail-1', status: PaymentStatus.INITIATED, bookingHoldId: 'hold-fail-1' }),
        create: (jest.fn() as any).mockResolvedValue({ id: 'pay-fail-1', status: PaymentStatus.INITIATED }),
        update: jest.fn(),
      },
      bookingHold: {
        update: jest.fn(),
        updateMany: jest.fn(),
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
        startTime: '2027-01-01T16:00:00Z',
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

  it('should re-verify wallet balance after FOR UPDATE and release hold if drained concurrently', async () => {
    MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue({
      id: gamingCenterId,
      slug: gamingCenterSlug,
      settings: { allowOnlineBooking: true, minAdvanceBookingMinutes: 30 },
    } as any);

    MockedBookingHoldRepo.findHoldByIdempotencyKey.mockResolvedValue(null);
    MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue({
      id: 'ca-race',
      phone: '+989981385514',
      walletBalance: 200000,
    } as any);
    MockedReservationRepo.findCustomerAccountById.mockResolvedValue({
      id: 'ca-race',
      phone: '+989981385514',
      walletBalance: 200000,
    } as any);

    const txMock = {
      $executeRaw: jest.fn().mockImplementation(() => Promise.resolve(1)),
      gameStation: {
        findMany: (jest.fn() as any).mockResolvedValue([
          { id: 'station-1', name: 'Station 1', hourlyPrice: 185000, minRentHours: 1, maxRentHours: 8, stationType: 'PC' },
        ]),
      },
      customerAccount: {
        // Simulates concurrent drain inside locked transaction
        findUnique: (jest.fn() as any).mockResolvedValue({ id: 'ca-race', walletBalance: 10000 }),
        update: jest.fn(),
      },
      customerProfile: {
        findUnique: (jest.fn() as any).mockResolvedValue({ id: 'cp-1', customerAccountId: 'ca-race' }),
      },
      bookingHold: {
        updateMany: jest.fn().mockImplementation(() => Promise.resolve({ count: 1 })),
      },
    };

    MockedBookingHoldRepo.transaction.mockImplementation(async (fn: any) => fn(txMock));
    MockedBookingHoldRepo.findOverlappingReservationsAndHoldsForStations.mockResolvedValue([]);

    const createdHold = {
      id: 'hold-race-drain',
      gamingCenterId,
      status: BookingHoldStatus.ACTIVE,
      totalAmount: 185000,
      currency: 'IRR',
      expiresAt: new Date(Date.now() + 600000),
      items: [{ stationId: 'station-1', price: 185000 }],
    };
    MockedBookingHoldRepo.createBookingHold.mockResolvedValue(createdHold as any);
    MockedPaymentsRepo.transaction.mockImplementation(async (fn: any) => fn(txMock));

    await expect(
      BookingHoldStation.checkoutGroupReservation(gamingCenterSlug, {
        startTime: '2027-01-01T16:00:00Z',
        durationMinutes: 60,
        items,
        customer,
        useWallet: true,
        idempotencyKey: 'idemp-race-drain-1',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INSUFFICIENT_WALLET_BALANCE',
    });

    expect(txMock.customerAccount.update).not.toHaveBeenCalled();
    expect(txMock.bookingHold.updateMany).toHaveBeenCalledWith({
      where: { id: 'hold-race-drain', status: BookingHoldStatus.ACTIVE },
      data: { status: BookingHoldStatus.RELEASED },
    });
  });

  it('should release hold and throw INSUFFICIENT_WALLET_BALANCE when provider=WALLET and balance is insufficient', async () => {
    MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue({
      id: gamingCenterId,
      slug: gamingCenterSlug,
      settings: { allowOnlineBooking: true, minAdvanceBookingMinutes: 30 },
    } as any);

    MockedBookingHoldRepo.findHoldByIdempotencyKey.mockResolvedValue(null);
    MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue({
      id: 'ca-low',
      phone: '+989981385514',
      walletBalance: 50000,
    } as any);

    const txMock = {
      gameStation: {
        findMany: (jest.fn() as any).mockResolvedValue([
          { id: 'station-1', name: 'Station 1', hourlyPrice: 185000, minRentHours: 1, maxRentHours: 8, stationType: 'PC' },
        ]),
      },
      customerAccount: {
        findUnique: (jest.fn() as any).mockResolvedValue({ id: 'ca-low', walletBalance: 50000 }),
      },
      customerProfile: {
        findUnique: (jest.fn() as any).mockResolvedValue({ id: 'cp-1', customerAccountId: 'ca-low' }),
      },
      bookingHold: {
        updateMany: jest.fn().mockImplementation(() => Promise.resolve({ count: 1 })),
      },
    };

    MockedBookingHoldRepo.transaction.mockImplementation(async (fn: any) => fn(txMock));
    MockedBookingHoldRepo.findOverlappingReservationsAndHoldsForStations.mockResolvedValue([]);
    MockedBookingHoldRepo.createBookingHold.mockResolvedValue({
      id: 'hold-wallet-only-low',
      gamingCenterId,
      status: BookingHoldStatus.ACTIVE,
      totalAmount: 185000,
      currency: 'IRR',
      expiresAt: new Date(Date.now() + 600000),
      items: [{ stationId: 'station-1', price: 185000 }],
    } as any);
    MockedPaymentsRepo.transaction.mockImplementation(async (fn: any) => fn(txMock));

    await expect(
      BookingHoldStation.checkoutGroupReservation(gamingCenterSlug, {
        startTime: '2027-01-01T16:00:00Z',
        durationMinutes: 60,
        items,
        customer,
        provider: 'WALLET',
        idempotencyKey: 'idemp-wallet-only-low-1',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INSUFFICIENT_WALLET_BALANCE',
    });

    expect(txMock.bookingHold.updateMany).toHaveBeenCalledWith({
      where: { id: 'hold-wallet-only-low', status: BookingHoldStatus.ACTIVE },
      data: { status: BookingHoldStatus.RELEASED },
    });
  });

  it('should release hold when provider resolution fails before payment initiation', async () => {
    MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue({
      id: gamingCenterId,
      slug: gamingCenterSlug,
      settings: { allowOnlineBooking: true, minAdvanceBookingMinutes: 30 },
    } as any);

    MockedBookingHoldRepo.findHoldByIdempotencyKey.mockResolvedValue(null);
    MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue(null);

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
      bookingHold: {
        updateMany: jest.fn().mockImplementation(() => Promise.resolve({ count: 1 })),
      },
    };

    MockedBookingHoldRepo.transaction.mockImplementation(async (fn: any) => fn(txMock));
    MockedBookingHoldRepo.findOverlappingReservationsAndHoldsForStations.mockResolvedValue([]);
    MockedBookingHoldRepo.createBookingHold.mockResolvedValue({
      id: 'hold-bad-provider',
      gamingCenterId,
      status: BookingHoldStatus.ACTIVE,
      totalAmount: 185000,
      currency: 'IRR',
      expiresAt: new Date(Date.now() + 600000),
      items: [{ stationId: 'station-1', price: 185000 }],
    } as any);
    MockedPaymentsRepo.transaction.mockImplementation(async (fn: any) => fn(txMock));
    MockedProviderFactory.getProvider.mockImplementationOnce(() => {
      throw new AppError('Unsupported payment provider: UNKNOWN', 400);
    });

    await expect(
      BookingHoldStation.checkoutGroupReservation(gamingCenterSlug, {
        startTime: '2027-01-01T16:00:00Z',
        durationMinutes: 60,
        items,
        customer,
        provider: 'UNKNOWN',
        idempotencyKey: 'idemp-bad-prov-1',
      })
    ).rejects.toThrow('Unsupported payment provider: UNKNOWN');

    expect(txMock.bookingHold.updateMany).toHaveBeenCalledWith({
      where: { id: 'hold-bad-provider', status: BookingHoldStatus.ACTIVE },
      data: { status: BookingHoldStatus.RELEASED },
    });
  });

  it('should emit AppEvents.PAYMENT_SUCCESS on successful full wallet hold checkout', async () => {
    MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue({
      id: gamingCenterId,
      slug: gamingCenterSlug,
      settings: { allowOnlineBooking: true, minAdvanceBookingMinutes: 30 },
    } as any);

    MockedBookingHoldRepo.findHoldByIdempotencyKey.mockResolvedValue(null);
    MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue({
      id: 'ca-full-wallet',
      phone: '+989981385514',
      walletBalance: 300000,
    } as any);

    const txMock = {
      $executeRaw: jest.fn().mockImplementation(() => Promise.resolve(1)),
      customerAccount: {
        findUnique: (jest.fn() as any).mockResolvedValue({ id: 'ca-full-wallet', walletBalance: 300000 }),
        update: jest.fn(),
      },
      customerProfile: {
        findUnique: (jest.fn() as any).mockResolvedValue({ id: 'cp-1', customerAccountId: 'ca-full-wallet' }),
      },
      gameStation: {
        findMany: (jest.fn() as any).mockResolvedValue([
          { id: 'station-1', name: 'Station 1', hourlyPrice: 185000, minRentHours: 1, maxRentHours: 8, stationType: 'PC' },
        ]),
      },
      payment: {
        create: (jest.fn() as any).mockResolvedValue({
          id: 'pay-wallet-succ-1',
          status: PaymentStatus.PAID,
          amount: 185000,
        }),
        findFirst: jest.fn().mockImplementation(() => Promise.resolve(null)),
      },
      walletTransaction: {
        create: jest.fn().mockImplementation(() => Promise.resolve({ id: 'wt-1' })),
      },
      ledgerEntry: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(null)),
        create: jest.fn().mockImplementation(() => Promise.resolve({ id: 'le-1' })),
      },
      bookingHold: {
        updateMany: jest.fn().mockImplementation(() => Promise.resolve({ count: 1 })),
      },
      gamingCenter: {
        findUnique: (jest.fn() as any).mockResolvedValue({
          id: gamingCenterId,
          name: 'Kian Gaming',
          settings: { timeZone: 'Asia/Tehran' },
        }),
      },
    };

    MockedBookingHoldRepo.transaction.mockImplementation(async (fn: any) => fn(txMock));
    MockedBookingHoldRepo.findOverlappingReservationsAndHoldsForStations.mockResolvedValue([]);

    const createdHold = {
      id: 'hold-full-wallet-1',
      gamingCenterId,
      status: BookingHoldStatus.ACTIVE,
      totalAmount: 185000,
      currency: 'IRR',
      expiresAt: new Date(Date.now() + 600000),
      items: [{ stationId: 'station-1', price: 185000 }],
    };
    MockedBookingHoldRepo.createBookingHold.mockResolvedValue(createdHold as any);

    const convertedGroup = {
      id: 'gb-converted-succ',
      reservations: [{ id: 'res-child-1', status: 'CONFIRMED' }],
      customerAccount: { id: 'ca-full-wallet', phone: '+989981385514' },
    };
    MockedBookingHoldRepo.convertHoldToGroupBookingAndReservations.mockResolvedValue(convertedGroup as any);
    MockedPaymentsRepo.transaction.mockImplementation(async (fn: any) => fn(txMock));

    const paymentSuccessSpy = jest.fn();
    eventEmitter.on(AppEvents.PAYMENT_SUCCESS, paymentSuccessSpy);

    const result = await BookingHoldStation.checkoutGroupReservation(gamingCenterSlug, {
      startTime: '2027-01-01T16:00:00Z',
      durationMinutes: 60,
      items,
      customer,
      useWallet: true,
      idempotencyKey: 'idemp-wallet-succ-1',
    });

    expect(result.paymentStatus).toBe(PaymentStatus.PAID);
    expect(paymentSuccessSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        payment: expect.objectContaining({
          id: 'pay-wallet-succ-1',
          status: PaymentStatus.PAID,
        }),
      })
    );
  });
});
