import { Request, Response, NextFunction, RequestHandler } from 'express';
import pinoHttp from 'pino-http';
import cuid from 'cuid';
import { env } from '../../config/env';
import logger from '../../config/logger';
import { sanitizeLog } from '../utils/sanitizer';
import { requestContext } from '../context/request-context';
import { Metrics } from '../metrics/metrics';

export interface CustomIncomingMessage {
  id?: unknown;
  actor?: { id?: string; [key: string]: unknown };
  startTime?: number;
  raw?: CustomIncomingMessage;
  method?: string;
  url?: string;
  query?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, unknown>;
  body?: unknown;
  socket?: {
    remoteAddress?: string;
    remotePort?: number;
  };
}

export interface CustomServerResponse {
  statusCode?: number;
  raw?: CustomServerResponse;
  headers?: Record<string, unknown>;
  getHeaders?: () => Record<string, unknown>;
  _headers?: Record<string, unknown>;
}

let loggerMiddleware: RequestHandler;

if (env.NODE_ENV === 'test' && process.env.ENABLE_TEST_LOGGER !== 'true') {
  // In test environment by default, export a mock middleware to avoid pino-http overhead unless enabled
  loggerMiddleware = (req: Request, res: Response, next: NextFunction) => next();
} else {
  const middleware = pinoHttp({
    logger,
    genReqId: (req: CustomIncomingMessage) => (req.id ? String(req.id) : cuid()),
    customAttributeKeys: {
      req: 'request',
      res: 'response',
      err: 'error',
      responseTime: 'duration',
      reqId: 'requestId',
    },
    customProps: function (req: CustomIncomingMessage) {
      return {
        actorId: req.actor?.id || null,
        gamingCenterId: req.params?.gamingCenterId || null,
      };
    },
    serializers: {
      req(req: CustomIncomingMessage) {
        try {
          const rawReq = req.raw || req;
          const headers = rawReq.headers ? sanitizeLog(JSON.parse(JSON.stringify(rawReq.headers))) : {};
          const body = rawReq.body ? sanitizeLog(JSON.parse(JSON.stringify(rawReq.body))) : undefined;

          return {
            id: req.id || rawReq.id,
            method: rawReq.method,
            url: rawReq.url,
            query: rawReq.query,
            params: rawReq.params,
            headers,
            body,
            remoteAddress: rawReq.socket?.remoteAddress,
            remotePort: rawReq.socket?.remotePort,
          };
        } catch {
          return {
            id: req?.id,
            method: req?.method,
            url: req?.url,
          };
        }
      },
      res(res: CustomServerResponse) {
        try {
          const statusCode = res.statusCode || res.raw?.statusCode || 200;
          let headers: Record<string, unknown> = {};

          const targetRes = res.raw || res;

          if (typeof targetRes.getHeaders === 'function') {
            headers = targetRes.getHeaders() || {};
          } else if (res.headers && typeof res.headers === 'object') {
            headers = res.headers;
          } else if (targetRes._headers && typeof targetRes._headers === 'object') {
            headers = targetRes._headers;
          }

          const sanitizedHeaders = sanitizeLog(JSON.parse(JSON.stringify(headers)));

          return {
            statusCode,
            headers: sanitizedHeaders,
          };
        } catch {
          return {
            statusCode: res?.statusCode || 500,
            headers: {},
          };
        }
      },
    },
    customLogLevel: function (req: CustomIncomingMessage, res: CustomServerResponse, err?: Error) {
      const statusCode = res.statusCode || res.raw?.statusCode || 200;
      if (statusCode >= 400 && statusCode < 500) {
        return 'warn';
      } else if (statusCode >= 500 || err) {
        return 'error';
      }
      return 'info';
    },
    customSuccessMessage: function (req: CustomIncomingMessage, res: CustomServerResponse) {
      const startTime = req.startTime || Date.now();
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode || res.raw?.statusCode || 200;
      Metrics.recordApiLatency(req.method || 'UNKNOWN', req.url || 'UNKNOWN', statusCode, duration);

      if (statusCode === 404) {
        return 'resource not found';
      }
      return `${req.method || 'GET'} ${req.url || '/'} completed`;
    },
  });

  loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const customReq = req as unknown as CustomIncomingMessage;
    customReq.startTime = Date.now();
    const existingId = customReq.id ?? (req.headers['x-request-id'] as string) ?? (req.headers['x-correlation-id'] as string);
    const requestId = existingId ? String(existingId) : cuid();
    const correlationId = (req.headers['x-correlation-id'] as string) || requestId;

    if (!customReq.id) customReq.id = requestId;
    if (typeof res.setHeader === 'function') {
      res.setHeader('X-Request-Id', requestId);
      res.setHeader('X-Correlation-Id', correlationId);
    }

    const context = {
      requestId,
      correlationId,
      actorId: customReq.actor?.id,
      gamingCenterId: req.params?.gamingCenterId,
    };

    requestContext.run(context, () => {
      middleware(req as unknown as Parameters<typeof middleware>[0], res as unknown as Parameters<typeof middleware>[1], next);
    });
  };
}

export default loggerMiddleware;
