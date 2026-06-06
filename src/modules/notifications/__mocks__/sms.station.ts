
// src/modules/notifications/__mocks__/sms.station.ts

export class SmsStation {
  constructor() {
    // Mock constructor doesn't need API keys
  }

  async sendVerificationCode(phone: string, code: string): Promise<void> {
    // Mock implementation, just log it for testing
    console.log(`Mock SMS: Sending code ${code} to ${phone}`);
    return Promise.resolve();
  }
}

// Optional: Export a singleton instance if that's how it's used elsewhere
export const smsStation = new SmsStation();
