import { Prisma } from '@prisma/client';
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
    const res = await prisma.reservation.findMany({
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
    return res || [];
  },

  async getCustomerAllHistoricalFirstVisits(gamingCenterId: string, dayEnd: Date) {
    const res = await prisma.reservation.groupBy({
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
    return res || [];
  },

  async getCustomerAllHistoricalVisits(gamingCenterId: string, dayEnd: Date) {
    const res = await prisma.reservation.findMany({
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
    return res || [];
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

  // Phase 4 Financial Analytics & Reconciliation Methods
  async getFinancialOverviewDetailed(gamingCenterId: string, dayStart: Date, dayEnd: Date, currencyFilter?: string) {
    const paymentWhere = {
      gamingCenterId,
      createdAt: { gte: dayStart, lte: dayEnd },
      ...(currencyFilter ? { currency: currencyFilter } : {}),
    };

    const refundWhere = {
      gamingCenterId,
      createdAt: { gte: dayStart, lte: dayEnd },
      ...(currencyFilter ? { currency: currencyFilter } : {}),
    };

    const ledgerWhere = {
      gamingCenterId,
      createdAt: { gte: dayStart, lte: dayEnd },
      ...(currencyFilter ? { currency: currencyFilter } : {}),
    };

    const earningWhere = {
      gamingCenterId,
      createdAt: { gte: dayStart, lte: dayEnd },
    };

    const customerWhere = {
      profiles: {
        some: { gamingCenterId },
      },
    };

    const [
      paymentsByStatus,
      refundsByStatus,
      ledgerByType,
      walletByTypes,
      earningsByStatus,
      totalCustomerWalletBalances,
    ] = await Promise.all([
      prisma.payment.groupBy({
        by: ['status', 'currency'],
        where: paymentWhere,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.refund.groupBy({
        by: ['status', 'currency'],
        where: refundWhere,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.ledgerEntry.groupBy({
        by: ['entryType', 'currency'],
        where: ledgerWhere,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.walletTransaction.groupBy({
        by: ['type', 'currency'],
        where: {
          customerAccount: customerWhere,
          createdAt: { gte: dayStart, lte: dayEnd },
          ...(currencyFilter ? { currency: currencyFilter } : {}),
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.earning.groupBy({
        by: ['targetReached'],
        where: earningWhere,
        _sum: { baseAmount: true, commissionAmount: true },
        _count: { _all: true },
      }),
      prisma.customerAccount.aggregate({
        where: customerWhere,
        _sum: { walletBalance: true },
        _count: { _all: true },
      }),
    ]);

    return {
      paymentsByStatus,
      refundsByStatus,
      ledgerByType,
      walletByTypes,
      earningsByStatus,
      totalCustomerWalletBalances: {
        sum: totalCustomerWalletBalances._sum.walletBalance || 0,
        count: totalCustomerWalletBalances._count._all,
      },
    };
  },

  async runFinancialReconciliationCheck(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    const findings: Array<{
      ruleId: string;
      ruleName: string;
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
      status: 'MATCHED' | 'MISMATCH' | 'MISSING_COUNTERPART' | 'DUPLICATE_POSTING' | 'PENDING_REVIEW';
      sourceEntity: string;
      sourceId: string;
      details: string;
      expectedAmount?: number;
      actualAmount?: number;
      currency?: string;
      timestamp: Date;
    }> = [];

    // Fetch operational records in target window
    const [payments, refunds, ledgerEntries, walletTxns, earnings, commissionPolicy] = await Promise.all([
      prisma.payment.findMany({
        where: { gamingCenterId, createdAt: { gte: dayStart, lte: dayEnd } },
        include: { ledgerEntries: true, refunds: true },
      }),
      prisma.refund.findMany({
        where: { gamingCenterId, createdAt: { gte: dayStart, lte: dayEnd } },
        include: { ledgerEntries: true, payment: true },
      }),
      prisma.ledgerEntry.findMany({
        where: { gamingCenterId, createdAt: { gte: dayStart, lte: dayEnd } },
      }),
      prisma.walletTransaction.findMany({
        where: {
          customerAccount: { profiles: { some: { gamingCenterId } } },
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      prisma.earning.findMany({
        where: { gamingCenterId, createdAt: { gte: dayStart, lte: dayEnd } },
      }),
      prisma.commissionPolicy.findUnique({
        where: { gamingCenterId },
      }),
    ]);

    // Rule 1 & 2: Confirmed Payment Ledger Integrity
    for (const payment of payments) {
      if (payment.status === 'PAID') {
        const collectionLedger = payment.ledgerEntries.find((e) => e.entryType === 'PAYMENT_COLLECTION');
        if (!collectionLedger) {
          findings.push({
            ruleId: 'REC-001',
            ruleName: 'Confirmed Payment Missing Ledger Posting',
            severity: 'HIGH',
            status: 'MISSING_COUNTERPART',
            sourceEntity: 'Payment',
            sourceId: payment.id,
            details: `Payment ${payment.id} is marked PAID but lacks a corresponding PAYMENT_COLLECTION ledger entry.`,
            expectedAmount: payment.amount,
            actualAmount: 0,
            currency: payment.currency,
            timestamp: payment.createdAt,
          });
        } else if (collectionLedger.amount !== payment.amount) {
          findings.push({
            ruleId: 'REC-002',
            ruleName: 'Payment Ledger Amount Mismatch',
            severity: 'HIGH',
            status: 'MISMATCH',
            sourceEntity: 'Payment',
            sourceId: payment.id,
            details: `Payment ${payment.id} amount (${payment.amount}) differs from ledger collection entry amount (${collectionLedger.amount}).`,
            expectedAmount: payment.amount,
            actualAmount: collectionLedger.amount,
            currency: payment.currency,
            timestamp: payment.createdAt,
          });
        }
      }
    }

    // Rule 3: Refund Source Integrity & Disbursement Ledger
    for (const refund of refunds) {
      if (!refund.payment) {
        findings.push({
          ruleId: 'REC-003',
          ruleName: 'Orphaned Refund Source',
          severity: 'HIGH',
          status: 'MISSING_COUNTERPART',
          sourceEntity: 'Refund',
          sourceId: refund.id,
          details: `Refund ${refund.id} references non-existent parent payment ${refund.paymentId}.`,
          expectedAmount: refund.amount,
          currency: refund.currency,
          timestamp: refund.createdAt,
        });
      } else if (refund.status === 'SUCCESSFUL') {
        const disbursementLedger = refund.ledgerEntries.find((e) => e.entryType === 'REFUND_DISBURSEMENT');
        if (!disbursementLedger) {
          findings.push({
            ruleId: 'REC-003',
            ruleName: 'Successful Refund Missing Ledger Posting',
            severity: 'HIGH',
            status: 'MISSING_COUNTERPART',
            sourceEntity: 'Refund',
            sourceId: refund.id,
            details: `Refund ${refund.id} is SUCCESSFUL but lacks a corresponding REFUND_DISBURSEMENT ledger entry.`,
            expectedAmount: refund.amount,
            actualAmount: 0,
            currency: refund.currency,
            timestamp: refund.createdAt,
          });
        } else if (disbursementLedger.amount !== refund.amount) {
          findings.push({
            ruleId: 'REC-003',
            ruleName: 'Refund Disbursement Amount Mismatch',
            severity: 'HIGH',
            status: 'MISMATCH',
            sourceEntity: 'Refund',
            sourceId: refund.id,
            details: `Refund ${refund.id} amount (${refund.amount}) differs from ledger disbursement amount (${disbursementLedger.amount}).`,
            expectedAmount: refund.amount,
            actualAmount: disbursementLedger.amount,
            currency: refund.currency,
            timestamp: refund.createdAt,
          });
        }
      }
    }

    // Rule 4: Duplicate Ledger Entry Check
    const idempotencyMap = new Map<string, number>();
    for (const entry of ledgerEntries) {
      if (!entry.idempotencyKey) continue;
      const key = entry.idempotencyKey;
      idempotencyMap.set(key, (idempotencyMap.get(key) || 0) + 1);
    }
    for (const [key, count] of idempotencyMap.entries()) {
      if (count > 1) {
        const sampleEntry = ledgerEntries.find((e) => e.idempotencyKey === key)!;
        findings.push({
          ruleId: 'REC-004',
          ruleName: 'Duplicate Financial Posting',
          severity: 'HIGH',
          status: 'DUPLICATE_POSTING',
          sourceEntity: 'LedgerEntry',
          sourceId: sampleEntry.id,
          details: `Multiple ledger postings (${count}) found sharing idempotency key: ${key}.`,
          expectedAmount: sampleEntry.amount,
          currency: sampleEntry.currency,
          timestamp: sampleEntry.createdAt,
        });
      }
    }

    // Rule 5: Wallet Transaction Integrity vs Balance
    for (const wTx of walletTxns) {
      if (wTx.type === 'DEPOSIT' && wTx.amount <= 0) {
        findings.push({
          ruleId: 'REC-005',
          ruleName: 'Invalid Wallet Deposit Amount',
          severity: 'MEDIUM',
          status: 'MISMATCH',
          sourceEntity: 'WalletTransaction',
          sourceId: wTx.id,
          details: `Wallet DEPOSIT transaction ${wTx.id} has non-positive amount (${wTx.amount}).`,
          actualAmount: wTx.amount,
          currency: wTx.currency,
          timestamp: wTx.createdAt,
        });
      }
    }

    // Rule 6: Commission Policy & Calculation Consistency
    if (commissionPolicy && commissionPolicy.percentBps) {
      for (const earning of earnings) {
        const expectedCommission = Math.round((earning.baseAmount * commissionPolicy.percentBps) / 10000);
        if (Math.abs(earning.commissionAmount - expectedCommission) > 1) {
          findings.push({
            ruleId: 'REC-006',
            ruleName: 'Commission Calculation Mismatch',
            severity: 'MEDIUM',
            status: 'MISMATCH',
            sourceEntity: 'Earning',
            sourceId: earning.id,
            details: `Earning ${earning.id} commission amount (${earning.commissionAmount}) differs from policy calculated commission (${expectedCommission}).`,
            expectedAmount: expectedCommission,
            actualAmount: earning.commissionAmount,
            timestamp: earning.createdAt,
          });
        }
      }
    }

    return {
      evaluatedAt: new Date(),
      totalEvaluatedRecords: payments.length + refunds.length + ledgerEntries.length + walletTxns.length + earnings.length,
      findingCount: findings.length,
      statusCounts: {
        MISMATCH: findings.filter((f) => f.status === 'MISMATCH').length,
        MISSING_COUNTERPART: findings.filter((f) => f.status === 'MISSING_COUNTERPART').length,
        DUPLICATE_POSTING: findings.filter((f) => f.status === 'DUPLICATE_POSTING').length,
        PENDING_REVIEW: findings.filter((f) => f.status === 'PENDING_REVIEW').length,
      },
      findings,
    };
  },

  // Phase 7 Privacy-Preserving Benchmarking Cross-Tenant Queries
  async getEligiblePeerGamingCenters(requestingGamingCenterId: string) {
    return prisma.gamingCenter.findMany({
      where: {
        id: { not: requestingGamingCenterId },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    });
  },

  async getCrossTenantReservationStats(peerGamingCenterIds: string[], dayStart: Date, dayEnd: Date) {
    if (peerGamingCenterIds.length === 0) return [];

    return prisma.reservation.groupBy({
      by: ['gamingCenterId', 'status'],
      where: {
        gamingCenterId: { in: peerGamingCenterIds },
        startTime: { gte: dayStart, lte: dayEnd },
      },
      _count: { _all: true },
      _sum: { totalPrice: true, totalHours: true },
    });
  },

  async getCrossTenantGamingSessionStats(peerGamingCenterIds: string[], dayStart: Date, dayEnd: Date) {
    if (peerGamingCenterIds.length === 0) return [];

    return prisma.gamingSession.groupBy({
      by: ['reservationId'],
      where: {
        reservation: {
          gamingCenterId: { in: peerGamingCenterIds },
          startTime: { gte: dayStart, lte: dayEnd },
        },
      },
      _count: { _all: true },
      _sum: { actualHours: true },
    });
  },

  async getCrossTenantStationCounts(peerGamingCenterIds: string[]) {
    if (peerGamingCenterIds.length === 0) return [];

    return prisma.gameStation.groupBy({
      by: ['gamingCenterId'],
      where: {
        gamingCenterId: { in: peerGamingCenterIds },
        isActive: true,
      },
      _count: { _all: true },
    });
  },

  async getCrossTenantCustomerStats(peerGamingCenterIds: string[], dayStart: Date, dayEnd: Date) {
    if (peerGamingCenterIds.length === 0) return [];

    return prisma.reservation.groupBy({
      by: ['gamingCenterId', 'customerAccountId'],
      where: {
        gamingCenterId: { in: peerGamingCenterIds },
        status: 'COMPLETED',
        startTime: { gte: dayStart, lte: dayEnd },
      },
      _count: { _all: true },
    });
  },

  async getGamingCenterDetails(gamingCenterId: string) {
    return prisma.gamingCenter.findUnique({
      where: { id: gamingCenterId },
      select: {
        id: true,
        name: true,
        openingTime: true,
        closingTime: true,
        pcCount: true,
        consoleCount: true,
        isActive: true,
      },
    });
  },

  async getStationMaintenanceStats(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    return prisma.stationMaintenance.findMany({
      where: {
        station: { gamingCenterId },
        startTime: { lte: dayEnd },
        OR: [{ endTime: { gte: dayStart } }, { endTime: null }],
      },
      select: {
        id: true,
        stationId: true,
        startTime: true,
        endTime: true,
        reason: true,
        cost: true,
      },
    });
  },

  async getStationGamingSessionStats(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    return prisma.gamingSession.findMany({
      where: {
        station: { gamingCenterId },
        startTime: { lte: dayEnd },
        OR: [{ endTime: { gte: dayStart } }, { endTime: null }],
      },
      select: {
        id: true,
        stationId: true,
        reservationId: true,
        startTime: true,
        endTime: true,
        actualHours: true,
        pausedMinutes: true,
        status: true,
      },
    });
  },

  async getReservationLeadTimeStats(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    return prisma.reservation.findMany({
      where: {
        gamingCenterId,
        startTime: { gte: dayStart, lte: dayEnd },
      },
      select: {
        id: true,
        createdAt: true,
        startTime: true,
        endTime: true,
        totalHours: true,
        status: true,
      },
    });
  },

  async getCanceledWithPaidStats(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    return prisma.reservation.findMany({
      where: {
        gamingCenterId,
        status: 'CANCELED',
        paymentState: 'PAID',
        startTime: { gte: dayStart, lte: dayEnd },
      },
      select: {
        id: true,
        totalPrice: true,
        startTime: true,
        createdAt: true,
        canceledAt: true,
        cancelReason: true,
        payments: {
          where: { status: 'PAID' },
          select: {
            id: true,
            amount: true,
            paidAt: true,
            refunds: {
              where: { status: 'SUCCESSFUL' },
              select: { id: true, amount: true, processedAt: true },
            },
          },
        },
      },
    });
  },

  // Extended Customer Entities & Funnel/Discount Repo Methods
  async getRegisteredAccountsStats(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    if (!prisma?.customerAccount) return { registeredInPeriod: 0, totalRegistered: 0 };
    const [registeredInPeriod, totalRegistered] = await Promise.all([
      prisma.customerAccount.count({
        where: {
          profiles: { some: { gamingCenterId } },
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      prisma.customerAccount.count({
        where: {
          profiles: { some: { gamingCenterId } },
          createdAt: { lte: dayEnd },
        },
      }),
    ]);

    return { registeredInPeriod: registeredInPeriod || 0, totalRegistered: totalRegistered || 0 };
  },

  async getReservingCustomersCount(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    if (!prisma?.reservation?.groupBy) return 0;
    const result = (await prisma.reservation.groupBy({
      by: ['customerAccountId'],
      where: {
        gamingCenterId,
        startTime: { gte: dayStart, lte: dayEnd },
      },
    })) || [];
    return result.filter((r) => Boolean(r.customerAccountId)).length;
  },

  async getPayingCustomersCount(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    if (!prisma?.payment?.groupBy) return 0;
    const result = (await prisma.payment.groupBy({
      by: ['reservationId'],
      where: {
        gamingCenterId,
        status: 'PAID',
        paidAt: { gte: dayStart, lte: dayEnd },
        reservationId: { not: null },
      },
    })) || [];

    if (result.length === 0) return 0;

    const reservationIds = result.map((r) => r.reservationId!).filter(Boolean);
    const reservations = (await prisma.reservation.findMany({
      where: { id: { in: reservationIds } },
      select: { customerAccountId: true },
    })) || [];

    const uniqueCustomerIds = new Set(reservations.map((r) => r.customerAccountId).filter(Boolean));
    return uniqueCustomerIds.size;
  },

  async getFunnelReservations(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    if (!prisma?.reservation?.findMany) return [];
    const res = await prisma.reservation.findMany({
      where: {
        gamingCenterId,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      select: {
        id: true,
        customerAccountId: true,
        createdAt: true,
        startTime: true,
        endTime: true,
        status: true,
        paymentState: true,
        completedAt: true,
        canceledAt: true,
        payments: {
          where: { status: 'PAID' },
          select: { id: true, amount: true, paidAt: true, createdAt: true },
          orderBy: { paidAt: 'asc' },
        },
        gamingSessions: {
          select: { id: true, startTime: true, endTime: true, actualHours: true, status: true },
          orderBy: { startTime: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return res || [];
  },

  async getDiscountPerformanceReservations(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    if (!prisma?.reservation?.findMany) return [];
    const res = await prisma.reservation.findMany({
      where: {
        gamingCenterId,
        startTime: { gte: dayStart, lte: dayEnd },
      },
      select: {
        id: true,
        totalPrice: true,
        discountAmount: true,
        originalAmount: true,
        customerPayableAmount: true,
        platformFundedDiscount: true,
        merchantPayoutAmount: true,
        discountFundingSource: true,
        voucherCode: true,
        discountId: true,
        campaignId: true,
        status: true,
        paymentState: true,
        discount: {
          select: { id: true, targetType: true, valueType: true, value: true },
        },
        campaign: {
          select: { id: true, name: true, code: true, fundingSource: true, valueType: true, value: true },
        },
      },
    });
    return res || [];
  },

  async getCampaignsAnalyticsStats(gamingCenterId: string, dayStart?: Date, dayEnd?: Date) {
    const campaigns = await prisma.discountCampaign.findMany({
      where: {
        OR: [
          { gamingCenterId },
          { gamingCenterId: null },
        ],
      },
      include: {
        _count: {
          select: { usages: true, reservations: true },
        },
      },
    });

    const usagesWhere: Prisma.DiscountUsageWhereInput = {
      reservation: { gamingCenterId },
    };
    if (dayStart && dayEnd) {
      usagesWhere.createdAt = { gte: dayStart, lte: dayEnd };
    }

    const usages = await prisma.discountUsage.groupBy({
      by: ['fundingSource'],
      where: usagesWhere,
      _sum: { discountAmount: true },
      _count: { _all: true },
    });

    return {
      campaigns,
      usageSummaries: usages,
    };
  },

  // Operations & Reliability Analytics Repo Methods
  async getJobsHealthData() {
    const [watermarks, runs, notificationStats] = await Promise.all([
      prisma.analyticsWatermark.findMany(),
      prisma.analyticsIngestionRun.findMany({
        take: 200,
        orderBy: { startedAt: 'desc' },
      }),
      prisma.notificationLog.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    return { watermarks, runs, notificationStats };
  },

  async getSystemErrorsData(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    const [failedNotifications, failedPayments, failedRefunds, auditErrorLogs] = await Promise.all([
      prisma.notificationLog.findMany({
        where: {
          gamingCenterId,
          createdAt: { gte: dayStart, lte: dayEnd },
          status: 'FAILED',
        },
        select: {
          id: true,
          type: true,
          channel: true,
          recipient: true,
          lastError: true,
          attempts: true,
          createdAt: true,
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.findMany({
        where: {
          gamingCenterId,
          createdAt: { gte: dayStart, lte: dayEnd },
          status: 'FAILED',
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          provider: true,
          failureReason: true,
          createdAt: true,
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.refund.findMany({
        where: {
          gamingCenterId,
          createdAt: { gte: dayStart, lte: dayEnd },
          status: 'FAILED',
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          failureReason: true,
          createdAt: true,
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.findMany({
        where: {
          gamingCenterId,
          createdAt: { gte: dayStart, lte: dayEnd },
          action: { in: ['SETTINGS_UPDATE', 'MANUAL_REFUND', 'MANUAL_BALANCE_ADJUSTMENT', 'RESERVATION_CANCEL'] },
        },
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          userId: true,
          createdAt: true,
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      failedNotifications,
      failedPayments,
      failedRefunds,
      auditErrorLogs,
    };
  },

  async getSupportAnalyticsStats(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    const tickets = await prisma.ticket.findMany({
      where: {
        customerAccount: {
          profiles: { some: { gamingCenterId } },
        },
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tickets || [];
  },

  async getFeatureAdoptionStats(gamingCenterId: string, dayStart: Date, dayEnd: Date) {
    const [
      waitlistEntries,
      waitlistOffers,
      proposals,
      discounts,
      groupBookings,
      ratings,
      notificationLogs,
    ] = await Promise.all([
      prisma.waitlistEntry.findMany({
        where: { gamingCenterId, createdAt: { gte: dayStart, lte: dayEnd } },
        select: { id: true, status: true, createdAt: true },
      }),
      prisma.waitlistOffer.findMany({
        where: { gamingCenterId, createdAt: { gte: dayStart, lte: dayEnd } },
        select: { id: true, status: true, createdAt: true },
      }),
      prisma.reservationTimeProposal.findMany({
        where: {
          reservation: { gamingCenterId },
          createdAt: { gte: dayStart, lte: dayEnd },
        },
        select: { id: true, status: true, createdAt: true },
      }),
      prisma.discount.findMany({
        where: { gamingCenterId },
        select: { id: true, isActive: true, startAt: true, endAt: true },
      }),
      prisma.groupBooking.findMany({
        where: { gamingCenterId, createdAt: { gte: dayStart, lte: dayEnd } },
        select: { id: true, status: true, totalPrice: true },
      }),
      prisma.rating.findMany({
        where: { gamingCenterId, createdAt: { gte: dayStart, lte: dayEnd } },
        select: { id: true, rating: true, status: true },
      }),
      prisma.notificationLog.findMany({
        where: { gamingCenterId, createdAt: { gte: dayStart, lte: dayEnd } },
        select: { id: true, channel: true, status: true },
      }),
    ]);

    return {
      waitlistEntries,
      waitlistOffers,
      proposals,
      discounts,
      groupBookings,
      ratings,
      notificationLogs,
    };
  },

  async getOperationalDataQualityChecks(gamingCenterId: string) {
    const [
      orphanPayments,
      canceledPaidReservations,
      inProgressSessions,
      duplicateWaitlists,
      nullFieldReservations,
      currencyInconsistencies,
      orphanRatings,
      watermarks,
    ] = await Promise.all([
      // DQ-001: Orphan Payments without reservation or groupBooking
      prisma.payment.findMany({
        where: {
          gamingCenterId,
          reservationId: null,
          groupBookingId: null,
          status: 'PAID',
        },
        select: { id: true, amount: true, currency: true, createdAt: true },
        take: 20,
      }),
      // DQ-002: Canceled Reservation with Unrefunded Paid Status
      prisma.reservation.findMany({
        where: {
          gamingCenterId,
          status: 'CANCELED',
          paymentState: 'PAID',
        },
        select: {
          id: true,
          totalPrice: true,
          canceledAt: true,
          payments: {
            where: { status: 'PAID' },
            select: { id: true, amount: true, refunds: { where: { status: 'SUCCESSFUL' }, select: { amount: true } } },
          },
        },
        take: 20,
      }),
      // DQ-003: In Progress Reservation without active gaming session
      prisma.reservation.findMany({
        where: {
          gamingCenterId,
          status: 'IN_PROGRESS',
          gamingSessions: { none: { status: 'ACTIVE' } },
        },
        select: { id: true, startTime: true, endTime: true },
        take: 20,
      }),
      // DQ-004: Duplicate Active Waitlist Entries for same customer/station/time
      prisma.waitlistEntry.groupBy({
        by: ['customerAccountId', 'stationId', 'startTime'],
        where: { gamingCenterId, status: 'ACTIVE' },
        _count: { _all: true },
        having: { id: { _count: { gt: 1 } } },
      }),
      // DQ-005: Null Essential Fields in Completed Reservations
      prisma.reservation.findMany({
        where: {
          gamingCenterId,
          status: 'COMPLETED',
          OR: [
            { stationId: '' },
            { customerAccountId: '' },
            { totalPrice: { lt: 0 } },
            { totalHours: { lte: 0 } },
          ],
        },
        select: { id: true, totalPrice: true, totalHours: true, stationId: true },
        take: 20,
      }),
      // DQ-006: Currency inconsistency in payments vs refunds
      prisma.payment.findMany({
        where: {
          gamingCenterId,
          status: 'PAID',
          refunds: { some: {} },
        },
        select: {
          id: true,
          currency: true,
          refunds: { select: { id: true, currency: true } },
        },
        take: 20,
      }),
      // DQ-007: Orphan Rating without completed reservation
      prisma.rating.findMany({
        where: {
          gamingCenterId,
          reservation: { status: { not: 'COMPLETED' } },
        },
        select: { id: true, rating: true, reservationId: true },
        take: 20,
      }),
      // DQ-008: Analytics Watermark lag
      prisma.analyticsWatermark.findMany(),
    ]);

    return {
      orphanPayments,
      canceledPaidReservations,
      inProgressSessions,
      duplicateWaitlists,
      nullFieldReservations,
      currencyInconsistencies,
      orphanRatings,
      watermarks,
    };
  },
};
