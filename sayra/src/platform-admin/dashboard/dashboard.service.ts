import { prisma } from '../../config/prisma';
import { AdminHealthService, AdminHealthStatus } from '../services/admin-health.service';
import logger from '../../config/logger';

export interface DashboardMetrics {
  totalGamingCenters: number;
  totalUsers: number;
  reservations: {
    total: number;
    confirmed: number;
    completed: number;
    canceled: number;
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
      const [
        totalGamingCenters,
        totalUsers,
        totalReservations,
        confirmedReservations,
        completedReservations,
        canceledReservations,
        paymentsAggregate,
        failedPaymentsCount,
        recentAuditLogs,
        health,
      ] = await Promise.all([
        prisma.gamingCenter.count().catch(() => 0),
        prisma.user.count().catch(() => 0),
        prisma.reservation.count().catch(() => 0),
        prisma.reservation.count({ where: { status: 'CONFIRMED' } }).catch(() => 0),
        prisma.reservation.count({ where: { status: 'COMPLETED' } }).catch(() => 0),
        prisma.reservation.count({ where: { status: 'CANCELED' } }).catch(() => 0),
        prisma.payment.aggregate({
          where: { status: 'PAID' },
          _sum: { amount: true },
          _count: { id: true },
        }).catch(() => ({ _sum: { amount: 0 }, _count: { id: 0 } })),
        prisma.payment.count({ where: { status: 'FAILED' } }).catch(() => 0),
        prisma.auditLog.findMany({
          take: 5,
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
          timestamp: new Date().toISOString(),
        })),
      ]);

      return {
        totalGamingCenters,
        totalUsers,
        reservations: {
          total: totalReservations,
          confirmed: confirmedReservations,
          completed: completedReservations,
          canceled: canceledReservations,
        },
        payments: {
          totalVolume: paymentsAggregate._sum.amount ?? 0,
          successfulCount: paymentsAggregate._count.id ?? 0,
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
