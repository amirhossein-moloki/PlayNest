import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BookingHoldStation } from '../../../../src/modules/booking-hold/booking-hold.station';
import { BookingHoldRepo } from '../../../../src/modules/booking-hold/booking-hold.repo';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { discountsStation } from '../../../../src/modules/discounts/discounts.station';
import { BookingHoldStatus, PaymentStatus, ReservationStatus, ReservationPaymentState } from '@prisma/client';

jest.mock('../../../../src/modules/booking-hold/booking-hold.repo');
jest.mock('../../../../src/modules/reservation/reservation.repo');
jest.mock('../../../../src/modules/discounts/discounts.station');
jest.mock('../../../../src/modules/payments/ledger.repo');
jest.mock('../../../../src/modules/commissions/commissions.station');

const MockedBookingHoldRepo = BookingHoldRepo as jest.Mocked<typeof BookingHoldRepo>;
const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;
const MockedDiscountsStation = discountsStation as jest.Mocked<typeof discountsStation>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('BookingHoldStation', () => {
  const gamingCenterSlug = 'gamenet-arena';
  const gamingCenterId = 'gc-1';
  const customer = { fullName: 'Babak Khorramdin', phone: '09121112233' };

  beforeEach(() => {
    jest.clearAllMocks();
    MockedBookingHoldRepo.transaction.mockImplementation(async (fn: any) => fn({
      gameStation: {
        findMany: jest.fn(),
      },
      customerAccount: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      customerProfile: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      reservation: {
        findMany: jest.fn(),
      },
      payment: {
        findUnique: jest.fn(),
      },
      groupBooking: {
        findUnique: jest.fn(),
      },
    } as any));
    MockedDiscountsStation.calculateApplicableDiscount.mockResolvedValue({ applicableDiscount: null, discountAmount: 0 } as any);
  });

  describe('createBookingHold', () => {
    const startTime = '2026-11-20T16:00:00Z';
    const items = [
      { stationId: 'st-1' },
      { stationId: 'st-2' },
    ];

    it('should create an ACTIVE booking hold and not create actual reservations', async () => {
      const mockCenter = {
        id: gamingCenterId,
        slug: gamingCenterSlug,
        settings: { allowOnlineBooking: true, minAdvanceBookingMinutes: 30 },
      };
      const stations = [
        { id: 'st-1', name: 'Station 1', hourlyPrice: 100000, minRentHours: 1, maxRentHours: 8, stationType: 'PC' },
        { id: 'st-2', name: 'Station 2', hourlyPrice: 150000, minRentHours: 1, maxRentHours: 8, stationType: 'PC' },
      ];

      MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue(mockCenter as any);
      MockedBookingHoldRepo.transaction.mockImplementation(async (fn: any) => {
        return fn({
          gameStation: {
            findMany: (jest.fn() as any).mockResolvedValue(stations),
          },
          customerAccount: {
            findUnique: (jest.fn() as any).mockResolvedValue({ id: 'ca-1', phone: '09121112233' }),
          },
          customerProfile: {
            findUnique: (jest.fn() as any).mockResolvedValue({ id: 'cp-1', customerAccountId: 'ca-1' }),
          },
        } as any);
      });
      MockedBookingHoldRepo.findOverlappingReservationsAndHoldsForStations.mockResolvedValue([]);

      const mockHold = {
        id: 'hold-123',
        gamingCenterId,
        status: BookingHoldStatus.ACTIVE,
        totalAmount: 250000,
        currency: 'IRR',
        expiresAt: new Date(Date.now() + 600000),
        items: stations.map((s) => ({ stationId: s.id, price: s.hourlyPrice })),
      };

      MockedBookingHoldRepo.createBookingHold.mockResolvedValue(mockHold as any);

      const result = await BookingHoldStation.createBookingHold(gamingCenterSlug, {
        startTime,
        durationMinutes: 60,
        items,
        customer,
      });

      expect(result.id).toBe('hold-123');
      expect(result.status).toBe(BookingHoldStatus.ACTIVE);
      expect(MockedBookingHoldRepo.createBookingHold).toHaveBeenCalledWith(
        expect.objectContaining({
          status: BookingHoldStatus.ACTIVE,
          totalAmount: 250000,
          currency: 'IRR',
        }),
        expect.anything()
      );
    });

    it('should throw Conflict when one or more stations overlap with active reservation or active hold', async () => {
      const mockCenter = {
        id: gamingCenterId,
        slug: gamingCenterSlug,
        settings: { allowOnlineBooking: true, minAdvanceBookingMinutes: 30 },
      };
      const stations = [
        { id: 'st-1', name: 'Station 1', hourlyPrice: 100000, minRentHours: 1, maxRentHours: 8, stationType: 'PC' },
        { id: 'st-2', name: 'Station 2', hourlyPrice: 150000, minRentHours: 1, maxRentHours: 8, stationType: 'PC' },
      ];

      MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue(mockCenter as any);
      MockedBookingHoldRepo.transaction.mockImplementation(async (fn: any) => {
        return fn({
          gameStation: {
            findMany: (jest.fn() as any).mockResolvedValue(stations),
          },
        } as any);
      });
      MockedBookingHoldRepo.findOverlappingReservationsAndHoldsForStations.mockResolvedValue([
        { id: 'other-hold', stationId: 'st-2', station: { id: 'st-2', name: 'Station 2' } } as any,
      ]);

      await expect(
        BookingHoldStation.createBookingHold(gamingCenterSlug, {
          startTime,
          durationMinutes: 60,
          items,
          customer,
        })
      ).rejects.toThrow('One or more selected stations are not available for the requested time.');
    });
  });

  describe('convertHoldToReservations', () => {
    const holdId = 'hold-123';

    it('should atomically convert ACTIVE hold to CONFIRMED and PAID group booking when payment is verified', async () => {
      const mockHold = {
        id: holdId,
        gamingCenterId,
        status: BookingHoldStatus.ACTIVE,
        totalAmount: 200000,
        durationMinutes: 60,
        startTime: new Date('2026-11-20T16:00:00Z'),
        endTime: new Date('2026-11-20T17:00:00Z'),
        items: [{ stationId: 'st-1', price: 200000, discountAmount: 0 }],
        payment: { id: 'pay-1', status: PaymentStatus.PAID, amount: 200000, currency: 'IRR' },
      };

      const mockGroupBooking = {
        id: 'gb-1',
        gamingCenterId,
        status: ReservationStatus.CONFIRMED,
        paymentState: ReservationPaymentState.PAID,
        reservations: [{ id: 'res-1' }],
      };

      MockedBookingHoldRepo.findHoldForUpdate.mockResolvedValue(mockHold as any);
      MockedBookingHoldRepo.convertHoldToGroupBookingAndReservations.mockResolvedValue(mockGroupBooking as any);

      MockedBookingHoldRepo.transaction.mockImplementation(async (fn: any) => {
        return fn({
          reservation: {
            findMany: (jest.fn() as any).mockResolvedValue([]),
          },
        } as any);
      });

      const result = await BookingHoldStation.convertHoldToReservations(holdId);

      expect(result).toBeDefined();
      expect(result?.status).toBe(ReservationStatus.CONFIRMED);
      expect(result?.paymentState).toBe(ReservationPaymentState.PAID);
    });

    it('should be idempotent and return existing group booking if hold was already CONVERTED', async () => {
      const mockHold = {
        id: holdId,
        gamingCenterId,
        status: BookingHoldStatus.CONVERTED,
        convertedGroupBookingId: 'gb-existing',
      };

      const existingGroup = {
        id: 'gb-existing',
        status: ReservationStatus.CONFIRMED,
        paymentState: ReservationPaymentState.PAID,
      };

      MockedBookingHoldRepo.findHoldForUpdate.mockResolvedValue(mockHold as any);
      MockedBookingHoldRepo.transaction.mockImplementation(async (fn: any) => {
        return fn({
          groupBooking: {
            findUnique: (jest.fn() as any).mockResolvedValue(existingGroup),
          },
        } as any);
      });

      const result = await BookingHoldStation.convertHoldToReservations(holdId);
      expect(result).toEqual(existingGroup);
    });

    it('should reject conversion if associated payment is not PAID', async () => {
      const mockHold = {
        id: holdId,
        status: BookingHoldStatus.ACTIVE,
        totalAmount: 200000,
        items: [{ stationId: 'st-1' }],
        payment: { id: 'pay-1', status: PaymentStatus.INITIATED, amount: 200000 },
      };

      MockedBookingHoldRepo.findHoldForUpdate.mockResolvedValue(mockHold as any);
      MockedBookingHoldRepo.transaction.mockImplementation(async (fn: any) => {
        return fn({} as any);
      });

      await expect(
        BookingHoldStation.convertHoldToReservations(holdId)
      ).rejects.toThrow('Payment must be PAID before converting booking hold to reservations.');
    });

    it('should throw Conflict if a conflict occurred between hold creation and payment verification', async () => {
      const mockHold = {
        id: holdId,
        gamingCenterId,
        status: BookingHoldStatus.ACTIVE,
        totalAmount: 200000,
        durationMinutes: 60,
        startTime: new Date('2026-11-20T16:00:00Z'),
        endTime: new Date('2026-11-20T17:00:00Z'),
        items: [{ stationId: 'st-1', price: 200000, discountAmount: 0 }],
        payment: { id: 'pay-1', status: PaymentStatus.PAID, amount: 200000, currency: 'IRR' },
      };

      MockedBookingHoldRepo.findHoldForUpdate.mockResolvedValue(mockHold as any);
      MockedBookingHoldRepo.transaction.mockImplementation(async (fn: any) => {
        return fn({
          reservation: {
            findMany: (jest.fn() as any).mockResolvedValue([{ id: 'res-conflicting' }]),
          },
        } as any);
      });

      await expect(
        BookingHoldStation.convertHoldToReservations(holdId)
      ).rejects.toThrow('Slot conflict detected during reservation creation. Payment preserved for reconciliation.');
    });
  });
});
