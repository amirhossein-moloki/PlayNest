import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createHash } from 'crypto';
import { Request, Response } from 'express';
import { idempotencyMiddleware } from '../../../../src/common/middleware/idempotency';
import { IdempotencyRepo } from '../../../../src/common/repositories/idempotency.repo';
import { IdempotencyStatus } from '../../../../src/types/idempotency';
import httpStatus from 'http-status';
import AppError from '../../../../src/common/errors/AppError';

jest.mock('../../../../src/common/repositories/idempotency.repo');
jest.mock('../../../../src/config/logger');

const MockedIdempotencyRepo = IdempotencyRepo as jest.Mocked<typeof IdempotencyRepo>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('IdempotencyMiddleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      header: jest.fn(),
      method: 'POST',
      path: '/api/test',
      gamingCenterId: 'gc-1',
      body: { foo: 'bar' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      on: jest.fn(),
      statusCode: 200,
    };
    next = jest.fn();
  });

  it('should throw error if Idempotency-Key is missing', async () => {
    req.header.mockReturnValue(null);
    await idempotencyMiddleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].message).toBe('Idempotency-Key header is required.');
  });

  it('should throw error if Idempotency-Key is too short', async () => {
    req.header.mockReturnValue('short');
    await idempotencyMiddleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });

  it('should replay response if key is already completed with same hash', async () => {
    const key = 'a-very-long-idempotency-key';
    req.header.mockReturnValue(key);

    // Calculate actual hash of { foo: 'bar' }
    const hash = createHash('sha256').update(JSON.stringify({ foo: 'bar' })).digest('hex');

    MockedIdempotencyRepo.findKey.mockResolvedValue({
      status: IdempotencyStatus.COMPLETED,
      requestHash: hash,
      responseStatusCode: 201,
      responseBody: { ok: true },
    } as any);

    await idempotencyMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('should throw CONFLICT if key is in progress', async () => {
    req.header.mockReturnValue('a-very-long-idempotency-key');
    MockedIdempotencyRepo.findKey.mockResolvedValue({
      status: IdempotencyStatus.IN_PROGRESS,
    } as any);

    await idempotencyMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(httpStatus.CONFLICT);
  });

  it('should create a new key and call next if no record found', async () => {
    req.header.mockReturnValue('a-very-long-idempotency-key');
    MockedIdempotencyRepo.findKey.mockResolvedValue(null);
    MockedIdempotencyRepo.createKey.mockResolvedValue({} as any);

    await idempotencyMiddleware(req as Request, res as Response, next);

    expect(MockedIdempotencyRepo.createKey).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('should update key to COMPLETED on finish', async () => {
    req.header.mockReturnValue('a-very-long-idempotency-key');
    MockedIdempotencyRepo.findKey.mockResolvedValue(null);

    let finishCallback: any;
    res.on.mockImplementation((event: string, cb: any) => {
      if (event === 'finish') finishCallback = cb;
    });

    await idempotencyMiddleware(req as Request, res as Response, next);

    res.json({ success: true });
    res.statusCode = 200;
    await finishCallback();

    expect(MockedIdempotencyRepo.updateKey).toHaveBeenCalledWith(
      expect.any(String),
      'a-very-long-idempotency-key',
      expect.objectContaining({ status: IdempotencyStatus.COMPLETED, responseStatusCode: 200 })
    );
  });

  it('should replay response with error status if cached', async () => {
    const key = 'a-very-long-idempotency-key';
    req.header.mockReturnValue(key);

    const hash = createHash('sha256').update(JSON.stringify({ foo: 'bar' })).digest('hex');

    MockedIdempotencyRepo.findKey.mockResolvedValue({
      status: IdempotencyStatus.COMPLETED,
      requestHash: hash,
      responseStatusCode: 400,
      responseBody: { error: 'bad' },
    } as any);

    await idempotencyMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'bad' });
  });

  it('should allow retry if previous attempt failed', async () => {
    const key = 'a-very-long-idempotency-key';
    req.header.mockReturnValue(key);

    MockedIdempotencyRepo.findKey.mockResolvedValue({
      id: 'rec-1',
      status: IdempotencyStatus.FAILED,
    } as any);

    await idempotencyMiddleware(req as Request, res as Response, next);

    expect(MockedIdempotencyRepo.deleteKey).toHaveBeenCalledWith('rec-1');
    expect(MockedIdempotencyRepo.createKey).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
