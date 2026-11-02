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

// Bridge symbol compatibility when pino-http bundles its own nested pino version
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pinoInHttp = require('pino-http/node_modules/pino');
  if (pinoInHttp && pinoInHttp.symbols) {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const pinoAny = pino as any;
    const loggerAny = logger as any;
    for (const [key, sym] of Object.entries(pinoInHttp.symbols as Record<string, symbol>)) {
      const topSym = pinoAny.symbols ? pinoAny.symbols[key] : undefined;
      if (sym && topSym && sym !== topSym && loggerAny[topSym] !== undefined) {
        loggerAny[sym] = loggerAny[topSym];
      }
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }
} catch {
  // Nested pino not present or already unified
}

export default logger;
