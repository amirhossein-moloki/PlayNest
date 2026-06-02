import { queueSms } from '../../../../src/jobs/producers/sms.producer';
import { describe, it, expect, jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { smsQueue } from '../../../../src/jobs/queues';

jest.mock('../../../../src/jobs/queues', () => ({
  smsQueue: {
    add: (jest.fn() as any).mockResolvedValue({}),
  },
}));

describe('SMS Producer', () => {
  it('should add job to smsQueue', async () => {
    const data = { mobile: '09123456789', templateId: 123, parameters: [] };
    await queueSms(data);
    expect(smsQueue.add).toHaveBeenCalledWith('send-sms', data);
  });
});
