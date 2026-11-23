import { Server } from 'http';
import app from './app';
import { env } from './config/env';
import { disconnectPrisma } from './config/prisma';
import redis from './config/redis';
import { closeQueues } from './jobs/queues';
import { initPlatformAdminPanel } from './platform-admin';
import { initPlatformSettingsCacheSync, stopPlatformSettingsCacheSync } from './modules/platform-admin/settings.station';
import logger from './config/logger';

const PORT = env.PORT;

let server: Server | undefined;
let workersModule: typeof import('./jobs/workers') | null = null;
let isShuttingDown = false;

async function bootstrap() {
  initPlatformSettingsCacheSync();

  if (env.WORKERS_ENABLED) {
    workersModule = await import('./jobs/workers');
    workersModule.initWorkers();
  } else {
    logger.info('Background workers disabled in API process (WORKERS_ENABLED=false)');
  }

  // Initialize Platform Admin Panel before starting listener
  try {
    await initPlatformAdminPanel(app);
  } catch (err) {
    logger.error({ err }, 'Failed to initialize Platform Admin Panel during bootstrap');
  }

  server = app.listen(PORT, () => {
    logger.info(`Server is successfully running and listening on port ${PORT} [PID: ${process.pid}]`);
  });
}

void bootstrap().catch((err) => {
  logger.fatal({ err }, 'Fatal error during API server bootstrap');
  process.exit(1);
});

async function shutdownResources() {
  const forceTimer = setTimeout(() => {
    logger.error({ timeoutMs: env.GRACEFUL_SHUTDOWN_TIMEOUT_MS }, 'Forced API server exit after graceful shutdown timeout');
    process.exit(1);
  }, env.GRACEFUL_SHUTDOWN_TIMEOUT_MS);
  if (typeof forceTimer.unref === 'function') {
    forceTimer.unref();
  }

  try {
    if (server && server.listening) {
      await new Promise<void>((resolve) => {
        server!.close((err) => {
          if (err) {
            logger.warn({ err }, 'HTTP server close completed with warning');
          }
          resolve();
        });
      });
      logger.info('HTTP server closed');
    }

    await stopPlatformSettingsCacheSync();

    if (workersModule) {
      await workersModule.stopWorkers();
      logger.info('Background workers stopped');
    }

    await closeQueues();
    await disconnectPrisma();

    if (typeof redis.quit === 'function' && redis.status !== 'end') {
      await redis.quit().catch(() => {
        try {
          redis.disconnect();
        } catch {
          // ignore
        }
      });
    }
  } finally {
    clearTimeout(forceTimer);
  }
}

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`${signal} signal received: shutting down API server gracefully`);
  await shutdownResources();
  process.exit(0);
};

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

process.on('unhandledRejection', async (err: unknown) => {
  logger.fatal({ err }, 'UNHANDLED REJECTION! 💥 Shutting down...');
  if (!isShuttingDown) {
    isShuttingDown = true;
    await shutdownResources();
  }
  process.exit(1);
});

process.on('uncaughtException', async (err: unknown) => {
  logger.fatal({ err }, 'UNCAUGHT EXCEPTION! 💥 Shutting down...');
  if (!isShuttingDown) {
    isShuttingDown = true;
    await shutdownResources();
  }
  process.exit(1);
});
