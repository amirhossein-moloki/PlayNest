import { queueAnalyticsSync } from '../../../../src/jobs/producers/analytics.producer';
import { describe, it, expect, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { analyticsQueue } from '../../../../src/jobs/queues';

jest.mock('../../../../src/jobs/queues', () => ({
  analyticsQueue: {
    add: (jest.fn() as any).mockResolvedValue({}),
  },
}));

describe('Analytics Producer', () => {
  it('should add job to analyticsQueue', async () => {
    const data = { type: 'BOOKING' as const, entityId: 'res-1' };
    await queueAnalyticsSync(data);
    expect(analyticsQueue.add).toHaveBeenCalledWith('sync-analytics', data);
  });
});
