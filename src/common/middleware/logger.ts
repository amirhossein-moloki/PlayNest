import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';

import { RequestHandler } from 'express';

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

  loggerMiddleware = pinoHttp({
    logger,
    genReqId: function (req: Request, res: Response) {
      const existingId = req.id ?? req.headers['x-request-id'];
      if (existingId) return existingId;
      const id = cuid();
      res.setHeader('X-Request-Id', id);
      return id;
    },
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
        return {
          ...req,
          headers: sanitizeLog({ ...req.headers }),
          body: sanitizeLog({ ...req.body }),
        };
      },
      res(res: Response) {
        // Sanitize headers from the response.
        const headers = typeof res.getHeaders === 'function' ? res.getHeaders() : (res as Record<string, any>).headers; // eslint-disable-line @typescript-eslint/no-explicit-any
        return {
          ...res,
          headers: sanitizeLog({ ...headers }),
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
      if (res.statusCode === 404) {
        return 'resource not found';
      }
      return `${req.method} ${req.url} completed`;
    },
  });
}

export default loggerMiddleware;
