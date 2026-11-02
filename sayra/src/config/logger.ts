import pino from 'pino';
import { env } from './env';

const isProduction = env.NODE_ENV === 'production';

import { getRequestContext } from '../common/context/request-context';

const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ['password', 'token', 'authorization', 'body.password', 'headers.authorization'],
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
