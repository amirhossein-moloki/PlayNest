import { jest } from '@jest/globals';
import { SessionActorType } from '@prisma/client';
import { Request, Response } from 'express';

// Mock the sanitizer before importing the middleware
jest.mock('../utils/sanitizer', () => ({
  sanitizeLog: (obj: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (obj.headers && obj.headers.authorization) {
      obj.headers.authorization = '[REDACTED]';
    }
    if (obj.body && obj.body.password) {
      obj.body.password = '[REDACTED]';
    }
    if (obj.body && obj.body.email) {
      obj.body.email = '[REDACTED]';
    }
    return obj;
  },
}));

// Mock pino-http and its logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
jest.mock('pino-http', () => {
  return jest.fn(() => (req: any, res: any, next?: () => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    // This is a simplified mock of the pino-http middleware.
    // It captures the log object that would be generated.
    const logObject = {
      requestId: res.getHeader('X-Request-Id'),
      actorId: req.actor?.id || null,
      gamingCenterId: req.params?.gamingCenterId || null,
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
      },
      response: {
        statusCode: res.statusCode,
        headers: res.getHeaders(),
      },
    };
    mockLogger.info(logObject);
    if (next) next();
  });
});
jest.mock('../../config/logger', () => ({
  default: mockLogger,
}));

// We need to import the middleware *after* the mocks are set up.
import loggerMiddleware from './logger';

describe('Logger Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response> & { statusCode: number; headers: Record<string, string | number | string[]> };
  let next: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // A minimal Express-compatible request mock.
    req = {
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer some-secret-token',
      },
      body: {
        email: 'test@example.com',
        password: 'a-very-secret-password',
      },
      actor: { id: 'user-123', actorType: SessionActorType.USER },
      params: { gamingCenterId: 'gamingCenter-abc' },
    };

    // A minimal Express-compatible response mock.
    const headers: Record<string, string | number | string[]> = {};
    res = {
      statusCode: 200,
      headers,
      setHeader(name: string, value: string | number | string[]) {
        headers[name] = value;
        return this as Response;
      },
      getHeader(name: string) {
        return headers[name];
      },
      getHeaders() {
        return headers;
      },
      end(callback?: () => void) {
        callback?.();
        return this as Response;
      },
    };

    next = jest.fn();
  });

  it('should provide a test-safe middleware when NODE_ENV is test', () => {
    const pinoHttp = require('pino-http'); // eslint-disable-line @typescript-eslint/no-var-requires

    loggerMiddleware(req as Request, res as Response, next);

    expect(pinoHttp).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});
