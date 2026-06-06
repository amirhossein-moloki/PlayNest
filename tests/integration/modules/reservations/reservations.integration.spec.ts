import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { reservationStation } from '../../../../src/modules/reservation/reservation.station';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { ReservationStatus, ReservationSource } from '@prisma/client';
import { eventEmitter, AppEvents } from '../../../../src/common/events/event-emitter';

jest.mock('../../../../src/modules/reservation/reservation.repo');
jest.mock('../../../../src/common/events/event-emitter');

const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;
const MockedEventEmitter = eventEmitter as jest.Mocked<typeof eventEmitter>;

describe('Reservation Creation Integration (Mocked Repo)', () => {
  const gamingCenterId = 'gc-1';
  const gamingCenterSlug = 'test-center';
  const staffId = 'staff-1';
  const stationId = 'station-1';

  beforeEach(() => {
    jest.clearAllMocks();
    // Simulate transaction by just calling the callback
    MockedReservationRepo.transaction.mockImplementation(async (cb: /* eslint-disable-line @typescript-eslint/no-explicit-any */ any) => {
      return cb({});
    });
  });

  describe('createReservation (Internal/Staff)', () => {
    it('should successfully create a reservation and emit event', async () => {
      const input = {
        gamingCenterId,
        stationId,
        staffId,
        customer: { fullName: 'John Doe', phone: '09123456789' },
        startTime: new Date(Date.now() + 3600000).toISOString(),
        createdByUserId: 'admin-1',
      };

      const station = { id: stationId, name: 'PC-1', hourlyPrice: 100, defaultDurationHours: 1, stationType: 'PC', isActive: true };
      const staff = { id: staffId };
      const customerAccount = { id: 'cust-1' };
      const customerProfile = { id: 'prof-1' };
      const gamingCenter = { id: gamingCenterId, settings: { timeZone: 'UTC' } };
      const reservation = { id: 'res-1', ...input, status: ReservationStatus.CONFIRMED };

      MockedReservationRepo.findStation.mockResolvedValue(station /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedReservationRepo.findStaff.mockResolvedValue(staff /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue(customerAccount /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue(customerProfile /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedReservationRepo.findGamingCenterWithSettings.mockResolvedValue(gamingCenter /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedReservationRepo.createReservation.mockResolvedValue(reservation /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

      const result = await reservationStation.createReservation(input);

      expect(result).toEqual(reservation);
      expect(MockedReservationRepo.createReservation).toHaveBeenCalled();
      expect(MockedEventEmitter.emit).toHaveBeenCalledWith(AppEvents.RESERVATION_CREATED, expect.objectContaining({
        reservation,
        gamingCenter,
        customerAccount,
      }));
    });
  });

  describe('createPublicReservation', () => {
    it('should successfully create an online reservation', async () => {
      const input = {
        stationId,
        staffId,
        startTime: '2027-06-06T10:00:00Z',
        customer: { fullName: 'Jane Doe', phone: '09998887766' },
      };

      const gamingCenter = {
        id: gamingCenterId,
        slug: gamingCenterSlug,
        settings: {
          allowOnlineBooking: true,
          onlineBookingAutoConfirm: true,
          timeZone: 'UTC',
        },
      };

      const station = { id: stationId, name: 'PS5-1', hourlyPrice: 200, defaultDurationHours: 1, stationType: 'PLAYSTATION', isActive: true };
      const staff = { id: staffId };
      const staffShift = { id: 'shift-1', startTime: '08:00', endTime: '22:00' };
      const customerAccount = { id: 'cust-2' };
      const customerProfile = { id: 'prof-2' };
      const reservation = { id: 'res-2', status: ReservationStatus.CONFIRMED, source: ReservationSource.ONLINE };

      MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue(gamingCenter /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedReservationRepo.findStation.mockResolvedValue(station /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedReservationRepo.findStaff.mockResolvedValue(staff /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedReservationRepo.findStaffShift.mockResolvedValue(staffShift /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedReservationRepo.findOverlappingReservation.mockResolvedValue(null);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue(customerAccount /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue(customerProfile /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedReservationRepo.createReservation.mockResolvedValue(reservation /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

      const result = await reservationStation.createPublicReservation(gamingCenterSlug, input);

      expect(result).toEqual(reservation);
      expect(MockedReservationRepo.createReservation).toHaveBeenCalledWith(expect.objectContaining({
        source: ReservationSource.ONLINE,
        status: ReservationStatus.CONFIRMED,
      }), expect.anything());
    });

    it('should fail if online reservation is disabled', async () => {
      const gamingCenter = {
        id: gamingCenterId,
        settings: { allowOnlineBooking: false },
      };
      MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue(gamingCenter /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

      await expect(reservationStation.createPublicReservation(gamingCenterSlug, {
        startTime: '2027-06-06T10:00:00Z',
      } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any)).rejects.toThrow('Online reservation is disabled.');
    });

    it('should fail if there is an overlapping reservation', async () => {
      const input = {
        stationId,
        staffId,
        startTime: '2027-06-06T10:00:00Z',
        customer: { fullName: 'Jane Doe', phone: '09998887766' },
      };

      const gamingCenter = {
        id: gamingCenterId,
        settings: { allowOnlineBooking: true, timeZone: 'UTC' },
      };
      const station = { id: stationId, defaultDurationHours: 1, isActive: true };
      const staff = { id: staffId };
      const staffShift = { id: 'shift-1', startTime: '00:00', endTime: '23:59' };

      MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue(gamingCenter /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedReservationRepo.findStation.mockResolvedValue(station /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedReservationRepo.findStaff.mockResolvedValue(staff /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedReservationRepo.findStaffShift.mockResolvedValue(staffShift /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);
      MockedReservationRepo.findOverlappingReservation.mockResolvedValue({ id: 'existing-res' } /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

      await expect(reservationStation.createPublicReservation(gamingCenterSlug, input))
        .rejects.toThrow('Selected time is not available.');
    });
  });
});
