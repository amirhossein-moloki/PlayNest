/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Worker, Job } from 'bullmq';
import { AnalyticsRepo } from '../../../../src/modules/analytics/analytics.repo';

jest.mock('../../../../src/modules/analytics/analytics.repo');
jest.mock('bullmq');
jest.mock('../../../../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const MockedAnalyticsRepo = AnalyticsRepo as jest.Mocked<typeof AnalyticsRepo>;

describe('AnalyticsWorker', () => {
  let handler: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.isolateModules(() => {
      require('../../../../src/jobs/workers/analytics.worker');
    });
    handler = (Worker as jest.MockedClass<typeof Worker>).mock.calls[0][1];
  });

  it('should process RESERVATION sync job successfully', async () => {
    const job = {
      id: 'job-1',
      data: { type: 'RESERVATION', entityId: 'res-1' },
    };

    MockedAnalyticsRepo.syncAllStatsForReservation.mockResolvedValue({} as any);
    await handler(job as Job);
    expect(MockedAnalyticsRepo.syncAllStatsForReservation).toHaveBeenCalledWith('res-1');
  });

  it('should process PAYMENT sync job successfully', async () => {
    const job = {
      id: 'job-1',
      data: { type: 'PAYMENT', entityId: 'pay-1' },
    };

    MockedAnalyticsRepo.syncAllStatsForPayment.mockResolvedValue({} as any);
    await handler(job as Job);
    expect(MockedAnalyticsRepo.syncAllStatsForPayment).toHaveBeenCalledWith('pay-1');
  });

  it('should process REVIEW sync job successfully', async () => {
    const job = {
      id: 'job-1',
      data: { type: 'REVIEW', entityId: 'rev-1' },
    };

    MockedAnalyticsRepo.syncAllStatsForReview.mockResolvedValue({} as any);
    await handler(job as Job);
    expect(MockedAnalyticsRepo.syncAllStatsForReview).toHaveBeenCalledWith('rev-1');
  });

  it('should throw error if sync fails', async () => {
    const job = {
      id: 'job-1',
      data: { type: 'RESERVATION', entityId: 'res-1' },
    };

    MockedAnalyticsRepo.syncAllStatsForReservation.mockRejectedValue(new Error('Sync fail'));
    await expect(handler(job as Job)).rejects.toThrow('Sync fail');
  });

  it('should execute inside AnalyticsWorker system context and emit zero tenantGuard WARN logs', async () => {
    let isolatedCtxModule: any;
    let isolatedPrismaExtModule: any;
    let isolatedLogger: any;
    let isolatedRepo: any;
    let isolatedHandler: any;

    jest.isolateModules(() => {
      isolatedRepo = require('../../../../src/modules/analytics/analytics.repo').AnalyticsRepo;
      isolatedCtxModule = require('../../../../src/common/context/request-context');
      isolatedPrismaExtModule = require('../../../../src/config/prisma-extensions');
      isolatedLogger = require('../../../../src/config/logger').default;
      const bullmq = require('bullmq');
      require('../../../../src/jobs/workers/analytics.worker');
      const calls = bullmq.Worker.mock.calls;
      isolatedHandler = calls[calls.length - 1][1];
    });

    const job = {
      id: 'job-ctx-123',
      data: { type: 'RESERVATION', entityId: 'res-ctx-1', correlationId: 'corr-worker-1' },
    };

    isolatedRepo.syncAllStatsForReservation.mockImplementation(async () => {
      const ctx = isolatedCtxModule.getRequestContext();
      expect(ctx.isSystemContext).toBe(true);
      expect(ctx.systemJobName).toBe('AnalyticsWorker');
      expect(ctx.correlationId).toBe('corr-worker-1');
      expect(ctx.requestId).toBe('job-ctx-123');

      await isolatedPrismaExtModule.processTenantGuardOperation({
        model: 'Reservation',
        operation: 'findUnique',
        args: { where: { id: 'res-ctx-1' } },
        query: async () => ({ id: 'res-ctx-1' }),
      });
    });

    await isolatedHandler(job as Job);
    expect(isolatedRepo.syncAllStatsForReservation).toHaveBeenCalledWith('res-ctx-1');
    expect(isolatedLogger.warn).not.toHaveBeenCalled();
  });
});
