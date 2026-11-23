import pino from 'pino';
import { env } from './env';

const isProduction = env.NODE_ENV === 'production';

import { getRequestContext } from '../common/context/request-context';

const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      'cookie',
      'body.password',
      'body.token',
      'body.accessToken',
      'body.refreshToken',
      'headers.authorization',
      'headers.cookie',
      'headers["set-cookie"]',
      'request.headers.authorization',
      'request.headers.cookie',
      'request.body.password',
      'request.body.token',
      'request.body.accessToken',
      'request.body.refreshToken',
    ],
    censor: '[REDACTED]',
  },
  mixin() {
    const context = getRequestContext();
    return {
      requestId: context.requestId,
      correlationId: context.correlationId,
      actorId: context.actorId,
      gamingCenterId: context.gamingCenterId,
    };
  },
  transport: isProduction
    ? undefined
    : {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'SYS:standard',
      },
    },
});

export default logger;
