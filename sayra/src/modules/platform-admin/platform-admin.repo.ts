/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const PlatformAdminRepo = {
  async listAllGamingCenters() {
    return (prisma as any).gamingCenter.findMany({
      include: {
        _count: {
          select: {
            users: true,
            stations: true,
            reservations: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findGamingCenterById(id: string) {
    return (prisma as any).gamingCenter.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            stations: true,
            reservations: true,
          },
        },
      },
    });
  },

  async updateGamingCenter(id: string, data: Prisma.GamingCenterUpdateInput) {
    return (prisma as any).gamingCenter.update({
      where: { id },
      data,
    });
  },

  async listUsers(params: {
    skip: number;
    take: number;
    where: Prisma.UserWhereInput;
  }) {
    const [items, total] = await Promise.all([
      (prisma as any).user.findMany({
        where: params.where,
        skip: params.skip,
        take: params.take,
        include: {
          gamingCenter: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      (prisma as any).user.count({ where: params.where }),
    ]);

    return { items, total };
  },

  async findUserById(id: string) {
    return (prisma as any).user.findUnique({
      where: { id },
      include: {
        gamingCenter: true,
      },
    });
  },

  async updateUser(id: string, data: Prisma.UserUpdateInput) {
    return (prisma as any).user.update({
      where: { id },
      data,
    });
  },

  async revokeUserSessions(userId: string) {
    return (prisma as any).session.updateMany({
      where: {
        actorId: userId,
        actorType: 'USER',
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  },

  async listCustomers(params: {
    skip: number;
    take: number;
    search?: string;
  }) {
    const where: any = params.search
      ? {
        OR: [
          { phone: { contains: params.search } },
          { profiles: { some: { displayName: { contains: params.search, mode: 'insensitive' } } } },
        ],
      }
      : {};

    const [items, total] = await Promise.all([
      (prisma as any).customerAccount.findMany({
        where,
        skip: params.skip,
        take: params.take,
        include: {
          profiles: {
            include: {
              gamingCenter: { select: { id: true, name: true } },
            },
          },
          _count: {
            select: {
              reservations: true,
              walletTransactions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      (prisma as any).customerAccount.count({ where }),
    ]);

    return { items, total };
  },

  async getOperationsOverview() {
    const [totalCenters, totalStations, totalReservations, activeSessions, openTickets] =
      await Promise.all([
        (prisma as any).gamingCenter.count(),
        (prisma as any).gameStation.count(),
        (prisma as any).reservation.count(),
        (prisma as any).gamingSession.count({ where: { status: 'ACTIVE' } }),
        (prisma as any).ticket.count({ where: { status: 'OPEN' } }),
      ]);

    return {
      totalCenters,
      totalStations,
      totalReservations,
      activeSessions,
      openTickets,
    };
  },

  async getFinancialsOverview() {
    const [totalPayments, totalRefunds, paymentsAggregate] = await Promise.all([
      (prisma as any).payment.count(),
      (prisma as any).refund.count(),
      (prisma as any).payment.aggregate({
        where: { status: 'PAID' },
        _sum: {
          amount: true,
        },
      }),
    ]);

    return {
      totalPayments,
      totalRefunds,
      totalCompletedAmount: paymentsAggregate._sum.amount || 0,
    };
  },

  async listAuditLogs(params: {
    skip: number;
    take: number;
    where: Prisma.AuditLogWhereInput;
  }) {
    const [items, total] = await Promise.all([
      (prisma as any).auditLog.findMany({
        where: params.where,
        skip: params.skip,
        take: params.take,
        include: {
          gamingCenter: { select: { id: true, name: true } },
          user: { select: { id: true, fullName: true, phone: true } },
          platformAdmin: { select: { id: true, fullName: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      (prisma as any).auditLog.count({ where: params.where }),
    ]);

    return { items, total };
  },
};
