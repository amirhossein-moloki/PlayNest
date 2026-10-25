/* eslint-disable @typescript-eslint/no-unused-vars */
export const SmsStation = {
  async sendTemplateSms(mobile: string, templateId: number, parameters: Array<{ name: string; value: string }>) {
    return Promise.resolve({ id: 'mock-sms-id' });
  },

  async sendVerificationCode(mobile: string, templateId: number, parameters: Array<{ name: string; value: string }>) {
    return this.sendTemplateSms(mobile, templateId, parameters);
  },
};
