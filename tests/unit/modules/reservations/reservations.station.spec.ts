import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { reservationStation } from '../../../../src/modules/reservation/reservation.station';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { walletService } from '../../../../src/modules/wallet/wallet.station';
import { eventEmitter } from '../../../../src/common/events/event-emitter';
import { ReservationStatus, SessionActorType, UserRole } from '@prisma/client';

jest.mock('../../../../src/modules/reservation/reservation.repo');
jest.mock('../../../../src/modules/auth/auth.repository');
jest.mock('../../../../src/modules/wallet/wallet.station');
jest.mock('../../../../src/modules/commissions/commissions.station');
jest.mock('../../../../src/modules/audit/audit.station');
jest.mock('../../../../src/common/events/event-emitter');

const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;
const MockedwalletService = walletService as jest.Mocked<typeof walletService>;
const MockedEventEmitter = eventEmitter as jest.Mocked<typeof eventEmitter>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('reservationstationStation', () => {
  const gamingCenterId = 'gc-1';
  const stationId = 'st-1';
  const staffId = 'u-1';
  const customerId = 'ca-1';
  const profileId = 'cp-1';

  beforeEach(() => {
    jest.clearAllMocks();
    MockedReservationRepo.transaction.mockImplementation(async (fn) => fn({} as any));
  });

  describe('createReservation', () => {
    const input = {
      gamingCenterId,
      stationId,
      staffId,
      customer: { fullName: 'John Doe', phone: '09123456789' },
      startTime: '2023-12-01T10:00:00Z',
      createdByUserId: 'u-admin',
    };

    it('should create a reservation successfully', async () => {
      const station = { id: stationId, name: 'PS5', defaultDurationHours: 1, hourlyPrice: 50, stationType: 'CONSOLE' };
      const staff = { id: staffId };
      const customerAccount = { id: customerId, phone: '09123456789' };
      const customerProfile = { id: profileId };
      const gamingCenter = { id: gamingCenterId, settings: {} };
      const reservation = { id: 'res-1', ...input, status: ReservationStatus.CONFIRMED };

      MockedReservationRepo.findStation.mockResolvedValue(station as any);
      MockedReservationRepo.findStaff.mockResolvedValue(staff as any);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue(customerAccount as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue(customerProfile as any);
      MockedReservationRepo.findGamingCenterWithSettings.mockResolvedValue(gamingCenter as any);
      MockedReservationRepo.createReservation.mockResolvedValue(reservation as any);

      const result = await reservationStation.createReservation(input);

      expect(result).toEqual(reservation);
      expect(MockedEventEmitter.emit).toHaveBeenCalledWith('reservation.created', expect.anything());
    });
  });

  describe('createPublicReservation', () => {
    const gamingCenterSlug = 'my-gamingCenter';
    const input = {
      stationId,
      staffId,
      startTime: '2027-06-06T10:00:00Z',
      customer: { fullName: 'Jane Doe', phone: '09123456789' },
    };

    it('should create a public reservation successfully', async () => {
      const gamingCenter = { id: gamingCenterId, settings: { allowOnlineBooking: true, timeZone: 'UTC' } };
      const station = { id: stationId, name: 'PS5', defaultDurationHours: 1, hourlyPrice: 50, stationType: 'CONSOLE' };
      const staff = { id: staffId };
      const staffShift = { id: 'shift-1', startTime: '08:00', endTime: '22:00' };
      const customerAccount = { id: customerId, phone: '09123456789' };
      const customerProfile = { id: profileId };
      const reservation = { id: 'res-1', status: ReservationStatus.PENDING };

      MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue(gamingCenter as any);
      MockedReservationRepo.findStation.mockResolvedValue(station as any);
      MockedReservationRepo.findStaff.mockResolvedValue(staff as any);
      MockedReservationRepo.findStaffShift.mockResolvedValue(staffShift as any);
      MockedReservationRepo.findOverlappingReservation.mockResolvedValue(null);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue(customerAccount as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue(customerProfile as any);
      MockedReservationRepo.createReservation.mockResolvedValue(reservation as any);

      const result = await reservationStation.createPublicReservation(gamingCenterSlug, input);

      expect(result).toEqual(reservation);
    });
  });

  describe('updateReservation', () => {
    const reservationId = 'res-1';
    const actor = { id: 'u-admin', actorType: SessionActorType.USER };

    it('should update reservation successfully', async () => {
      const reservation = { id: reservationId, status: ReservationStatus.CONFIRMED, stationId, staffId, startTime: new Date(), totalHours: 1, stationSnapshot: { hourlyPrice: 50 } };
      const data = { note: 'Updated note' };
      const updated = { ...reservation, ...data };

      MockedReservationRepo.findReservationById.mockResolvedValue(reservation as any);
      MockedReservationRepo.updateReservation.mockResolvedValue(updated as any);

      const result = await reservationStation.updateReservation(reservationId, gamingCenterId, data, actor);

      expect(result).toEqual(updated);
    });
  });

  describe('cancelReservation', () => {
    const reservationId = 'res-1';
    const actor = { id: 'u-admin', role: UserRole.MANAGER, actorType: SessionActorType.USER };

    it('should cancel reservation and trigger refund', async () => {
      const reservation = { id: reservationId, status: ReservationStatus.CONFIRMED, gamingCenterId };
      const updated = { ...reservation, status: ReservationStatus.CANCELED };

      MockedReservationRepo.findReservationById.mockResolvedValue(reservation as any);
      MockedReservationRepo.updateReservationWithInclude.mockResolvedValue(updated as any);

      const result = await reservationStation.cancelReservation(reservationId, gamingCenterId, actor, { reason: 'Test' });

      expect(result.status).toBe(ReservationStatus.CANCELED);
      expect(MockedwalletService.refundReservationToWallet).toHaveBeenCalledWith(reservationId, expect.anything());
    });
  });
});
