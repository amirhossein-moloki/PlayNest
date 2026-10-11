
import { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';
import { add } from 'date-fns';
import httpStatus from 'http-status';
import { IdempotencyStatus } from '../../types/idempotency';

import { IdempotencyRepo } from '../repositories/idempotency.repo';
import AppError from '../errors/AppError';
import logger from '../../config/logger';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
const TTL = { hours: 24 };

/**
 * Normalizes and hashes the request body to create a consistent representation.
 */
const getRequestHash = (body: any): string => { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!body || Object.keys(body).length === 0) {
    return '';
  }
  // Sort keys to ensure consistent hash for the same payload
  const sortedBody = Object.keys(body)
    .sort()
    .reduce((acc, key) => {
      acc[key] = body[key];
      return acc;
    }, {} as Record<string, any>); // eslint-disable-line @typescript-eslint/no-explicit-any
  const stringifiedBody = JSON.stringify(sortedBody);
  return createHash('sha256').update(stringifiedBody).digest('hex');
};

/**
 * Idempotency middleware to prevent duplicate requests.
 *
 * This middleware must run AFTER any middleware that resolves gamingCenter identifiers (e.g., gamingCenterIdMiddleware).
 */
export const idempotencyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const idempotencyKey = req.header(IDEMPOTENCY_KEY_HEADER);

  // 1. Validate header presence and format
  if (!idempotencyKey) {
    return next(
      new AppError(
        'Idempotency-Key header is required.',
        httpStatus.BAD_REQUEST,
        { code: 'IDEMPOTENCY_KEY_REQUIRED' },
      ),
    );
  }
  if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return next(
      new AppError(
        'Idempotency-Key must be between 16 and 128 characters.',
        httpStatus.BAD_REQUEST,
        { code: 'IDEMPOTENCY_KEY_INVALID_LENGTH' },
      ),
    );
  }

  // 2. Define scope and hash
  // Use req.path instead of req.originalUrl to ignore query parameters
  const scope = `${req.method}:${req.path}:${req.gamingCenterId}`;
  const requestHash = getRequestHash(req.body);

  // 3. Check for an existing idempotency record
  const existingRecord = await IdempotencyRepo.findKey(scope, idempotencyKey);

  if (existingRecord) {
    // 4. Handle existing record based on its status
    switch (existingRecord.status) {
    case IdempotencyStatus.COMPLETED:
      if (existingRecord.requestHash !== requestHash) {
        return next(
          new AppError(
            'Idempotency-Key is being reused with a different request payload.',
            httpStatus.CONFLICT,
            { code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD' },
          ),
        );
      }
      // Return the cached response
      logger.info({
        event: 'idempotency.replay',
        key: idempotencyKey,
        scope,
      });
      return res
        .status(existingRecord.responseStatusCode as number)
        .json(existingRecord.responseBody);

    case IdempotencyStatus.IN_PROGRESS:
      // Fail fast for in-flight requests
      return next(
        new AppError(
          'A request with this Idempotency-Key is already in progress.',
          httpStatus.CONFLICT,
          { code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS' },
        ),
      );

    case IdempotencyStatus.FAILED:
      // If a previous attempt failed, allow a new attempt by deleting the old key.
      // This will allow the flow to proceed to the 'create' step.
      await IdempotencyRepo.deleteKey(existingRecord.id);
      break;
    }
  }

  // 5. Create a new idempotency record for the new request
  try {
    await IdempotencyRepo.createKey({
      key: idempotencyKey,
      scope,
      requestHash,
      status: IdempotencyStatus.IN_PROGRESS,
      expiresAt: add(new Date(), TTL),
    });
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (error.code === 'P2002') {
      // Race condition: another request created the key just now.
      // Re-fetch and treat as an in-flight request.
      logger.warn({
        event: 'idempotency.race_condition',
        key: idempotencyKey,
        scope,
      });
      return next(
        new AppError(
          'A request with this Idempotency-Key is already in progress.',
          httpStatus.CONFLICT,
          { code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS' },
        ),
      );
    }
    // For other DB errors, let the global handler manage it.
    return next(error);
  }

  // 6. Wrap response methods to capture the result after business logic runs
  const originalJson = res.json;
  const originalSend = res.send;
  let responseBody: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  res.json = (body) => {
    responseBody = body;
    return originalJson.call(res, body);
  };

  res.send = (body) => {
    responseBody = body;
    return originalSend.call(res, body);
  };

  // 8. Attach 'finish' listener to handle the final response status
  res.on('finish', async () => {
    const finalStatusCode = res.statusCode;
    let finalStatus: IdempotencyStatus;
    let event: string;

    if (finalStatusCode >= 200 && finalStatusCode < 300) {
      finalStatus = IdempotencyStatus.COMPLETED;
      event = 'idempotency.success';
    } else if (finalStatusCode >= 400 && finalStatusCode < 500) {
      // Cache client errors to ensure subsequent retries receive the same response
      finalStatus = IdempotencyStatus.COMPLETED;
      event = 'idempotency.client_error';
    } else {
      // Mark as FAILED for server errors (5xx) to allow the client to retry
      finalStatus = IdempotencyStatus.FAILED;
      event = 'idempotency.server_error';
    }

    try {
      await IdempotencyRepo.updateKey(scope, idempotencyKey, {
        status: finalStatus,
        responseBody: responseBody || null,
        responseStatusCode: finalStatusCode,
      });
      logger.info({ event, key: idempotencyKey, scope, statusCode: finalStatusCode });
    } catch (dbError) {
      logger.error({
        event: 'idempotency.update_failed',
        key: idempotencyKey,
        scope,
        error: dbError,
      });
    }
  });

  // 9. Pass control to the next middleware
  return next();
};
