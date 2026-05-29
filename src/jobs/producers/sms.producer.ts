import { smsQueue } from '../queues';

export interface SmsJobData {
  mobile: string;
  templateId: number;
  parameters: Array<{ name: string; value: string }>;
}

export const queueSms = async (data: SmsJobData) => {
  await smsQueue.add('send-sms', data);
};
