/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../../config/prisma';
import redis from '../../config/redis';
import logger from '../../config/logger';

import { smsQueue, analyticsQueue, cmsSyncMediaQueue, remindersQueue } from '../../jobs/queues';

export interface QueueMetrics {
  name: string;
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
  status: 'HEALTHY' | 'DEGRADED';
}

export interface AdminHealthStatus {
  database: {
    status: 'UP' | 'DOWN';
    latencyMs: number;
    error?: string;
  };
  redis: {
    status: 'UP' | 'DOWN';
    latencyMs: number;
    error?: string;
  };
  queues: {
    sms: QueueMetrics;
    analytics: QueueMetrics;
    cmsMedia: QueueMetrics;
    reminders: QueueMetrics;
  };
  timestamp: string;
}

async function inspectQueue(queue: any, name: string): Promise<QueueMetrics> {
  try {
    const [waiting, active, failed, delayed] = await Promise.all([
      queue.getWaitingCount().catch(() => 0),
      queue.getActiveCount().catch(() => 0),
      queue.getFailedCount().catch(() => 0),
      queue.getDelayedCount().catch(() => 0),
    ]);

    const isDegraded = failed > 50 || waiting > 500;
    return {
      name,
      waiting,
      active,
      failed,
      delayed,
      status: isDegraded ? 'DEGRADED' : 'HEALTHY',
    };
  } catch (err: any) {
    logger.error({ err, queueName: name }, 'AdminHealthService: Failed to inspect queue');
    return {
      name,
      waiting: 0,
      active: 0,
      failed: 0,
      delayed: 0,
      status: 'DEGRADED',
    };
  }
}

export class AdminHealthService {
  static async checkHealth(): Promise<AdminHealthStatus> {
    const startDb = Date.now();
    let dbStatus: 'UP' | 'DOWN' = 'DOWN';
    let dbError: string | undefined;
    let dbLatencyMs = 0;

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'UP';
      dbLatencyMs = Date.now() - startDb;
    } catch (err: any) {
      dbError = err?.message || 'Database query failed';
      logger.error({ err }, 'AdminHealthService: DB check failed');
    }

    const startRedis = Date.now();
    let redisStatus: 'UP' | 'DOWN' = 'DOWN';
    let redisError: string | undefined;
    let redisLatencyMs = 0;

    try {
      const pingRes = await redis.ping();
      if (pingRes === 'PONG') {
        redisStatus = 'UP';
      }
      redisLatencyMs = Date.now() - startRedis;
    } catch (err: any) {
      redisError = err?.message || 'Redis ping failed';
      logger.error({ err }, 'AdminHealthService: Redis check failed');
    }

    const [sms, analytics, cmsMedia, reminders] = await Promise.all([
      inspectQueue(smsQueue, 'sms-notifications'),
      inspectQueue(analyticsQueue, 'analytics-sync'),
      inspectQueue(cmsSyncMediaQueue, 'cms-sync-media'),
      inspectQueue(remindersQueue, 'reservation-reminders'),
    ]);

    return {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        error: dbError,
      },
      redis: {
        status: redisStatus,
        latencyMs: redisLatencyMs,
        error: redisError,
      },
      queues: {
        sms,
        analytics,
        cmsMedia,
        reminders,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
