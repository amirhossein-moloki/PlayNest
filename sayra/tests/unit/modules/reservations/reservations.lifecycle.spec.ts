import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { reservationStation } from '../../../../src/modules/reservation/reservation.station';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { walletService } from '../../../../src/modules/wallet/wallet.station';
import { discountsStation } from '../../../../src/modules/discounts/discounts.station';
import { ReservationStatus, SessionActorType, UserRole } from '@prisma/client';

jest.mock('../../../../src/modules/reservation/reservation.repo');
jest.mock('../../../../src/modules/wallet/wallet.station');
jest.mock('../../../../src/modules/discounts/discounts.station');
jest.mock('../../../../src/modules/audit/audit.station');
jest.mock('../../../../src/common/events/event-emitter');

const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;
const MockedWalletService = walletService as jest.Mocked<typeof walletService>;
const MockedDiscountsStation = discountsStation as jest.Mocked<typeof discountsStation>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Reservation Lifecycle & Rescheduling Application Tests', () => {
  const gamingCenterId = 'gc-100';
  const reservationId = 'res-100';
  const stationId = 'st-100';
  const staffId = 'staff-100';
  const actor = { id: 'usr-1', role: UserRole.MANAGER, actorType: SessionActorType.USER };

  const futureDate = new Date(Date.now() + 24 * 3600 * 1000); // Tomorrow
  futureDate.setUTCHours(12, 0, 0, 0); // 12:00 UTC tomorrow
  const pastDate = new Date(Date.now() - 2 * 3600 * 1000); // 2 hours ago

  const mockBaseReservation = {
    id: reservationId,
    gamingCenterId,
    stationId,
    staffId,
    status: ReservationStatus.CONFIRMED,
    startTime: futureDate,
    endTime: new Date(futureDate.getTime() + 2 * 3600 * 1000),
    totalHours: 2,
    totalPrice: 100,
    stationSnapshot: { hourlyPrice: 50 },
  };

  const mockGamingCenter = {
    id: gamingCenterId,
    openingTime: '00:00',
    closingTime: '23:59',
    settings: {
      minAdvanceBookingMinutes: 30,
      timeZone: 'UTC',
      preventOverlaps: true,
      workStartTime: '00:00',
      workEndTime: '23:59',
    },
  };

  const mockStation = {
    id: stationId,
    gamingCenterId,
    isActive: true,
    hourlyPrice: 50,
    defaultDurationHours: 2,
    name: 'PC-VIP',
    stationType: 'PC',
  };

  const mockStaffShift = {
    id: 'shift-1',
    gamingCenterId,
    userId: staffId,
    dayOfWeek: futureDate.getUTCDay(),
    startTime: '00:00',
    endTime: '23:59',
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MockedReservationRepo.transaction.mockImplementation(async (fn) => fn({} as any));
    MockedDiscountsStation.calculateApplicableDiscount.mockResolvedValue({ applicableDiscount: null, discountAmount: 0 });
    MockedReservationRepo.findGamingCenterWithSettings.mockResolvedValue(mockGamingCenter as any);
    MockedReservationRepo.findStation.mockResolvedValue(mockStation as any);
    MockedReservationRepo.findStaff.mockResolvedValue({ id: staffId } as any);
    MockedReservationRepo.findStaffShift.mockResolvedValue(mockStaffShift as any);
    MockedReservationRepo.findOverlappingMaintenance.mockResolvedValue([]);
    MockedReservationRepo.findOverlappingReservation.mockResolvedValue(null);
    MockedWalletService.refundReservationToWallet.mockResolvedValue(undefined as any);
  });

  describe('Cancellation Idempotency & History', () => {
    it('should cancel CONFIRMED reservation, record history, and refund wallet', async () => {
      MockedReservationRepo.findReservationById.mockResolvedValue(mockBaseReservation as any);
      MockedReservationRepo.updateReservationWithInclude.mockResolvedValue({
        ...mockBaseReservation,
        status: ReservationStatus.CANCELED,
      } as any);

      const result = await reservationStation.cancelReservation(
        reservationId,
        gamingCenterId,
        actor,
        { reason: 'User requested' }
      );

      expect(result.status).toBe(ReservationStatus.CANCELED);
      expect(MockedReservationRepo.createHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          reservationId,
          fromStatus: ReservationStatus.CONFIRMED,
          toStatus: ReservationStatus.CANCELED,
          action: 'CANCEL',
        }),
        expect.anything()
      );
      expect(MockedWalletService.refundReservationToWallet).toHaveBeenCalledWith(reservationId, expect.anything());
    });

    it('should return already CANCELED reservation idempotently without duplicate refund or history', async () => {
      const canceledRes = { ...mockBaseReservation, status: ReservationStatus.CANCELED };
      MockedReservationRepo.findReservationById.mockResolvedValue(canceledRes as any);

      const result = await reservationStation.cancelReservation(
        reservationId,
        gamingCenterId,
        actor,
        { reason: 'User requested' }
      );

      expect(result.status).toBe(ReservationStatus.CANCELED);
      expect(MockedReservationRepo.createHistory).not.toHaveBeenCalled();
      expect(MockedWalletService.refundReservationToWallet).not.toHaveBeenCalled();
    });

    it('should handle concurrent double-cancellation safely', async () => {
      MockedReservationRepo.findReservationById.mockResolvedValue(mockBaseReservation as any);
      MockedReservationRepo.updateReservationWithInclude.mockResolvedValue({
        ...mockBaseReservation,
        status: ReservationStatus.CANCELED,
      } as any);

      const [res1, res2] = await Promise.all([
        reservationStation.cancelReservation(reservationId, gamingCenterId, actor, { reason: 'Req 1' }),
        reservationStation.cancelReservation(reservationId, gamingCenterId, actor, { reason: 'Req 2' }),
      ]);

      expect(res1.status).toBe(ReservationStatus.CANCELED);
      expect(res2.status).toBe(ReservationStatus.CANCELED);
    });
  });

  describe('Mark as No-Show Preconditions', () => {
    it('should throw error if attempting to mark no-show BEFORE startTime', async () => {
      MockedReservationRepo.findReservationById.mockResolvedValue(mockBaseReservation as any);

      await expect(
        reservationStation.markAsNoShow(reservationId, gamingCenterId, actor)
      ).rejects.toThrow('Reservation start time has not yet passed for no-show marking.');
    });

    it('should mark no-show successfully when startTime has passed', async () => {
      const pastReservation = {
        ...mockBaseReservation,
        startTime: pastDate,
        endTime: new Date(pastDate.getTime() + 2 * 3600 * 1000),
      };
      MockedReservationRepo.findReservationById.mockResolvedValue(pastReservation as any);
      MockedReservationRepo.updateReservation.mockResolvedValue({
        ...pastReservation,
        status: ReservationStatus.NO_SHOW,
      } as any);

      const result = await reservationStation.markAsNoShow(reservationId, gamingCenterId, actor);

      expect(result.status).toBe(ReservationStatus.NO_SHOW);
      expect(MockedReservationRepo.createHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          reservationId,
          fromStatus: ReservationStatus.CONFIRMED,
          toStatus: ReservationStatus.NO_SHOW,
          action: 'NO_SHOW',
        }),
        expect.anything()
      );
    });
  });

  describe('Rescheduling Operational Constraints', () => {
    it('should reject rescheduling if reservation is in terminal state', async () => {
      const completedRes = { ...mockBaseReservation, status: ReservationStatus.COMPLETED };
      MockedReservationRepo.findReservationById.mockResolvedValue(completedRes as any);

      await expect(
        reservationStation.rescheduleReservation(reservationId, gamingCenterId, {
          startTime: futureDate.toISOString(),
        }, actor)
      ).rejects.toThrow('Cannot reschedule a reservation in terminal state');
    });

    it('should reject rescheduling if requested start time violates lead time rule (BR-001)', async () => {
      MockedReservationRepo.findReservationById.mockResolvedValue(mockBaseReservation as any);
      const tooSoonDate = new Date(Date.now() + 10 * 60 * 1000); // Only 10 mins lead time

      await expect(
        reservationStation.rescheduleReservation(reservationId, gamingCenterId, {
          startTime: tooSoonDate.toISOString(),
        }, actor)
      ).rejects.toThrow('Reservation must be booked at least 30 minutes in advance.');
    });

    it('should reject rescheduling if station has overlapping maintenance', async () => {
      MockedReservationRepo.findReservationById.mockResolvedValue(mockBaseReservation as any);
      MockedReservationRepo.findOverlappingMaintenance.mockResolvedValue([{ id: 'maint-1' }] as any);

      await expect(
        reservationStation.rescheduleReservation(reservationId, gamingCenterId, {
          startTime: futureDate.toISOString(),
        }, actor)
      ).rejects.toThrow('Station is under maintenance during the requested time.');
    });

    it('should reject rescheduling if slot overlaps with existing active reservation', async () => {
      MockedReservationRepo.findReservationById.mockResolvedValue(mockBaseReservation as any);
      MockedReservationRepo.findOverlappingReservation.mockResolvedValue({ id: 'res-other' } as any);

      await expect(
        reservationStation.rescheduleReservation(reservationId, gamingCenterId, {
          startTime: futureDate.toISOString(),
        }, actor)
      ).rejects.toThrow('Reservation overlaps with another reservation.');
    });

    it('should reschedule successfully when all constraints pass and record history', async () => {
      const newStartAt = new Date();
      newStartAt.setUTCDate(newStartAt.getUTCDate() + 1);
      newStartAt.setUTCHours(10, 0, 0, 0);

      MockedReservationRepo.findReservationById.mockResolvedValue(mockBaseReservation as any);
      MockedReservationRepo.updateReservation.mockResolvedValue({
        ...mockBaseReservation,
        startTime: newStartAt,
        endTime: new Date(newStartAt.getTime() + 2 * 3600 * 1000),
      } as any);

      const result = await reservationStation.rescheduleReservation(reservationId, gamingCenterId, {
        startTime: newStartAt.toISOString(),
        reason: 'Client requested reschedule',
      }, actor);

      expect(result.startTime).toEqual(newStartAt);
      expect(MockedReservationRepo.createHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          reservationId,
          action: 'RESCHEDULE',
          reason: 'Client requested reschedule',
        }),
        expect.anything()
      );
    });
  });
});
