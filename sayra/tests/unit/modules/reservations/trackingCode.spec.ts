import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { reservationStation } from '../../../../src/modules/reservation/reservation.station';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { ReservationStatus, ReservationPaymentState, SessionActorType, UserRole } from '@prisma/client';

jest.mock('../../../../src/modules/reservation/reservation.repo');
jest.mock('../../../../src/modules/audit/audit.station');
jest.mock('../../../../src/modules/gamingSessions/gamingSessions.station');

const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Tracking Code & Check-In Service Unit Tests', () => {
  const gamingCenterId = 'gc-100';
  const reservationId = 'res-100';
  const staffId = 'staff-100';
  const trackingCode = 'K7M9P2R4';

  const actor = {
    id: staffId,
    role: UserRole.STAFF,
    actorType: SessionActorType.USER,
  };

  const mockBaseReservation = {
    id: reservationId,
    gamingCenterId,
    trackingCode,
    status: ReservationStatus.CONFIRMED,
    paymentState: ReservationPaymentState.PAID,
    startTime: new Date('2026-12-15T14:00:00Z'),
    endTime: new Date('2026-12-15T16:00:00Z'),
    checkedInAt: null,
    station: {
      id: 'st-1',
      name: 'PC-VIP-01',
      stationType: 'PC',
    },
    customerAccount: {
      id: 'cust-1',
      fullName: 'Ali Rezaei',
    },
    customerProfile: {
      id: 'prof-1',
      displayName: 'Ali Rezaei',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MockedReservationRepo.transaction.mockImplementation(async (fn) => fn({} as any));
  });

  describe('lookupReservationByTrackingCode', () => {
    it('should normalize tracking code and return minimal operational data for valid reservation', async () => {
      MockedReservationRepo.findReservationByTrackingCode.mockResolvedValue(mockBaseReservation as any);
      MockedReservationRepo.findGamingCenterWithSettings.mockResolvedValue({
        id: gamingCenterId,
        settings: { timeZone: 'Asia/Tehran' },
      } as any);

      const result = await reservationStation.lookupReservationByTrackingCode(gamingCenterId, '  k7m9-p2r4  ');

      expect(MockedReservationRepo.findReservationByTrackingCode).toHaveBeenCalledWith(gamingCenterId, 'K7M9P2R4');
      expect(result).toMatchObject({
        id: reservationId,
        trackingCode,
        status: ReservationStatus.CONFIRMED,
        paymentState: ReservationPaymentState.PAID,
        isEligibleForCheckIn: true,
        checkInIneligibilityReason: null,
        station: {
          id: 'st-1',
          name: 'PC-VIP-01',
          stationType: 'PC',
        },
        customer: {
          displayName: 'Ali Rezaei',
        },
      });
      expect(result.siteTimezone).toBe('Asia/Tehran');
      expect(result.localStartTime).toBe('2026-12-15 17:30'); // UTC +3.5
    });

    it('should throw 404 when tracking code is not found or belongs to another gaming center', async () => {
      MockedReservationRepo.findReservationByTrackingCode.mockResolvedValue(null);

      await expect(
        reservationStation.lookupReservationByTrackingCode(gamingCenterId, 'UNKNOWN99')
      ).rejects.toThrow('Reservation not found for this tracking code.');
    });

    it('should mark reservation as ineligible for check-in if canceled or already checked in', async () => {
      const canceledRes = { ...mockBaseReservation, status: ReservationStatus.CANCELED };
      MockedReservationRepo.findReservationByTrackingCode.mockResolvedValue(canceledRes as any);
      MockedReservationRepo.findGamingCenterWithSettings.mockResolvedValue({
        id: gamingCenterId,
        settings: { timeZone: 'UTC' },
      } as any);

      const result = await reservationStation.lookupReservationByTrackingCode(gamingCenterId, trackingCode);

      expect(result.isEligibleForCheckIn).toBe(false);
      expect(result.checkInIneligibilityReason).toBe('Reservation is canceled.');
    });
  });

  describe('checkInReservation', () => {
    it('should check in CONFIRMED reservation atomically and transition to IN_PROGRESS', async () => {
      MockedReservationRepo.findReservationByTrackingCode.mockResolvedValue(mockBaseReservation as any);
      MockedReservationRepo.updateReservation.mockResolvedValue({
        ...mockBaseReservation,
        status: ReservationStatus.IN_PROGRESS,
        checkedInAt: new Date(),
        checkedInByUserId: staffId,
      } as any);

      const result = await reservationStation.checkInReservation(trackingCode, gamingCenterId, actor);

      expect(result.status).toBe(ReservationStatus.IN_PROGRESS);
      expect(MockedReservationRepo.createHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          reservationId,
          fromStatus: ReservationStatus.CONFIRMED,
          toStatus: ReservationStatus.IN_PROGRESS,
          action: 'CHECK_IN',
          actorId: staffId,
        }),
        expect.anything()
      );
    });

    it('should return already checked-in reservation idempotently without duplicate side effects', async () => {
      const alreadyCheckedInRes = {
        ...mockBaseReservation,
        status: ReservationStatus.IN_PROGRESS,
        checkedInAt: new Date('2026-12-15T14:05:00Z'),
      };
      MockedReservationRepo.findReservationByTrackingCode.mockResolvedValue(alreadyCheckedInRes as any);

      const result = await reservationStation.checkInReservation(trackingCode, gamingCenterId, actor);

      expect(result.status).toBe(ReservationStatus.IN_PROGRESS);
      expect(MockedReservationRepo.updateReservation).not.toHaveBeenCalled();
      expect(MockedReservationRepo.createHistory).not.toHaveBeenCalled();
    });

    it('should reject check-in for CANCELED or EXPIRED reservations', async () => {
      const expiredRes = { ...mockBaseReservation, status: ReservationStatus.EXPIRED };
      MockedReservationRepo.findReservationByTrackingCode.mockResolvedValue(expiredRes as any);

      await expect(
        reservationStation.checkInReservation(trackingCode, gamingCenterId, actor)
      ).rejects.toThrow('Reservation in state EXPIRED is not eligible for check-in.');
    });
  });
});
