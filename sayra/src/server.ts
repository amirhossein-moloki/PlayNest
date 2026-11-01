import { Server } from 'http';
import app from './app';
import { env } from './config/env';
import { initWorkers } from './jobs/workers';
import { initPlatformAdminPanel } from './platform-admin';
import logger from './config/logger';

const PORT = env.PORT;

let server: Server;

async function bootstrap() {
  initWorkers();

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

bootstrap();

const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} signal received: closing HTTP server`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  logger.fatal({ err }, 'UNHANDLED REJECTION! 💥 Shutting down...');
  server.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  logger.fatal({ err }, 'UNCAUGHT EXCEPTION! 💥 Shutting down...');
  server.close(() => {
    process.exit(1);
  });
});
