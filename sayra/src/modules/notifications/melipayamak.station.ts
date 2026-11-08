import MelipayamakApi from 'melipayamak';
import { env } from '../../config/env';
import logger from '../../config/logger';

export interface ReservationSmsDetails {
  customerName?: string;
  stationName?: string;
  gamingCenterName?: string;
  date?: string;
  time?: string;
  statusText?: string;
  statusCondition?: string;
}

export interface MelipayamakSendResult {
  success: boolean;
  recId?: string;
  rawResponse?: unknown;
  mocked?: boolean;
}

// 1. Centralized connection and credentials
const username = env.MELIPAYAMAK_USERNAME;
const password = env.MELIPAYAMAK_PASSWORD;
const fromLine = env.MELIPAYAMAK_FROM;
const otpBodyId = env.MELIPAYAMAK_OTP_BODY_ID;
const reservationBodyId = env.MELIPAYAMAK_RESERVATION_BODY_ID;

const isConfigured = Boolean(username && password);

let apiInstance: MelipayamakApi | null = null;
let smsRestInstance: ReturnType<MelipayamakApi['sms']> | null = null;

if (isConfigured) {
  try {
    apiInstance = new MelipayamakApi(username, password);
    smsRestInstance = apiInstance.sms();
  } catch (error) {
    logger.error({ msg: 'Failed to initialize Melipayamak API client', error });
  }
} else {
  logger.warn('Melipayamak credentials are not fully configured. SMS will operate in MOCK mode.');
}

const parseRecId = (response: unknown): string | undefined => {
  if (!response) return undefined;
  if (typeof response === 'string' || typeof response === 'number') {
    return String(response);
  }
  if (typeof response === 'object' && response !== null) {
    const resObj = response as Record<string, unknown>;
    if (resObj.Value !== undefined) return String(resObj.Value);
    if (resObj.recId !== undefined) return String(resObj.recId);
    if (resObj.id !== undefined) return String(resObj.id);
  }
  return undefined;
};

export const MelipayamakStation = {
  isConfigured(): boolean {
    return isConfigured && Boolean(smsRestInstance);
  },

  /**
   * Helper to execute Melipayamak promise with timeout and standard error management
   */
  async executeWithTimeout<T>(operation: () => Promise<T>, timeoutMs = 7000): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Melipayamak request timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    return Promise.race([operation(), timeoutPromise]);
  },

  /**
   * Type 1: OTP SMS
   * Uses shared service pattern with smsRest.sendByBaseNumber(text, to, bodyId)
   */
  async sendOtpSms(to: string, otpCode: string): Promise<MelipayamakSendResult> {
    const bodyId = otpBodyId;

    if (!this.isConfigured() || !smsRestInstance || !bodyId) {
      logger.info({
        msg: '[MELIPAYAMAK MOCK] OTP SMS dispatch',
        to,
        bodyId: bodyId || 'NOT_CONFIGURED',
        otpCode: '[PROTECTED]',
      });
      return { success: true, mocked: true, recId: 'mock-melipayamak-otp' };
    }

    try {
      // In Melipayamak sendByBaseNumber, the parameter text is passed as string, e.g., `${otpCode}`
      const response = await this.executeWithTimeout(() =>
        smsRestInstance!.sendByBaseNumber(String(otpCode), to, bodyId)
      );
      const recId = parseRecId(response);

      logger.info({
        msg: 'Melipayamak OTP SMS dispatched successfully',
        to,
        recId,
      });

      return {
        success: true,
        recId,
        rawResponse: response,
      };
    } catch (error) {
      // Ensure credentials and sensitive information are never leaked in error logs
      logger.error({
        msg: 'Failed to send OTP SMS via Melipayamak',
        to,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Type 2: Reservation Status SMS
   * Uses shared service pattern with smsRest.sendByBaseNumber(text, to, bodyId)
   * Formats reservation parameters and condition cleanly in a centralized manner
   */
  async sendReservationStatusSms(
    to: string,
    details: ReservationSmsDetails,
    customBodyId?: number
  ): Promise<MelipayamakSendResult> {
    const bodyId = customBodyId || reservationBodyId;

    // Centralized formatting of template parameters
    // Format according to Melipayamak shared service parameter conventions: text;param1;param2... or formatted string
    const statusText = details.statusText || 'در انتظار تایید';
    const customerName = details.customerName || 'مشتری گرامی';
    const centerName = details.gamingCenterName || 'مجموعه بازی';
    const date = details.date || '';
    const time = details.time || '';
    const station = details.stationName || '';

    // Standard parameter payload string format for Melipayamak pattern
    const patternText = [customerName, statusText, centerName, date, time, station]
      .filter(Boolean)
      .join(';');

    if (!this.isConfigured() || !smsRestInstance || !bodyId) {
      logger.info({
        msg: '[MELIPAYAMAK MOCK] Reservation status SMS dispatch',
        to,
        bodyId: bodyId || 'NOT_CONFIGURED',
        status: statusText,
      });
      return { success: true, mocked: true, recId: 'mock-melipayamak-res' };
    }

    try {
      const response = await this.executeWithTimeout(() =>
        smsRestInstance!.sendByBaseNumber(patternText, to, bodyId)
      );
      const recId = parseRecId(response);

      logger.info({
        msg: 'Melipayamak Reservation Status SMS dispatched successfully',
        to,
        recId,
        status: statusText,
      });

      return {
        success: true,
        recId,
        rawResponse: response,
      };
    } catch (error) {
      logger.error({
        msg: 'Failed to send Reservation Status SMS via Melipayamak',
        to,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Type 3: Support Ticket Reply SMS
   * Sends standard SMS without service pattern, using dedicated number from MELIPAYAMAK_FROM
   * smsRest.send(to, from, text)
   */
  async sendTicketReplySms(to: string, ticketCode: string): Promise<MelipayamakSendResult> {
    const from = fromLine;
    const messageText = `کاربر گرامی، تیکت شماره ${ticketCode} شما توسط پشتیبانی پاسخ داده شد. برای مشاهده پاسخ به پنل کاربری خود در سایت مراجعه کنید.`;

    if (!this.isConfigured() || !smsRestInstance || !from) {
      logger.info({
        msg: '[MELIPAYAMAK MOCK] Support ticket reply SMS dispatch',
        to,
        from: from || 'NOT_CONFIGURED',
        ticketCode,
      });
      return { success: true, mocked: true, recId: 'mock-melipayamak-ticket' };
    }

    try {
      const response = await this.executeWithTimeout(() =>
        smsRestInstance!.send(to, from, messageText)
      );
      const recId = parseRecId(response);

      logger.info({
        msg: 'Melipayamak Support Ticket Reply SMS dispatched successfully',
        to,
        ticketCode,
        recId,
      });

      return {
        success: true,
        recId,
        rawResponse: response,
      };
    } catch (error) {
      logger.error({
        msg: 'Failed to send Support Ticket Reply SMS via Melipayamak',
        to,
        ticketCode,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};
