import { AnalyticsRepo } from './analytics.repo';
import { resolveTimezoneAndBoundaries } from './analytics.validators';
import { formatInTimeZone } from 'date-fns-tz';
import { differenceInDays, subDays, addDays } from 'date-fns';

function maskPhone(phone?: string | null): string {
  if (!phone || phone.length < 7) return '***';
  return phone.slice(0, 4) + '***' + phone.slice(-4);
}

function calculateOverlapHours(
  startA: Date,
  endA: Date | null | undefined,
  startWindow: Date,
  endWindow: Date
): number {
  const effectiveEndA = endA || endWindow;
  const overlapStart = startA > startWindow ? startA : startWindow;
  const overlapEnd = effectiveEndA < endWindow ? effectiveEndA : endWindow;

  if (overlapEnd <= overlapStart) return 0;
  return Math.round(((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60)) * 100) / 100;
}

function mergeOverlappingIntervals(intervals: Array<{ start: Date; end: Date }>): Array<{ start: Date; end: Date }> {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Array<{ start: Date; end: Date }> = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];

    if (curr.start <= prev.end) {
      if (curr.end > prev.end) {
        prev.end = curr.end;
      }
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

function calculateDailyOperatingHours(openingTime?: string | null, closingTime?: string | null): number {
  if (!openingTime || !closingTime) return 24;
  const [openH, openM] = openingTime.split(':').map(Number);
  const [closeH, closeM] = closingTime.split(':').map(Number);

  if (isNaN(openH) || isNaN(openM) || isNaN(closeH) || isNaN(closeM)) return 24;

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (closeMinutes <= openMinutes) {
    return Math.round((((24 * 60 - openMinutes) + closeMinutes) / 60) * 100) / 100;
  }

  return Math.round(((closeMinutes - openMinutes) / 60) * 100) / 100;
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

    const eligibleForCompletion = totalReservations - canceledReservations;
    const completionRate =
      eligibleForCompletion > 0
        ? Math.round((completedReservations / eligibleForCompletion) * 10000) / 100
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

    const [liveResStats, rawReservations, stationsList, leadTimeData, canceledWithPaidData, gamingSessionsData] =
      await Promise.all([
        AnalyticsRepo.getLiveReservationStats(gamingCenterId, dayStart, dayEnd),
        AnalyticsRepo.getReservationListForTrends(gamingCenterId, dayStart, dayEnd),
        AnalyticsRepo.getStationDetails(gamingCenterId),
        AnalyticsRepo.getReservationLeadTimeStats(gamingCenterId, dayStart, dayEnd),
        AnalyticsRepo.getCanceledWithPaidStats(gamingCenterId, dayStart, dayEnd),
        AnalyticsRepo.getStationGamingSessionStats(gamingCenterId, dayStart, dayEnd),
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
    const expired = statusDistribution.find((s) => s.status === 'EXPIRED');

    const completedCount = completed?.count || 0;
    const canceledCount = canceled?.count || 0;
    const noShowCount = noShow?.count || 0;
    const expiredCount = expired?.count || 0;

    // Explicit denominator definitions:
    // completionRate: completed / eligibleForCompletion (COMPLETED + CANCELED + NO_SHOW + EXPIRED)
    const eligibleForCompletion = completedCount + canceledCount + noShowCount + expiredCount;
    const completionRate =
      eligibleForCompletion > 0 ? Math.round((completedCount / eligibleForCompletion) * 10000) / 100 : 0;

    // cancellationRate: canceled / totalReservations created
    const cancellationRate =
      totalReservations > 0 ? Math.round((canceledCount / totalReservations) * 10000) / 100 : 0;

    // noShowRate: noShow / eligibleForAttendance (COMPLETED + CANCELED + NO_SHOW)
    const eligibleForAttendance = completedCount + canceledCount + noShowCount;
    const noShowRate =
      eligibleForAttendance > 0 ? Math.round((noShowCount / eligibleForAttendance) * 10000) / 100 : 0;

    const averageDurationHours =
      completedCount > 0 ? Math.round(((completed?.totalHours || 0) / completedCount) * 100) / 100 : 0;
    const averageReservationValue =
      completedCount > 0 ? Math.round((completed?.totalPrice || 0) / completedCount) : 0;

    // Lead time calculation (startTime - createdAt)
    const leadTimeMinutesList = leadTimeData
      .map((r) => {
        const diffMs = r.startTime.getTime() - r.createdAt.getTime();
        return diffMs > 0 ? Math.round(diffMs / (1000 * 60)) : 0;
      })
      .sort((a, b) => a - b);

    const leadTimeCount = leadTimeMinutesList.length;
    const totalLeadTimeMinutes = leadTimeMinutesList.reduce((acc, m) => acc + m, 0);
    const averageLeadTimeMinutes = leadTimeCount > 0 ? Math.round(totalLeadTimeMinutes / leadTimeCount) : 0;

    let medianLeadTimeMinutes = 0;
    if (leadTimeCount > 0) {
      const mid = Math.floor(leadTimeCount / 2);
      medianLeadTimeMinutes =
        leadTimeCount % 2 !== 0
          ? leadTimeMinutesList[mid]
          : Math.round((leadTimeMinutesList[mid - 1] + leadTimeMinutesList[mid]) / 2);
    }

    // Planned vs Actual Duration
    const totalPlannedHours = liveResStats.byStatus.reduce((acc, s) => acc + (s._sum.totalHours || 0), 0);
    const totalActualHours = gamingSessionsData.reduce((acc, gs) => {
      if (gs.actualHours && gs.actualHours > 0) {
        return acc + gs.actualHours;
      }
      return acc + calculateOverlapHours(gs.startTime, gs.endTime, dayStart, dayEnd);
    }, 0);

    // Canceled reservations with paid status tracking
    const canceledWithPaidCount = canceledWithPaidData.length;
    const unrefundedCanceledAmount = canceledWithPaidData.reduce((acc, res) => {
      const totalPaid = res.payments.reduce((pAcc, p) => pAcc + p.amount, 0);
      const totalRefunded = res.payments.reduce(
        (pAcc, p) => pAcc + p.refunds.reduce((rAcc, r) => rAcc + r.amount, 0),
        0
      );
      return acc + Math.max(0, totalPaid - totalRefunded);
    }, 0);

    // Trends calculation
    const trendsMap = new Map<
      string,
      { date: string; total: number; completed: number; canceled: number; revenue: number }
    >();
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
        averageLeadTimeMinutes,
        medianLeadTimeMinutes,
        totalPlannedHours: Math.round(totalPlannedHours * 100) / 100,
        totalActualHours: Math.round(totalActualHours * 100) / 100,
      },
      anomalies: {
        canceledWithPaidCount,
        unrefundedCanceledAmount: Math.round(unrefundedCanceledAmount),
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

    const [stats, expenses, discountBreakdown] = await Promise.all([
      AnalyticsRepo.getLiveFinancialStats(gamingCenterId, dayStart, dayEnd, currencyFilter),
      AnalyticsRepo.getApprovedExpenses(gamingCenterId, dayStart, dayEnd, currencyFilter),
      AnalyticsRepo.getDiscountFundingBreakdown(gamingCenterId, dayStart, dayEnd),
    ]);

    // Primary currency calculation
    const primaryCurrency = currencyFilter || stats.paidPayments[0]?.currency || 'IRR';

    // Strictly isolate totals by currency
    const paidForPrimary = stats.paidPayments.filter((p) => p.currency === primaryCurrency);
    const grossCollected = paidForPrimary.reduce((acc, p) => acc + (p._sum.amount || 0), 0);

    const refundsForPrimary = stats.refunds.filter((r) => r.currency === primaryCurrency);
    const totalRefunded = refundsForPrimary.reduce((acc, r) => acc + (r._sum.amount || 0), 0);
    const netCollected = grossCollected - totalRefunded;

    const recognizedRevenue = Math.max(0, netCollected);

    // Expenses & Profitability (with safe fallbacks for unit test mocks)
    const approvedExpensesAmount = expenses?.totalAmount || 0;
    const hasExpenseData = (expenses?.count || 0) > 0;

    let profitabilityStatus = 'NOT_CALCULABLE';
    let netProfit: number | null = null;
    let profitMargin: number | null = null;

    if (hasExpenseData) {
      profitabilityStatus = 'CALCULATED';
      netProfit = recognizedRevenue - approvedExpensesAmount;
      profitMargin = recognizedRevenue > 0 ? Math.round((netProfit / recognizedRevenue) * 10000) / 100 : 0;
    }

    const distinctCurrencies = Array.from(
      new Set([
        ...stats.paidPayments.map((p) => p.currency),
        ...stats.refunds.map((r) => r.currency),
      ])
    );

    const currencySummaries = distinctCurrencies.map((curr) => {
      const gross = stats.paidPayments
        .filter((p) => p.currency === curr)
        .reduce((acc, p) => acc + (p._sum.amount || 0), 0);
      const refunded = stats.refunds
        .filter((r) => r.currency === curr)
        .reduce((acc, r) => acc + (r._sum.amount || 0), 0);
      return {
        currency: curr,
        grossCollected: gross,
        totalRefunded: refunded,
        netCollected: gross - refunded,
      };
    });

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
        merchantRecognizedRevenue: recognizedRevenue,
      },
      discountAnalysis: {
        grossOriginalAmount: discountBreakdown?.grossOriginalAmount || 0,
        totalDiscount: discountBreakdown?.totalDiscount || 0,
        platformFundedDiscount: discountBreakdown?.platformFunded || 0,
        merchantFundedDiscount: discountBreakdown?.merchantFunded || 0,
        notice: 'Platform-funded discounts do not decrease merchant payout.',
      },
      profitability: {
        status: profitabilityStatus,
        cost: hasExpenseData ? approvedExpensesAmount : null,
        netProfit,
        profitMargin,
        expensesByCategory: (expenses?.byCategory || []).map((c) => ({
          category: c.category,
          amount: c._sum.amount || 0,
        })),
        disclaimer: hasExpenseData
          ? 'Net profit calculated as Recognized Revenue minus Approved Operational Expenses.'
          : 'Operational expenses are NOT CALCULABLE for this period due to missing approved expense entries.',
      },
      currencySummaries,
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

    const [liveResStats, stationsList, centerDetails, maintenanceList, sessionList] = await Promise.all([
      AnalyticsRepo.getLiveReservationStats(gamingCenterId, dayStart, dayEnd),
      AnalyticsRepo.getStationDetails(gamingCenterId),
      AnalyticsRepo.getGamingCenterDetails(gamingCenterId),
      AnalyticsRepo.getStationMaintenanceStats(gamingCenterId, dayStart, dayEnd),
      AnalyticsRepo.getStationGamingSessionStats(gamingCenterId, dayStart, dayEnd),
    ]);

    const daysCount = Math.max(differenceInDays(dayEnd, dayStart), 1);
    const dailyOperatingHours = calculateDailyOperatingHours(
      centerDetails?.openingTime,
      centerDetails?.closingTime
    );
    const totalOperatingHours = Math.round(daysCount * dailyOperatingHours * 100) / 100;

    const performance = stationsList.map((station) => {
      const found = liveResStats.byStation.find((s) => s.stationId === station.id);
      const plannedHoursBooked = found?._sum.totalHours || 0;
      const revenue = found?._sum.totalPrice || 0;
      const reservationCount = found?._count._all || 0;

      // Station maintenance downtime with interval merging
      const stationMaintenances = maintenanceList.filter((m) => m.stationId === station.id);
      const rawIntervals = stationMaintenances.map((m) => ({
        start: m.startTime < dayStart ? dayStart : m.startTime,
        end: m.endTime ? (m.endTime > dayEnd ? dayEnd : m.endTime) : dayEnd,
      }));
      const mergedIntervals = mergeOverlappingIntervals(rawIntervals);

      const downtimeHours = mergedIntervals.reduce((acc, inv) => {
        return acc + Math.max(0, (inv.end.getTime() - inv.start.getTime()) / (1000 * 60 * 60));
      }, 0);

      // Available operational capacity (Operating Hours - Downtime)
      const availableOperationalHours = Math.max(0, Math.round((totalOperatingHours - downtimeHours) * 100) / 100);

      // Actual gaming session usage
      const stationSessions = sessionList.filter((s) => s.stationId === station.id);
      const actualSessionHours = stationSessions.reduce((acc, gs) => {
        if (gs.actualHours && gs.actualHours > 0) {
          return acc + gs.actualHours;
        }
        return acc + calculateOverlapHours(gs.startTime, gs.endTime, dayStart, dayEnd);
      }, 0);

      // Rates calculation with zero-denominator protection
      const bookingRate =
        availableOperationalHours > 0
          ? Math.min(100, Math.round((plannedHoursBooked / availableOperationalHours) * 10000) / 100)
          : 0;

      const utilizationRate =
        availableOperationalHours > 0
          ? Math.min(100, Math.round((actualSessionHours / availableOperationalHours) * 10000) / 100)
          : 0;

      const revenuePerAvailableStationHour =
        availableOperationalHours > 0 ? Math.round(revenue / availableOperationalHours) : 0;

      // Potential Revenue Lost estimation
      const estimatedLostRevenue = Math.round(downtimeHours * station.hourlyPrice);

      return {
        stationId: station.id,
        stationName: station.name,
        stationType: station.stationType,
        isActive: station.isActive,
        reservationCount,
        plannedHoursBooked: Math.round(plannedHoursBooked * 100) / 100,
        actualSessionHours: Math.round(actualSessionHours * 100) / 100,
        downtimeHours: Math.round(downtimeHours * 100) / 100,
        availableOperationalHours,
        revenue,
        revenuePerAvailableStationHour,
        bookingRate,
        utilizationRate,
        estimatedLostRevenue,
      };
    });

    return performance;
  },

  async getMaintenanceAnalytics(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const [stationsList, maintenanceList, centerDetails] = await Promise.all([
      AnalyticsRepo.getStationDetails(gamingCenterId),
      AnalyticsRepo.getStationMaintenanceStats(gamingCenterId, dayStart, dayEnd),
      AnalyticsRepo.getGamingCenterDetails(gamingCenterId),
    ]);

    const daysCount = Math.max(differenceInDays(dayEnd, dayStart), 1);
    const dailyOpHours = calculateDailyOperatingHours(centerDetails?.openingTime, centerDetails?.closingTime);
    const stationCount = Math.max(stationsList.length, 1);
    const totalCenterCapacityHours = daysCount * dailyOpHours * stationCount;

    // MTTR calculation (Mean Time To Repair)
    let totalRepairHours = 0;
    let repairedCount = 0;

    for (const m of maintenanceList) {
      if (m.endTime) {
        const diffMs = m.endTime.getTime() - m.startTime.getTime();
        if (diffMs > 0) {
          totalRepairHours += diffMs / (1000 * 60 * 60);
          repairedCount++;
        }
      }
    }

    const mttrHours = repairedCount > 0 ? Math.round((totalRepairHours / repairedCount) * 100) / 100 : 0;

    // Deduplicated downtime per station
    let totalDowntimeHours = 0;
    let totalEstimatedLostRevenue = 0;

    for (const station of stationsList) {
      const stationMaintenances = maintenanceList.filter((m) => m.stationId === station.id);
      const rawIntervals = stationMaintenances.map((m) => ({
        start: m.startTime < dayStart ? dayStart : m.startTime,
        end: m.endTime ? (m.endTime > dayEnd ? dayEnd : m.endTime) : dayEnd,
      }));
      const merged = mergeOverlappingIntervals(rawIntervals);
      const stDowntime = merged.reduce((acc, inv) => acc + (inv.end.getTime() - inv.start.getTime()) / (1000 * 60 * 60), 0);

      totalDowntimeHours += stDowntime;
      totalEstimatedLostRevenue += stDowntime * station.hourlyPrice;
    }

    totalDowntimeHours = Math.round(totalDowntimeHours * 100) / 100;
    totalEstimatedLostRevenue = Math.round(totalEstimatedLostRevenue);

    // MTBF calculation
    const breakdownCount = maintenanceList.length;
    let mtbfHours: number | string = 'NOT_ENOUGH_DATA';
    if (breakdownCount >= 2) {
      const operationalHours = Math.max(0, totalCenterCapacityHours - totalDowntimeHours);
      mtbfHours = Math.round((operationalHours / breakdownCount) * 100) / 100;
    }

    // Availability Rate
    const availabilityRate =
      totalCenterCapacityHours > 0
        ? Math.min(100, Math.round(((totalCenterCapacityHours - totalDowntimeHours) / totalCenterCapacityHours) * 10000) / 100)
        : 100;

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      summary: {
        totalBreakdownsCount: breakdownCount,
        totalDowntimeHours,
        availabilityRate,
        mttrHours,
        mtbfHours,
        estimatedPotentialLostRevenue: totalEstimatedLostRevenue,
      },
      maintenanceLogs: maintenanceList,
      disclaimer:
        'Potential lost revenue represents hypothetical unearned capacity based on hourly rates. MTBF requires 2+ breakdown events.',
    };
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

  // Financial Analytics & Reconciliation Methods (Phase 4)
  async getFinancialOverviewDetailed(gamingCenterId: string, startDateInput: Date, endDateInput: Date, currencyFilter?: string) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const detailedStats = await AnalyticsRepo.getFinancialOverviewDetailed(
      gamingCenterId,
      dayStart,
      dayEnd,
      currencyFilter
    );

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      payments: detailedStats.paymentsByStatus.map((p) => ({
        status: p.status,
        currency: p.currency,
        count: p._count._all,
        totalAmount: p._sum.amount || 0,
      })),
      refunds: detailedStats.refundsByStatus.map((r) => ({
        status: r.status,
        currency: r.currency,
        count: r._count._all,
        totalAmount: r._sum.amount || 0,
      })),
      ledger: detailedStats.ledgerByType.map((l) => ({
        entryType: l.entryType,
        currency: l.currency,
        count: l._count._all,
        totalAmount: l._sum.amount || 0,
      })),
      wallet: detailedStats.walletByTypes.map((w) => ({
        type: w.type,
        currency: w.currency,
        count: w._count._all,
        totalAmount: w._sum.amount || 0,
      })),
      customerWallets: detailedStats.totalCustomerWalletBalances,
      commissions: detailedStats.earningsByStatus.map((e) => ({
        targetReached: e.targetReached,
        count: e._count._all,
        totalBaseAmount: e._sum.baseAmount || 0,
        totalCommissionAmount: e._sum.commissionAmount || 0,
      })),
      profitability: {
        status: 'NOT_CALCULABLE',
        cost: null,
        netProfit: null,
        profitMargin: null,
        disclaimer:
          'Expenses and net profitability are NOT CALCULABLE due to lack of authoritative center cost data source and allocation rules.',
      },
    };
  },

  async getFinancialReconciliation(
    gamingCenterId: string,
    startDateInput: Date,
    endDateInput: Date,
    statusFilter = 'ALL',
    ruleIdFilter?: string,
    limit = 50
  ) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const checkResult = await AnalyticsRepo.runFinancialReconciliationCheck(gamingCenterId, dayStart, dayEnd);

    let filteredFindings = checkResult.findings;
    if (statusFilter !== 'ALL') {
      filteredFindings = filteredFindings.filter((f) => f.status === statusFilter);
    }
    if (ruleIdFilter) {
      filteredFindings = filteredFindings.filter((f) => f.ruleId === ruleIdFilter);
    }

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      evaluatedAt: checkResult.evaluatedAt,
      totalEvaluatedRecords: checkResult.totalEvaluatedRecords,
      findingCount: filteredFindings.length,
      statusCounts: checkResult.statusCounts,
      findings: filteredFindings.slice(0, limit),
    };
  },

  // Customer Analytics Methods (Phase 3 & Refined Growth Analytics)
  async getCustomerSummary(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const [
      allPeriodReservations,
      allHistoricalFirstVisits,
      rawRegisteredAccountsStats,
      rawReservingCustomersCount,
      rawPayingCustomersCount,
    ] = await Promise.all([
      AnalyticsRepo.getCompletedCustomerReservations(gamingCenterId, dayStart, dayEnd),
      AnalyticsRepo.getCustomerAllHistoricalFirstVisits(gamingCenterId, dayEnd),
      AnalyticsRepo.getRegisteredAccountsStats(gamingCenterId, dayStart, dayEnd),
      AnalyticsRepo.getReservingCustomersCount(gamingCenterId, dayStart, dayEnd),
      AnalyticsRepo.getPayingCustomersCount(gamingCenterId, dayStart, dayEnd),
    ]);

    const registeredAccountsStats = rawRegisteredAccountsStats || { registeredInPeriod: 0, totalRegistered: 0 };
    const reservingCustomersCount = rawReservingCustomersCount || 0;
    const payingCustomersCount = rawPayingCustomersCount || 0;

    // Exclude unlinked/walk-in reservations without customerAccountId
    const periodReservations = allPeriodReservations.filter(
      (r): r is typeof r & { customerAccountId: string } => Boolean(r.customerAccountId)
    );
    const historicalFirstVisits = allHistoricalFirstVisits.filter(
      (h): h is typeof h & { customerAccountId: string } => Boolean(h.customerAccountId)
    );

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

    const repeatVisitRate =
      activeCustomersCount > 0 ? Math.round((repeatCustomersCount / activeCustomersCount) * 10000) / 100 : 0;
    const avgSpendPerActiveCustomer =
      activeCustomersCount > 0 ? Math.round(totalRecordedSpend / activeCustomersCount) : 0;
    const avgSpendPerVisit =
      periodReservations.length > 0 ? Math.round(totalRecordedSpend / periodReservations.length) : 0;

    // Calculate Average Time Between Visits for repeat active customers using historical data
    const rawHistoricalVisits = await AnalyticsRepo.getCustomerAllHistoricalVisits(gamingCenterId, dayEnd);
    const allHistoricalVisits = rawHistoricalVisits.filter(
      (v): v is typeof v & { customerAccountId: string } => Boolean(v.customerAccountId)
    );
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
      entityTaxonomyBreakdown: {
        registeredAccountsInPeriod: registeredAccountsStats.registeredInPeriod,
        totalRegisteredAccounts: registeredAccountsStats.totalRegistered,
        reservingCustomersCount,
        payingCustomersCount,
        completedSessionCustomersCount: activeCustomersCount,
      },
      activeCustomers: activeCustomersCount,
      newCustomers: newCustomersCount,
      returningCustomers: returningCustomersCount,
      repeatCustomers: repeatCustomersCount,
      repeatVisitRate,
      avgDaysBetweenVisits,
      totalRecordedSpend,
      avgSpendPerActiveCustomer,
      avgSpendPerVisit,
      entityDistinctionNotice:
        'Distinct entities are strictly separated: Registered Account = User profile created; Reserving Customer = Created 1+ reservations; Paying Customer = Made 1+ successful payments; Completed Session Customer = Finished 1+ gaming sessions.',
      ltvDisclaimer:
        'Metric represents historical recorded spend during selected period, not predictive lifetime value (LTV).',
    };
  },

  // Visitor Analytics Method
  // Cancellation Analytics Method
  async getCancellationAnalytics(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const { canceledReservations, totalReservationsCount } = await AnalyticsRepo.getCancellationAnalyticsStats(
      gamingCenterId,
      dayStart,
      dayEnd
    );

    const totalCanceled = canceledReservations.length;
    const cancellationRate =
      totalReservationsCount > 0 ? Math.round((totalCanceled / totalReservationsCount) * 10000) / 100 : 0;

    const categoryMap = new Map<string, number>();
    const actorMap = new Map<string, number>();

    let discountedCanceled = 0;
    let nonDiscountedCanceled = 0;

    for (const r of canceledReservations) {
      const category = r.cancelCategory || 'UNKNOWN';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);

      const actor = r.cancelActor || 'SYSTEM';
      actorMap.set(actor, (actorMap.get(actor) || 0) + 1);

      if (r.discountAmount > 0 || r.voucherCode) {
        discountedCanceled++;
      } else {
        nonDiscountedCanceled++;
      }
    }

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      totalReservationsCount,
      totalCanceledCount: totalCanceled,
      cancellationRate,
      byCategory: Array.from(categoryMap.entries()).map(([category, count]) => ({
        category,
        count,
        percentage: totalCanceled > 0 ? Math.round((count / totalCanceled) * 10000) / 100 : 0,
      })),
      byActor: Array.from(actorMap.entries()).map(([actor, count]) => ({
        actor,
        count,
        percentage: totalCanceled > 0 ? Math.round((count / totalCanceled) * 10000) / 100 : 0,
      })),
      discountedvsNonDiscounted: {
        discountedCanceledCount: discountedCanceled,
        nonDiscountedCanceledCount: nonDiscountedCanceled,
      },
      notice: 'Legacy canceled reservations without explicit category tag are classified as UNKNOWN to prevent artificial data insertion.',
    };
  },

  async getVisitorReport(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const stats = await AnalyticsRepo.getVisitorEventStats(gamingCenterId, dayStart, dayEnd);

    const pageViewFound = stats.byType.find((s) => s.eventType === 'page_view');
    const totalPageViews = pageViewFound?._count._all || 0;

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      totalEvents: stats.totalEvents,
      totalPageViews,
      uniqueVisitors: stats.uniqueVisitorsCount,
      uniqueSessions: stats.uniqueSessionsCount,
      eventTypeDistribution: stats.byType.map((s) => ({
        eventType: s.eventType,
        count: s._count._all,
      })),
      privacyPolicyNotice:
        'Visitor identification relies on pseudonymous random session keys. Personal identification parameters, raw IP addresses, and device fingerprints are strictly excluded from event payloads.',
    };
  },

  // Operational Conversion Funnel Method
  async getConversionFunnel(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const [events, reservations] = await Promise.all([
      AnalyticsRepo.getVisitorEventsForFunnel(gamingCenterId, dayStart, dayEnd),
      AnalyticsRepo.getFunnelReservations(gamingCenterId, dayStart, dayEnd),
    ]);

    const safeEvents = events || [];
    const safeReservations = reservations || [];

    // Aggregate Visitor Events by Type
    const pageViewsCount = safeEvents.filter((e) => e.eventType === 'page_view').length;
    const centerViewsCount = safeEvents.filter((e) => e.eventType === 'center_view').length;
    const stationViewsCount = safeEvents.filter((e) => e.eventType === 'station_view').length;
    const bookingStartedCount = safeEvents.filter((e) => e.eventType === 'booking_started').length;
    const checkoutStartedCount = safeEvents.filter((e) => e.eventType === 'checkout_started').length;

    // Database Verified Stages
    const totalCreated = safeReservations.length;
    let paidCount = 0;
    let completedCount = 0;

    for (const r of reservations) {
      if (r.paymentState === 'PAID' || r.payments.some((p) => p.paidAt)) {
        paidCount++;
      }
      if (r.status === 'COMPLETED' || r.status === 'CONFIRMED') {
        completedCount++;
      }
    }

    const hasEventData = safeEvents.length > 0;

    if (!hasEventData) {
      let sessionStartedCount = 0;

      for (const r of safeReservations) {
        if (r.gamingSessions && r.gamingSessions.length > 0) {
          sessionStartedCount++;
        }
      }
      const stage1To2Conversion = totalCreated > 0 ? Math.round((paidCount / totalCreated) * 10000) / 100 : 0;
      const stage2To3Conversion = paidCount > 0 ? Math.round((sessionStartedCount / paidCount) * 10000) / 100 : 0;
      const stage3To4Conversion = sessionStartedCount > 0 ? Math.round((completedCount / sessionStartedCount) * 10000) / 100 : 0;
      const overallConversion = totalCreated > 0 ? Math.round((completedCount / totalCreated) * 10000) / 100 : 0;

      return {
        period: { startDate: dayStart, endDate: dayEnd, timeZone },
        webTrafficFunnelStatus: 'DATA_COLLECTION_MISSING',
        webTrafficNotice:
          'Web traffic, pageviews, and site search events are not instrumented on frontend. Operational conversion funnel below is constructed strictly from verified database state events.',
        funnel: [
          {
            stageOrder: 1,
            stageKey: 'RESERVATION_CREATED',
            stageTitle: 'Reservation Created',
            count: totalCreated,
            conversionFromInitial: 100,
            conversionFromPrevious: 100,
            droppedCount: 0,
          },
          {
            stageOrder: 2,
            stageKey: 'PAYMENT_SUCCEEDED',
            stageTitle: 'Payment Succeeded',
            count: paidCount,
            conversionFromInitial: stage1To2Conversion,
            conversionFromPrevious: stage1To2Conversion,
            droppedCount: Math.max(0, totalCreated - paidCount),
          },
          {
            stageOrder: 3,
            stageKey: 'SESSION_STARTED',
            stageTitle: 'Gaming Session Started',
            count: sessionStartedCount,
            conversionFromInitial: totalCreated > 0 ? Math.round((sessionStartedCount / totalCreated) * 10000) / 100 : 0,
            conversionFromPrevious: stage2To3Conversion,
            droppedCount: Math.max(0, paidCount - sessionStartedCount),
          },
          {
            stageOrder: 4,
            stageKey: 'RESERVATION_COMPLETED',
            stageTitle: 'Reservation Completed',
            count: completedCount,
            conversionFromInitial: overallConversion,
            conversionFromPrevious: stage3To4Conversion,
            droppedCount: Math.max(0, sessionStartedCount - completedCount),
          },
        ],
        summary: {
          totalReservationsCreated: totalCreated,
          totalReservationsCompleted: completedCount,
          overallConversionRate: overallConversion,
        },
      };
    }

    // When web traffic events are present, build 7-stage funnel

    const stage1SiteVisit = Math.max(pageViewsCount, totalCreated);
    const stage2CenterView = Math.max(centerViewsCount, totalCreated);
    const stage3StationView = Math.max(stationViewsCount, totalCreated);
    const stage4BookingStarted = Math.max(bookingStartedCount, totalCreated);
    const stage5CheckoutStarted = Math.max(checkoutStartedCount, paidCount);
    const stage6PaymentSucceeded = paidCount;
    const stage7BookingConfirmed = completedCount;

    const stages = [
      { order: 1, key: 'SITE_VISIT', title: 'Site Visit', count: stage1SiteVisit },
      { order: 2, key: 'CENTER_VIEW', title: 'Center View', count: stage2CenterView },
      { order: 3, key: 'STATION_VIEW', title: 'Station View', count: stage3StationView },
      { order: 4, key: 'BOOKING_STARTED', title: 'Booking Started', count: stage4BookingStarted },
      { order: 5, key: 'CHECKOUT_STARTED', title: 'Checkout Started', count: stage5CheckoutStarted },
      { order: 6, key: 'PAYMENT_SUCCEEDED', title: 'Payment Succeeded (Verified)', count: stage6PaymentSucceeded },
      { order: 7, key: 'BOOKING_CONFIRMED', title: 'Booking Confirmed (Verified)', count: stage7BookingConfirmed },
    ];

    const initialCount = stages[0].count;
    const funnelStages = stages.map((s, idx) => {
      const prevCount = idx === 0 ? s.count : stages[idx - 1].count;
      const convFromInitial = initialCount > 0 ? Math.round((s.count / initialCount) * 10000) / 100 : 0;
      const convFromPrev = prevCount > 0 ? Math.round((s.count / prevCount) * 10000) / 100 : 0;
      const dropped = Math.max(0, prevCount - s.count);

      return {
        stageOrder: s.order,
        stageKey: s.key,
        stageTitle: s.title,
        count: s.count,
        conversionFromInitial: convFromInitial,
        conversionFromPrevious: convFromPrev,
        droppedCount: dropped,
      };
    });

    const overallConversionRate = initialCount > 0 ? Math.round((stage7BookingConfirmed / initialCount) * 10000) / 100 : 0;

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      webTrafficFunnelStatus: 'INSTRUMENTED',
      webTrafficNotice:
        'Conversion funnel integrates real-time client visitor events and server-verified database payment confirmations.',
      funnel: funnelStages,
      summary: {
        initialTrafficCount: initialCount,
        totalReservationsCreated: totalCreated,
        totalReservationsConfirmed: stage7BookingConfirmed,
        totalReservationsCompleted: completedCount,
        overallConversionRate,
      },
    };
  },

  // Marketing CAC & Campaign Attribution Method
  async getMarketingAttributionAnalytics(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const { spends, campaigns, reservations, newCustomers } = await AnalyticsRepo.getMarketingAttributionData(
      gamingCenterId,
      dayStart,
      dayEnd
    );

    const totalMarketingSpend = spends.reduce((acc, s) => acc + s.amount, 0);
    const newCustomerAccountIds = new Set(newCustomers.map((c) => c.customerAccountId));

    // Map campaign stats
    const campaignStatsMap = new Map<
      string,
      {
        campaignKey: string;
        campaignName: string;
        marketingSpend: number;
        platformDiscountSubsidy: number;
        attributedNewCustomers: Set<string>;
        attributedRevenue: number;
      }
    >();

    // Initialize stats from recorded spends
    for (const spend of spends) {
      const key = spend.campaignId || spend.source;
      const entry = campaignStatsMap.get(key) || {
        campaignKey: key,
        campaignName: spend.campaignName,
        marketingSpend: 0,
        platformDiscountSubsidy: 0,
        attributedNewCustomers: new Set(),
        attributedRevenue: 0,
      };
      entry.marketingSpend += spend.amount;
      campaignStatsMap.set(key, entry);
    }

    let unattributedNewCustomersCount = 0;
    let unattributedRevenue = 0;

    for (const r of reservations) {
      const isNewCust = newCustomerAccountIds.has(r.customerAccountId);

      const campaignKey =
        r.campaignId ||
        r.utmCampaign ||
        r.utmSource ||
        (r.voucherCode ? `CODE:${r.voucherCode}` : null);

      if (campaignKey) {
        let entry = campaignStatsMap.get(campaignKey);
        if (!entry) {
          const campObj = campaigns.find((c) => c.id === campaignKey || c.code === r.voucherCode);
          entry = {
            campaignKey,
            campaignName: campObj?.name || campaignKey,
            marketingSpend: 0,
            platformDiscountSubsidy: 0,
            attributedNewCustomers: new Set(),
            attributedRevenue: 0,
          };
          campaignStatsMap.set(campaignKey, entry);
        }

        entry.attributedRevenue += r.totalPrice;
        entry.platformDiscountSubsidy += r.platformFundedDiscount || r.discountAmount || 0;

        if (isNewCust) {
          entry.attributedNewCustomers.add(r.customerAccountId);
        }
      } else {
        unattributedRevenue += r.totalPrice;
        if (isNewCust) {
          unattributedNewCustomersCount++;
        }
      }
    }

    // Compute CAC & ROAS for each campaign
    const campaignBreakdown = Array.from(campaignStatsMap.values()).map((c) => {
      const newCustCount = c.attributedNewCustomers.size;
      const cac = newCustCount > 0 ? Math.round(c.marketingSpend / newCustCount) : null;
      const roas = c.marketingSpend > 0 ? Math.round((c.attributedRevenue / c.marketingSpend) * 100) / 100 : null;

      return {
        campaignKey: c.campaignKey,
        campaignName: c.campaignName,
        marketingSpend: c.marketingSpend,
        platformDiscountSubsidy: c.platformDiscountSubsidy,
        totalCampaignCost: c.marketingSpend + c.platformDiscountSubsidy,
        attributedNewCustomersCount: newCustCount,
        attributedRevenue: c.attributedRevenue,
        cacStatus: cac !== null ? 'CALCULATED' : 'NOT_CALCULABLE_ZERO_CUSTOMERS',
        cac,
        roasStatus: roas !== null ? 'CALCULATED' : 'NOT_CALCULABLE_ZERO_SPEND',
        roas,
      };
    });

    const totalAttributedNewCustomers = Array.from(campaignStatsMap.values()).reduce(
      (acc, c) => acc + c.attributedNewCustomers.size,
      0
    );

    const overallCAC =
      totalAttributedNewCustomers > 0 ? Math.round(totalMarketingSpend / totalAttributedNewCustomers) : null;

    const totalAttributedRevenue = Array.from(campaignStatsMap.values()).reduce(
      (acc, c) => acc + c.attributedRevenue,
      0
    );

    const overallROAS =
      totalMarketingSpend > 0 ? Math.round((totalAttributedRevenue / totalMarketingSpend) * 100) / 100 : null;

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      summary: {
        totalMarketingSpend,
        totalNewCustomers: newCustomers.length,
        totalAttributedNewCustomers,
        unattributedNewCustomersCount,
        unattributedRevenue,
        overallCACStatus: overallCAC !== null ? 'CALCULATED' : 'NOT_CALCULABLE',
        overallCAC,
        overallROASStatus: overallROAS !== null ? 'CALCULATED' : 'NOT_CALCULABLE',
        overallROAS,
      },
      campaignBreakdown,
      unattributedNotice:
        'Customers without explicit UTM, campaign ID, or promotional voucher parameters are classified as UNATTRIBUTED_SOURCE and excluded from specific campaign CAC calculations.',
    };
  },

  // Discount Retention Method
  async getDiscountRetentionAnalytics(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const rawReservations = await AnalyticsRepo.getDiscountCohortReservations(gamingCenterId, dayEnd);
    const reservations = rawReservations.filter((r): r is typeof r & { customerAccountId: string } => Boolean(r.customerAccountId));

    const customerResMap = new Map<string, typeof reservations>();
    for (const r of reservations) {
      if (!customerResMap.has(r.customerAccountId)) {
        customerResMap.set(r.customerAccountId, []);
      }
      customerResMap.get(r.customerAccountId)!.push(r);
    }

    const now = new Date();

    interface CohortCustomer {
      customerAccountId: string;
      initialDate: Date;
      cohortType: 'PLATFORM_DISCOUNTED' | 'MERCHANT_DISCOUNTED' | 'NON_DISCOUNTED';
      initialDiscountAmount: number;
      subsequentReservations: typeof reservations;
    }

    const cohortCustomers: CohortCustomer[] = [];

    for (const [cid, resList] of customerResMap.entries()) {
      if (resList.length === 0) continue;
      const initial = resList[0];

      if (initial.startTime > dayEnd) continue;

      const isDiscounted = initial.discountAmount > 0 || Boolean(initial.voucherCode);
      let cohortType: CohortCustomer['cohortType'] = 'NON_DISCOUNTED';

      if (isDiscounted) {
        if (initial.discountFundingSource === 'MERCHANT_FUNDED') {
          cohortType = 'MERCHANT_DISCOUNTED';
        } else {
          cohortType = 'PLATFORM_DISCOUNTED';
        }
      }

      cohortCustomers.push({
        customerAccountId: cid,
        initialDate: initial.startTime,
        cohortType,
        initialDiscountAmount: initial.discountAmount,
        subsequentReservations: resList.slice(1),
      });
    }

    const evaluateCohort = (group: CohortCustomer[]) => {
      const evalWindow = (days: number) => {
        const eligible = group.filter((c) => differenceInDays(now, c.initialDate) >= days);
        if (eligible.length === 0) {
          return { eligibleCount: 0, retainedCount: 0, retentionRate: 0 };
        }

        let retained = 0;
        for (const c of eligible) {
          const windowEnd = addDays(c.initialDate, days);
          const hasRepeat = c.subsequentReservations.some(
            (sr) => sr.startTime > c.initialDate && sr.startTime <= windowEnd
          );
          if (hasRepeat) retained++;
        }

        return {
          eligibleCount: eligible.length,
          retainedCount: retained,
          retentionRate: Math.round((retained / eligible.length) * 10000) / 100,
        };
      };

      let totalSubsequentBookings = 0;
      let totalSubsequentRevenue = 0;
      let totalDaysToRepeat = 0;
      let repeatCount = 0;

      for (const c of group) {
        totalSubsequentBookings += c.subsequentReservations.length;
        if (c.subsequentReservations.length > 0) {
          repeatCount++;
          const firstRepeat = c.subsequentReservations[0];
          const daysToRepeat = Math.abs(differenceInDays(firstRepeat.startTime, c.initialDate));
          totalDaysToRepeat += daysToRepeat;
          for (const sr of c.subsequentReservations) {
            totalSubsequentRevenue += sr.totalPrice;
          }
        }
      }

      const totalCustomers = group.length;
      const avgSubsequentBookings = totalCustomers > 0 ? Math.round((totalSubsequentBookings / totalCustomers) * 10) / 10 : 0;
      const avgSubsequentRevenue = totalCustomers > 0 ? Math.round(totalSubsequentRevenue / totalCustomers) : 0;
      const avgDaysToFirstRepeat = repeatCount > 0 ? Math.round((totalDaysToRepeat / repeatCount) * 10) / 10 : 0;

      return {
        totalCustomers,
        retention30d: evalWindow(30),
        retention60d: evalWindow(60),
        retention90d: evalWindow(90),
        avgSubsequentBookings,
        avgSubsequentRevenue,
        avgDaysToFirstRepeat,
      };
    };

    const platformGroup = cohortCustomers.filter((c) => c.cohortType === 'PLATFORM_DISCOUNTED');
    const merchantGroup = cohortCustomers.filter((c) => c.cohortType === 'MERCHANT_DISCOUNTED');
    const nonDiscountedGroup = cohortCustomers.filter((c) => c.cohortType === 'NON_DISCOUNTED');

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      totalCustomersEvaluated: cohortCustomers.length,
      cohortComparison: {
        platformDiscounted: evaluateCohort(platformGroup),
        merchantDiscounted: evaluateCohort(merchantGroup),
        nonDiscounted: evaluateCohort(nonDiscountedGroup),
      },
      incompleteWindowNotice:
        'Customers whose observation window (30/60/90 days) has not elapsed since their initial booking are excluded from the retention denominator for that window to prevent artificial churn bias.',
      correlationDisclaimer:
        'Metrics report observed repeat booking behavior across discount cohorts. Observed associations do NOT imply causality or incrementality.',
    };
  },

  // Discount Effectiveness Method
  async getDiscountAnalytics(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const reservations = await AnalyticsRepo.getDiscountPerformanceReservations(
      gamingCenterId,
      dayStart,
      dayEnd
    );

    let discountedCount = 0;
    let nonDiscountedCount = 0;

    let totalDiscountAmount = 0;

    let discountedCompletedCount = 0;
    let nonDiscountedCompletedCount = 0;

    let discountedRevenue = 0;
    let nonDiscountedRevenue = 0;

    const voucherBreakdownMap = new Map<
      string,
      { voucherCode: string; usageCount: number; totalDiscountGiven: number; totalRevenue: number }
    >();

    for (const r of reservations) {
      const isDiscounted = r.discountAmount > 0 || r.discountId != null || Boolean(r.voucherCode);

      if (isDiscounted) {
        discountedCount++;
        totalDiscountAmount += r.discountAmount;

        if (r.status === 'COMPLETED') {
          discountedCompletedCount++;
          discountedRevenue += r.totalPrice;
        }

        if (r.voucherCode) {
          const entry = voucherBreakdownMap.get(r.voucherCode) || {
            voucherCode: r.voucherCode,
            usageCount: 0,
            totalDiscountGiven: 0,
            totalRevenue: 0,
          };
          entry.usageCount += 1;
          entry.totalDiscountGiven += r.discountAmount;
          if (r.status === 'COMPLETED') entry.totalRevenue += r.totalPrice;
          voucherBreakdownMap.set(r.voucherCode, entry);
        }
      } else {
        nonDiscountedCount++;
        if (r.status === 'COMPLETED') {
          nonDiscountedCompletedCount++;
          nonDiscountedRevenue += r.totalPrice;
        }
      }
    }

    const discountedCompletionRate =
      discountedCount > 0 ? Math.round((discountedCompletedCount / discountedCount) * 10000) / 100 : 0;
    const nonDiscountedCompletionRate =
      nonDiscountedCount > 0 ? Math.round((nonDiscountedCompletedCount / nonDiscountedCount) * 10000) / 100 : 0;

    const avgDiscountAmount = discountedCount > 0 ? Math.round(totalDiscountAmount / discountedCount) : 0;
    const avgDiscountedOrderValue =
      discountedCompletedCount > 0 ? Math.round(discountedRevenue / discountedCompletedCount) : 0;
    const avgNonDiscountedOrderValue =
      nonDiscountedCompletedCount > 0 ? Math.round(nonDiscountedRevenue / nonDiscountedCompletedCount) : 0;

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      summary: {
        totalReservations: reservations.length,
        discountedReservationsCount: discountedCount,
        nonDiscountedReservationsCount: nonDiscountedCount,
        discountPenetrationRate:
          reservations.length > 0 ? Math.round((discountedCount / reservations.length) * 10000) / 100 : 0,
        totalDiscountAmountGiven: Math.round(totalDiscountAmount),
        avgDiscountAmount,
      },
      performanceComparison: {
        discounted: {
          reservationCount: discountedCount,
          completedCount: discountedCompletedCount,
          completionRate: discountedCompletionRate,
          totalRevenue: discountedRevenue,
          avgOrderValue: avgDiscountedOrderValue,
        },
        nonDiscounted: {
          reservationCount: nonDiscountedCount,
          completedCount: nonDiscountedCompletedCount,
          completionRate: nonDiscountedCompletionRate,
          totalRevenue: nonDiscountedRevenue,
          avgOrderValue: avgNonDiscountedOrderValue,
        },
      },
      voucherCodeBreakdown: Array.from(voucherBreakdownMap.values()),
      causalityDisclaimer:
        'Discount code usage metrics report redemption patterns and revenue correlation, but do NOT prove campaign incrementality or ROAS. Establishing causality requires randomized or controlled experiment design.',
    };
  },

  // Instrumentation Gap & Event Collector Specification Method
  async getInstrumentationGaps() {
    return {
      statusOverview: {
        webTrafficTracking: 'DATA_COLLECTION_MISSING',
        campaignAttribution: 'PARTIALLY_COLLECTED',
        loyaltyPointsLedger: 'MISSING_LEDGER',
      },
      gapDetails: [
        {
          gapKey: 'GAP-WEB-001',
          domain: 'WEB_TRAFFIC',
          title: 'Missing Frontend Pageview and Search Tracking',
          status: 'DATA_COLLECTION_MISSING',
          impact: 'Website visitor count and visitor-to-reservation conversion rate cannot be calculated.',
          recommendedAction: 'Deploy Web Event Collector script to capture page_view and center_search events.',
        },
        {
          gapKey: 'GAP-MKT-001',
          domain: 'CAMPAIGN_ATTRIBUTION',
          title: 'Unbound Campaign/UTM Parameters in Reservations',
          status: 'PARTIALLY_COLLECTED',
          impact: 'Campaign attribution window and multi-channel return on ad spend (ROAS) cannot be claimed conclusively.',
          recommendedAction: 'Add utm_source, utm_medium, utm_campaign to Reservation schema and session cookie.',
        },
        {
          gapKey: 'GAP-LOY-001',
          domain: 'LOYALTY_PROGRAM',
          title: 'Absence of Loyalty Points Transaction Ledger',
          status: 'MISSING_LEDGER',
          impact: 'Current membership status exists but historical earn/spend/expiration history is untracked.',
          recommendedAction: 'Implement LoyaltyPointsLedger model with earned, spent, expired point transactions.',
        },
      ],
      requiredEventCatalog: [
        {
          eventName: 'page_view',
          trigger: 'User loads public website page',
          minimalPayloadSchema: { url: 'string', referrer: 'string', deviceType: 'string' },
          pseudonymousActorKey: 'visitor_session_id',
          consentRequirement: 'Essential / Anonymized Analytics Consent',
          retentionPolicy: '90 days raw, 365 days aggregated',
          deduplicationKey: 'visitor_session_id + page_path + minute_timestamp',
          qaAcceptanceCriteria: 'Event fires within 500ms of DOM load with valid session ID.',
        },
        {
          eventName: 'center_search',
          trigger: 'User executes search or station filter on public page',
          minimalPayloadSchema: { query: 'string', stationType: 'string', dateFilter: 'string' },
          pseudonymousActorKey: 'visitor_session_id',
          consentRequirement: 'Analytics Consent',
          retentionPolicy: '90 days raw',
          deduplicationKey: 'visitor_session_id + search_query + timestamp',
          qaAcceptanceCriteria: 'Fires upon query submit with non-empty payload.',
        },
        {
          eventName: 'booking_started',
          trigger: 'User clicks reserve button for a specific time slot',
          minimalPayloadSchema: { gamingCenterId: 'string', stationId: 'string', startTime: 'string' },
          pseudonymousActorKey: 'visitor_session_id',
          consentRequirement: 'Analytics Consent',
          retentionPolicy: '180 days',
          deduplicationKey: 'visitor_session_id + stationId + startTime',
          qaAcceptanceCriteria: 'Fires on checkout page open before payment initiation.',
        },
        {
          eventName: 'booking_completed',
          trigger: 'Payment or reservation confirmation succeeds',
          minimalPayloadSchema: { reservationId: 'string', totalPrice: 'number', discountCode: 'string?' },
          pseudonymousActorKey: 'customer_account_id',
          consentRequirement: 'Contractual / Service Execution',
          retentionPolicy: '7 years (financial audit compliance)',
          deduplicationKey: 'reservationId',
          qaAcceptanceCriteria: 'Fires exactly once per successful reservation confirmation.',
        },
      ],
      openDecisionsRequired: [
        'Define default campaign attribution window (e.g., 7-day or 30-day last-touch).',
        'Establish user consent banner policy for public web analytics cookies in Iran/EU compliance contexts.',
        'Formalize loyalty points earn rate per 1,000 IRR spend.',
      ],
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

  // Phase 7 Privacy-Preserving Benchmarking & Growth Insights Methods
  async getBenchmarks(
    gamingCenterId: string,
    startDateInput: Date,
    endDateInput: Date,
    peerGroupCategory = 'ALL'
  ) {
    if (process.env.ENABLE_ANALYTICS_BENCHMARKING === 'false') {
      return {
        status: 'DISABLED',
        message: 'Cross-tenant benchmarking is currently disabled by administrative policy.',
        isSuppressed: true,
      };
    }

    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    // 1. Calculate Requesting Tenant's Own Metrics
    const tenantSummary = await this.getSummary(gamingCenterId, startDateInput, endDateInput);
    const tenantReservationReport = await this.getReservationReport(gamingCenterId, startDateInput, endDateInput);
    const tenantCustomerSummary = await this.getCustomerSummary(gamingCenterId, startDateInput, endDateInput);

    const daysCount = Math.max(differenceInDays(dayEnd, dayStart), 1);
    const tenantStations = await AnalyticsRepo.getStationDetails(gamingCenterId);
    const tenantStationCount = tenantStations.length;
    const maxPossibleTenantHours = tenantStationCount * daysCount * 24;

    const tenantCompletionRate = tenantSummary.completionRate; // percentage (0-100)
    const tenantAvgSessionDuration = tenantReservationReport.metrics.averageDurationHours;
    const tenantStationUtilization = maxPossibleTenantHours > 0
      ? Math.round(((tenantReservationReport.statusDistribution.find(s => s.status === 'COMPLETED')?.totalHours || 0) / maxPossibleTenantHours) * 10000) / 100
      : 0;
    const tenantRepeatVisitRate = tenantCustomerSummary.repeatVisitRate;

    const tenantMetrics = {
      completionRate: tenantCompletionRate,
      averageSessionDurationHours: tenantAvgSessionDuration,
      stationUtilizationRate: tenantStationUtilization,
      repeatVisitRate: tenantRepeatVisitRate,
    };

    // 2. Fetch Eligible Peer Gaming Centers (excluding requesting tenant)
    const peers = await AnalyticsRepo.getEligiblePeerGamingCenters(gamingCenterId);
    const peerIds = peers.map((p) => p.id);
    const k = peerIds.length;

    // Minimum cohort threshold check (k >= 5)
    if (k < 5) {
      return {
        status: 'SUPPRESSED',
        isSuppressed: true,
        suppressionReason: 'Peer cohort size is below the minimum privacy threshold (k >= 5 required).',
        peerCohortCount: k,
        minimumCohortThreshold: 5,
        peerGroupCategory,
        period: { startDate: dayStart, endDate: dayEnd, timeZone },
        tenantMetrics,
        benchmarks: null,
        dataFreshness: 'FRESH',
      };
    }

    // 3. Compute Peer Cohort Metrics
    const [rawPeerReservations, rawPeerStations, rawPeerCustomers] = await Promise.all([
      AnalyticsRepo.getCrossTenantReservationStats(peerIds, dayStart, dayEnd),
      AnalyticsRepo.getCrossTenantStationCounts(peerIds),
      AnalyticsRepo.getCrossTenantCustomerStats(peerIds, dayStart, dayEnd),
    ]);

    // Group peer metrics by tenant
    const peerCompletionRates: number[] = [];
    const peerAvgDurations: number[] = [];
    const peerStationUtilizations: number[] = [];
    const peerRepeatVisitRates: number[] = [];

    const stationCountMap = new Map<string, number>();
    for (const sc of rawPeerStations) {
      stationCountMap.set(sc.gamingCenterId, sc._count._all);
    }

    for (const peerId of peerIds) {
      const tenantRes = rawPeerReservations.filter((r) => r.gamingCenterId === peerId);
      const totalRes = tenantRes.reduce((acc, r) => acc + r._count._all, 0);
      const completedRes = tenantRes.find((r) => r.status === 'COMPLETED');
      const completedCount = completedRes?._count._all || 0;
      const completedHours = completedRes?._sum.totalHours || 0;

      if (totalRes > 0) {
        const compRate = Math.round((completedCount / totalRes) * 10000) / 100;
        peerCompletionRates.push(compRate);
      }

      if (completedCount > 0) {
        const avgDur = Math.round((completedHours / completedCount) * 100) / 100;
        peerAvgDurations.push(avgDur);
      }

      const stCount = stationCountMap.get(peerId) || 0;
      if (stCount > 0) {
        const maxHours = stCount * daysCount * 24;
        const utilRate = Math.round((completedHours / maxHours) * 10000) / 100;
        peerStationUtilizations.push(utilRate);
      }

      const peerCustRes = rawPeerCustomers.filter((c) => c.gamingCenterId === peerId);
      const activeCusts = peerCustRes.length;
      if (activeCusts > 0) {
        const repeatCusts = peerCustRes.filter((c) => c._count._all >= 2).length;
        const repRate = Math.round((repeatCusts / activeCusts) * 10000) / 100;
        peerRepeatVisitRates.push(repRate);
      }
    }

    const completionRateAggregate = computeAggregateStats(peerCompletionRates);
    const avgDurationAggregate = computeAggregateStats(peerAvgDurations);
    const utilizationAggregate = computeAggregateStats(peerStationUtilizations);
    const repeatVisitAggregate = computeAggregateStats(peerRepeatVisitRates);

    return {
      status: 'PUBLISHED',
      isSuppressed: false,
      peerCohortCount: k,
      peerGroupCategory,
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      tenantMetrics,
      benchmarks: {
        completionRate: completionRateAggregate ? {
          ...completionRateAggregate,
          unit: 'PERCENTAGE',
          diffFromMedian: Math.round((tenantCompletionRate - completionRateAggregate.median) * 100) / 100,
        } : null,
        averageSessionDurationHours: avgDurationAggregate ? {
          ...avgDurationAggregate,
          unit: 'HOURS',
          diffFromMedian: Math.round((tenantAvgSessionDuration - avgDurationAggregate.median) * 100) / 100,
        } : null,
        stationUtilizationRate: utilizationAggregate ? {
          ...utilizationAggregate,
          unit: 'PERCENTAGE',
          diffFromMedian: Math.round((tenantStationUtilization - utilizationAggregate.median) * 100) / 100,
        } : null,
        repeatVisitRate: repeatVisitAggregate ? {
          ...repeatVisitAggregate,
          unit: 'PERCENTAGE',
          diffFromMedian: Math.round((tenantRepeatVisitRate - repeatVisitAggregate.median) * 100) / 100,
        } : null,
      },
      dataFreshness: 'FRESH',
      disclaimer: 'Benchmark aggregates exclude the requesting tenant\'s own metrics. Values are privacy-preserved using k-anonymity (k>=5).',
    };
  },

  async getGrowthInsights(
    gamingCenterId: string,
    startDateInput: Date,
    endDateInput: Date,
    peerGroupCategory = 'ALL'
  ) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const rangeDays = Math.max(differenceInDays(dayEnd, dayStart), 1);
    const priorStart = subDays(dayStart, rangeDays);
    const priorEnd = subDays(dayEnd, rangeDays);

    const [currentSummary, priorSummary, benchmarksResult] = await Promise.all([
      this.getSummary(gamingCenterId, startDateInput, endDateInput),
      this.getSummary(gamingCenterId, priorStart, priorEnd),
      this.getBenchmarks(gamingCenterId, startDateInput, endDateInput, peerGroupCategory),
    ]);

    const insights: Array<{
      id: string;
      title: string;
      metric: string;
      direction: 'IMPROVED' | 'DECLINED' | 'STABLE';
      insightType: 'TREND_VS_PRIOR_PERIOD' | 'BENCHMARK_COMPARISON';
      observedChange: string;
      evidenceBasis: string;
    }> = [];

    // Trend Insight 1: Reservation Volume
    const resDiff = currentSummary.totalReservations - priorSummary.totalReservations;
    const resPctChange = priorSummary.totalReservations > 0
      ? Math.round((resDiff / priorSummary.totalReservations) * 1000) / 10
      : 0;

    insights.push({
      id: 'INSIGHT-001',
      title: 'Reservation Volume Trend',
      metric: 'totalReservations',
      direction: resDiff > 0 ? 'IMPROVED' : resDiff < 0 ? 'DECLINED' : 'STABLE',
      insightType: 'TREND_VS_PRIOR_PERIOD',
      observedChange: `${resDiff >= 0 ? '+' : ''}${resDiff} reservations (${resPctChange >= 0 ? '+' : ''}${resPctChange}%)`,
      evidenceBasis: `Current period: ${currentSummary.totalReservations} vs Prior period: ${priorSummary.totalReservations}`,
    });

    // Trend Insight 2: Completion Rate
    const compDiff = Math.round((currentSummary.completionRate - priorSummary.completionRate) * 100) / 100;
    insights.push({
      id: 'INSIGHT-002',
      title: 'Completion Rate Trend',
      metric: 'completionRate',
      direction: compDiff > 0 ? 'IMPROVED' : compDiff < 0 ? 'DECLINED' : 'STABLE',
      insightType: 'TREND_VS_PRIOR_PERIOD',
      observedChange: `${compDiff >= 0 ? '+' : ''}${compDiff}% percentage points`,
      evidenceBasis: `Current completion rate: ${currentSummary.completionRate}% vs Prior completion rate: ${priorSummary.completionRate}%`,
    });

    // Benchmark Insights (if published)
    if (benchmarksResult.status === 'PUBLISHED' && benchmarksResult.benchmarks) {
      const bm = benchmarksResult.benchmarks;

      if (bm.completionRate) {
        const diff = bm.completionRate.diffFromMedian;
        insights.push({
          id: 'INSIGHT-003',
          title: 'Completion Rate vs Peer Benchmark',
          metric: 'completionRate',
          direction: diff > 0 ? 'IMPROVED' : diff < 0 ? 'DECLINED' : 'STABLE',
          insightType: 'BENCHMARK_COMPARISON',
          observedChange: `${diff >= 0 ? '+' : ''}${diff}% relative to peer median (${bm.completionRate.median}%)`,
          evidenceBasis: `Tenant: ${currentSummary.completionRate}% vs Peer Median: ${bm.completionRate.median}% across ${benchmarksResult.peerCohortCount} peers`,
        });
      }

      if (bm.repeatVisitRate) {
        const diff = bm.repeatVisitRate.diffFromMedian;
        insights.push({
          id: 'INSIGHT-004',
          title: 'Customer Repeat Visit Rate vs Peer Benchmark',
          metric: 'repeatVisitRate',
          direction: diff > 0 ? 'IMPROVED' : diff < 0 ? 'DECLINED' : 'STABLE',
          insightType: 'BENCHMARK_COMPARISON',
          observedChange: `${diff >= 0 ? '+' : ''}${diff}% relative to peer median (${bm.repeatVisitRate.median}%)`,
          evidenceBasis: `Tenant repeat visit rate: ${benchmarksResult.tenantMetrics.repeatVisitRate}% vs Peer Median: ${bm.repeatVisitRate.median}%`,
        });
      }
    }

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      priorPeriod: { startDate: priorStart, endDate: priorEnd },
      insightCount: insights.length,
      insights,
      dataFreshness: 'FRESH',
      disclaimer: 'Growth insights are descriptive observations grounded in historical operational data and peer benchmark aggregates.',
    };
  },

  // Operations & Reliability Analytics Methods
  async getJobsHealth() {
    const { watermarks, runs } = await AnalyticsRepo.getJobsHealthData();

    const entities = [
      'Tenant',
      'Customer',
      'Station',
      'Reservation',
      'GamingSession',
      'Payment',
      'LedgerEntry',
      'Refund',
    ];

    const now = new Date();

    const jobHealthList = entities.map((entity) => {
      const entityRuns = runs.filter((r) => r.entity === entity);
      const watermark = watermarks.find((w) => w.entity === entity);

      const totalRuns = entityRuns.length;
      const successRuns = entityRuns.filter((r) => r.status === 'SUCCESS');
      const failedRuns = entityRuns.filter((r) => r.status === 'FAILED');

      const latestRun = entityRuns[0] || null;
      const lastSuccessfulRun = successRuns[0] || null;

      const lastAttemptAt = latestRun?.startedAt || null;
      const lastSuccessfulRunAt = lastSuccessfulRun?.completedAt || lastSuccessfulRun?.startedAt || watermark?.lastIngestedAt || null;

      let status: 'HEALTHY' | 'STALE' | 'FAILED' | 'NEVER_RUN' = 'HEALTHY';
      if (!lastAttemptAt && !lastSuccessfulRunAt) {
        status = 'NEVER_RUN';
      } else if (latestRun?.status === 'FAILED') {
        status = 'FAILED';
      } else if (lastSuccessfulRunAt && (now.getTime() - new Date(lastSuccessfulRunAt).getTime()) > 120 * 60 * 1000) {
        status = 'STALE';
      }

      const lagSeconds = lastSuccessfulRunAt
        ? Math.max(0, Math.floor((now.getTime() - new Date(lastSuccessfulRunAt).getTime()) / 1000))
        : null;

      const recordsRead = entityRuns.reduce((acc, r) => acc + (r.recordsRead || 0), 0);
      const recordsIngested = entityRuns.reduce((acc, r) => acc + (r.recordsIngested || 0), 0);
      const recordsRejected = Math.max(0, recordsRead - recordsIngested);

      const errorRate = totalRuns > 0 ? Math.round((failedRuns.length / totalRuns) * 10000) / 100 : 0;

      return {
        jobName: `IngestionWorker:${entity}`,
        entity,
        status,
        lastAttemptAt,
        lastSuccessfulRunAt,
        lagSeconds,
        totalRuns,
        successCount: successRuns.length,
        failureCount: failedRuns.length,
        errorRate,
        recordsProcessed: recordsIngested,
        recordsRejected,
        lastError: latestRun?.errorMessage || null,
        watermarkPosition: watermark?.lastIngestedAt || null,
      };
    });

    const isOverallStale = jobHealthList.some((j) => j.status === 'STALE' || j.status === 'FAILED');

    return {
      evaluatedAt: now,
      overallStatus: isOverallStale ? 'DEGRADED' : 'HEALTHY',
      summary: {
        totalJobsMonitored: jobHealthList.length,
        healthyJobsCount: jobHealthList.filter((j) => j.status === 'HEALTHY').length,
        staleJobsCount: jobHealthList.filter((j) => j.status === 'STALE').length,
        failedJobsCount: jobHealthList.filter((j) => j.status === 'FAILED').length,
      },
      jobs: jobHealthList,
    };
  },

  async getSystemErrors(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const errorData = await AnalyticsRepo.getSystemErrorsData(gamingCenterId, dayStart, dayEnd);

    // Sanitize PII from recipients or payloads
    const sanitizedNotifications = errorData.failedNotifications.map((n) => ({
      id: n.id,
      type: n.type,
      channel: n.channel,
      recipient: maskPhone(n.recipient),
      attempts: n.attempts,
      lastError: n.lastError,
      createdAt: n.createdAt,
    }));

    const totalFailedNotifications = sanitizedNotifications.length;
    const totalFailedPayments = errorData.failedPayments.length;
    const totalFailedRefunds = errorData.failedRefunds.length;
    const totalAuditErrorLogs = errorData.auditErrorLogs.length;

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      totalErrors: totalFailedNotifications + totalFailedPayments + totalFailedRefunds,
      errorCategories: {
        notificationFailures: { count: totalFailedNotifications, samples: sanitizedNotifications.slice(0, 10) },
        paymentFailures: { count: totalFailedPayments, samples: errorData.failedPayments.slice(0, 10) },
        refundFailures: { count: totalFailedRefunds, samples: errorData.failedRefunds.slice(0, 10) },
        sensitiveOperationsAudits: { count: totalAuditErrorLogs, samples: errorData.auditErrorLogs.slice(0, 10) },
      },
      disclaimer: 'Telemetry error stream sanitizes sensitive customer details (masked phone/email) and credential tokens.',
    };
  },

  async getDataQuality(gamingCenterId: string) {
    const checks = await AnalyticsRepo.getOperationalDataQualityChecks(gamingCenterId);

    const results = [
      {
        checkId: 'DQ-001',
        title: 'Confirmed Payment Missing Ledger Posting',
        domain: 'FINANCE',
        severity: 'HIGH' as const,
        owner: 'Finance Ops',
        actionRequired: 'Investigate payment collection ledger synchronization',
        findingCount: checks.orphanPayments.length,
        status: checks.orphanPayments.length > 0 ? ('FAILED' as const) : ('PASSED' as const),
        findingsSample: checks.orphanPayments.map((p) => ({ id: p.id, amount: p.amount, currency: p.currency })),
      },
      {
        checkId: 'DQ-002',
        title: 'Canceled Reservation with Unrefunded Paid Status',
        domain: 'RESERVATION',
        severity: 'HIGH' as const,
        owner: 'Reservation Ops',
        actionRequired: 'Process refund or cancel payment state for canceled reservation',
        findingCount: checks.canceledPaidReservations.length,
        status: checks.canceledPaidReservations.length > 0 ? ('FAILED' as const) : ('PASSED' as const),
        findingsSample: checks.canceledPaidReservations.map((r) => ({ id: r.id, totalPrice: r.totalPrice })),
      },
      {
        checkId: 'DQ-003',
        title: 'In Progress Reservation Missing Active Session',
        domain: 'SESSION',
        severity: 'MEDIUM' as const,
        owner: 'Floor Supervisor',
        actionRequired: 'Verify station terminal gaming session start state',
        findingCount: checks.inProgressSessions.length,
        status: checks.inProgressSessions.length > 0 ? ('FAILED' as const) : ('PASSED' as const),
        findingsSample: checks.inProgressSessions.map((s) => ({ id: s.id, startTime: s.startTime })),
      },
      {
        checkId: 'DQ-004',
        title: 'Duplicate Active Waitlist Entry',
        domain: 'WAITLIST',
        severity: 'MEDIUM' as const,
        owner: 'Waitlist Controller',
        actionRequired: 'Consolidate duplicate active waitlist entries for customer',
        findingCount: checks.duplicateWaitlists.length,
        status: checks.duplicateWaitlists.length > 0 ? ('FAILED' as const) : ('PASSED' as const),
        findingsSample: checks.duplicateWaitlists.map((w) => ({
          customerAccountId: w.customerAccountId,
          stationId: w.stationId,
          count: w._count._all,
        })),
      },
      {
        checkId: 'DQ-005',
        title: 'Null Essential Fields in Completed Reservation',
        domain: 'RESERVATION',
        severity: 'HIGH' as const,
        owner: 'Data Engineering',
        actionRequired: 'Audit booking creation schema validation and payload persistence',
        findingCount: checks.nullFieldReservations.length,
        status: checks.nullFieldReservations.length > 0 ? ('FAILED' as const) : ('PASSED' as const),
        findingsSample: checks.nullFieldReservations.map((r) => ({ id: r.id, totalPrice: r.totalPrice })),
      },
      {
        checkId: 'DQ-006',
        title: 'Currency or Timezone Inconsistency in Financials',
        domain: 'FINANCE',
        severity: 'HIGH' as const,
        owner: 'Finance Ops',
        actionRequired: 'Reconcile multi-currency refund postings against payment currency',
        findingCount: checks.currencyInconsistencies.length,
        status: checks.currencyInconsistencies.length > 0 ? ('FAILED' as const) : ('PASSED' as const),
        findingsSample: checks.currencyInconsistencies.map((c) => ({ id: c.id, currency: c.currency })),
      },
      {
        checkId: 'DQ-007',
        title: 'Orphan Rating or Review without Completed Reservation',
        domain: 'RATING',
        severity: 'LOW' as const,
        owner: 'Customer Success',
        actionRequired: 'Verify rating submission relation to completed reservation',
        findingCount: checks.orphanRatings.length,
        status: checks.orphanRatings.length > 0 ? ('FAILED' as const) : ('PASSED' as const),
        findingsSample: checks.orphanRatings.map((r) => ({ id: r.id, rating: r.rating })),
      },
      {
        checkId: 'DQ-008',
        title: 'Analytics Pipeline Ingestion Watermark Lag',
        domain: 'PIPELINE',
        severity: 'HIGH' as const,
        owner: 'Analytics Reliability Eng',
        actionRequired: 'Trigger incremental backfill or inspect worker queue health',
        findingCount: checks.watermarks.filter(
          (w) => Date.now() - new Date(w.lastIngestedAt).getTime() > 120 * 60 * 1000
        ).length,
        status: checks.watermarks.some(
          (w) => Date.now() - new Date(w.lastIngestedAt).getTime() > 120 * 60 * 1000
        )
          ? ('FAILED' as const)
          : ('PASSED' as const),
        findingsSample: checks.watermarks
          .filter((w) => Date.now() - new Date(w.lastIngestedAt).getTime() > 120 * 60 * 1000)
          .map((w) => ({ entity: w.entity, lastIngestedAt: w.lastIngestedAt })),
      },
    ];

    const passedCount = results.filter((r) => r.status === 'PASSED').length;
    const qualityScore = Math.round((passedCount / results.length) * 100);

    return {
      evaluatedAt: new Date(),
      gamingCenterId,
      qualityScore,
      summary: {
        totalChecksEvaluated: results.length,
        passedChecksCount: passedCount,
        failedChecksCount: results.length - passedCount,
      },
      checks: results,
      nonMutationNotice: 'All data quality checks are strictly deterministic and read-only. Operational source data is never modified or deleted automatically.',
    };
  },

  async getSupportQuality(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const tickets = await AnalyticsRepo.getSupportAnalyticsStats(gamingCenterId, dayStart, dayEnd);

    const totalTickets = tickets.length;
    const openTickets = tickets.filter((t) => t.status === 'OPEN').length;
    const pendingTickets = tickets.filter((t) => t.status === 'PENDING').length;
    const answeredTickets = tickets.filter((t) => t.status === 'ANSWERED').length;
    const closedTicketsList = tickets.filter((t) => t.status === 'CLOSED');
    const closedTickets = closedTicketsList.length;

    // First response time calculation
    const firstResponseMinutesList: number[] = [];
    for (const t of tickets) {
      const firstSupportMsg = t.messages.find((m) => m.senderType === 'SUPPORT');
      if (firstSupportMsg) {
        const diffMs = firstSupportMsg.createdAt.getTime() - t.createdAt.getTime();
        firstResponseMinutesList.push(diffMs > 0 ? Math.round(diffMs / (1000 * 60)) : 0);
      }
    }

    firstResponseMinutesList.sort((a, b) => a - b);
    const avgFirstResponseMinutes =
      firstResponseMinutesList.length > 0
        ? Math.round(firstResponseMinutesList.reduce((acc, m) => acc + m, 0) / firstResponseMinutesList.length)
        : 0;

    let medianFirstResponseMinutes = 0;
    if (firstResponseMinutesList.length > 0) {
      const mid = Math.floor(firstResponseMinutesList.length / 2);
      medianFirstResponseMinutes =
        firstResponseMinutesList.length % 2 !== 0
          ? firstResponseMinutesList[mid]
          : Math.round((firstResponseMinutesList[mid - 1] + firstResponseMinutesList[mid]) / 2);
    }

    // Resolution time calculation (STRICTLY for CLOSED tickets only; OPEN tickets MUST NOT be counted as resolved)
    const resolutionMinutesList: number[] = [];
    for (const t of closedTicketsList) {
      if (t.closedAt) {
        const diffMs = t.closedAt.getTime() - t.createdAt.getTime();
        resolutionMinutesList.push(diffMs > 0 ? Math.round(diffMs / (1000 * 60)) : 0);
      }
    }

    resolutionMinutesList.sort((a, b) => a - b);
    const avgResolutionMinutes =
      resolutionMinutesList.length > 0
        ? Math.round(resolutionMinutesList.reduce((acc, m) => acc + m, 0) / resolutionMinutesList.length)
        : 0;

    let medianResolutionMinutes = 0;
    if (resolutionMinutesList.length > 0) {
      const mid = Math.floor(resolutionMinutesList.length / 2);
      medianResolutionMinutes =
        resolutionMinutesList.length % 2 !== 0
          ? resolutionMinutesList[mid]
          : Math.round((resolutionMinutesList[mid - 1] + resolutionMinutesList[mid]) / 2);
    }

    // Category breakdown
    const categoryMap = new Map<string, number>();
    const priorityMap = new Map<string, number>();

    for (const t of tickets) {
      categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + 1);
      priorityMap.set(t.priority, (priorityMap.get(t.priority) || 0) + 1);
    }

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      totalTickets,
      statusDistribution: {
        open: openTickets,
        pending: pendingTickets,
        answered: answeredTickets,
        closed: closedTickets,
      },
      slaMetrics: {
        avgFirstResponseMinutes,
        medianFirstResponseMinutes,
        avgResolutionMinutes,
        medianResolutionMinutes,
        openTicketNotice: 'Resolution SLA metrics are calculated strictly for CLOSED tickets. Active OPEN, PENDING, or ANSWERED tickets are excluded from resolution duration.',
      },
      categoryBreakdown: Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count })),
      priorityBreakdown: Array.from(priorityMap.entries()).map(([priority, count]) => ({ priority, count })),
    };
  },

  async getFeatureAdoption(gamingCenterId: string, startDateInput: Date, endDateInput: Date) {
    const { timeZone, dayStart, dayEnd } = await resolveTimezoneAndBoundaries(
      gamingCenterId,
      startDateInput,
      endDateInput
    );

    const stats = await AnalyticsRepo.getFeatureAdoptionStats(gamingCenterId, dayStart, dayEnd);

    // Waitlist adoption
    const waitlistCount = stats.waitlistEntries.length;
    const waitlistConverted = stats.waitlistEntries.filter((w) => w.status === 'CONVERTED').length;

    // Time Proposals adoption
    const proposalCount = stats.proposals.length;
    const proposalAccepted = stats.proposals.filter((p) => p.status === 'ACCEPTED').length;

    // Discounts adoption
    const discountActiveCount = stats.discounts.filter((d) => d.isActive).length;

    // Group Bookings adoption
    const groupBookingCount = stats.groupBookings.length;

    // Ratings adoption
    const ratingCount = stats.ratings.length;
    const avgRatingScore =
      ratingCount > 0
        ? Math.round((stats.ratings.reduce((acc, r) => acc + r.rating, 0) / ratingCount) * 10) / 10
        : 0;

    // Notification adoption
    const notificationCount = stats.notificationLogs.length;

    return {
      period: { startDate: dayStart, endDate: dayEnd, timeZone },
      features: [
        {
          featureKey: 'RESERVATION_WAITLIST',
          title: 'Reservation Waitlist',
          availability: 'AVAILABLE',
          adoptionStatus: waitlistCount > 0 ? 'ADOPTED' : 'LOW_ADOPTION',
          usageEventsCount: waitlistCount,
          conversionCount: waitlistConverted,
          conversionRate: waitlistCount > 0 ? Math.round((waitlistConverted / waitlistCount) * 10000) / 100 : 0,
        },
        {
          featureKey: 'TIME_PROPOSALS',
          title: 'Reservation Time Proposals',
          availability: 'AVAILABLE',
          adoptionStatus: proposalCount > 0 ? 'ADOPTED' : 'LOW_ADOPTION',
          usageEventsCount: proposalCount,
          conversionCount: proposalAccepted,
          conversionRate: proposalCount > 0 ? Math.round((proposalAccepted / proposalCount) * 10000) / 100 : 0,
        },
        {
          featureKey: 'DISCOUNTS_VOUCHERS',
          title: 'Discounts & Voucher Campaigns',
          availability: discountActiveCount > 0 ? 'AVAILABLE' : 'CONFIGURED',
          adoptionStatus: discountActiveCount > 0 ? 'ADOPTED' : 'NOT_IN_USE',
          activeCampaignsCount: discountActiveCount,
        },
        {
          featureKey: 'GROUP_BOOKINGS',
          title: 'Multi-Station Group Bookings',
          availability: 'AVAILABLE',
          adoptionStatus: groupBookingCount > 0 ? 'ADOPTED' : 'LOW_ADOPTION',
          usageEventsCount: groupBookingCount,
        },
        {
          featureKey: 'CUSTOMER_RATINGS',
          title: 'Post-Session Customer Ratings',
          availability: 'AVAILABLE',
          adoptionStatus: ratingCount > 0 ? 'ADOPTED' : 'LOW_ADOPTION',
          usageEventsCount: ratingCount,
          averageScore: avgRatingScore,
        },
        {
          featureKey: 'NOTIFICATION_DISPATCH',
          title: 'Automated SMS / In-App Notifications',
          availability: 'AVAILABLE',
          adoptionStatus: notificationCount > 0 ? 'ADOPTED' : 'NOT_IN_USE',
          usageEventsCount: notificationCount,
        },
      ],
      adoptionDistinctionNotice: 'Feature availability reflects system capability, whereas feature adoption measures verified user and operator interaction events during the window.',
    };
  },

  async getIssueMatrix() {
    return {
      title: 'Play-Nest Operational Issue & Reliability Matrix',
      lastUpdated: new Date().toISOString(),
      matrix: [
        {
          issueId: 'ISS-001',
          sourceComponent: 'AnalyticsIngestionWorker',
          description: 'Ingestion pipeline watermark lag exceeds 120-minute threshold',
          severity: 'HIGH',
          owner: 'Analytics Reliability Eng',
          action: 'Inspect Redis connection, check worker process logs, run manual backfill script',
        },
        {
          issueId: 'ISS-002',
          sourceComponent: 'PaymentGatewayProvider / ZarinPal',
          description: 'Payment status is PAID but missing corresponding PAYMENT_COLLECTION ledger posting',
          severity: 'HIGH',
          owner: 'Finance Ops',
          action: 'Run financial reconciliation check POST /financials/reconciliation/run and record compensating ledger entry',
        },
        {
          issueId: 'ISS-003',
          sourceComponent: 'ReservationStateEngine',
          description: 'Reservation is CANCELED but payment state remains PAID without refund record',
          severity: 'HIGH',
          owner: 'Reservation Operations Manager',
          action: 'Audit cancellation reason and trigger provider refund or manual wallet credit',
        },
        {
          issueId: 'ISS-004',
          sourceComponent: 'WaitlistExpiryWorker',
          description: 'Duplicate active waitlist entries exist for same customer, station, and time slot',
          severity: 'MEDIUM',
          owner: 'Waitlist Controller',
          action: 'Cancel older duplicate waitlist entry and notify customer',
        },
        {
          issueId: 'ISS-005',
          sourceComponent: 'SMSWorker',
          description: 'High notification failure rate or provider delivery failure',
          severity: 'MEDIUM',
          owner: 'Communication Systems Lead',
          action: 'Check SMSIR API key validity, credit balance, and retry queue status',
        },
        {
          issueId: 'ISS-006',
          sourceComponent: 'CustomerSupportPanel',
          description: 'Open support tickets exceed SLA 120-minute first response target',
          severity: 'LOW',
          owner: 'Customer Support Supervisor',
          action: 'Reassign pending tickets to available support staff on shift',
        },
      ],
    };
  },
};

function computeAggregateStats(values: number[]): { median: number; mean: number; p25: number; p75: number } | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = Math.round((sum / sorted.length) * 100) / 100;

  const median = percentile(sorted, 50);
  const p25 = percentile(sorted, 25);
  const p75 = percentile(sorted, 75);

  return { median, mean, p25, p75 };
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const weight = rank - lower;
  const val = sortedAsc[lower] + weight * (sortedAsc[upper] - sortedAsc[lower]);
  return Math.round(val * 100) / 100;
}
