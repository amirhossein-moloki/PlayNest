import app from './app';
import { env } from './config/env';
import { initWorkers } from './jobs/workers';
import logger from './config/logger';

const PORT = env.PORT;

initWorkers();

const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

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
