import { PrismaClient } from '@prisma/client';
import logger from './logger';
import { env } from './env';
import { tenantGuardExtension } from './prisma-extensions';

declare global {
  // جلوگیری از ساخت چندباره PrismaClient در dev (hot reload)
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const isProd = env.NODE_ENV === 'production';

/**
 * Create a PrismaClient instance with sensible defaults.
 * - In dev: can enable query logs
 * - In prod: keep logs to warn/error unless you explicitly need more
 */
function createPrismaClient() {
  const enableQueryLogs = !isProd && env.PRISMA_LOG_QUERIES;

  const client = new PrismaClient({
    log: enableQueryLogs
      ? [
        { level: 'query', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ]
      : [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
  });

  // --- Prisma event -> app logger ---
  client.$on('warn', (e) => {
    logger.warn({ prisma: { message: e.message, target: e.target } }, 'Prisma warn');
  });

  client.$on('error', (e) => {
    logger.error({ prisma: { message: e.message, target: e.target } }, 'Prisma error');
  });

  // Query log only if enabled (to avoid noise in prod)
  if (enableQueryLogs) {
    client.$on('query', (e) => {
      logger.debug(
        {
          prisma: {
            query: e.query,
            params: e.params,
            durationMs: e.duration,
          },
        },
        'Prisma query'
      );
    });

    client.$on('info', (e) => {
      logger.info({ prisma: { message: e.message, target: e.target } }, 'Prisma info');
    });
  }

  return client.$extends(tenantGuardExtension) as unknown as PrismaClient;
}

// Singleton export
export const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

if (!isProd) {
  globalThis.__prisma = prisma;
}

/**
 * Optional helper: verify DB connection on startup.
 * Useful in server.ts before app.listen().
 */
export async function connectPrisma(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Prisma connected');
  } catch (err) {
    logger.error({ err }, 'Prisma failed to connect');
    throw err;
  }
}

/**
 * Optional helper: clean shutdown.
 * Useful in process signal handlers and tests.
 */
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Prisma disconnected');
  } catch (err) {
    logger.error({ err }, 'Prisma failed to disconnect');
  }
}
