import { Request, Response, NextFunction, RequestHandler } from 'express';
import { env } from '../../config/env';

let loggerMiddleware: RequestHandler;

if (env.NODE_ENV === 'test') {
  // In a test environment, export a mock middleware to avoid pino-http issues with Jest
  loggerMiddleware = (req: Request, res: Response, next: NextFunction) => next();
} else {
  // In other environments, use the actual pino-http logger
  const pinoHttp = require('pino-http'); // eslint-disable-line @typescript-eslint/no-var-requires
  const logger = require('../../config/logger').default; // eslint-disable-line @typescript-eslint/no-var-requires
  const { sanitizeLog } = require('../utils/sanitizer'); // eslint-disable-line @typescript-eslint/no-var-requires
  const cuid = require('cuid'); // eslint-disable-line @typescript-eslint/no-var-requires
  const { requestContext } = require('../context/request-context'); // eslint-disable-line @typescript-eslint/no-var-requires
  const { Metrics } = require('../metrics/metrics'); // eslint-disable-line @typescript-eslint/no-var-requires

  const middleware = pinoHttp({
    logger,
    genReqId: (req: Request) => req.id,
    customAttributeKeys: {
      req: 'request',
      res: 'response',
      err: 'error',
      responseTime: 'duration',
      reqId: 'requestId',
    },
    customProps: function (req: Request) {
      return {
        actorId: req.actor?.id || null,
        gamingCenterId: req.params?.gamingCenterId || null,
      };
    },
    // Use serializers to sanitize sensitive fields from the log output.
    serializers: {
      req(req: Request) {
        // Sanitize headers and body before they are logged.
        req.headers = sanitizeLog(req.headers);
        req.body = sanitizeLog(req.body);
        return req;
      },
      res(res: Response) {
        // Sanitize headers from the response without accessing non-Express response fields.
        return {
          statusCode: res.statusCode,
          headers: sanitizeLog(res.getHeaders()),
        };
      },
    },
    customLogLevel: function (req: Request, res: Response, err?: Error) {
      if (res.statusCode >= 400 && res.statusCode < 500) {
        return 'warn';
      } else if (res.statusCode >= 500 || err) {
        return 'error';
      }
      return 'info';
    },
    customSuccessMessage: function (req: Request, res: Response) {
      const startTime = (req as any).startTime || Date.now(); // eslint-disable-line @typescript-eslint/no-explicit-any
      const duration = Date.now() - startTime;
      Metrics.recordApiLatency(req.method, req.url, res.statusCode, duration);

      if (res.statusCode === 404) {
        return 'resource not found';
      }
      return `${req.method} ${req.url} completed`;
    },
  });

  loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
    (req as any).startTime = Date.now(); // eslint-disable-line @typescript-eslint/no-explicit-any
    const existingId = req.id ?? req.headers['x-request-id'] ?? req.headers['x-correlation-id'];
    const requestId = existingId || cuid();
    const correlationId = req.headers['x-correlation-id'] || requestId;

    if (!req.id) req.id = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Correlation-Id', correlationId);

    const context = {
      requestId,
      correlationId,
      actorId: req.actor?.id,
      gamingCenterId: req.params?.gamingCenterId,
    };

    requestContext.run(context, () => {
      middleware(req, res, next);
    });
  };
}

export default loggerMiddleware;
