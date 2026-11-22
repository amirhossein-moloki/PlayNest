import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GroupBookingStation } from '../../../../src/modules/group-booking/group-booking.station';
import { GroupBookingRepo } from '../../../../src/modules/group-booking/group-booking.repo';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { discountsStation } from '../../../../src/modules/discounts/discounts.station';
import { walletService } from '../../../../src/modules/wallet/wallet.station';
import { ReservationStatus, ReservationPaymentState, SessionActorType, UserRole } from '@prisma/client';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    customerAccount: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('../../../../src/modules/payments/payments.repo', () => ({
  PaymentsRepo: {
    reapStaleCustomerInitiatedPayments: jest.fn().mockImplementation(() => Promise.resolve()),
  },
}));
jest.mock('../../../../src/modules/payments/ledger.repo', () => ({
  LedgerRepo: {
    createCollectionEntry: jest.fn().mockImplementation(() => Promise.resolve({})),
  },
}));
jest.mock('../../../../src/modules/commissions/commissions.station', () => ({
  commissionsStation: {
    calculateCommission: jest.fn().mockImplementation(() => Promise.resolve()),
  },
}));
jest.mock('../../../../src/modules/group-booking/group-booking.repo');
jest.mock('../../../../src/modules/reservation/reservation.repo');
jest.mock('../../../../src/modules/discounts/discounts.station');
jest.mock('../../../../src/modules/wallet/wallet.station');
jest.mock('../../../../src/modules/audit/audit.station');

const MockedGroupBookingRepo = GroupBookingRepo as jest.Mocked<typeof GroupBookingRepo>;
const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;
const MockedDiscountsStation = discountsStation as jest.Mocked<typeof discountsStation>;
const MockedWalletService = walletService as jest.Mocked<typeof walletService>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('GroupBookingStation', () => {
  const gamingCenterId = 'gc-1';
  const createdByUserId = 'u-staff-1';
  const customer = { fullName: 'Alice Smith', phone: '09123456789' };

  beforeEach(() => {
    jest.clearAllMocks();
    MockedGroupBookingRepo.transaction.mockImplementation(async (fn) => fn({} as any));
    MockedDiscountsStation.calculateApplicableDiscount.mockResolvedValue({ applicableDiscount: null, discountAmount: 0 });
  });

  describe('createGroupBooking', () => {
    const startTime = '2026-11-01T14:00:00Z';
    const items = [
      { stationId: 'st-ps5-1' },
      { stationId: 'st-ps5-2' },
      { stationId: 'st-ps5-3' },
      { stationId: 'st-pc-1' },
      { stationId: 'st-pc-2' },
    ];

    it('should create a group booking with multiple stations successfully', async () => {
      const stations = [
        { id: 'st-ps5-1', name: 'PS5 #1', hourlyPrice: 100, minRentHours: 1, maxRentHours: 8, stationType: 'PLAYSTATION' },
        { id: 'st-ps5-2', name: 'PS5 #2', hourlyPrice: 100, minRentHours: 1, maxRentHours: 8, stationType: 'PLAYSTATION' },
        { id: 'st-ps5-3', name: 'PS5 #3', hourlyPrice: 100, minRentHours: 1, maxRentHours: 8, stationType: 'PLAYSTATION' },
        { id: 'st-pc-1', name: 'PC #1', hourlyPrice: 150, minRentHours: 1, maxRentHours: 8, stationType: 'PC' },
        { id: 'st-pc-2', name: 'PC #2', hourlyPrice: 150, minRentHours: 1, maxRentHours: 8, stationType: 'PC' },
      ];

      MockedReservationRepo.findGamingCenterWithSettings.mockResolvedValue({ id: gamingCenterId, settings: {} } as any);
      MockedGroupBookingRepo.findStationsBatch.mockResolvedValue(stations as any);
      MockedGroupBookingRepo.findOverlappingReservationsForStations.mockResolvedValue([]);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue({ id: 'ca-1' } as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue({ id: 'cp-1' } as any);

      const createdBooking = {
        id: 'gb-123',
        gamingCenterId,
        totalHours: 2,
        totalPrice: 1200, // (100*3 + 150*2)*2 = 1200
        status: ReservationStatus.CONFIRMED,
        items: stations.map((s) => ({ stationId: s.id, price: s.hourlyPrice * 2 })),
      };

      MockedGroupBookingRepo.createGroupBookingWithDetails.mockResolvedValue(createdBooking as any);

      const result = await GroupBookingStation.createGroupBooking({
        gamingCenterId,
        createdByUserId,
        startTime,
        durationMinutes: 120,
        items,
        customer,
      });

      expect(result).toEqual(createdBooking);
      expect(MockedGroupBookingRepo.createGroupBookingWithDetails).toHaveBeenCalledWith(
        expect.objectContaining({
          totalHours: 2,
          totalPrice: 1200,
          status: ReservationStatus.CONFIRMED,
        }),
        expect.anything()
      );
    });

    it('should reject request when duplicate station IDs are provided', async () => {
      const duplicateItems = [
        { stationId: 'st-ps5-1' },
        { stationId: 'st-ps5-1' },
      ];

      await expect(
        GroupBookingStation.createGroupBooking({
          gamingCenterId,
          createdByUserId,
          startTime,
          items: duplicateItems,
          customer,
        })
      ).rejects.toThrow('Duplicate stations selected in group booking.');
    });

    it('should reject request when an item station is unavailable / overlapping', async () => {
      const stations = [
        { id: 'st-ps5-1', name: 'PS5 #1', hourlyPrice: 100, minRentHours: 1, maxRentHours: 8 },
        { id: 'st-ps5-2', name: 'PS5 #2', hourlyPrice: 100, minRentHours: 1, maxRentHours: 8 },
      ];

      MockedReservationRepo.findGamingCenterWithSettings.mockResolvedValue({ id: gamingCenterId, settings: {} } as any);
      MockedGroupBookingRepo.findStationsBatch.mockResolvedValue(stations as any);
      MockedGroupBookingRepo.findOverlappingReservationsForStations.mockResolvedValue([
        { id: 'res-existing', stationId: 'st-ps5-2', station: { id: 'st-ps5-2', name: 'PS5 #2' } } as any,
      ]);

      await expect(
        GroupBookingStation.createGroupBooking({
          gamingCenterId,
          createdByUserId,
          startTime,
          items: [{ stationId: 'st-ps5-1' }, { stationId: 'st-ps5-2' }],
          customer,
        })
      ).rejects.toThrow('One or more selected stations are not available for the requested time.');
    });
  });

  describe('cancelGroupBooking', () => {
    const groupBookingId = 'gb-123';

    it('should cancel group booking and trigger refunds for child reservations', async () => {
      const existingBooking = {
        id: groupBookingId,
        gamingCenterId,
        status: ReservationStatus.CONFIRMED,
        reservations: [{ id: 'res-1' }, { id: 'res-2' }],
      };

      const canceledBooking = {
        ...existingBooking,
        status: ReservationStatus.CANCELED,
      };

      MockedGroupBookingRepo.findGroupBookingById.mockResolvedValue(existingBooking as any);
      MockedGroupBookingRepo.cancelGroupBookingAndReservations.mockResolvedValue(canceledBooking as any);

      const actor = { id: 'u-mgr-1', role: UserRole.MANAGER, actorType: SessionActorType.USER };
      const result = await GroupBookingStation.cancelGroupBooking(groupBookingId, gamingCenterId, actor, 'Customer requested cancel');

      expect(result.status).toBe(ReservationStatus.CANCELED);
      expect(MockedWalletService.refundReservationToWallet).toHaveBeenCalledTimes(2);
    });

    it('should throw conflict if group booking is already canceled', async () => {
      const existingBooking = {
        id: groupBookingId,
        gamingCenterId,
        status: ReservationStatus.CANCELED,
      };

      MockedGroupBookingRepo.findGroupBookingById.mockResolvedValue(existingBooking as any);

      const actor = { id: 'u-mgr-1', role: UserRole.MANAGER, actorType: SessionActorType.USER };
      await expect(
        GroupBookingStation.cancelGroupBooking(groupBookingId, gamingCenterId, actor)
      ).rejects.toThrow('Group booking is already canceled.');
    });
  });

  describe('getGroupBookingById', () => {
    const groupBookingId = 'gb-123';

    it('should throw 404 when group booking is not found', async () => {
      MockedGroupBookingRepo.findGroupBookingById.mockResolvedValue(null);

      await expect(
        GroupBookingStation.getGroupBookingById(groupBookingId, gamingCenterId)
      ).rejects.toThrow('Group booking not found.');
    });

    it('should throw 404 when customer account does not match owner', async () => {
      const booking = { id: groupBookingId, customerAccountId: 'ca-owner' };
      MockedGroupBookingRepo.findGroupBookingById.mockResolvedValue(booking as any);

      const actor = { id: 'cust-other', actorType: SessionActorType.CUSTOMER, customerAccountId: 'ca-other' };
      await expect(
        GroupBookingStation.getGroupBookingById(groupBookingId, gamingCenterId, actor)
      ).rejects.toThrow('Group booking not found.');
    });
  });

  describe('createPublicGroupBooking', () => {
    const startTime = '2027-06-06T14:00:00Z';
    const items = [{ stationId: 'st-ps5-1' }, { stationId: 'st-ps5-2' }];
    const stations = [
      { id: 'st-ps5-1', name: 'PS5 #1', hourlyPrice: 100000, minRentHours: 1, maxRentHours: 8, stationType: 'PLAYSTATION' },
      { id: 'st-ps5-2', name: 'PS5 #2', hourlyPrice: 100000, minRentHours: 1, maxRentHours: 8, stationType: 'PLAYSTATION' },
    ];

    it('should reject with INSUFFICIENT_WALLET_BALANCE without creating group booking when useWallet=true or provider=WALLET', async () => {
      MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue({
        id: gamingCenterId,
        slug: 'center-1',
        isActive: true,
        settings: { allowOnlineBooking: true, onlineBookingAutoConfirm: true, timeZone: 'UTC' },
      } as any);

      const txMock = {
        $executeRaw: jest.fn().mockImplementation(() => Promise.resolve(1)),
        user: { findFirst: jest.fn().mockImplementation(() => Promise.resolve({ id: 'sys-user-1' })) },
        customerAccount: {
          findUnique: jest.fn().mockImplementation(() => Promise.resolve({ walletBalance: 50000 })),
          update: jest.fn(),
        },
      };

      MockedGroupBookingRepo.transaction.mockImplementation(async (fn) => fn(txMock as any));
      MockedGroupBookingRepo.findStationsBatch.mockResolvedValue(stations as any);
      MockedGroupBookingRepo.findOverlappingReservationsForStations.mockResolvedValue([]);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue({ id: 'ca-1', phone: '+989123456789' } as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue({ id: 'cp-1' } as any);

      await expect(
        GroupBookingStation.createPublicGroupBooking('center-1', {
          startTime,
          durationMinutes: 60,
          items,
          customer,
          useWallet: true,
        })
      ).rejects.toMatchObject({ statusCode: 400, code: 'INSUFFICIENT_WALLET_BALANCE' });

      await expect(
        GroupBookingStation.createPublicGroupBooking('center-1', {
          startTime,
          durationMinutes: 60,
          items,
          customer,
          provider: 'WALLET',
        })
      ).rejects.toMatchObject({ statusCode: 400, code: 'INSUFFICIENT_WALLET_BALANCE' });

      expect(MockedGroupBookingRepo.createGroupBookingWithDetails).not.toHaveBeenCalled();
      expect(txMock.customerAccount.update).not.toHaveBeenCalled();
    });

    it('should deduct wallet and set PAID/CONFIRMED when useWallet=true with sufficient balance', async () => {
      MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue({
        id: gamingCenterId,
        slug: 'center-1',
        isActive: true,
        settings: { allowOnlineBooking: true, onlineBookingAutoConfirm: true, timeZone: 'UTC' },
      } as any);

      const txMock = {
        $executeRaw: jest.fn().mockImplementation(() => Promise.resolve(1)),
        user: { findFirst: jest.fn().mockImplementation(() => Promise.resolve({ id: 'sys-user-1' })) },
        customerAccount: {
          findUnique: jest.fn().mockImplementation(() => Promise.resolve({ walletBalance: 500000 })),
          update: jest.fn().mockImplementation(() => Promise.resolve({ walletBalance: 300000 })),
        },
        payment: {
          create: jest.fn().mockImplementation(() => Promise.resolve({ id: 'pay-gb-1' })),
        },
        walletTransaction: {
          create: jest.fn().mockImplementation(() => Promise.resolve({ id: 'wtx-gb-1' })),
        },
      };

      MockedGroupBookingRepo.transaction.mockImplementationOnce(async (fn) => fn(txMock as any));
      MockedGroupBookingRepo.findStationsBatch.mockResolvedValue(stations as any);
      MockedGroupBookingRepo.findOverlappingReservationsForStations.mockResolvedValue([]);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue({ id: 'ca-1', phone: '+989123456789' } as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue({ id: 'cp-1' } as any);

      const createdBooking = {
        id: 'gb-paid-1',
        status: ReservationStatus.CONFIRMED,
        paymentState: ReservationPaymentState.PAID,
        reservations: [{ id: 'res-c1' }, { id: 'res-c2' }],
      };
      MockedGroupBookingRepo.createGroupBookingWithDetails.mockResolvedValue(createdBooking as any);

      const result = await GroupBookingStation.createPublicGroupBooking('center-1', {
        startTime,
        durationMinutes: 60,
        items,
        customer,
        useWallet: true,
      });

      expect(result?.status).toBe(ReservationStatus.CONFIRMED);
      expect(result?.paymentState).toBe(ReservationPaymentState.PAID);
      expect(txMock.customerAccount.update).toHaveBeenCalledWith({
        where: { id: 'ca-1' },
        data: { walletBalance: { decrement: 200000 } },
      });
      expect(MockedGroupBookingRepo.createGroupBookingWithDetails).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ReservationStatus.CONFIRMED,
          paymentState: ReservationPaymentState.PAID,
        }),
        expect.anything()
      );
    });

    it('should keep unpaid payable online group booking PENDING with expiresAt even when onlineBookingAutoConfirm is true', async () => {
      MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue({
        id: gamingCenterId,
        slug: 'center-1',
        isActive: true,
        settings: {
          allowOnlineBooking: true,
          onlineBookingAutoConfirm: true,
          autoReleaseUnpaidMinutes: 15,
          reservationConfirmationTimeoutMinutes: 30,
          timeZone: 'UTC',
        },
      } as any);

      const txMock = {
        user: { findFirst: jest.fn().mockImplementation(() => Promise.resolve({ id: 'sys-user-1' })) },
      };

      MockedGroupBookingRepo.transaction.mockImplementationOnce(async (fn) => fn(txMock as any));
      MockedGroupBookingRepo.findStationsBatch.mockResolvedValue(stations as any);
      MockedGroupBookingRepo.findOverlappingReservationsForStations.mockResolvedValue([]);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue({ id: 'ca-1', phone: '+989123456789' } as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue({ id: 'cp-1' } as any);
      MockedGroupBookingRepo.createGroupBookingWithDetails.mockResolvedValue({
        id: 'gb-unpaid-1',
        status: ReservationStatus.PENDING,
        paymentState: ReservationPaymentState.UNPAID,
      } as any);

      await GroupBookingStation.createPublicGroupBooking('center-1', {
        startTime,
        durationMinutes: 60,
        items,
        customer,
      });

      expect(MockedGroupBookingRepo.createGroupBookingWithDetails).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ReservationStatus.PENDING,
          paymentState: ReservationPaymentState.UNPAID,
          expiresAt: expect.any(Date),
          confirmationExpiresAt: expect.any(Date),
        }),
        expect.anything()
      );
    });
  });
});
