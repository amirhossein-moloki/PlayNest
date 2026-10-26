import { AnalyticsRepo } from './analytics.repo';
import { resolveTimezoneAndBoundaries } from './analytics.validators';
import { formatInTimeZone } from 'date-fns-tz';
import { differenceInDays } from 'date-fns';

export const AnalyticsStation = {
  async getSummary(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const [stats, liveResStats, newCustomers, financialStats] = await Promise.all([
      AnalyticsRepo.getSummaryStats(gamingCenterId, dayStart, dayEnd),
      AnalyticsRepo.getLiveReservationStats(gamingCenterId, dayStart, dayEnd),
      AnalyticsRepo.getNewCustomersCount(gamingCenterId, dayStart, dayEnd),
      AnalyticsRepo.getLiveFinancialStats(gamingCenterId, dayStart, dayEnd),
    ]);

    const totalReservations = stats?.totalReservations || liveResStats.totalCount || 0;
    const completedStats = liveResStats.byStatus.find((s) => s.status === 'COMPLETED');
    const canceledStats = liveResStats.byStatus.find((s) => s.status === 'CANCELED');

    const completedReservations = stats?.completedReservations || completedStats?._count._all || 0;
    const canceledReservations = stats?.canceledReservations || canceledStats?._count._all || 0;
    const totalRevenue = stats?.revenue || completedStats?._sum.totalPrice || 0;

    const realizedCashFromPayments = financialStats.paidPayments.reduce((sum, p) => sum + (p._sum.amount || 0), 0);
    const realizedCash = stats?.realizedCash || realizedCashFromPayments;

    const completionRate =
      totalReservations > 0
        ? Math.round((completedReservations / (totalReservations - canceledReservations || 1)) * 10000) / 100
        : 0;

    const averageReservationValue = completedReservations > 0 ? Math.round(totalRevenue / completedReservations) : 0;

    return {
      period: {
        startDate: dayStart,
        endDate: dayEnd,
        timeZone,
      },
      totalRevenue,
      realizedCash,
      totalReservations,
      completedReservations,
      canceledReservations,
      completionRate,
      averageReservationValue,
      newCustomers,
    };
  },

  async getReservationReport(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const [liveResStats, rawReservations, stationsList] = await Promise.all([
      AnalyticsRepo.getLiveReservationStats(gamingCenterId, dayStart, dayEnd),
      AnalyticsRepo.getReservationListForTrends(gamingCenterId, dayStart, dayEnd),
      AnalyticsRepo.getStationDetails(gamingCenterId),
    ]);

    const allStatuses = ['CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW', 'EXPIRED', 'PENDING', 'IN_PROGRESS'];
    const statusDistribution = allStatuses.map((st) => {
      const found = liveResStats.byStatus.find((s) => s.status === st);
      return {
        status: st,
        count: found?._count._all || 0,
        totalPrice: found?._sum.totalPrice || 0,
        totalHours: found?._sum.totalHours || 0,
      };
    });

    const totalReservations = liveResStats.totalCount;
    const completed = statusDistribution.find((s) => s.status === 'COMPLETED');
    const canceled = statusDistribution.find((s) => s.status === 'CANCELED');
    const noShow = statusDistribution.find((s) => s.status === 'NO_SHOW');

    const completedCount = completed?.count || 0;
    const canceledCount = canceled?.count || 0;
    const noShowCount = noShow?.count || 0;

    const completionRate = totalReservations > 0 ? Math.round((completedCount / totalReservations) * 10000) / 100 : 0;
    const cancellationRate = totalReservations > 0 ? Math.round((canceledCount / totalReservations) * 10000) / 100 : 0;
    const noShowRate = totalReservations > 0 ? Math.round((noShowCount / totalReservations) * 10000) / 100 : 0;

    const averageDurationHours = completedCount > 0 ? Math.round(((completed?.totalHours || 0) / completedCount) * 100) / 100 : 0;
    const averageReservationValue = completedCount > 0 ? Math.round((completed?.totalPrice || 0) / completedCount) : 0;

    // Trends calculation
    const trendsMap = new Map<string, { date: string; total: number; completed: number; canceled: number; revenue: number }>();
    for (const r of rawReservations) {
      const dateStr = formatInTimeZone(r.startTime, timeZone, 'yyyy-MM-dd');
      const entry = trendsMap.get(dateStr) || { date: dateStr, total: 0, completed: 0, canceled: 0, revenue: 0 };
      entry.total += 1;
      if (r.status === 'COMPLETED') {
        entry.completed += 1;
        entry.revenue += r.totalPrice;
      } else if (r.status === 'CANCELED') {
        entry.canceled += 1;
      }
      trendsMap.set(dateStr, entry);
    }
    const trends = Array.from(trendsMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Station breakdown
    const stationBreakdown = stationsList.map((st) => {
      const found = liveResStats.byStation.find((s) => s.stationId === st.id);
      return {
        stationId: st.id,
        stationName: st.name,
        stationType: st.stationType,
        reservationCount: found?._count._all || 0,
        totalHours: found?._sum.totalHours || 0,
        revenue: found?._sum.totalPrice || 0,
      };
    });

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      totalReservations,
      metrics: {
        completionRate,
        cancellationRate,
        noShowRate,
        averageDurationHours,
        averageReservationValue,
      },
      statusDistribution,
      stationBreakdown,
      trends,
    };
  },

  async getFinancialReport(gamingCenterId: string, startDateInput: Date, endDateInput: Date, currencyFilter?: string) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const stats = await AnalyticsRepo.getLiveFinancialStats(gamingCenterId, dayStart, dayEnd, currencyFilter);

    // Primary currency calculation
    const primaryCurrency = currencyFilter || stats.paidPayments[0]?.currency || 'IRR';

    const grossCollected = stats.paidPayments.reduce((acc, p) => acc + (p._sum.amount || 0), 0);
    const totalRefunded = stats.refunds.reduce((acc, r) => acc + (r._sum.amount || 0), 0);
    const netCollected = grossCollected - totalRefunded;

    const paymentsByStatus = stats.paymentsByStatus.map((p) => ({
      status: p.status,
      currency: p.currency,
      count: p._count._all,
      amount: p._sum.amount || 0,
    }));

    const paymentsByMethod = stats.paymentsByMethod.map((p) => ({
      method: p.method,
      currency: p.currency,
      count: p._count._all,
      amount: p._sum.amount || 0,
    }));

    const paymentsByProvider = stats.paymentsByProvider.map((p) => ({
      provider: p.provider,
      currency: p.currency,
      count: p._count._all,
      amount: p._sum.amount || 0,
    }));

    const ledgerSummary = stats.ledgerEntries.map((l) => ({
      entryType: l.entryType,
      currency: l.currency,
      count: l._count._all,
      amount: l._sum.amount || 0,
    }));

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      summary: {
        currency: primaryCurrency,
        grossCollected,
        totalRefunded,
        netCollected,
      },
      paymentsByStatus,
      paymentsByMethod,
      paymentsByProvider,
      ledgerSummary,
    };
  },

  async getWaitlistReport(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const stats = await AnalyticsRepo.getWaitlistAnalyticsStats(gamingCenterId, dayStart, dayEnd);

    const convertedFound = stats.entriesByStatus.find((s) => s.status === 'CONVERTED');
    const convertedCount = convertedFound?._count._all || 0;
    const totalEntries = stats.totalEntries;

    const conversionRate = totalEntries > 0 ? Math.round((convertedCount / totalEntries) * 10000) / 100 : 0;

    const acceptedFound = stats.offersByStatus.find((s) => s.status === 'ACCEPTED');
    const acceptedOffersCount = acceptedFound?._count._all || 0;
    const totalOffers = stats.offersByStatus.reduce((acc, o) => acc + o._count._all, 0);

    const offerAcceptanceRate = totalOffers > 0 ? Math.round((acceptedOffersCount / totalOffers) * 10000) / 100 : 0;

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      totalEntries,
      conversionRate,
      entriesByStatus: stats.entriesByStatus.map((s) => ({ status: s.status, count: s._count._all })),
      offersSummary: {
        totalOffers,
        offerAcceptanceRate,
        offersByStatus: stats.offersByStatus.map((s) => ({ status: s.status, count: s._count._all })),
      },
    };
  },

  async getNotificationReport(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const stats = await AnalyticsRepo.getNotificationAnalyticsStats(gamingCenterId, dayStart, dayEnd);

    const failedFound = stats.byStatus.find((s) => s.status === 'FAILED');
    const failedLogs = failedFound?._count._all || 0;
    const totalLogs = stats.totalLogs;

    const failureRate = totalLogs > 0 ? Math.round((failedLogs / totalLogs) * 10000) / 100 : 0;

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      totalLogs,
      failureRate,
      statusDistribution: stats.byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      channelDistribution: stats.byChannel.map((c) => ({ channel: c.channel, count: c._count._all })),
      typeDistribution: stats.byType.map((t) => ({ type: t.type, count: t._count._all })),
    };
  },

  async getStaffPerformance(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const [staffStats, staffList] = await Promise.all([
      AnalyticsRepo.getStaffPerformanceStats(gamingCenterId, dayStart, dayEnd),
      AnalyticsRepo.getStaffDetails(gamingCenterId),
    ]);

    const performance = staffList.map((staff) => {
      const stats = staffStats.find((s) => s.staffId === staff.id) as { revenue?: number; completedReservations?: number; totalRating?: number; ratingCount?: number; _sum?: { revenue?: number; completedReservations?: number; totalRating?: number; ratingCount?: number } } | undefined;
      const revenue = stats?.revenue || stats?._sum?.revenue || 0;
      const completedReservations = stats?.completedReservations || stats?._sum?.completedReservations || 0;
      const totalRating = stats?.totalRating || stats?._sum?.totalRating || 0;
      const ratingCount = stats?.ratingCount || stats?._sum?.ratingCount || 0;

      return {
        staffId: staff.id,
        staffName: staff.fullName,
        reservationCount: completedReservations,
        revenue,
        averageRating: ratingCount > 0 ? Math.round((totalRating / ratingCount) * 10) / 10 : 0,
      };
    });

    return performance;
  },

  async getStationPerformance(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const [liveResStats, stationsList] = await Promise.all([
      AnalyticsRepo.getLiveReservationStats(gamingCenterId, dayStart, dayEnd),
      AnalyticsRepo.getStationDetails(gamingCenterId),
    ]);

    const daysCount = Math.max(differenceInDays(dayEnd, dayStart), 1);

    const performance = stationsList.map((station) => {
      const found = liveResStats.byStation.find((s) => s.stationId === station.id);
      const totalHours = found?._sum.totalHours || 0;
      const revenue = found?._sum.totalPrice || 0;
      const reservationCount = found?._count._all || 0;

      // Assuming 24 hours per day max availability per station
      const maxPossibleHours = daysCount * 24;
      const utilizationRate = maxPossibleHours > 0 ? Math.round((totalHours / maxPossibleHours) * 10000) / 100 : 0;

      return {
        stationId: station.id,
        stationName: station.name,
        stationType: station.stationType,
        isActive: station.isActive,
        reservationCount,
        totalHoursBooked: totalHours,
        revenue,
        utilizationRate,
      };
    });

    return performance;
  },

  async getRevenueChart(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const rawReservations = await AnalyticsRepo.getReservationListForTrends(gamingCenterId, dayStart, dayEnd);

    const dailyRevenueMap = new Map<string, number>();
    for (const r of rawReservations) {
      if (r.status === 'COMPLETED') {
        const dateStr = formatInTimeZone(r.startTime, timeZone, 'yyyy-MM-dd');
        dailyRevenueMap.set(dateStr, (dailyRevenueMap.get(dateStr) || 0) + r.totalPrice);
      }
    }

    const chart = Array.from(dailyRevenueMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return chart;
  },

  async getIngestionStatus() {
    return AnalyticsRepo.getIngestionStatus();
  },
};
