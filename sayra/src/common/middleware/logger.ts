import { Request, Response, NextFunction, RequestHandler } from 'express';
import pinoHttp from 'pino-http';
import { createId as cuid } from '@paralleldrive/cuid2';
import { env } from '../../config/env';
import logger from '../../config/logger';
import {
  sanitizeLogCopy,
  pickSafeRequestHeaders,
  pickSafeResponseHeaders,
} from '../utils/sanitizer';
import { requestContext } from '../context/request-context';

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
  getHeader?: (name: string) => unknown;
  getHeaders?: () => Record<string, unknown>;
  _headers?: Record<string, unknown>;
}

let loggerMiddleware: RequestHandler;

if (env.NODE_ENV === 'test' && process.env.ENABLE_TEST_LOGGER !== 'true') {
  // In test environment by default, export a mock middleware to avoid pino-http overhead unless enabled
  loggerMiddleware = (req: Request, res: Response, next: NextFunction) => next();
} else {
  const middleware = pinoHttp({
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    logger: logger as any,
    genReqId: (req: CustomIncomingMessage) => (req.id ? String(req.id) : cuid()),
    autoLogging: {
      ignore: (req: CustomIncomingMessage) => {
        const url = req.url || '';
        return (
          url === '/health' ||
          url.startsWith('/health?') ||
          url === '/api/v1/health' ||
          url.startsWith('/api/v1/health?')
        );
      },
    },
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
          const headers = pickSafeRequestHeaders(rawReq.headers);
          const hasBody =
            rawReq.body &&
            typeof rawReq.body === 'object' &&
            Object.keys(rawReq.body as Record<string, unknown>).length > 0;
          const body = hasBody ? sanitizeLogCopy(rawReq.body) : undefined;

          return {
            id: req.id || rawReq.id,
            method: rawReq.method,
            url: rawReq.url,
            query: rawReq.query,
            params: rawReq.params,
            headers,
            ...(body !== undefined ? { body } : {}),
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
          const targetRes = res.raw || res;
          const sanitizedHeaders = pickSafeResponseHeaders(
            typeof targetRes.getHeader === 'function' ? targetRes : res
          );

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
      const statusCode = res.statusCode || res.raw?.statusCode || 200;
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
