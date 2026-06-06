import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { reservationsService } from '../../../../src/modules/reservations/reservations.station';
import { ReservationsRepo } from '../../../../src/modules/reservations/reservations.repo';
import { GamingSessionsService } from '../../../../src/modules/gamingSessions/gamingSessions.station';
import { ReservationStatus, SessionActorType, UserRole } from '@prisma/client';

jest.mock('../../../../src/modules/reservations/reservations.repo');
jest.mock('../../../../src/modules/gamingSessions/gamingSessions.station');
jest.mock('../../../../src/modules/commissions/commissions.station', () => ({
  commissionsService: {
    calculateCommission: jest.fn().mockImplementation(() => Promise.resolve()),
  },
}));
jest.mock('../../../../src/modules/audit/audit.station');
jest.mock('../../../../src/common/events/event-emitter');

const MockedReservationsRepo = ReservationsRepo as jest.Mocked<typeof ReservationsRepo>;
const MockedGamingSessionsService = GamingSessionsService as jest.Mocked<typeof GamingSessionsService>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Reservations State Machine', () => {
  const gamingCenterId = 'gc-1';
  const reservationId = 'res-1';
  const actor = { id: 'u-admin', role: UserRole.MANAGER, actorType: SessionActorType.USER };

  beforeEach(() => {
    jest.clearAllMocks();
    MockedReservationsRepo.transaction.mockImplementation(async (fn) => fn({} as any));
  });

  describe('startBooking', () => {
    it('should transition from CONFIRMED to IN_PROGRESS and start a session', async () => {
      const reservation = { id: reservationId, status: ReservationStatus.CONFIRMED, stationId: 'st-1' };
      const updated = { ...reservation, status: ReservationStatus.IN_PROGRESS };

      MockedReservationsRepo.findReservationById.mockResolvedValue(reservation as any);
      MockedReservationsRepo.updateReservation.mockResolvedValue(updated as any);

      const result = await reservationsService.startBooking(reservationId, gamingCenterId, actor);

      expect(result.status).toBe(ReservationStatus.IN_PROGRESS);
      expect(MockedGamingSessionsService.startSession).toHaveBeenCalledWith(reservationId, 'st-1', expect.anything());
    });

    it('should throw error if reservation is not CONFIRMED', async () => {
      const reservation = { id: reservationId, status: ReservationStatus.PENDING };
      MockedReservationsRepo.findReservationById.mockResolvedValue(reservation as any);

      await expect(reservationsService.startBooking(reservationId, gamingCenterId, actor))
        .rejects.toThrow('Invalid state transition from PENDING to IN_PROGRESS');
    });
  });

  describe('completeBooking', () => {
    it('should complete reservation from CONFIRMED state (no session)', async () => {
      const reservation = { id: reservationId, status: ReservationStatus.CONFIRMED };
      const updated = { ...reservation, status: ReservationStatus.COMPLETED };

      MockedReservationsRepo.findReservationById.mockResolvedValue(reservation as any);
      MockedReservationsRepo.updateReservation.mockResolvedValue(updated as any);

      const result = await reservationsService.completeBooking(reservationId, gamingCenterId, actor);

      expect(result.status).toBe(ReservationStatus.COMPLETED);
      expect(MockedGamingSessionsService.endSession).not.toHaveBeenCalled();
    });

    it('should complete reservation from IN_PROGRESS state and end session', async () => {
      const reservation = { id: reservationId, status: ReservationStatus.IN_PROGRESS };
      const updated = { ...reservation, status: ReservationStatus.COMPLETED };

      MockedReservationsRepo.findReservationById.mockResolvedValue(reservation as any);
      MockedReservationsRepo.updateReservation.mockResolvedValue(updated as any);

      const result = await reservationsService.completeBooking(reservationId, gamingCenterId, actor);

      expect(result.status).toBe(ReservationStatus.COMPLETED);
      expect(MockedGamingSessionsService.endSession).toHaveBeenCalledWith(reservationId, expect.anything());
    });
  });
});
