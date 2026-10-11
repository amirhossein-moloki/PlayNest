import { smsQueue } from '../queues';
import { getRequestContext } from '../../common/context/request-context';

export interface SmsJobData {
  mobile: string;
  templateId: number;
  parameters: Array<{ name: string; value: string }>;
  correlationId?: string;
}

export const queueSms = async (data: SmsJobData) => {
  const context = getRequestContext();
  await smsQueue.add('send-sms', {
    ...data,
    correlationId: context.correlationId,
  });
};
