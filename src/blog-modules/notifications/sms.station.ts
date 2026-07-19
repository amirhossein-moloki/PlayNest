import { Smsir } from 'smsir-js';
import { env } from '../../config/env';

const apiKey = env.SMSIR_API_KEY;
const lineNumber = env.SMSIR_LINE_NUMBER;
const smsir = apiKey && lineNumber ? new Smsir(apiKey, lineNumber) : null;

if (!smsir) {
  console.warn('SMSIR_API_KEY and SMSIR_LINE_NUMBER are not set. SMS station will run in MOCK mode.');
}

export const SmsStation = {
  async sendTemplateSms(mobile: string, templateId: number, parameters: Array<{ name: string; value: string }>) {
    if (!smsir) {
      console.log(`[MOCK SMS] To: ${mobile}, Template: ${templateId}, Params: ${JSON.stringify(parameters)}`);
      return { status: 'mocked' };
    }

    try {
      // smsir-js v1.x uses SendVerifyCode for template-based messages
      const response = await smsir.SendVerifyCode(mobile, templateId, parameters);
      return response;
    } catch (error) {
      console.error('Failed to send SMS via Smsir:', error);
      throw error;
    }
  },

  async sendVerificationCode(mobile: string, templateId: number, parameters: Array<{ name: string; value: string }>) {
    return this.sendTemplateSms(mobile, templateId, parameters);
  }
};
