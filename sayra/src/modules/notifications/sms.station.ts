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

    const TIMEOUT_MS = 5000;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`SMS request timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
    });

    try {
      // smsir-js v1.x uses SendVerifyCode for template-based messages wrapped in 5s timeout race
      const response = await Promise.race([
        smsir.SendVerifyCode(mobile, templateId, parameters),
        timeoutPromise,
      ]);
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
