import {
  GamingSession,
  GamingSessionStatus,
  Prisma,
  ReservationStatus,
  SessionActorType,
  UserRole,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { GamingSessionsRepo } from './gamingSessions.repo';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { GamingSessionStateMachine } from './gamingSessions.state-machine';
import { AppEvents, eventEmitter } from '../../common/events/event-emitter';
import { commissionsStation } from '../commissions/commissions.station';
import { GroupBookingRepo } from '../group-booking/group-booking.repo';

export const gamingSessionsStation = {
  async startSession(
    reservationId: string,
    stationId?: string,
    gamingCenterIdOrTx?: string | Prisma.TransactionClient,
    actor?: { id: string; role?: UserRole; actorType?: SessionActorType },
    context?: { ip?: string; userAgent?: string },
    passedTx?: Prisma.TransactionClient
  ): Promise<GamingSession> {
    const isTx = gamingCenterIdOrTx && typeof gamingCenterIdOrTx === 'object' && '$executeRaw' in (gamingCenterIdOrTx as any);
    const gamingCenterId = isTx ? undefined : (gamingCenterIdOrTx as string | undefined);
    const tx = isTx ? (gamingCenterIdOrTx as Prisma.TransactionClient) : passedTx;

    const execute = async (client: Prisma.TransactionClient) => {
      // 1. Fetch reservation
      const reservation = await client.reservation.findUnique({
        where: { id: reservationId },
        include: { station: true },
      });

      if (!reservation) {
        throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
      }

      // 2. Validate tenant isolation / gamingCenter match
      if (gamingCenterId && reservation.gamingCenterId !== gamingCenterId) {
        throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
      }

      // 3. Resolve and validate game station
      const effectiveStationId = stationId || reservation.stationId;
      if (!effectiveStationId) {
        throw new AppError('Reservation has no assigned station.', httpStatus.BAD_REQUEST);
      }

      // Verify station exists and belongs to the gaming center
      const station = await client.gameStation.findFirst({
        where: {
          id: effectiveStationId,
          gamingCenterId: reservation.gamingCenterId,
        },
      });

      if (!station) {
        throw new AppError('GameStation not found for this gaming center.', httpStatus.NOT_FOUND);
      }

      // 4. Validate reservation status permits starting a session
      if (
        reservation.status !== ReservationStatus.CONFIRMED &&
        reservation.status !== ReservationStatus.IN_PROGRESS
      ) {
        throw new AppError(
          `Reservation status ${reservation.status} does not allow starting a session.`,
          httpStatus.CONFLICT,
          { code: 'INVALID_STATUS' }
        );
      }

      // 5. Ensure no active session currently exists for this reservation
      const existingActive = await GamingSessionsRepo.findActiveSessionByReservationId(reservationId, client);
      if (existingActive) {
        throw new AppError('An active session already exists for this reservation.', httpStatus.CONFLICT, {
          code: 'SESSION_ALREADY_ACTIVE',
        });
      }

      // 6. Atomically transition reservation to IN_PROGRESS if currently CONFIRMED
      if (reservation.status === ReservationStatus.CONFIRMED) {
        await client.reservation.update({
          where: { id: reservationId },
          data: { status: ReservationStatus.IN_PROGRESS },
        });

        await client.reservationHistory.create({
          data: {
            reservationId,
            fromStatus: ReservationStatus.CONFIRMED,
            toStatus: ReservationStatus.IN_PROGRESS,
            action: 'START_SESSION',
            actorId: actor?.id,
            actorType: actor?.actorType,
          },
        });

        if (reservation.groupBookingId && typeof GroupBookingRepo?.syncParentGroupBookingStatus === 'function') {
          await GroupBookingRepo.syncParentGroupBookingStatus(reservation.groupBookingId, client);
        }
      }

      // 7. Create the active gaming session
      const session = await GamingSessionsRepo.createSession({
        reservationId,
        stationId: effectiveStationId,
        startTime: new Date(),
        status: GamingSessionStatus.ACTIVE,
      }, client);

      return session;
    };

    if (tx) {
      return execute(tx);
    }
    return prisma.$transaction(execute);
  },

  async pauseSession(
    reservationId: string,
    gamingCenterIdOrTx?: string | Prisma.TransactionClient,
    actor?: { id: string; role?: UserRole; actorType?: SessionActorType },
    context?: { ip?: string; userAgent?: string },
    passedTx?: Prisma.TransactionClient
  ): Promise<GamingSession> {
    const isTx = gamingCenterIdOrTx && typeof gamingCenterIdOrTx === 'object' && '$executeRaw' in (gamingCenterIdOrTx as any);
    const gamingCenterId = isTx ? undefined : (gamingCenterIdOrTx as string | undefined);
    const tx = isTx ? (gamingCenterIdOrTx as Prisma.TransactionClient) : passedTx;

    const execute = async (client: Prisma.TransactionClient) => {
      if (gamingCenterId) {
        const reservation = await client.reservation.findUnique({
          where: { id: reservationId },
        });
        if (!reservation || reservation.gamingCenterId !== gamingCenterId) {
          throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
        }
      }

      const session = await GamingSessionsRepo.findActiveOrPausedSessionByReservationId(reservationId, client);
      if (!session) {
        throw new AppError('No active session found for this reservation.', httpStatus.NOT_FOUND);
      }

      GamingSessionStateMachine.validateTransition(session.status, GamingSessionStatus.PAUSED);

      return GamingSessionsRepo.updateSession(session.id, {
        status: GamingSessionStatus.PAUSED,
        pausedAt: new Date(),
      }, client);
    };

    if (tx) {
      return execute(tx);
    }
    return prisma.$transaction(execute);
  },

  async resumeSession(
    reservationId: string,
    gamingCenterIdOrTx?: string | Prisma.TransactionClient,
    actor?: { id: string; role?: UserRole; actorType?: SessionActorType },
    context?: { ip?: string; userAgent?: string },
    passedTx?: Prisma.TransactionClient
  ): Promise<GamingSession> {
    const isTx = gamingCenterIdOrTx && typeof gamingCenterIdOrTx === 'object' && '$executeRaw' in (gamingCenterIdOrTx as any);
    const gamingCenterId = isTx ? undefined : (gamingCenterIdOrTx as string | undefined);
    const tx = isTx ? (gamingCenterIdOrTx as Prisma.TransactionClient) : passedTx;

    const execute = async (client: Prisma.TransactionClient) => {
      if (gamingCenterId) {
        const reservation = await client.reservation.findUnique({
          where: { id: reservationId },
        });
        if (!reservation || reservation.gamingCenterId !== gamingCenterId) {
          throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
        }
      }

      const session = await GamingSessionsRepo.findActiveOrPausedSessionByReservationId(reservationId, client);
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
      }, client);
    };

    if (tx) {
      return execute(tx);
    }
    return prisma.$transaction(execute);
  },

  async endSession(
    reservationId: string,
    gamingCenterIdOrTx?: string | Prisma.TransactionClient,
    actor?: { id: string; role?: UserRole; actorType?: SessionActorType },
    context?: { ip?: string; userAgent?: string },
    passedTx?: Prisma.TransactionClient
  ): Promise<GamingSession> {
    const isTx = gamingCenterIdOrTx && typeof gamingCenterIdOrTx === 'object' && '$executeRaw' in (gamingCenterIdOrTx as any);
    const gamingCenterId = isTx ? undefined : (gamingCenterIdOrTx as string | undefined);
    const tx = isTx ? (gamingCenterIdOrTx as Prisma.TransactionClient) : passedTx;

    const execute = async (client: Prisma.TransactionClient) => {
      // 1. Fetch reservation
      const reservation = await client.reservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation) {
        throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
      }

      if (gamingCenterId && reservation.gamingCenterId !== gamingCenterId) {
        throw new AppError('Reservation not found.', httpStatus.NOT_FOUND);
      }

      // 2. Find active or paused session
      const session = await GamingSessionsRepo.findActiveOrPausedSessionByReservationId(reservationId, client);
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

      const completedSession = await GamingSessionsRepo.updateSession(session.id, {
        endTime,
        actualHours: Math.max(0, actualHours),
        status: GamingSessionStatus.COMPLETED,
        pausedAt: null,
        pausedMinutes: totalPausedMinutes,
      }, client);

      // 3. Atomically transition reservation to COMPLETED if currently IN_PROGRESS
      let completedReservation = null;
      if (reservation.status === ReservationStatus.IN_PROGRESS) {
        completedReservation = await client.reservation.update({
          where: { id: reservationId },
          data: {
            status: ReservationStatus.COMPLETED,
            completedAt: endTime,
          },
        });

        await client.reservationHistory.create({
          data: {
            reservationId,
            fromStatus: ReservationStatus.IN_PROGRESS,
            toStatus: ReservationStatus.COMPLETED,
            action: 'COMPLETE_SESSION',
            actorId: actor?.id,
            actorType: actor?.actorType,
          },
        });

        if (reservation.groupBookingId && typeof GroupBookingRepo?.syncParentGroupBookingStatus === 'function') {
          await GroupBookingRepo.syncParentGroupBookingStatus(reservation.groupBookingId, client);
        }
      }

      return { completedSession, completedReservation };
    };

    if (tx) {
      const { completedSession } = await execute(tx);
      return completedSession;
    }

    const { completedSession, completedReservation } = await prisma.$transaction(execute);
    if (completedReservation) {
      eventEmitter.emit(AppEvents.RESERVATION_COMPLETED, { reservation: completedReservation });
      await commissionsStation.calculateCommission(reservationId).catch(() => {});
    }
    return completedSession;
  },
};
