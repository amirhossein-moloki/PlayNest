import { GamingSession, GamingSessionStatus, Prisma } from '@prisma/client';
import { GamingSessionsRepo } from './gamingSessions.repo';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { GamingSessionStateMachine } from './gamingSessions.state-machine';

export const gamingSessionsStation = {
  async startSession(reservationId: string, stationId: string, tx?: Prisma.TransactionClient): Promise<GamingSession> {
    // Ensure no other active session for this reservation
    const existing = await GamingSessionsRepo.findActiveSessionByReservationId(reservationId, tx);
    if (existing) {
      throw new AppError('An active session already exists for this reservation.', httpStatus.CONFLICT);
    }

    return GamingSessionsRepo.createSession({
      reservationId,
      stationId,
      startTime: new Date(),
      status: GamingSessionStatus.ACTIVE,
    }, tx);
  },

  async pauseSession(reservationId: string, tx?: Prisma.TransactionClient): Promise<GamingSession> {
    const session = await GamingSessionsRepo.findActiveOrPausedSessionByReservationId(reservationId, tx);
    if (!session) {
      throw new AppError('No active session found for this reservation.', httpStatus.NOT_FOUND);
    }

    GamingSessionStateMachine.validateTransition(session.status, GamingSessionStatus.PAUSED);

    return GamingSessionsRepo.updateSession(session.id, {
      status: GamingSessionStatus.PAUSED,
      pausedAt: new Date(),
    }, tx);
  },

  async resumeSession(reservationId: string, tx?: Prisma.TransactionClient): Promise<GamingSession> {
    const session = await GamingSessionsRepo.findActiveOrPausedSessionByReservationId(reservationId, tx);

    if (!session) {
      throw new AppError('No paused session found for this reservation.', httpStatus.NOT_FOUND);
    }

    GamingSessionStateMachine.validateTransition(session.status, GamingSessionStatus.ACTIVE);

    const now = new Date();
    const pausedMinutes = session.pausedAt
      ? Math.floor((now.getTime() - session.pausedAt.getTime()) / (1000 * 60))
      : 0;

    return GamingSessionsRepo.updateSession(session.id, {
      status: GamingSessionStatus.ACTIVE,
      pausedAt: null,
      pausedMinutes: { increment: pausedMinutes },
    }, tx);
  },

  async endSession(reservationId: string, tx?: Prisma.TransactionClient): Promise<GamingSession> {
    const session = await GamingSessionsRepo.findActiveOrPausedSessionByReservationId(reservationId, tx);

    if (!session) {
      throw new AppError('No active or paused session found for this reservation.', httpStatus.NOT_FOUND);
    }

    GamingSessionStateMachine.validateTransition(session.status, GamingSessionStatus.COMPLETED);

    const endTime = new Date();
    let totalPausedMinutes = session.pausedMinutes;

    if (session.status === GamingSessionStatus.PAUSED && session.pausedAt) {
      totalPausedMinutes += Math.floor((endTime.getTime() - session.pausedAt.getTime()) / (1000 * 60));
    }

    const actualHours = (endTime.getTime() - session.startTime.getTime() - totalPausedMinutes * 60 * 1000) / (1000 * 60 * 60);

    return GamingSessionsRepo.updateSession(session.id, {
      endTime,
      actualHours: Math.max(0, actualHours),
      status: GamingSessionStatus.COMPLETED,
      pausedAt: null,
      pausedMinutes: totalPausedMinutes,
    }, tx);
  }
};
