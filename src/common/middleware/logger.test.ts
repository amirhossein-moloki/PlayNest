import { jest } from '@jest/globals';
import http from 'http';
import { Writable } from 'stream';

// Mock the sanitizer
jest.mock('../utils/sanitizer', () => ({
  sanitizeLog: (obj: any) => obj, // eslint-disable-line @typescript-eslint/no-explicit-any
}));

// Mock pino-http
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('pino-http', () => {
  return jest.fn(() => (req: any, res: any, next?: () => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (next) next();
  });
});

jest.mock('../../config/logger', () => ({
  default: mockLogger,
}));

jest.mock('../../config/env', () => ({
  env: { NODE_ENV: 'development' },
}));

// We need to import the middleware *after* the mocks are set up.
import loggerMiddleware from './logger';
import { Request, Response } from 'express';

describe('Logger Middleware', () => {
  let req: Request;
  let res: Response;
  let next: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {},
      body: {},
      actor: { id: 'user-123', actorType: 'USER' },
      params: { gamingCenterId: 'gamingCenter-abc' },
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

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

  it('should be defined', () => {
    expect(loggerMiddleware).toBeDefined();
  });

  it('should call next', () => {
    (loggerMiddleware as any)(req, res, next); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(next).toHaveBeenCalled();
  });
});
