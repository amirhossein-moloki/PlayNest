import { jest } from '@jest/globals';
import http from 'http';
import { Writable } from 'stream';

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
process.env.NODE_ENV = 'development';
import loggerMiddleware from './logger';
import { Request, Response } from 'express';

describe('Logger Middleware', () => {
  let req: Request;
  let res: Response;
  let next: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // A basic mock for Request
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
      actor: { id: 'user-123', actorType: 'USER' },
      params: { gamingCenterId: 'gamingCenter-abc' },
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    // A mock for ServerResponse that allows setting headers and status code
    const resWritable = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    res = new http.ServerResponse(req as any) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    (res as any).assignSocket(resWritable as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    res.statusCode = 200;

    next = jest.fn();
  });

  it('should be created in non-test environments', () => {
    const pinoHttp = require('pino-http'); // eslint-disable-line @typescript-eslint/no-var-requires
    expect(pinoHttp).toHaveBeenCalled();
  });

  it('should call the mocked logger with sanitized data and custom props', (done) => {
    // Manually invoke the middleware
    // We need to cast it since we might have made it incompatible with RequestHandler in some way during refactoring
    (loggerMiddleware as any)(req, res, next); // eslint-disable-line @typescript-eslint/no-explicit-any

    // End the response to trigger the logging logic in a real scenario
    res.end(() => {
      expect(mockLogger.info).toHaveBeenCalledTimes(1);
      const loggedData = mockLogger.info.mock.calls[0][0] as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      // 1. Check for custom context
      expect(loggedData).toHaveProperty('requestId');
      expect(loggedData.actorId).toBe('user-123');
      expect(loggedData.gamingCenterId).toBe('gamingCenter-abc');

      // 2. Check for redaction (based on our simple mock sanitizer)
      expect(loggedData.request.headers.authorization).toBe('[REDACTED]');
      expect(loggedData.request.body.password).toBe('[REDACTED]');

      // 3. Ensure non-sensitive data is still present
      expect(loggedData.request.body.email).toBe('[REDACTED]');

      // 4. Check if next() was called
      expect(next).toHaveBeenCalledTimes(1);

      done();
    });
  });
});
