
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import httpStatus from 'http-status';
import { ApiFailure } from '../utils/response';
import { env } from '../../config/env';
import logger from '../../config/logger';
import { isReservationOverlapDbError } from './dbErrors';

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

function isValidHttpErrorStatus(status: unknown): status is number {
  return typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599;
}

function normalizeError(err: any): NormalizedError { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!err || (typeof err !== 'object' && typeof err !== 'function')) {
    return {
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal server error occurred.',
    };
  }

  // 1. AppError (our custom, preferred error type)
  if (err.isOperational) {
    return {
      status: isValidHttpErrorStatus(err.statusCode) ? err.statusCode : 500,
      code: err.code || 'APP_ERROR',
      message: err.message || 'Request failed.',
      details: err.details,
    };
  }

  // 2. Prisma Known Request Error
  const isProduction = env.NODE_ENV === 'production';
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
    case 'P2002': {
      const target = err.meta?.target;
      const message = !isProduction && Array.isArray(target)
        ? `Duplicate value for field(s): ${target.join(', ')}`
        : 'Duplicate value for field';
      return {
        status: 409,
        code: 'CONFLICT',
        message,
        ...(isProduction ? {} : { details: err.meta }),
      };
    }
    case 'P2025':
      return {
        status: 404,
        code: 'NOT_FOUND',
        message: 'The requested record was not found.',
        ...(isProduction ? {} : { details: err.meta }),
      };
    case 'P2003':
      return {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Referenced entity was not found.',
        ...(isProduction ? {} : { details: err.meta }),
      };
    default:
      return {
        status: 400,
        code: 'DB_REQUEST_FAILED',
        message: 'Database request failed.',
        ...(isProduction ? {} : { details: { prismaCode: err.code, meta: err.meta } }),
      };
    }
  }

  // 2.1 Prisma Validation Error
  if (err instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid database query parameters.',
      ...(isProduction ? {} : { details: err.message }),
    };
  }

  // 3. PostgreSQL Exclusion Constraint Violation (raw or wrapped in PrismaClientUnknownRequestError)
  if (isReservationOverlapDbError(err)) {
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

  // 4.1 Express / body-parser errors (malformed JSON, payload limits, unsupported encoding)
  if (
    err.type === 'entity.parse.failed' ||
    (err instanceof SyntaxError &&
      'body' in err &&
      ((err as { status?: unknown }).status === 400 ||
        (err as { statusCode?: unknown }).statusCode === 400))
  ) {
    return {
      status: 400,
      code: 'INVALID_JSON',
      message: 'Malformed JSON payload.',
    };
  }

  if (err.type === 'entity.too.large') {
    return {
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request payload is too large.',
    };
  }

  if (err.type === 'charset.unsupported' || err.type === 'encoding.unsupported') {
    return {
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: err.message || 'Unsupported request encoding or media type.',
    };
  }

  // 4.2 Multer file upload errors
  if (err.name === 'MulterError') {
    const details = err.field
      ? { field: err.field, multerCode: err.code }
      : { multerCode: err.code };
    if (err.code === 'LIMIT_FILE_SIZE') {
      return {
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: err.message || 'Uploaded file exceeds the maximum allowed size.',
        details,
      };
    }
    return {
      status: 400,
      code: 'FILE_UPLOAD_ERROR',
      message: err.message || 'Invalid file upload request.',
      details,
    };
  }

  // 5. http-errors or similar errors with valid HTTP error status codes
  const rawStatus = err.status ?? err.statusCode;
  if (isValidHttpErrorStatus(rawStatus)) {
    const statusText = (httpStatus as unknown as Record<number, string>)[rawStatus] as string | undefined;
    const code =
      typeof err.code === 'string' && err.code.trim()
        ? err.code
        : (statusText ? statusText.replace(/\s+/g, '_').toUpperCase() : 'HTTP_ERROR');

    return {
      status: rawStatus,
      code,
      message: err.message || statusText || 'Request failed.',
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
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const requestId = getRequestId(req);
  const normalized = normalizeError(err);

  // If headers are already sent, delegate to the default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // For 5xx errors in production, we don't want to leak implementation details
  const isServerError = normalized.status >= 500;
  const includeDetails = !isServerError || env.NODE_ENV !== 'production';

  if (isServerError && env.NODE_ENV !== 'test') {
    logger.error(
      {
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        status: normalized.status,
        code: normalized.code,
        err,
      },
      'Unhandled 5xx API error'
    );
  }

  const body: ApiFailure = {
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(includeDetails && normalized.details ? { details: normalized.details } : {}),
    },
    meta: { requestId },
  };

  res.status(normalized.status).type('application/json').json(body);
}
