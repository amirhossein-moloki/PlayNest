import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Worker, Job } from 'bullmq';
import { AnalyticsRepo } from '../../../../src/modules/analytics/analytics.repo';

jest.mock('../../../../src/modules/analytics/analytics.repo');
jest.mock('bullmq');

const MockedAnalyticsRepo = AnalyticsRepo as jest.Mocked<typeof AnalyticsRepo>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('AnalyticsWorker', () => {
  let handler: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.isolateModules(() => {
      require('../../../../src/jobs/workers/analytics.worker');
    });
    handler = (Worker as jest.MockedClass<typeof Worker>).mock.calls[0][1];
  });

  it('should process BOOKING sync job successfully', async () => {
    const job = {
      id: 'job-1',
      data: { type: 'BOOKING', entityId: 'res-1' },
    };

    MockedAnalyticsRepo.syncAllStatsForBooking.mockResolvedValue({} as any);
    await handler(job as Job);
    expect(MockedAnalyticsRepo.syncAllStatsForBooking).toHaveBeenCalledWith('res-1');
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
      data: { type: 'BOOKING', entityId: 'res-1' },
    };

    MockedAnalyticsRepo.syncAllStatsForBooking.mockRejectedValue(new Error('Sync fail'));
    await expect(handler(job as Job)).rejects.toThrow('Sync fail');
  });
});
