/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';
import { Prisma } from '@prisma/client';
import AppError from '../../../../src/common/errors/AppError';
import { errorHandler } from '../../../../src/common/errors/errorHandler';
import { notFoundHandler } from '../../../../src/common/errors/notFoundHandler';
import { env } from '../../../../src/config/env';
import { NotificationStation } from '../../../../src/modules/notifications/notifications.station';

jest.mock('../../../../src/modules/notifications/notifications.station', () => ({
  NotificationStation: {
    notifyManagers: jest.fn().mockImplementation(() => Promise.resolve([])),
  },
}));

function createMockResponse(initialOverrides: { headersSent?: boolean } = {}) {
  const res: any = {
    headersSent: initialOverrides.headersSent ?? false,
    statusCode: 200,
    resolvedContentType: undefined as string | undefined,
    body: undefined as unknown,
  };

  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });

  res.type = jest.fn((value: string) => {
    res.resolvedContentType = value;
    return res;
  });

  res.json = jest.fn((payload: unknown) => {
    res.body = payload;
    return res;
  });

  return res as Response & {
    statusCode: number;
    resolvedContentType?: string;
    body: any;
  };
}

function createMockRequest(overrides: Partial<Request> & Record<string, unknown> = {}): Request {
  return {
    method: 'GET',
    originalUrl: '/api/v1/test',
    url: '/api/v1/test',
    path: '/api/v1/test',
    id: 'req-test-123',
    ...overrides,
  } as unknown as Request;
}

describe('notFoundHandler & errorHandler unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NotificationStation.notifyManagers as jest.Mock).mockImplementation(() => Promise.resolve([]));
  });

  describe('notFoundHandler', () => {
    it('forwards an operational 404 ROUTE_NOT_FOUND AppError with method and path details', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/missing',
      });
      const res = createMockResponse();
      const next = jest.fn() as unknown as NextFunction;

      notFoundHandler(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const forwardedErr = (next as jest.Mock).mock.calls[0][0] as AppError;
      expect(forwardedErr).toBeInstanceOf(AppError);
      expect(forwardedErr.statusCode).toBe(404);
      expect(forwardedErr.isOperational).toBe(true);
      expect(forwardedErr.code).toBe('ROUTE_NOT_FOUND');
      expect(forwardedErr.message).toBe('Route POST /api/v1/missing not found.');
      expect(forwardedErr.details).toEqual({
        method: 'POST',
        path: '/api/v1/missing',
      });
    });

    it('strips query parameters from originalUrl so sensitive tokens are not echoed', () => {
      const req = createMockRequest({
        method: 'GET',
        originalUrl: '/api/v1/missing?token=secret-jwt&phone=09120000000',
      });
      const res = createMockResponse();
      const next = jest.fn() as unknown as NextFunction;

      notFoundHandler(req, res, next);

      const forwardedErr = (next as jest.Mock).mock.calls[0][0] as AppError;
      expect(forwardedErr.message).toBe('Route GET /api/v1/missing not found.');
      expect(forwardedErr.message).not.toContain('secret-jwt');
      expect(forwardedErr.details).toEqual({
        method: 'GET',
        path: '/api/v1/missing',
      });
    });
  });

  describe('errorHandler', () => {
    it('handles operational AppError with custom code and details', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn() as unknown as NextFunction;
      const err = new AppError('Route GET /api/v1/nope not found.', 404, {
        code: 'ROUTE_NOT_FOUND',
        details: { method: 'GET', path: '/api/v1/nope' },
      });

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.type).toHaveBeenCalledWith('application/json');
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: 'Route GET /api/v1/nope not found.',
          details: { method: 'GET', path: '/api/v1/nope' },
        },
        meta: { requestId: 'req-test-123' },
      });
      expect(NotificationStation.notifyManagers).not.toHaveBeenCalled();
    });

    it('defaults operational AppError without explicit code to APP_ERROR', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn() as unknown as NextFunction;
      const err = new AppError('Something failed.', 400);

      errorHandler(err, req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'APP_ERROR',
          message: 'Something failed.',
        },
        meta: { requestId: 'req-test-123' },
      });
    });

    it('normalizes malformed JSON body-parser SyntaxError to 400 INVALID_JSON', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn() as unknown as NextFunction;
      const err = Object.assign(new SyntaxError('Unexpected end of JSON input'), {
        status: 400,
        statusCode: 400,
        body: '{"broken":',
        type: 'entity.parse.failed',
      });

      errorHandler(err, req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.type).toHaveBeenCalledWith('application/json');
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Malformed JSON payload.',
        },
        meta: { requestId: 'req-test-123' },
      });
    });

    it('normalizes entity.too.large to 413 PAYLOAD_TOO_LARGE', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn() as unknown as NextFunction;
      const err = Object.assign(new Error('request entity too large'), {
        status: 413,
        type: 'entity.too.large',
      });

      errorHandler(err, req, res, next);

      expect(res.statusCode).toBe(413);
      expect(res.body.error).toEqual({
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload is too large.',
      });
    });

    it('normalizes charset/encoding unsupported errors to 415 UNSUPPORTED_MEDIA_TYPE', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn() as unknown as NextFunction;
      const err = Object.assign(new Error('unsupported content encoding "br"'), {
        status: 415,
        type: 'encoding.unsupported',
      });

      errorHandler(err, req, res, next);

      expect(res.statusCode).toBe(415);
      expect(res.body.error).toEqual({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'unsupported content encoding "br"',
      });
    });

    it('normalizes MulterError LIMIT_FILE_SIZE to 413 PAYLOAD_TOO_LARGE and other Multer errors to 400 FILE_UPLOAD_ERROR', () => {
      const req = createMockRequest();
      const next = jest.fn() as unknown as NextFunction;

      const sizeRes = createMockResponse();
      const sizeErr = Object.assign(new Error('File too large'), {
        name: 'MulterError',
        code: 'LIMIT_FILE_SIZE',
        field: 'file',
      });
      errorHandler(sizeErr, req, sizeRes, next);

      expect(sizeRes.statusCode).toBe(413);
      expect(sizeRes.body.error).toEqual({
        code: 'PAYLOAD_TOO_LARGE',
        message: 'File too large',
        details: { field: 'file', multerCode: 'LIMIT_FILE_SIZE' },
      });

      const fieldRes = createMockResponse();
      const fieldErr = Object.assign(new Error('Unexpected field'), {
        name: 'MulterError',
        code: 'LIMIT_UNEXPECTED_FILE',
        field: 'avatar',
      });
      errorHandler(fieldErr, req, fieldRes, next);

      expect(fieldRes.statusCode).toBe(400);
      expect(fieldRes.body.error).toEqual({
        code: 'FILE_UPLOAD_ERROR',
        message: 'Unexpected field',
        details: { field: 'avatar', multerCode: 'LIMIT_UNEXPECTED_FILE' },
      });
    });

    it('normalizes ZodError to 400 VALIDATION_ERROR with issues details', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = jest.fn() as unknown as NextFunction;
      const parsed = z.object({ phone: z.string() }).safeParse({});
      expect(parsed.success).toBe(false);
      const err = (parsed as { success: false; error: ZodError }).error;

      errorHandler(err, req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBe('Invalid request payload.');
      expect(Array.isArray(res.body.error.details)).toBe(true);
    });

    it('accepts valid 4xx/5xx status errors and falls back to 500 INTERNAL_ERROR on invalid status codes', () => {
      const req = createMockRequest();
      const next = jest.fn() as unknown as NextFunction;

      const validRes = createMockResponse();
      errorHandler({ status: 400, message: 'Failed to decode param' }, req, validRes, next);
      expect(validRes.statusCode).toBe(400);
      expect(validRes.body.error).toEqual({
        code: 'BAD_REQUEST',
        message: 'Failed to decode param',
      });

      const invalidHighRes = createMockResponse();
      errorHandler({ status: 999, message: 'Weird status' }, req, invalidHighRes, next);
      expect(invalidHighRes.statusCode).toBe(500);
      expect(invalidHighRes.body.error.code).toBe('INTERNAL_ERROR');

      const invalidZeroRes = createMockResponse();
      errorHandler({ statusCode: 0, message: 'Zero status' }, req, invalidZeroRes, next);
      expect(invalidZeroRes.statusCode).toBe(500);
      expect(invalidZeroRes.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('safely handles null, undefined, and primitive errors with 500 INTERNAL_ERROR JSON', () => {
      const req = createMockRequest();
      const next = jest.fn() as unknown as NextFunction;

      for (const value of [null, undefined, 'raw string failure']) {
        const res = createMockResponse();
        errorHandler(value, req, res, next);
        expect(res.statusCode).toBe(500);
        expect(res.type).toHaveBeenCalledWith('application/json');
        expect(res.body).toEqual({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected internal server error occurred.',
          },
          meta: { requestId: 'req-test-123' },
        });
      }
    });

    it('always enforces application/json content type on error responses', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      res.resolvedContentType = 'text/html';
      const next = jest.fn() as unknown as NextFunction;

      errorHandler(new AppError('Not found', 404, { code: 'NOT_FOUND' }), req, res, next);

      expect(res.type).toHaveBeenCalledWith('application/json');
      expect(res.resolvedContentType).toBe('application/json');
    });

    it('delegates to next(err) and does not write body when headers are already sent', () => {
      const req = createMockRequest();
      const res = createMockResponse({ headersSent: true });
      const next = jest.fn() as unknown as NextFunction;
      const err = new Error('Stream error');

      errorHandler(err, req, res, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('does not invoke NotificationStation.notifyManagers on 5xx errors', () => {
      const req = createMockRequest();
      const next = jest.fn() as unknown as NextFunction;
      const resSync = createMockResponse();

      errorHandler(new Error('Boom internal failure'), req, resSync, next);

      expect(resSync.statusCode).toBe(500);
      expect(resSync.body.error.code).toBe('INTERNAL_ERROR');
      expect(NotificationStation.notifyManagers).not.toHaveBeenCalled();
    });

    it('normalizes raw and Prisma-wrapped 23P01 exclusion violations to 409 RESERVATION_OVERLAP', () => {
      const req = createMockRequest();
      const next = jest.fn() as unknown as NextFunction;

      const rawRes = createMockResponse();
      errorHandler(
        {
          code: '23P01',
          message: 'conflicting key value violates exclusion constraint "Reservation_no_overlap_active"',
        },
        req,
        rawRes,
        next
      );
      expect(rawRes.statusCode).toBe(409);
      expect(rawRes.body.error.code).toBe('RESERVATION_OVERLAP');

      const prismaWrappedErr = new Prisma.PrismaClientUnknownRequestError(
        'Invalid `prisma.reservation.create()` invocation: Error occurred during query execution: ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "23P01", message: "conflicting key value violates exclusion constraint \\"Reservation_no_overlap_active\\"" }) })',
        { clientVersion: '5.22.0' }
      );
      const wrappedRes = createMockResponse();
      errorHandler(prismaWrappedErr, req, wrappedRes, next);
      expect(wrappedRes.statusCode).toBe(409);
      expect(wrappedRes.body.error.code).toBe('RESERVATION_OVERLAP');
    });

    it('omits error details for 5xx errors in production environment', () => {
      const originalEnv = env.NODE_ENV;
      (env as any).NODE_ENV = 'production';
      try {
        const req = createMockRequest();
        const res = createMockResponse();
        const next = jest.fn() as unknown as NextFunction;
        const err = new AppError('Database down', 500, {
          code: 'INTERNAL_ERROR',
          details: { host: '10.0.0.5', stack: 'secret-trace' },
        });

        errorHandler(err, req, res, next);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Database down',
          },
          meta: { requestId: 'req-test-123' },
        });
        expect(res.body.error.details).toBeUndefined();
      } finally {
        (env as any).NODE_ENV = originalEnv;
      }
    });
  });
});
