import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GroupBookingStation } from '../../../../src/modules/group-booking/group-booking.station';
import { GroupBookingRepo } from '../../../../src/modules/group-booking/group-booking.repo';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { discountsStation } from '../../../../src/modules/discounts/discounts.station';
import { walletService } from '../../../../src/modules/wallet/wallet.station';
import { ReservationStatus, SessionActorType, UserRole } from '@prisma/client';

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
});
