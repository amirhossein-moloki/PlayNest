import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Worker, Job } from 'bullmq';
import { SmsService } from '../../../../src/modules/notifications/sms.station';

jest.mock('../../../../src/modules/notifications/sms.station', () => ({
  SmsService: {
    sendTemplateSms: jest.fn()
  }
}));
jest.mock('bullmq');

const MockedSmsService = SmsService as jest.Mocked<typeof SmsService>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('SmsWorker', () => {
  let handler: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-importing to get the handler passed to Worker constructor
    jest.isolateModules(() => {
      require('../../../../src/jobs/workers/sms.worker');
    });
    handler = (Worker as jest.MockedClass<typeof Worker>).mock.calls[0][1];
  });

  it('should process SMS job successfully', async () => {
    const job = {
      id: 'job-1',
      data: {
        mobile: '09123456789',
        templateId: 123,
        parameters: [{ name: 'code', value: '1234' }],
      },
    };

    MockedSmsService.sendTemplateSms.mockResolvedValue({} as any);

    await handler(job as Job);

    expect(MockedSmsService.sendTemplateSms).toHaveBeenCalledWith('09123456789', 123, job.data.parameters);
  });

  it('should throw error if sendTemplateSms fails', async () => {
    const job = {
      id: 'job-1',
      data: { mobile: '09123456789', templateId: 123, parameters: [] },
    };

    MockedSmsService.sendTemplateSms.mockRejectedValue(new Error('SMS fail'));

    await expect(handler(job as Job)).rejects.toThrow('SMS fail');
  });
});
