import { env } from './config/env';
import { disconnectPrisma } from './config/prisma';
import redis from './config/redis';
import logger from './config/logger';
import { closeQueues } from './jobs/queues';
import { initWorkers, stopWorkers } from './jobs/workers';
import { initReservationEvents } from './modules/reservation/reservation.events';
import {
  initPlatformSettingsCacheSync,
  stopPlatformSettingsCacheSync,
} from './modules/platform-admin/settings.station';

let isShuttingDown = false;

async function shutdownWorker(exitCode: number) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  const forceTimer = setTimeout(() => {
    logger.error(
      { timeoutMs: env.GRACEFUL_SHUTDOWN_TIMEOUT_MS },
      'Forced worker exit after graceful shutdown timeout'
    );
    process.exit(1);
  }, env.GRACEFUL_SHUTDOWN_TIMEOUT_MS);
  if (typeof forceTimer.unref === 'function') {
    forceTimer.unref();
  }

  try {
    await stopPlatformSettingsCacheSync();
    await stopWorkers();
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
    logger.info('Sayra worker shutdown completed cleanly');
  } finally {
    clearTimeout(forceTimer);
    process.exit(exitCode);
  }
}

function startWorkerProcess() {
  initPlatformSettingsCacheSync();
  initReservationEvents();
  initWorkers();
  logger.info(`Sayra worker process started [PID: ${process.pid}]`);
}

startWorkerProcess();

process.on('SIGTERM', () => {
  logger.info('SIGTERM received in worker process: draining jobs...');
  void shutdownWorker(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received in worker process: draining jobs...');
  void shutdownWorker(0);
});

process.on('unhandledRejection', (err: unknown) => {
  logger.fatal({ err }, 'UNHANDLED REJECTION in worker process');
  void shutdownWorker(1);
});

process.on('uncaughtException', (err: unknown) => {
  logger.fatal({ err }, 'UNCAUGHT EXCEPTION in worker process');
  void shutdownWorker(1);
});
