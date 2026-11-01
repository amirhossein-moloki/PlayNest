/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../../config/prisma';
import redis from '../../config/redis';
import logger from '../../config/logger';

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
  timestamp: string;
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
      timestamp: new Date().toISOString(),
    };
  }
}
