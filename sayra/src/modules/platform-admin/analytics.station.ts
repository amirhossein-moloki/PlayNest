/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../../config/prisma';
import { PlatformAnalyticsReportsQuery } from './analytics.validators';

export const PlatformAnalyticsRepo = {
  async getMetricsForPeriod(start: Date, end: Date, filters: { gamingCenterId?: string; city?: string }) {
    const reservationWhere: any = {
      startTime: {
        gte: start,
        lte: end,
      },
    };

    const paymentWhere: any = {
      paidAt: {
        gte: start,
        lte: end,
      },
    };

    const refundWhere: any = {
      createdAt: {
        gte: start,
        lte: end,
      },
      status: 'SUCCESSFUL',
    };

    const userWhere: any = {
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    if (filters.gamingCenterId) {
      reservationWhere.gamingCenterId = filters.gamingCenterId;
      paymentWhere.gamingCenterId = filters.gamingCenterId;
      refundWhere.gamingCenterId = filters.gamingCenterId;
    } else if (filters.city) {
      reservationWhere.gamingCenter = {
        addresses: {
          some: {
            city: { contains: filters.city, mode: 'insensitive' },
          },
        },
      };
      paymentWhere.gamingCenter = {
        addresses: {
          some: {
            city: { contains: filters.city, mode: 'insensitive' },
          },
        },
      };
      refundWhere.gamingCenter = {
        addresses: {
          some: {
            city: { contains: filters.city, mode: 'insensitive' },
          },
        },
      };
    }

    // 1. Financial queries
    const [paidPaymentsAgg, refundAgg, discountsAgg, earningsAgg] = await Promise.all([
      (prisma as any).payment.aggregate({
        where: { ...paymentWhere, status: 'PAID' },
        _sum: { amount: true },
      }),
      (prisma as any).refund.aggregate({
        where: refundWhere,
        _sum: { amount: true },
      }),
      (prisma as any).reservation.aggregate({
        where: {
          ...reservationWhere,
          status: { in: ['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'] },
        },
        _sum: { discountAmount: true },
      }),
      (prisma as any).earning.aggregate({
        where: {
          reservation: reservationWhere,
        },
        _sum: { commissionAmount: true },
      }),
    ]);

    const totalPaidAmount = paidPaymentsAgg._sum.amount || 0;
    const totalRefundAmount = refundAgg._sum.amount || 0;
    const totalDiscountAmount = discountsAgg._sum.discountAmount || 0;
    const platformCommission = earningsAgg._sum.commissionAmount || 0;
    const totalRevenue = Math.max(0, totalPaidAmount - totalRefundAmount);
    const gamingCentersRevenue = Math.max(0, totalRevenue - platformCommission);

    // 2. Reservation queries
    const [
      totalReservations,
      confirmedReservations,
      pendingReservations,
      cancelledReservations,
      completedReservations,
      expiredReservations,
      durationAgg,
    ] = await Promise.all([
      (prisma as any).reservation.count({ where: reservationWhere }),
      (prisma as any).reservation.count({ where: { ...reservationWhere, status: 'CONFIRMED' } }),
      (prisma as any).reservation.count({ where: { ...reservationWhere, status: 'PENDING' } }),
      (prisma as any).reservation.count({ where: { ...reservationWhere, status: 'CANCELED' } }),
      (prisma as any).reservation.count({ where: { ...reservationWhere, status: 'COMPLETED' } }),
      (prisma as any).reservation.count({ where: { ...reservationWhere, status: 'EXPIRED' } }),
      (prisma as any).reservation.aggregate({
        where: { ...reservationWhere, status: { in: ['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'] } },
        _avg: { totalHours: true },
      }),
    ]);

    const cancellationRate = totalReservations > 0 ? (cancelledReservations / totalReservations) * 100 : 0;
    const realizedCount = confirmedReservations + completedReservations;
    const averageReservationValue = realizedCount > 0 ? totalRevenue / realizedCount : 0;
    const averageReservationDuration = durationAgg._avg.totalHours || 0;

    // 3. User analytics
    const [totalUsers, newUsers, activeUsersDistinct, returningUsersDistinct] = await Promise.all([
      (prisma as any).customerAccount.count(),
      (prisma as any).customerAccount.count({ where: userWhere }),
      (prisma as any).reservation.groupBy({
        by: ['customerAccountId'],
        where: { ...reservationWhere, status: { in: ['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'] } },
      }),
      (prisma as any).reservation.groupBy({
        by: ['customerAccountId'],
        where: { ...reservationWhere, status: { in: ['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'] } },
        _count: { id: true },
        having: { id: { _count: { gt: 1 } } },
      }),
    ]);

    // 4. Gaming Center analytics
    const centerWhere: any = {};
    if (filters.gamingCenterId) {
      centerWhere.id = filters.gamingCenterId;
    } else if (filters.city) {
      centerWhere.addresses = {
        some: { city: { contains: filters.city, mode: 'insensitive' } },
      };
    }

    const [totalGamingCenters, activeGamingCenters, inactiveGamingCenters, totalStations] = await Promise.all([
      (prisma as any).gamingCenter.count({ where: centerWhere }),
      (prisma as any).gamingCenter.count({ where: { ...centerWhere, isActive: true } }),
      (prisma as any).gamingCenter.count({ where: { ...centerWhere, isActive: false } }),
      (prisma as any).gameStation.count({
        where: filters.gamingCenterId ? { gamingCenterId: filters.gamingCenterId } : (filters.city ? { gamingCenter: centerWhere } : {}),
      }),
    ]);

    const averageReservationsPerGamingCenter = totalGamingCenters > 0 ? totalReservations / totalGamingCenters : 0;

    return {
      financials: {
        totalRevenue,
        totalPaidAmount,
        totalRefundAmount,
        totalDiscountAmount,
        platformCommission,
        gamingCentersRevenue,
        averageReservationValue: Math.round(averageReservationValue * 100) / 100,
      },
      reservations: {
        totalReservations,
        confirmedReservations,
        pendingReservations,
        cancelledReservations,
        completedReservations,
        expiredReservations,
        cancellationRate: Math.round(cancellationRate * 100) / 100,
        averageReservationDuration: Math.round(averageReservationDuration * 100) / 100,
      },
      users: {
        totalUsers,
        newUsers,
        activeUsers: activeUsersDistinct.length,
        returningUsers: returningUsersDistinct.length,
      },
      gamingCenters: {
        totalGamingCenters,
        activeGamingCenters,
        inactiveGamingCenters,
        totalStations,
        averageReservationsPerGamingCenter: Math.round(averageReservationsPerGamingCenter * 100) / 100,
      },
    };
  },

  async getTopGamingCenters(start: Date, end: Date, filters: { city?: string }, limit = 10) {
    const reservationWhere: any = {
      startTime: { gte: start, lte: end },
    };
    if (filters.city) {
      reservationWhere.gamingCenter = {
        addresses: { some: { city: { contains: filters.city, mode: 'insensitive' } } },
      };
    }

    const grouped = await (prisma as any).reservation.groupBy({
      by: ['gamingCenterId'],
      where: reservationWhere,
      _count: { id: true },
      _sum: { totalPrice: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const centersWithDetails = await Promise.all(
      grouped.map(async (g: any) => {
        const gc = await (prisma as any).gamingCenter.findUnique({
          where: { id: g.gamingCenterId },
          select: { id: true, name: true, slug: true, isActive: true },
        });
        return {
          id: g.gamingCenterId,
          name: gc?.name || 'Unknown',
          slug: gc?.slug || '',
          isActive: gc?.isActive ?? false,
          reservationCount: g._count?.id || 0,
          revenue: g._sum?.totalPrice || 0,
        };
      })
    );

    return centersWithDetails;
  },

  async getTimeSeries(start: Date, end: Date, filters: { gamingCenterId?: string; city?: string }, groupBy: 'DAILY' | 'WEEKLY' | 'MONTHLY') {
    const reservationWhere: any = {
      startTime: { gte: start, lte: end },
    };
    const paymentWhere: any = {
      paidAt: { gte: start, lte: end },
      status: 'PAID',
    };
    const userWhere: any = {
      createdAt: { gte: start, lte: end },
    };

    if (filters.gamingCenterId) {
      reservationWhere.gamingCenterId = filters.gamingCenterId;
      paymentWhere.gamingCenterId = filters.gamingCenterId;
    } else if (filters.city) {
      const cityFilter = {
        addresses: { some: { city: { contains: filters.city, mode: 'insensitive' } } },
      };
      reservationWhere.gamingCenter = cityFilter;
      paymentWhere.gamingCenter = cityFilter;
    }

    const [reservations, payments, users] = await Promise.all([
      (prisma as any).reservation.findMany({
        where: reservationWhere,
        select: {
          startTime: true,
          totalPrice: true,
          discountAmount: true,
          status: true,
        },
      }),
      (prisma as any).payment.findMany({
        where: paymentWhere,
        select: {
          paidAt: true,
          amount: true,
        },
      }),
      (prisma as any).customerAccount.findMany({
        where: userWhere,
        select: {
          createdAt: true,
        },
      }),
    ]);

    const formatKey = (date: Date) => {
      const d = new Date(date);
      if (groupBy === 'MONTHLY') {
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
      }
      if (groupBy === 'WEEKLY') {
        const firstDay = new Date(d);
        const day = firstDay.getUTCDay();
        const diff = firstDay.getUTCDate() - day + (day === 0 ? -6 : 1);
        firstDay.setUTCDate(diff);
        return firstDay.toISOString().split('T')[0];
      }
      return d.toISOString().split('T')[0];
    };

    const buckets: Record<string, {
      date: string;
      reservationCount: number;
      revenue: number;
      discountAmount: number;
      cancellationCount: number;
      newUsers: number;
    }> = {};

    for (const r of reservations) {
      const key = formatKey(r.startTime);
      if (!buckets[key]) {
        buckets[key] = { date: key, reservationCount: 0, revenue: 0, discountAmount: 0, cancellationCount: 0, newUsers: 0 };
      }
      buckets[key].reservationCount++;
      buckets[key].discountAmount += r.discountAmount || 0;
      if (r.status === 'CANCELED') {
        buckets[key].cancellationCount++;
      }
    }

    for (const p of payments) {
      if (p.paidAt) {
        const key = formatKey(p.paidAt);
        if (!buckets[key]) {
          buckets[key] = { date: key, reservationCount: 0, revenue: 0, discountAmount: 0, cancellationCount: 0, newUsers: 0 };
        }
        buckets[key].revenue += p.amount || 0;
      }
    }

    for (const u of users) {
      const key = formatKey(u.createdAt);
      if (!buckets[key]) {
        buckets[key] = { date: key, reservationCount: 0, revenue: 0, discountAmount: 0, cancellationCount: 0, newUsers: 0 };
      }
      buckets[key].newUsers++;
    }

    return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
  },
};

export const PlatformAnalyticsStation = {
  async getReports(query: PlatformAnalyticsReportsQuery) {
    const {
      startDate,
      endDate,
      period,
      city,
      gamingCenterId,
      compare,
      groupBy = 'DAILY',
    } = query;

    // Determine current period date range
    const now = new Date();
    let currentEnd = endDate ? new Date(endDate) : now;
    let currentStart: Date;

    if (startDate) {
      currentStart = new Date(startDate);
    } else if (period === 'WEEKLY') {
      currentStart = new Date(currentEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'MONTHLY') {
      currentStart = new Date(currentEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === 'YEARLY') {
      currentStart = new Date(currentEnd.getTime() - 365 * 24 * 60 * 60 * 1000);
    } else {
      // Default to last 30 days
      currentStart = new Date(currentEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const filters = { city, gamingCenterId };

    const [currentMetrics, topCenters, timeSeries] = await Promise.all([
      PlatformAnalyticsRepo.getMetricsForPeriod(currentStart, currentEnd, filters),
      PlatformAnalyticsRepo.getTopGamingCenters(currentStart, currentEnd, filters),
      PlatformAnalyticsRepo.getTimeSeries(currentStart, currentEnd, filters, groupBy),
    ]);

    (currentMetrics.gamingCenters as any).topGamingCenters = topCenters;

    let periodComparison: any = null;
    if (compare) {
      const durationMs = currentEnd.getTime() - currentStart.getTime();
      const prevEnd = new Date(currentStart.getTime());
      const prevStart = new Date(prevEnd.getTime() - durationMs);

      const previousMetrics = await PlatformAnalyticsRepo.getMetricsForPeriod(prevStart, prevEnd, filters);

      const calculateDiff = (curr: number, prev: number) => {
        const diff = curr - prev;
        const percentageChange = prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 10000) / 100;
        return {
          current: curr,
          previous: prev,
          difference: diff,
          percentageChange,
        };
      };

      periodComparison = {
        totalRevenue: calculateDiff(currentMetrics.financials.totalRevenue, previousMetrics.financials.totalRevenue),
        totalReservations: calculateDiff(currentMetrics.reservations.totalReservations, previousMetrics.reservations.totalReservations),
        newUsers: calculateDiff(currentMetrics.users.newUsers, previousMetrics.users.newUsers),
        activeUsers: calculateDiff(currentMetrics.users.activeUsers, previousMetrics.users.activeUsers),
      };
    }

    return {
      period: {
        startDate: currentStart.toISOString(),
        endDate: currentEnd.toISOString(),
      },
      financials: currentMetrics.financials,
      reservations: currentMetrics.reservations,
      users: currentMetrics.users,
      gamingCenters: currentMetrics.gamingCenters,
      timeSeries,
      comparison: periodComparison,
    };
  },
};
