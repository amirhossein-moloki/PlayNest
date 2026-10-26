import { prisma } from '../../config/prisma';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const AnalyticsRepo = {
  async getSummaryStats(gamingCenterId: string, startDate: Date, endDate: Date) {
    const stats = await prisma.gamingCenterAnalytics.aggregate({
      where: {
        gamingCenterId,
        date: { gte: startDate, lte: endDate },
      },
      _sum: {
        totalReservations: true,
        completedReservations: true,
        canceledReservations: true,
        revenue: true,
        realizedCash: true,
      },
    });
    return stats._sum;
  },

  async getLiveReservationStats(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    const [byStatus, byStation, totalCount] = await Promise.all([
      prisma.reservation.groupBy({
        by: ['status'],
        where: { gamingCenterId, startTime: { gte: dayStart, lte: dayEnd } },
        _count: { _all: true },
        _sum: { totalPrice: true, totalHours: true },
      }),
      prisma.reservation.groupBy({
        by: ['stationId'],
        where: { gamingCenterId, startTime: { gte: dayStart, lte: dayEnd } },
        _count: { _all: true },
        _sum: { totalPrice: true, totalHours: true },
      }),
      prisma.reservation.count({
        where: { gamingCenterId, startTime: { gte: dayStart, lte: dayEnd } },
      }),
    ]);

    return { byStatus, byStation, totalCount };
  },

  async getLiveFinancialStats(gamingCenterId: string, dayStart: Date, dayEnd: Date, currencyFilter?: string) {
    const wherePayments = {
      gamingCenterId,
      paidAt: { gte: dayStart, lte: dayEnd },
      status: 'PAID' as const,
      ...(currencyFilter ? { currency: currencyFilter } : {}),
    };

    const whereAllPayments = {
      gamingCenterId,
      createdAt: { gte: dayStart, lte: dayEnd },
      ...(currencyFilter ? { currency: currencyFilter } : {}),
    };

    const whereRefunds = {
      gamingCenterId,
      processedAt: { gte: dayStart, lte: dayEnd },
      status: 'SUCCESSFUL' as const,
      ...(currencyFilter ? { currency: currencyFilter } : {}),
    };

    const whereLedger = {
      gamingCenterId,
      createdAt: { gte: dayStart, lte: dayEnd },
      ...(currencyFilter ? { currency: currencyFilter } : {}),
    };

    const [paidPayments, paymentsByStatus, paymentsByMethod, paymentsByProvider, refunds, ledgerEntries] = await Promise.all([
      prisma.payment.groupBy({
        by: ['currency'],
        where: wherePayments,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.groupBy({
        by: ['status', 'currency'],
        where: whereAllPayments,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.groupBy({
        by: ['method', 'currency'],
        where: wherePayments,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.payment.groupBy({
        by: ['provider', 'currency'],
        where: wherePayments,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.refund.groupBy({
        by: ['currency'],
        where: whereRefunds,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.ledgerEntry.groupBy({
        by: ['entryType', 'currency'],
        where: whereLedger,
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    return {
      paidPayments,
      paymentsByStatus,
      paymentsByMethod,
      paymentsByProvider,
      refunds,
      ledgerEntries,
    };
  },

  async getWaitlistAnalyticsStats(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    const [entriesByStatus, offersByStatus, totalEntries] = await Promise.all([
      prisma.waitlistEntry.groupBy({
        by: ['status'],
        where: { gamingCenterId, createdAt: { gte: dayStart, lte: dayEnd } },
        _count: { _all: true },
      }),
      prisma.waitlistOffer.groupBy({
        by: ['status'],
        where: { gamingCenterId, createdAt: { gte: dayStart, lte: dayEnd } },
        _count: { _all: true },
      }),
      prisma.waitlistEntry.count({
        where: { gamingCenterId, createdAt: { gte: dayStart, lte: dayEnd } },
      }),
    ]);

    return { entriesByStatus, offersByStatus, totalEntries };
  },

  async getNotificationAnalyticsStats(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    const [byStatus, byChannel, byType, totalLogs] = await Promise.all([
      prisma.notificationLog.groupBy({
        by: ['status'],
        where: { gamingCenterId, createdAt: { gte: dayStart, lte: dayEnd } },
        _count: { _all: true },
      }),
      prisma.notificationLog.groupBy({
        by: ['channel'],
        where: { gamingCenterId, createdAt: { gte: dayStart, lte: dayEnd } },
        _count: { _all: true },
      }),
      prisma.notificationLog.groupBy({
        by: ['type'],
        where: { gamingCenterId, createdAt: { gte: dayStart, lte: dayEnd } },
        _count: { _all: true },
      }),
      prisma.notificationLog.count({
        where: { gamingCenterId, createdAt: { gte: dayStart, lte: dayEnd } },
      }),
    ]);

    return { byStatus, byChannel, byType, totalLogs };
  },

  async getReservationListForTrends(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    return prisma.reservation.findMany({
      where: {
        gamingCenterId,
        startTime: { gte: dayStart, lte: dayEnd },
      },
      select: {
        startTime: true,
        status: true,
        totalPrice: true,
        totalHours: true,
      },
      orderBy: { startTime: 'asc' },
    });
  },

  async getStaffPerformanceStats(gamingCenterId: string, startDate: Date, endDate: Date) {
    return prisma.staffAnalytics.groupBy({
      by: ['staffId'],
      where: {
        gamingCenterId,
        date: { gte: startDate, lte: endDate },
      },
      _sum: {
        completedReservations: true,
        revenue: true,
        totalRating: true,
        ratingCount: true,
      },
    });
  },

  async getStationPerformanceStats(gamingCenterId: string, startDate: Date, endDate: Date) {
    return prisma.stationAnalytics.groupBy({
      by: ['stationId'],
      where: {
        gamingCenterId,
        date: { gte: startDate, lte: endDate },
      },
      _sum: {
        completedReservations: true,
        revenue: true,
      },
    });
  },

  async getDailyRevenue(gamingCenterId: string, startDate: Date, endDate: Date) {
    return prisma.gamingCenterAnalytics.findMany({
      where: {
        gamingCenterId,
        date: { gte: startDate, lte: endDate },
      },
      select: {
        date: true,
        revenue: true,
      },
      orderBy: { date: 'asc' },
    });
  },

  async getNewCustomersCount(gamingCenterId: string, startDate: Date, endDate: Date) {
    return prisma.customerProfile.count({
      where: {
        gamingCenterId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });
  },

  async getStaffDetails(gamingCenterId: string) {
    return prisma.user.findMany({
      where: { gamingCenterId, role: 'STAFF' },
      select: { id: true, fullName: true },
    });
  },

  async getStationDetails(gamingCenterId: string) {
    return prisma.gameStation.findMany({
      where: { gamingCenterId },
      select: { id: true, name: true, stationType: true, isActive: true, hourlyPrice: true },
    });
  },

  async getReservationWithReviews(gamingCenterId: string, startDate: Date, endDate: Date) {
    return prisma.reservation.findMany({
      where: {
        gamingCenterId,
        startTime: { gte: startDate, lte: endDate },
        ratings: { some: {} },
      },
      select: {
        staffId: true,
        ratings: {
          select: { rating: true },
        },
      },
    });
  },

  // Customer Analytics Methods
  async getCompletedCustomerReservations(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    return prisma.reservation.findMany({
      where: {
        gamingCenterId,
        status: 'COMPLETED',
        startTime: { gte: dayStart, lte: dayEnd },
      },
      select: {
        id: true,
        customerAccountId: true,
        startTime: true,
        endTime: true,
        totalPrice: true,
        customerAccount: {
          select: {
            phone: true,
            fullName: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });
  },

  async getCustomerAllHistoricalFirstVisits(gamingCenterId: string, dayEnd: Date) {
    return prisma.reservation.groupBy({
      by: ['customerAccountId'],
      where: {
        gamingCenterId,
        status: 'COMPLETED',
        startTime: { lte: dayEnd },
      },
      _min: {
        startTime: true,
      },
    });
  },

  async getCustomerAllHistoricalVisits(gamingCenterId: string, dayEnd: Date) {
    return prisma.reservation.findMany({
      where: {
        gamingCenterId,
        status: 'COMPLETED',
        startTime: { lte: dayEnd },
      },
      select: {
        customerAccountId: true,
        startTime: true,
      },
      orderBy: { startTime: 'asc' },
    });
  },

  async syncGamingCenterStats(gamingCenterId: string, date: Date) {
    const settings = await prisma.settings.findUnique({ where: { gamingCenterId } });
    const timeZone = settings?.timeZone || 'UTC';
    const dateStr = formatInTimeZone(date, timeZone, 'yyyy-MM-dd');
    const dayStart = fromZonedTime(`${dateStr} 00:00:00`, timeZone);
    const dayEnd = fromZonedTime(`${dateStr} 23:59:59.999`, timeZone);

    const [reservationStats, realizedCashStats] = await Promise.all([
      prisma.reservation.groupBy({
        by: ['status'],
        where: { gamingCenterId, startTime: { gte: dayStart, lte: dayEnd } },
        _count: { _all: true },
        _sum: { totalPrice: true },
      }),
      prisma.payment.aggregate({
        where: { gamingCenterId, status: 'PAID', paidAt: { gte: dayStart, lte: dayEnd } },
        _sum: { amount: true },
      }),
    ]);

    const totalReservations = reservationStats.reduce((sum, s) => sum + s._count._all, 0);
    const completedStats = reservationStats.find((s) => s.status === 'COMPLETED');
    const canceledStats = reservationStats.find((s) => s.status === 'CANCELED');

    await prisma.gamingCenterAnalytics.upsert({
      where: { gamingCenterId_date: { gamingCenterId, date: new Date(dateStr) } },
      create: {
        gamingCenterId,
        date: new Date(dateStr),
        totalReservations,
        completedReservations: completedStats?._count._all || 0,
        canceledReservations: canceledStats?._count._all || 0,
        revenue: completedStats?._sum.totalPrice || 0,
        realizedCash: realizedCashStats._sum.amount || 0,
      },
      update: {
        totalReservations,
        completedReservations: completedStats?._count._all || 0,
        canceledReservations: canceledStats?._count._all || 0,
        revenue: completedStats?._sum.totalPrice || 0,
        realizedCash: realizedCashStats._sum.amount || 0,
        updatedAt: new Date(),
      },
    });
  },

  async syncStaffStats(gamingCenterId: string, staffId: string, date: Date) {
    const settings = await prisma.settings.findUnique({ where: { gamingCenterId } });
    const timeZone = settings?.timeZone || 'UTC';
    const dateStr = formatInTimeZone(date, timeZone, 'yyyy-MM-dd');
    const dayStart = fromZonedTime(`${dateStr} 00:00:00`, timeZone);
    const dayEnd = fromZonedTime(`${dateStr} 23:59:59.999`, timeZone);

    const [reservationStats, reviewStats] = await Promise.all([
      prisma.reservation.aggregate({
        where: {
          gamingCenterId,
          staffId,
          status: 'COMPLETED',
          startTime: { gte: dayStart, lte: dayEnd },
        },
        _count: { _all: true },
        _sum: { totalPrice: true },
      }),
      prisma.rating.aggregate({
        where: {
          gamingCenterId,
          reservation: {
            staffId,
            startTime: { gte: dayStart, lte: dayEnd },
          },
          status: 'PUBLISHED',
        },
        _count: { _all: true },
        _sum: { rating: true },
      }),
    ]);

    await prisma.staffAnalytics.upsert({
      where: {
        gamingCenterId_staffId_date: {
          gamingCenterId,
          staffId,
          date: new Date(dateStr),
        },
      },
      create: {
        gamingCenterId,
        staffId,
        date: new Date(dateStr),
        completedReservations: reservationStats._count._all || 0,
        revenue: reservationStats._sum.totalPrice || 0,
        totalRating: reviewStats._sum.rating || 0,
        ratingCount: reviewStats._count._all || 0,
      },
      update: {
        completedReservations: reservationStats._count._all || 0,
        revenue: reservationStats._sum.totalPrice || 0,
        totalRating: reviewStats._sum.rating || 0,
        ratingCount: reviewStats._count._all || 0,
        updatedAt: new Date(),
      },
    });
  },

  async syncStationStats(gamingCenterId: string, stationId: string, date: Date) {
    const settings = await prisma.settings.findUnique({ where: { gamingCenterId } });
    const timeZone = settings?.timeZone || 'UTC';
    const dateStr = formatInTimeZone(date, timeZone, 'yyyy-MM-dd');
    const dayStart = fromZonedTime(`${dateStr} 00:00:00`, timeZone);
    const dayEnd = fromZonedTime(`${dateStr} 23:59:59.999`, timeZone);

    const stats = await prisma.reservation.aggregate({
      where: {
        gamingCenterId,
        stationId,
        status: 'COMPLETED',
        startTime: { gte: dayStart, lte: dayEnd },
      },
      _count: { _all: true },
      _sum: { totalPrice: true },
    });

    await prisma.stationAnalytics.upsert({
      where: {
        gamingCenterId_stationId_date: {
          gamingCenterId,
          stationId,
          date: new Date(dateStr),
        },
      },
      create: {
        gamingCenterId,
        stationId,
        date: new Date(dateStr),
        completedReservations: stats._count._all || 0,
        revenue: stats._sum.totalPrice || 0,
      },
      update: {
        completedReservations: stats._count._all || 0,
        revenue: stats._sum.totalPrice || 0,
        updatedAt: new Date(),
      },
    });
  },

  async syncAllStatsForReservation(reservationId: string) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) return;

    await this.syncSpecificStats(reservation.gamingCenterId, reservation.startTime, reservation.staffId!, reservation.stationId);
  },

  async syncSpecificStats(gamingCenterId: string, date: Date, staffId: string, stationId: string) {
    await Promise.all([
      this.syncGamingCenterStats(gamingCenterId, date),
      this.syncStaffStats(gamingCenterId, staffId, date),
      this.syncStationStats(gamingCenterId, stationId, date),
    ]);
  },

  async syncAllStatsForPayment(paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { reservation: true },
    });
    if (!payment) return;

    // Payment realizedCash is based on paidAt
    if (payment.status === 'PAID' && payment.paidAt) {
      await this.syncGamingCenterStats(payment.gamingCenterId, payment.paidAt);
    }

    // Also sync the reservation's date stats just in case
    await this.syncAllStatsForReservation(payment.reservationId);
  },

  async syncAllStatsForReview(reviewId: string) {
    const rating = await prisma.rating.findUnique({
      where: { id: reviewId },
      include: { reservation: true },
    });
    if (!rating) return;

    await this.syncStaffStats(rating.gamingCenterId, rating.reservation.staffId!, rating.reservation.startTime);
  },

  async getIngestionStatus() {
    const [watermarks, recentRuns] = await Promise.all([
      prisma.analyticsWatermark.findMany({
        orderBy: { entity: 'asc' },
      }),
      prisma.analyticsIngestionRun.findMany({
        take: 10,
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    const lastSuccessfulRun = recentRuns.find((r) => r.status === 'SUCCESS');
    const lastIngestedAt = lastSuccessfulRun?.completedAt || lastSuccessfulRun?.startedAt || null;

    const now = new Date();
    const isStale = !lastIngestedAt || (now.getTime() - new Date(lastIngestedAt).getTime()) > 120 * 60 * 1000;

    return {
      status: isStale ? 'STALE' : 'FRESH',
      lastIngestedAt,
      watermarks: watermarks.map((w) => ({
        entity: w.entity,
        lastIngestedAt: w.lastIngestedAt,
        lastSourceId: w.lastSourceId,
      })),
      recentRuns: recentRuns.map((r) => ({
        id: r.id,
        entity: r.entity,
        status: r.status,
        recordsRead: r.recordsRead,
        recordsIngested: r.recordsIngested,
        durationMs: r.durationMs,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        errorMessage: r.errorMessage,
      })),
    };
  },
};
