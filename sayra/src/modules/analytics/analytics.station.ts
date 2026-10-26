import { AnalyticsRepo } from './analytics.repo';
import { resolveTimezoneAndBoundaries } from './analytics.validators';
import { formatInTimeZone } from 'date-fns-tz';
import { differenceInDays, subDays } from 'date-fns';

function maskPhone(phone?: string | null): string {
  if (!phone || phone.length < 7) return '***';
  return phone.slice(0, 4) + '***' + phone.slice(-4);
}

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

  // Customer Analytics Methods (Phase 3)
  async getCustomerSummary(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const [allPeriodReservations, allHistoricalFirstVisits] = await Promise.all([
      AnalyticsRepo.getCompletedCustomerReservations(gamingCenterId, dayStart, dayEnd),
      AnalyticsRepo.getCustomerAllHistoricalFirstVisits(gamingCenterId, dayEnd),
    ]);

    // Exclude unlinked/walk-in reservations without customerAccountId
    const periodReservations = allPeriodReservations.filter((r): r is typeof r & { customerAccountId: string } => Boolean(r.customerAccountId));
    const historicalFirstVisits = allHistoricalFirstVisits.filter((h): h is typeof h & { customerAccountId: string } => Boolean(h.customerAccountId));

    const activeCustomerIds = new Set(periodReservations.map((r) => r.customerAccountId));
    const activeCustomersCount = activeCustomerIds.size;

    // First visit map
    const firstVisitMap = new Map<string, Date>();
    for (const h of historicalFirstVisits) {
      if (h._min.startTime) {
        firstVisitMap.set(h.customerAccountId, h._min.startTime);
      }
    }

    let newCustomersCount = 0;
    let returningCustomersCount = 0;

    for (const cid of activeCustomerIds) {
      const firstVisit = firstVisitMap.get(cid);
      if (firstVisit && firstVisit >= dayStart && firstVisit <= dayEnd) {
        newCustomersCount++;
      } else {
        returningCustomersCount++;
      }
    }

    // Customer visit counts in period
    const visitsPerCustomerMap = new Map<string, number>();
    let totalRecordedSpend = 0;

    for (const r of periodReservations) {
      visitsPerCustomerMap.set(r.customerAccountId, (visitsPerCustomerMap.get(r.customerAccountId) || 0) + 1);
      totalRecordedSpend += r.totalPrice;
    }

    let repeatCustomersCount = 0;
    for (const visits of visitsPerCustomerMap.values()) {
      if (visits >= 2) repeatCustomersCount++;
    }

    const repeatVisitRate = activeCustomersCount > 0 ? Math.round((repeatCustomersCount / activeCustomersCount) * 10000) / 100 : 0;
    const avgSpendPerActiveCustomer = activeCustomersCount > 0 ? Math.round(totalRecordedSpend / activeCustomersCount) : 0;
    const avgSpendPerVisit = periodReservations.length > 0 ? Math.round(totalRecordedSpend / periodReservations.length) : 0;

    // Calculate Average Time Between Visits for repeat active customers using historical data
    const rawHistoricalVisits = await AnalyticsRepo.getCustomerAllHistoricalVisits(gamingCenterId, dayEnd);
    const allHistoricalVisits = rawHistoricalVisits.filter((v): v is typeof v & { customerAccountId: string } => Boolean(v.customerAccountId));
    const customerVisitsGrouped = new Map<string, Date[]>();

    for (const v of allHistoricalVisits) {
      if (!customerVisitsGrouped.has(v.customerAccountId)) {
        customerVisitsGrouped.set(v.customerAccountId, []);
      }
      customerVisitsGrouped.get(v.customerAccountId)!.push(v.startTime);
    }

    let totalGapsDays = 0;
    let gapCount = 0;

    for (const cid of activeCustomerIds) {
      const visits = customerVisitsGrouped.get(cid);
      if (visits && visits.length >= 2) {
        for (let i = 1; i < visits.length; i++) {
          const diffDays = Math.abs(differenceInDays(visits[i], visits[i - 1]));
          totalGapsDays += diffDays;
          gapCount++;
        }
      }
    }

    const avgDaysBetweenVisits = gapCount > 0 ? Math.round((totalGapsDays / gapCount) * 10) / 10 : 0;

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      activeCustomers: activeCustomersCount,
      newCustomers: newCustomersCount,
      returningCustomers: returningCustomersCount,
      repeatCustomers: repeatCustomersCount,
      repeatVisitRate,
      avgDaysBetweenVisits,
      totalRecordedSpend,
      avgSpendPerActiveCustomer,
      avgSpendPerVisit,
      ltvDisclaimer: 'Metric represents historical recorded spend during selected period, not predictive lifetime value (LTV).',
    };
  },

  async getCustomerActivity(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const rawPeriodReservations = await AnalyticsRepo.getCompletedCustomerReservations(gamingCenterId, dayStart, dayEnd);
    const periodReservations = rawPeriodReservations.filter((r): r is typeof r & { customerAccountId: string } => Boolean(r.customerAccountId));

    // Daily active customers & visit trends
    const dailyMap = new Map<string, { date: string; activeCustomers: Set<string>; visits: number; spend: number }>();

    for (const r of periodReservations) {
      const dateStr = formatInTimeZone(r.startTime, timeZone, 'yyyy-MM-dd');
      let entry = dailyMap.get(dateStr);
      if (!entry) {
        entry = { date: dateStr, activeCustomers: new Set(), visits: 0, spend: 0 };
        dailyMap.set(dateStr, entry);
      }
      entry.activeCustomers.add(r.customerAccountId);
      entry.visits += 1;
      entry.spend += r.totalPrice;
    }

    const trends = Array.from(dailyMap.values())
      .map((e) => ({
        date: e.date,
        activeCustomers: e.activeCustomers.size,
        visits: e.visits,
        spend: e.spend,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Frequency Histogram
    const customerVisitsMap = new Map<string, number>();
    for (const r of periodReservations) {
      customerVisitsMap.set(r.customerAccountId, (customerVisitsMap.get(r.customerAccountId) || 0) + 1);
    }

    const frequencyBuckets = {
      '1 visit': 0,
      '2-3 visits': 0,
      '4-5 visits': 0,
      '6-10 visits': 0,
      '10+ visits': 0,
    };

    for (const count of customerVisitsMap.values()) {
      if (count === 1) frequencyBuckets['1 visit']++;
      else if (count <= 3) frequencyBuckets['2-3 visits']++;
      else if (count <= 5) frequencyBuckets['4-5 visits']++;
      else if (count <= 10) frequencyBuckets['6-10 visits']++;
      else frequencyBuckets['10+ visits']++;
    }

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      trends,
      frequencyDistribution: Object.entries(frequencyBuckets).map(([bucket, count]) => ({ bucket, count })),
    };
  },

  async getCustomerRetention(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const [rawAllVisits, periodSummary] = await Promise.all([
      AnalyticsRepo.getCustomerAllHistoricalVisits(gamingCenterId, dayEnd),
      this.getCustomerSummary(gamingCenterId, startDateInput, endDateInput),
    ]);

    const allVisits = rawAllVisits.filter((v): v is typeof v & { customerAccountId: string } => Boolean(v.customerAccountId));

    // Group visits by customer
    const customerVisits = new Map<string, Date[]>();
    for (const v of allVisits) {
      if (!customerVisits.has(v.customerAccountId)) {
        customerVisits.set(v.customerAccountId, []);
      }
      customerVisits.get(v.customerAccountId)!.push(v.startTime);
    }

    // Cohorts by First Visit Month
    const cohortGroups = new Map<string, Set<string>>(); // YYYY-MM -> Set of customerIds
    const customerCohortMonth = new Map<string, string>();

    for (const [cid, visits] of customerVisits.entries()) {
      const firstVisit = visits[0];
      const cohortKey = formatInTimeZone(firstVisit, timeZone, 'yyyy-MM');
      if (!cohortGroups.has(cohortKey)) {
        cohortGroups.set(cohortKey, new Set());
      }
      cohortGroups.get(cohortKey)!.add(cid);
      customerCohortMonth.set(cid, cohortKey);
    }

    // Compute retention rates for last 6 cohorts
    const sortedCohorts = Array.from(cohortGroups.keys()).sort().slice(-6);
    const cohortMatrix = [];

    for (const cohortKey of sortedCohorts) {
      const cohortCustomers = cohortGroups.get(cohortKey)!;
      const totalSize = cohortCustomers.size;

      // Track activity in subsequent 3 months
      const retentionByMonth = [];
      const [yearStr, monthStr] = cohortKey.split('-');
      const cohortYear = parseInt(yearStr, 10);
      const cohortMonth = parseInt(monthStr, 10) - 1; // 0-based

      for (let m = 0; m <= 3; m++) {
        const targetDate = new Date(Date.UTC(cohortYear, cohortMonth + m, 1));
        const targetMonthKey = formatInTimeZone(targetDate, timeZone, 'yyyy-MM');

        let activeInTargetMonth = 0;
        for (const cid of cohortCustomers) {
          const visits = customerVisits.get(cid) || [];
          const visitedInMonth = visits.some((v) => formatInTimeZone(v, timeZone, 'yyyy-MM') === targetMonthKey);
          if (visitedInMonth) activeInTargetMonth++;
        }

        const retentionRate = totalSize > 0 ? Math.round((activeInTargetMonth / totalSize) * 10000) / 100 : 0;
        retentionByMonth.push({ monthIndex: m, monthKey: targetMonthKey, activeCount: activeInTargetMonth, retentionRate });
      }

      cohortMatrix.push({ cohort: cohortKey, cohortSize: totalSize, retention: retentionByMonth });
    }

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      summaryMetrics: {
        repeatVisitRate: periodSummary.repeatVisitRate,
        avgDaysBetweenVisits: periodSummary.avgDaysBetweenVisits,
      },
      cohortMatrix,
    };
  },

  async getCustomerSegmentation(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const [rawPeriodReservations, rawHistoricalFirstVisits, rawAllVisits] = await Promise.all([
      AnalyticsRepo.getCompletedCustomerReservations(gamingCenterId, dayStart, dayEnd),
      AnalyticsRepo.getCustomerAllHistoricalFirstVisits(gamingCenterId, dayEnd),
      AnalyticsRepo.getCustomerAllHistoricalVisits(gamingCenterId, dayEnd),
    ]);

    const periodReservations = rawPeriodReservations.filter((r): r is typeof r & { customerAccountId: string } => Boolean(r.customerAccountId));
    const historicalFirstVisits = rawHistoricalFirstVisits.filter((h): h is typeof h & { customerAccountId: string } => Boolean(h.customerAccountId));
    const allVisits = rawAllVisits.filter((v): v is typeof v & { customerAccountId: string } => Boolean(v.customerAccountId));

    const activeCustomerIds = new Set(periodReservations.map((r) => r.customerAccountId));

    // First visit map
    const firstVisitMap = new Map<string, Date>();
    for (const h of historicalFirstVisits) {
      if (h._min.startTime) firstVisitMap.set(h.customerAccountId, h._min.startTime);
    }

    // Customer spend & visits in period
    const customerPeriodStats = new Map<string, { visits: number; spend: number }>();
    for (const r of periodReservations) {
      const entry = customerPeriodStats.get(r.customerAccountId) || { visits: 0, spend: 0 };
      entry.visits += 1;
      entry.spend += r.totalPrice;
      customerPeriodStats.set(r.customerAccountId, entry);
    }

    let newCount = 0;
    let repeatCount = 0;
    let vipCount = 0;

    for (const cid of activeCustomerIds) {
      const firstVisit = firstVisitMap.get(cid);
      const stats = customerPeriodStats.get(cid) || { visits: 0, spend: 0 };

      if (firstVisit && firstVisit >= dayStart && firstVisit <= dayEnd) {
        newCount++;
      } else if (stats.visits >= 2) {
        repeatCount++;
      }

      if (stats.visits >= 5 || stats.spend >= 100000) {
        vipCount++;
      }
    }

    // At-Risk: Customers with >= 3 visits in past 60 days before dayStart, but 0 visits in selected period
    const sixtyDaysAgo = subDays(dayStart, 60);
    const recent60Visits = allVisits.filter((v) => v.startTime >= sixtyDaysAgo && v.startTime < dayStart);
    const customer60Count = new Map<string, number>();

    for (const v of recent60Visits) {
      customer60Count.set(v.customerAccountId, (customer60Count.get(v.customerAccountId) || 0) + 1);
    }

    let atRiskCount = 0;
    for (const [cid, count] of customer60Count.entries()) {
      if (count >= 3 && !activeCustomerIds.has(cid)) {
        atRiskCount++;
      }
    }

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      totalActiveInPeriod: activeCustomerIds.size,
      segments: [
        { key: 'NEW', title: 'New Customers', count: newCount, description: 'First visit occurred in current period' },
        { key: 'REPEAT', title: 'Repeat Customers', count: repeatCount, description: '2+ visits in current period' },
        { key: 'VIP', title: 'High-Value (VIP)', count: vipCount, description: '5+ visits or high recorded spend' },
        { key: 'AT_RISK', title: 'Declining Activity (At-Risk)', count: atRiskCount, description: '3+ prior visits in 60d, 0 in current period' },
      ],
    };
  },

  async getTopSpenders(gamingCenterId: string, startDateInput: Date, endDateInput: Date, limit = 10) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const rawPeriodReservations = await AnalyticsRepo.getCompletedCustomerReservations(gamingCenterId, dayStart, dayEnd);
    const periodReservations = rawPeriodReservations.filter((r): r is typeof r & { customerAccountId: string } => Boolean(r.customerAccountId));

    const spenderMap = new Map<
      string,
      { customerAccountId: string; fullName: string | null; phone: string; visits: number; totalSpend: number }
    >();

    for (const r of periodReservations) {
      let entry = spenderMap.get(r.customerAccountId);
      if (!entry) {
        entry = {
          customerAccountId: r.customerAccountId,
          fullName: r.customerAccount?.fullName || null,
          phone: maskPhone(r.customerAccount?.phone),
          visits: 0,
          totalSpend: 0,
        };
        spenderMap.set(r.customerAccountId, entry);
      }
      entry.visits += 1;
      entry.totalSpend += r.totalPrice;
    }

    const topSpenders = Array.from(spenderMap.values())
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, limit);

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      topSpenders,
    };
  },
};
