import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';

let loggerMiddleware: any; // eslint-disable-line @typescript-eslint/no-explicit-any

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
    genReqId: function (req, res) {
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
    customProps: function (req, _res) { // eslint-disable-line @typescript-eslint/no-unused-vars
      return {
        actorId: req.actor?.id || null,
        gamingCenterId: req.params?.gamingCenterId || null,
      };
    },
    // Use serializers to sanitize sensitive fields from the log output.
    serializers: {
      req(req) {
        // Sanitize headers and body before they are logged.
        req.headers = sanitizeLog(req.headers);
        req.body = sanitizeLog(req.body);
        return req;
      },
      res(res) {
        // Sanitize headers from the response.
        res.headers = sanitizeLog(res.headers);
        return res;
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
