import { GamingSession, GamingSessionStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

const getClient = (tx?: Prisma.TransactionClient) => {
  if (tx && typeof (tx as unknown as Record<string, unknown>).gamingSession === 'object' && (tx as unknown as Record<string, unknown>).gamingSession !== null) {
    return tx;
  }
  return prisma;
};

export const GamingSessionsRepo = {
  async createSession(data: Prisma.GamingSessionUncheckedCreateInput, tx?: Prisma.TransactionClient): Promise<GamingSession> {
    const client = getClient(tx);
    return client.gamingSession.create({ data });
  },

  async findActiveSessionByReservationId(reservationId: string, tx?: Prisma.TransactionClient): Promise<GamingSession | null> {
    const client = getClient(tx);
    return client.gamingSession.findFirst({
      where: {
        reservationId,
        status: GamingSessionStatus.ACTIVE,
      },
    });
  },

  async findPausedSessionByReservationId(reservationId: string, tx?: Prisma.TransactionClient): Promise<GamingSession | null> {
    const client = getClient(tx);
    return client.gamingSession.findFirst({
      where: {
        reservationId,
        status: GamingSessionStatus.PAUSED,
      },
    });
  },

  async findActiveOrPausedSessionByReservationId(reservationId: string, tx?: Prisma.TransactionClient): Promise<GamingSession | null> {
    const client = getClient(tx);
    return client.gamingSession.findFirst({
      where: {
        reservationId,
        status: { in: [GamingSessionStatus.ACTIVE, GamingSessionStatus.PAUSED] },
      },
    });
  },

  async updateSession(sessionId: string, data: Prisma.GamingSessionUpdateInput, tx?: Prisma.TransactionClient): Promise<GamingSession> {
    const client = getClient(tx);
    return client.gamingSession.update({
      where: { id: sessionId },
      data,
    });
  },

  async findSessionById(sessionId: string, tx?: Prisma.TransactionClient): Promise<GamingSession | null> {
    const client = getClient(tx);
    return client.gamingSession.findUnique({
      where: { id: sessionId },
    });
  }
};
