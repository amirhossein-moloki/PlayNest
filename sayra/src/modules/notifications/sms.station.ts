import { Smsir } from 'smsir-js';
import { env } from '../../config/env';
import logger from '../../config/logger';
import { MelipayamakStation, ReservationSmsDetails } from './melipayamak.station';

const apiKey = env.SMSIR_API_KEY;
const lineNumber = env.SMSIR_LINE_NUMBER;
const smsir = apiKey && lineNumber ? new Smsir(apiKey, lineNumber) : null;

if (!smsir && !MelipayamakStation.isConfigured()) {
  logger.warn('SMS provider credentials (Melipayamak / SmsIr) are not set. SMS station will run in MOCK mode.');
}

export const SmsStation = {
  async sendOtp(mobile: string, code: string) {
    if (MelipayamakStation.isConfigured() || env.MELIPAYAMAK_OTP_BODY_ID) {
      return MelipayamakStation.sendOtpSms(mobile, code);
    }
    const templateId = env.SMSIR_OTP_TEMPLATE_ID || 123456;
    return this.sendTemplateSms(mobile, templateId, [{ name: 'CODE', value: code }]);
  },

  async sendReservationStatus(mobile: string, details: ReservationSmsDetails, customBodyId?: number) {
    if (MelipayamakStation.isConfigured() || env.MELIPAYAMAK_RESERVATION_BODY_ID) {
      return MelipayamakStation.sendReservationStatusSms(mobile, details, customBodyId);
    }
    const templateId = customBodyId || env.SMSIR_RESERVATION_CONFIRMED_TEMPLATE_ID || 123456;
    return this.sendTemplateSms(mobile, templateId, [
      { name: 'CUSTOMER_NAME', value: details.customerName || 'Customer' },
      { name: 'SERVICE_NAME', value: details.stationName || 'N/A' },
      { name: 'DATE', value: details.date || '' },
      { name: 'TIME', value: details.time || '' },
      { name: 'SALON_NAME', value: details.gamingCenterName || '' },
    ]);
  },

  async sendTicketReply(mobile: string, ticketCode: string) {
    return MelipayamakStation.sendTicketReplySms(mobile, ticketCode);
  },

  async sendTemplateSms(mobile: string, templateId: number, parameters: Array<{ name: string; value: string }>) {
    // If Melipayamak is configured and template matches Melipayamak OTP or reservation body ID
    if (MelipayamakStation.isConfigured()) {
      if (templateId === env.MELIPAYAMAK_OTP_BODY_ID) {
        const codeParam = parameters.find((p) => p.name.toUpperCase() === 'CODE')?.value || parameters[0]?.value || '';
        const res = await MelipayamakStation.sendOtpSms(mobile, codeParam);
        return { id: res.recId, status: res.mocked ? 'mocked' : 'sent', provider: 'Melipayamak' };
      }
      if (templateId === env.MELIPAYAMAK_RESERVATION_BODY_ID) {
        const getVal = (name: string) => parameters.find((p) => p.name.toUpperCase() === name.toUpperCase())?.value;
        const res = await MelipayamakStation.sendReservationStatusSms(mobile, {
          customerName: getVal('CUSTOMER_NAME'),
          stationName: getVal('SERVICE_NAME'),
          date: getVal('DATE'),
          time: getVal('TIME'),
          gamingCenterName: getVal('SALON_NAME'),
          statusText: getVal('STATUS'),
        }, templateId);
        return { id: res.recId, status: res.mocked ? 'mocked' : 'sent', provider: 'Melipayamak' };
      }
    }

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
