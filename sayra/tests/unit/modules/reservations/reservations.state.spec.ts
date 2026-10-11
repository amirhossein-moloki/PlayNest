import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { reservationStation } from '../../../../src/modules/reservation/reservation.station';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { gamingSessionsStation } from '../../../../src/modules/gamingSessions/gamingSessions.station';
import { ReservationStatus, SessionActorType, UserRole } from '@prisma/client';

jest.mock('../../../../src/modules/reservation/reservation.repo');
jest.mock('../../../../src/modules/gamingSessions/gamingSessions.station');
jest.mock('../../../../src/modules/commissions/commissions.station', () => ({
  commissionsStation: {
    calculateCommission: jest.fn().mockImplementation(() => Promise.resolve()),
  },
}));
jest.mock('../../../../src/modules/audit/audit.station');
jest.mock('../../../../src/common/events/event-emitter');

const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;
const MockedgamingSessionsStation = gamingSessionsStation as jest.Mocked<typeof gamingSessionsStation>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Reservation State Machine', () => {
  const gamingCenterId = 'gc-1';
  const reservationId = 'res-1';
  const actor = { id: 'u-admin', role: UserRole.MANAGER, actorType: SessionActorType.USER };

  beforeEach(() => {
    jest.clearAllMocks();
    MockedReservationRepo.transaction.mockImplementation(async (fn) => fn({} as any));
  });

  describe('startReservation', () => {
    it('should transition from CONFIRMED to IN_PROGRESS and start a session', async () => {
      const reservation = { id: reservationId, status: ReservationStatus.CONFIRMED, stationId: 'st-1' };
      const updated = { ...reservation, status: ReservationStatus.IN_PROGRESS };

      MockedReservationRepo.findReservationById.mockResolvedValue(reservation as any);
      MockedReservationRepo.updateReservation.mockResolvedValue(updated as any);

      const result = await reservationStation.startReservation(reservationId, gamingCenterId, actor);

      expect(result.status).toBe(ReservationStatus.IN_PROGRESS);
      expect(MockedgamingSessionsStation.startSession).toHaveBeenCalledWith(reservationId, 'st-1', expect.anything());
    });

    it('should throw error if reservation is not CONFIRMED', async () => {
      const reservation = { id: reservationId, status: ReservationStatus.PENDING };
      MockedReservationRepo.findReservationById.mockResolvedValue(reservation as any);

      await expect(reservationStation.startReservation(reservationId, gamingCenterId, actor))
        .rejects.toThrow('Invalid state transition from PENDING to IN_PROGRESS');
    });
  });

  describe('completeReservation', () => {
    it('should complete reservation from CONFIRMED state (no session)', async () => {
      const reservation = { id: reservationId, status: ReservationStatus.CONFIRMED };
      const updated = { ...reservation, status: ReservationStatus.COMPLETED };

      MockedReservationRepo.findReservationById.mockResolvedValue(reservation as any);
      MockedReservationRepo.updateReservation.mockResolvedValue(updated as any);

      const result = await reservationStation.completeReservation(reservationId, gamingCenterId, actor);

      expect(result.status).toBe(ReservationStatus.COMPLETED);
      expect(MockedgamingSessionsStation.endSession).not.toHaveBeenCalled();
    });

    it('should complete reservation from IN_PROGRESS state and end session', async () => {
      const reservation = { id: reservationId, status: ReservationStatus.IN_PROGRESS };
      const updated = { ...reservation, status: ReservationStatus.COMPLETED };

      MockedReservationRepo.findReservationById.mockResolvedValue(reservation as any);
      MockedReservationRepo.updateReservation.mockResolvedValue(updated as any);

      const result = await reservationStation.completeReservation(reservationId, gamingCenterId, actor);

      expect(result.status).toBe(ReservationStatus.COMPLETED);
      expect(MockedgamingSessionsStation.endSession).toHaveBeenCalledWith(reservationId, expect.anything());
    });
  });
});
