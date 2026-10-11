
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import httpStatus from 'http-status';
import { ApiFailure } from '../utils/response';
import { env } from '../../config/env';

type NormalizedError = {
  status: number;
  code: string;
  message: string;
  details?: unknown;
};

function getRequestId(req: Request): string | undefined {
  const anyReq = req as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  return anyReq.id ?? anyReq.requestId ?? anyReq.context?.requestId;
}

function normalizeError(err: any): NormalizedError { // eslint-disable-line @typescript-eslint/no-explicit-any
  // 1. AppError (our custom, preferred error type)
  if (err.isOperational) {
    return {
      status: err.statusCode,
      code: err.code || 'APP_ERROR',
      message: err.message,
      details: err.details,
    };
  }

  // 2. Prisma Known Request Error
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
    case 'P2002': {
      const target = err.meta?.target;
      const message = Array.isArray(target)
        ? `Duplicate value for field(s): ${target.join(', ')}`
        : 'Duplicate value for field';
      return {
        status: 409,
        code: 'CONFLICT',
        message,
        details: err.meta,
      };
    }
    case 'P2025':
      return {
        status: 404,
        code: 'NOT_FOUND',
        message: 'The requested record was not found.',
        details: err.meta,
      };
    default:
      return {
        status: 400,
        code: 'DB_REQUEST_FAILED',
        message: 'Database request failed.',
        details: { prismaCode: err.code, meta: err.meta },
      };
    }
  }

  // 3. PostgreSQL Exclusion Constraint Violation (via Prisma Raw Query Error)
  // This is a specific case for our reservation overlap constraint.
  // Prisma doesn't have a specific code for this, so we check the native DB error code.
  if (err.code === '23P01' && err.message?.includes('Reservation_no_overlap_active')) {
    return {
      status: 409,
      code: 'RESERVATION_OVERLAP',
      message: 'This time slot is already booked for the selected staff member.',
    };
  }

  // 4. Zod Validation Error
  if (err?.name === 'ZodError') {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request payload.',
      details: err.errors ?? err.issues ?? err,
    };
  }

  // 5. http-errors or similar errors with status codes
  if (typeof err?.status === 'number' || typeof err?.statusCode === 'number') {
    const status = err.status ?? err.statusCode;
    const statusText = (httpStatus as unknown as Record<number, string>)[status] as string | undefined;
    const code = err.code ?? (statusText ? statusText.replace(/\s+/g, '_').toUpperCase() : 'HTTP_ERROR');

    return {
      status,
      code,
      message: err.message ?? statusText ?? 'Request failed.',
      details: err.details,
    };
  }

  // 6. Default/Unknown Error
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected internal server error occurred.',
  };
}

/**
 * Express error-handling middleware
 * Usage: app.use(errorHandler);
 */
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) { // eslint-disable-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  const requestId = getRequestId(req);
  const normalized = normalizeError(err);

  // If headers are already sent, delegate to the default Express handler
  if (res.headersSent) return;

  // For 5xx errors in production, we don't want to leak implementation details
  const isServerError = normalized.status >= 500;
  const includeDetails = !isServerError || env.NODE_ENV !== 'production';

  const body: ApiFailure = {
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(includeDetails && normalized.details ? { details: normalized.details } : {}),
    },
    meta: { requestId },
  };

  res.status(normalized.status).json(body);
}
