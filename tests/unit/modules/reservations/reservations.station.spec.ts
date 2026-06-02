import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { reservationsService } from '../../../../src/modules/reservations/reservations.station';
import { ReservationsRepo } from '../../../../src/modules/reservations/reservations.repo';
import { WalletService } from '../../../../src/modules/wallet/wallet.station';
import { eventEmitter } from '../../../../src/common/events/event-emitter';
import { ReservationStatus, SessionActorType, UserRole } from '@prisma/client';

jest.mock('../../../../src/modules/reservations/reservations.repo');
jest.mock('../../../../src/modules/auth/auth.repository');
jest.mock('../../../../src/modules/wallet/wallet.station');
jest.mock('../../../../src/modules/commissions/commissions.station');
jest.mock('../../../../src/modules/audit/audit.station');
jest.mock('../../../../src/common/events/event-emitter');

const MockedReservationsRepo = ReservationsRepo as jest.Mocked<typeof ReservationsRepo>;
const MockedWalletService = WalletService as jest.Mocked<typeof WalletService>;
const MockedEventEmitter = eventEmitter as jest.Mocked<typeof eventEmitter>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('ReservationsStationService', () => {
  const gamingCenterId = 'gc-1';
  const stationId = 'st-1';
  const staffId = 'u-1';
  const customerId = 'ca-1';
  const profileId = 'cp-1';

  beforeEach(() => {
    jest.clearAllMocks();
    MockedReservationsRepo.transaction.mockImplementation(async (fn) => fn({} as any));
  });

  describe('createBooking', () => {
    const input = {
      gamingCenterId,
      stationId,
      staffId,
      customer: { fullName: 'John Doe', phone: '09123456789' },
      startTime: '2023-12-01T10:00:00Z',
      createdByUserId: 'u-admin',
    };

    it('should create a booking successfully', async () => {
      const station = { id: stationId, name: 'PS5', defaultDurationHours: 1, hourlyPrice: 50, stationType: 'CONSOLE' };
      const staff = { id: staffId };
      const customerAccount = { id: customerId, phone: '09123456789' };
      const customerProfile = { id: profileId };
      const gamingCenter = { id: gamingCenterId, settings: {} };
      const reservation = { id: 'res-1', ...input, status: ReservationStatus.CONFIRMED };

      MockedReservationsRepo.findStation.mockResolvedValue(station as any);
      MockedReservationsRepo.findStaff.mockResolvedValue(staff as any);
      MockedReservationsRepo.findCustomerAccountByPhone.mockResolvedValue(customerAccount as any);
      MockedReservationsRepo.findCustomerProfile.mockResolvedValue(customerProfile as any);
      MockedReservationsRepo.findGamingCenterWithSettings.mockResolvedValue(gamingCenter as any);
      MockedReservationsRepo.createReservation.mockResolvedValue(reservation as any);

      const result = await reservationsService.createBooking(input);

      expect(result).toEqual(reservation);
      expect(MockedEventEmitter.emit).toHaveBeenCalledWith('reservation.created', expect.anything());
    });
  });

  describe('createPublicBooking', () => {
    const gamingCenterSlug = 'my-gamingCenter';
    const input = {
      stationId,
      staffId,
      startTime: new Date(Date.now() + 3600000).toISOString(),
      customer: { fullName: 'Jane Doe', phone: '09123456789' },
    };

    it('should create a public booking successfully', async () => {
      const gamingCenter = { id: gamingCenterId, settings: { allowOnlineBooking: true, timeZone: 'UTC' } };
      const station = { id: stationId, name: 'PS5', defaultDurationHours: 1, hourlyPrice: 50, stationType: 'CONSOLE' };
      const staff = { id: staffId };
      const staffShift = { id: 'shift-1', startTime: '08:00', endTime: '22:00' };
      const customerAccount = { id: customerId, phone: '09123456789' };
      const customerProfile = { id: profileId };
      const reservation = { id: 'res-1', status: ReservationStatus.PENDING };

      MockedReservationsRepo.findGamingCenterBySlugWithSettings.mockResolvedValue(gamingCenter as any);
      MockedReservationsRepo.findStation.mockResolvedValue(station as any);
      MockedReservationsRepo.findStaff.mockResolvedValue(staff as any);
      MockedReservationsRepo.findStaffShift.mockResolvedValue(staffShift as any);
      MockedReservationsRepo.findOverlappingReservation.mockResolvedValue(null);
      MockedReservationsRepo.findCustomerAccountByPhone.mockResolvedValue(customerAccount as any);
      MockedReservationsRepo.findCustomerProfile.mockResolvedValue(customerProfile as any);
      MockedReservationsRepo.createReservation.mockResolvedValue(reservation as any);

      const result = await reservationsService.createPublicBooking(gamingCenterSlug, input);

      expect(result).toEqual(reservation);
    });
  });

  describe('updateBooking', () => {
    const reservationId = 'res-1';
    const actor = { id: 'u-admin', actorType: SessionActorType.USER };

    it('should update booking successfully', async () => {
      const reservation = { id: reservationId, status: ReservationStatus.CONFIRMED, stationId, staffId, startTime: new Date(), totalHours: 1, stationSnapshot: { hourlyPrice: 50 } };
      const data = { note: 'Updated note' };
      const updated = { ...reservation, ...data };

      MockedReservationsRepo.findReservationById.mockResolvedValue(reservation as any);
      MockedReservationsRepo.updateReservation.mockResolvedValue(updated as any);

      const result = await reservationsService.updateBooking(reservationId, gamingCenterId, data, actor);

      expect(result).toEqual(updated);
    });
  });

  describe('cancelBooking', () => {
    const reservationId = 'res-1';
    const actor = { id: 'u-admin', role: UserRole.MANAGER, actorType: SessionActorType.USER };

    it('should cancel booking and trigger refund', async () => {
      const reservation = { id: reservationId, status: ReservationStatus.CONFIRMED, gamingCenterId };
      const updated = { ...reservation, status: ReservationStatus.CANCELED };

      MockedReservationsRepo.findReservationById.mockResolvedValue(reservation as any);
      MockedReservationsRepo.updateReservationWithInclude.mockResolvedValue(updated as any);

      const result = await reservationsService.cancelBooking(reservationId, gamingCenterId, actor, { reason: 'Test' });

      expect(result.status).toBe(ReservationStatus.CANCELED);
      expect(MockedWalletService.refundBookingToWallet).toHaveBeenCalledWith(reservationId, expect.anything());
    });
  });
});
