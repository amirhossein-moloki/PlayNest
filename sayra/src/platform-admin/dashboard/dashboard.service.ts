import { prisma } from '../../config/prisma';
import { AdminHealthService, AdminHealthStatus } from '../services/admin-health.service';
import logger from '../../config/logger';

export interface DashboardMetrics {
  totalGamingCenters: number;
  totalUsers: number;
  totalManagers: number;
  reservations: {
    total: number;
    confirmed: number;
    completed: number;
    canceled: number;
    todayTotal: number;
    todayConfirmed: number;
    todayActive: number;
    todayCanceled: number;
  };
  financials: {
    todayRevenue: number;
    monthRevenue: number;
    totalVolume: number;
    successfulCount: number;
    failedCount: number;
    pendingRefundsCount: number;
    pendingRefundsAmount: number;
  };
  payments: {
    totalVolume: number;
    successfulCount: number;
    failedCount: number;
  };
  recentAuditLogs: Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string;
    createdAt: string;
  }>;
  health: AdminHealthStatus;
}

export class DashboardService {
  static async getPlatformMetrics(): Promise<DashboardMetrics> {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalGamingCenters,
        totalUsers,
        totalManagers,
        totalReservations,
        confirmedReservations,
        completedReservations,
        canceledReservations,
        todayTotalReservations,
        todayConfirmedReservations,
        todayActiveReservations,
        todayCanceledReservations,
        paymentsAggregate,
        failedPaymentsCount,
        todayPaymentsAggregate,
        monthPaymentsAggregate,
        pendingRefundsAggregate,
        recentAuditLogs,
        health,
      ] = await Promise.all([
        prisma.gamingCenter.count().catch(() => 0),
        prisma.user.count().catch(() => 0),
        prisma.user.count({ where: { role: 'MANAGER' } }).catch(() => 0),
        prisma.reservation.count().catch(() => 0),
        prisma.reservation.count({ where: { status: 'CONFIRMED' } }).catch(() => 0),
        prisma.reservation.count({ where: { status: 'COMPLETED' } }).catch(() => 0),
        prisma.reservation.count({ where: { status: 'CANCELED' } }).catch(() => 0),
        prisma.reservation.count({
          where: { startTime: { gte: startOfToday, lt: endOfToday } },
        }).catch(() => 0),
        prisma.reservation.count({
          where: { startTime: { gte: startOfToday, lt: endOfToday }, status: 'CONFIRMED' },
        }).catch(() => 0),
        prisma.reservation.count({
          where: { startTime: { gte: startOfToday, lt: endOfToday }, status: 'IN_PROGRESS' },
        }).catch(() => 0),
        prisma.reservation.count({
          where: { startTime: { gte: startOfToday, lt: endOfToday }, status: 'CANCELED' },
        }).catch(() => 0),
        prisma.payment.aggregate({
          where: { status: 'PAID' },
          _sum: { amount: true },
          _count: { id: true },
        }).catch(() => ({ _sum: { amount: 0 }, _count: { id: 0 } })),
        prisma.payment.count({ where: { status: 'FAILED' } }).catch(() => 0),
        prisma.payment.aggregate({
          where: { status: 'PAID', createdAt: { gte: startOfToday, lt: endOfToday } },
          _sum: { amount: true },
        }).catch(() => ({ _sum: { amount: 0 } })),
        prisma.payment.aggregate({
          where: { status: 'PAID', createdAt: { gte: startOfMonth } },
          _sum: { amount: true },
        }).catch(() => ({ _sum: { amount: 0 } })),
        prisma.refund.aggregate({
          where: { status: 'PENDING' },
          _sum: { amount: true },
          _count: { id: true },
        }).catch(() => ({ _sum: { amount: 0 }, _count: { id: 0 } })),
        prisma.auditLog.findMany({
          take: 6,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            action: true,
            entity: true,
            entityId: true,
            createdAt: true,
          },
        }).catch(() => []),
        AdminHealthService.checkHealth().catch(() => ({
          database: { status: 'DOWN' as const, latencyMs: 0, error: 'Health check failed' },
          redis: { status: 'DOWN' as const, latencyMs: 0, error: 'Health check failed' },
          queues: {
            sms: { name: 'sms-notifications', waiting: 0, active: 0, failed: 0, delayed: 0, status: 'DEGRADED' as const },
            analytics: { name: 'analytics-sync', waiting: 0, active: 0, failed: 0, delayed: 0, status: 'DEGRADED' as const },
            cmsMedia: { name: 'cms-sync-media', waiting: 0, active: 0, failed: 0, delayed: 0, status: 'DEGRADED' as const },
            reminders: { name: 'reservation-reminders', waiting: 0, active: 0, failed: 0, delayed: 0, status: 'DEGRADED' as const },
          },
          timestamp: new Date().toISOString(),
        })),
      ]);

      const totalVolume = paymentsAggregate._sum.amount ?? 0;
      const successfulCount = paymentsAggregate._count.id ?? 0;

      return {
        totalGamingCenters,
        totalUsers,
        totalManagers,
        reservations: {
          total: totalReservations,
          confirmed: confirmedReservations,
          completed: completedReservations,
          canceled: canceledReservations,
          todayTotal: todayTotalReservations,
          todayConfirmed: todayConfirmedReservations,
          todayActive: todayActiveReservations,
          todayCanceled: todayCanceledReservations,
        },
        financials: {
          todayRevenue: todayPaymentsAggregate._sum.amount ?? 0,
          monthRevenue: monthPaymentsAggregate._sum.amount ?? 0,
          totalVolume,
          successfulCount,
          failedCount: failedPaymentsCount,
          pendingRefundsCount: pendingRefundsAggregate._count.id ?? 0,
          pendingRefundsAmount: pendingRefundsAggregate._sum.amount ?? 0,
        },
        payments: {
          totalVolume,
          successfulCount,
          failedCount: failedPaymentsCount,
        },
        recentAuditLogs: recentAuditLogs.map((log) => ({
          id: log.id,
          action: log.action,
          entity: log.entity,
          entityId: log.entityId,
          createdAt: log.createdAt.toISOString(),
        })),
        health,
      };
    } catch (err) {
      logger.error({ err }, 'DashboardService: Error retrieving metrics');
      throw err;
    }
  }
}
