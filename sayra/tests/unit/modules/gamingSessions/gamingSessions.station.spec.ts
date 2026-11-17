import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GamingSessionStatus, ReservationStatus, SessionActorType, UserRole } from '@prisma/client';
import { prismaMock } from '../../../mocks/prisma';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: prismaMock,
}));

import { gamingSessionsStation } from '../../../../src/modules/gamingSessions/gamingSessions.station';
import { GamingSessionsRepo } from '../../../../src/modules/gamingSessions/gamingSessions.repo';
import AppError from '../../../../src/common/errors/AppError';
import httpStatus from 'http-status';

const pMock = prismaMock as any;

describe('GamingSessionsStation Unit Tests', () => {
  const centerId = 'center_07';
  const reservationId = 'reservation_07_007';
  const stationId = 'station_07_001';
  const sessionId = 'session_07_001';

  const mockStation = {
    id: stationId,
    gamingCenterId: centerId,
    name: 'PS5 Station 1',
    isActive: true,
  };

  const mockReservation = {
    id: reservationId,
    gamingCenterId: centerId,
    stationId,
    status: ReservationStatus.CONFIRMED,
    station: mockStation,
  };

  const mockActiveSession = {
    id: sessionId,
    reservationId,
    stationId,
    startTime: new Date('2026-11-17T10:00:00Z'),
    endTime: null,
    status: GamingSessionStatus.ACTIVE,
    pausedAt: null,
    pausedMinutes: 0,
    actualHours: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default prisma.$transaction simply calls the callback with pMock
    pMock.$transaction.mockImplementation(async (cb: any) => cb(pMock));
  });

  describe('startSession', () => {
    it('should successfully start a session deriving stationId from reservation when stationId is omitted', async () => {
      pMock.reservation.findUnique.mockResolvedValue(mockReservation);
      pMock.gameStation.findFirst.mockResolvedValue(mockStation);
      jest.spyOn(GamingSessionsRepo, 'findActiveSessionByReservationId').mockResolvedValue(null);
      pMock.reservation.update.mockResolvedValue({
        ...mockReservation,
        status: ReservationStatus.IN_PROGRESS,
      });
      pMock.reservationHistory.create.mockResolvedValue({ id: 'hist_1' });
      jest.spyOn(GamingSessionsRepo, 'createSession').mockResolvedValue(mockActiveSession as any);

      const session = await gamingSessionsStation.startSession(
        reservationId,
        undefined, // stationId omitted!
        centerId,
        { id: 'user_1', role: UserRole.MANAGER, actorType: SessionActorType.USER }
      );

      expect(session).toBeDefined();
      expect(session.id).toBe(sessionId);
      expect(GamingSessionsRepo.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          reservationId,
          stationId, // derived from reservation
          status: GamingSessionStatus.ACTIVE,
        }),
        pMock
      );
      expect(pMock.reservation.update).toHaveBeenCalledWith({
        where: { id: reservationId },
        data: { status: ReservationStatus.IN_PROGRESS },
      });
      expect(pMock.reservationHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reservationId,
            fromStatus: ReservationStatus.CONFIRMED,
            toStatus: ReservationStatus.IN_PROGRESS,
            action: 'START_SESSION',
          }),
        })
      );
    });

    it('should throw NOT_FOUND (404) if reservation does not exist', async () => {
      pMock.reservation.findUnique.mockResolvedValue(null);

      await expect(
        gamingSessionsStation.startSession(reservationId, stationId, centerId)
      ).rejects.toThrow(new AppError('Reservation not found.', httpStatus.NOT_FOUND));
    });

    it('should throw NOT_FOUND (404) if reservation belongs to a different gaming center', async () => {
      pMock.reservation.findUnique.mockResolvedValue({
        ...mockReservation,
        gamingCenterId: 'center_other',
      });

      await expect(
        gamingSessionsStation.startSession(reservationId, stationId, centerId)
      ).rejects.toThrow(new AppError('Reservation not found.', httpStatus.NOT_FOUND));
    });

    it('should throw BAD_REQUEST (400) if reservation has no station assigned', async () => {
      pMock.reservation.findUnique.mockResolvedValue({
        ...mockReservation,
        stationId: null,
      });

      await expect(
        gamingSessionsStation.startSession(reservationId, undefined, centerId)
      ).rejects.toThrow(new AppError('Reservation has no assigned station.', httpStatus.BAD_REQUEST));
    });

    it('should throw NOT_FOUND (404) if station does not belong to the gaming center', async () => {
      pMock.reservation.findUnique.mockResolvedValue(mockReservation);
      pMock.gameStation.findFirst.mockResolvedValue(null);

      await expect(
        gamingSessionsStation.startSession(reservationId, stationId, centerId)
      ).rejects.toThrow(new AppError('GameStation not found for this gaming center.', httpStatus.NOT_FOUND));
    });

    it('should throw CONFLICT (409) if reservation status is PENDING or CANCELED', async () => {
      pMock.reservation.findUnique.mockResolvedValue({
        ...mockReservation,
        status: ReservationStatus.PENDING,
      });
      pMock.gameStation.findFirst.mockResolvedValue(mockStation);

      await expect(
        gamingSessionsStation.startSession(reservationId, stationId, centerId)
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: httpStatus.CONFLICT,
          message: 'Reservation status PENDING does not allow starting a session.',
        })
      );
    });

    it('should throw CONFLICT (409) if an active session already exists', async () => {
      pMock.reservation.findUnique.mockResolvedValue(mockReservation);
      pMock.gameStation.findFirst.mockResolvedValue(mockStation);
      jest.spyOn(GamingSessionsRepo, 'findActiveSessionByReservationId').mockResolvedValue(mockActiveSession as any);

      await expect(
        gamingSessionsStation.startSession(reservationId, stationId, centerId)
      ).rejects.toThrow(
        expect.objectContaining({
          statusCode: httpStatus.CONFLICT,
          message: 'An active session already exists for this reservation.',
        })
      );
    });

    it('should not update reservation status if already IN_PROGRESS', async () => {
      pMock.reservation.findUnique.mockResolvedValue({
        ...mockReservation,
        status: ReservationStatus.IN_PROGRESS,
      });
      pMock.gameStation.findFirst.mockResolvedValue(mockStation);
      jest.spyOn(GamingSessionsRepo, 'findActiveSessionByReservationId').mockResolvedValue(null);
      jest.spyOn(GamingSessionsRepo, 'createSession').mockResolvedValue(mockActiveSession as any);

      await gamingSessionsStation.startSession(reservationId, stationId, centerId);

      expect(pMock.reservation.update).not.toHaveBeenCalled();
      expect(pMock.reservationHistory.create).not.toHaveBeenCalled();
    });
  });

  describe('pauseSession', () => {
    it('should pause an active session and update pausedAt timestamp', async () => {
      pMock.reservation.findUnique.mockResolvedValue(mockReservation);
      jest.spyOn(GamingSessionsRepo, 'findActiveOrPausedSessionByReservationId').mockResolvedValue(mockActiveSession as any);
      const updatedMock = { ...mockActiveSession, status: GamingSessionStatus.PAUSED, pausedAt: new Date() };
      jest.spyOn(GamingSessionsRepo, 'updateSession').mockResolvedValue(updatedMock as any);

      const session = await gamingSessionsStation.pauseSession(reservationId, centerId);

      expect(session.status).toBe(GamingSessionStatus.PAUSED);
      expect(GamingSessionsRepo.updateSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          status: GamingSessionStatus.PAUSED,
        }),
        pMock
      );
    });

    it('should throw NOT_FOUND (404) if no active session found to pause', async () => {
      pMock.reservation.findUnique.mockResolvedValue(mockReservation);
      jest.spyOn(GamingSessionsRepo, 'findActiveOrPausedSessionByReservationId').mockResolvedValue(null);

      await expect(
        gamingSessionsStation.pauseSession(reservationId, centerId)
      ).rejects.toThrow(new AppError('No active session found for this reservation.', httpStatus.NOT_FOUND));
    });
  });

  describe('resumeSession', () => {
    it('should resume a paused session and increment pausedMinutes', async () => {
      const pausedSession = {
        ...mockActiveSession,
        status: GamingSessionStatus.PAUSED,
        pausedAt: new Date(Date.now() - 15 * 60 * 1000), // paused 15 mins ago
      };

      pMock.reservation.findUnique.mockResolvedValue(mockReservation);
      jest.spyOn(GamingSessionsRepo, 'findActiveOrPausedSessionByReservationId').mockResolvedValue(pausedSession as any);
      jest.spyOn(GamingSessionsRepo, 'updateSession').mockResolvedValue({
        ...mockActiveSession,
        status: GamingSessionStatus.ACTIVE,
      } as any);

      const session = await gamingSessionsStation.resumeSession(reservationId, centerId);

      expect(session.status).toBe(GamingSessionStatus.ACTIVE);
      expect(GamingSessionsRepo.updateSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          status: GamingSessionStatus.ACTIVE,
          pausedAt: null,
          pausedMinutes: { increment: expect.any(Number) },
        }),
        pMock
      );
    });
  });

  describe('endSession', () => {
    it('should complete session and atomically update reservation to COMPLETED', async () => {
      const inProgressReservation = {
        ...mockReservation,
        status: ReservationStatus.IN_PROGRESS,
      };

      pMock.reservation.findUnique.mockResolvedValue(inProgressReservation);
      jest.spyOn(GamingSessionsRepo, 'findActiveOrPausedSessionByReservationId').mockResolvedValue(mockActiveSession as any);
      const completedSessionMock = {
        ...mockActiveSession,
        status: GamingSessionStatus.COMPLETED,
        endTime: new Date(),
        actualHours: 1.5,
      };
      jest.spyOn(GamingSessionsRepo, 'updateSession').mockResolvedValue(completedSessionMock as any);
      pMock.reservation.update.mockResolvedValue({
        ...inProgressReservation,
        status: ReservationStatus.COMPLETED,
      });
      pMock.reservationHistory.create.mockResolvedValue({ id: 'hist_2' });

      const session = await gamingSessionsStation.endSession(reservationId, centerId);

      expect(session.status).toBe(GamingSessionStatus.COMPLETED);
      expect(pMock.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: reservationId },
          data: expect.objectContaining({
            status: ReservationStatus.COMPLETED,
          }),
        })
      );
      expect(pMock.reservationHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reservationId,
            fromStatus: ReservationStatus.IN_PROGRESS,
            toStatus: ReservationStatus.COMPLETED,
            action: 'COMPLETE_SESSION',
          }),
        })
      );
    });

    it('should throw NOT_FOUND (404) if session is not active or paused', async () => {
      pMock.reservation.findUnique.mockResolvedValue(mockReservation);
      jest.spyOn(GamingSessionsRepo, 'findActiveOrPausedSessionByReservationId').mockResolvedValue(null);

      await expect(
        gamingSessionsStation.endSession(reservationId, centerId)
      ).rejects.toThrow(new AppError('No active or paused session found for this reservation.', httpStatus.NOT_FOUND));
    });
  });
});

