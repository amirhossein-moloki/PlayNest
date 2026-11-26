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

const MELIPAYAMAK_REST_BASE = 'https://rest.payamak-panel.com/api/SendSMS';

// 1. Centralized connection and credentials
const username = env.MELIPAYAMAK_USERNAME;
const password = env.MELIPAYAMAK_PASSWORD;
const fromLine = env.MELIPAYAMAK_FROM;
const otpBodyId = env.MELIPAYAMAK_OTP_BODY_ID;
const reservationBodyId = env.MELIPAYAMAK_RESERVATION_BODY_ID;

const isConfigured = Boolean(username && password);

if (!isConfigured) {
  logger.warn('Melipayamak credentials are not fully configured. SMS will operate in MOCK mode.');
}

async function postMelipayamakRest(
  method: 'BaseServiceNumber' | 'SendSMS',
  params: Record<string, string | number | boolean>
): Promise<unknown> {
  const form = new URLSearchParams();
  form.set('username', username || '');
  form.set('password', password || '');
  for (const [key, value] of Object.entries(params)) {
    form.set(key, String(value));
  }

  const response = await fetch(`${MELIPAYAMAK_REST_BASE}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: form.toString(),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`Melipayamak HTTP ${response.status}`);
  }
  if (!rawText) {
    return {};
  }
  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
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
    return isConfigured;
  },

  /**
   * Helper to execute Melipayamak promise with timeout and standard error management
   */
  async executeWithTimeout<T>(operation: () => Promise<T>, timeoutMs = 7000): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Melipayamak request timed out after ${timeoutMs}ms`)),
        timeoutMs
      );
    });
    try {
      return await Promise.race([operation(), timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  },

  /**
   * Type 1: OTP SMS
   * Uses native HTTPS REST POST to SendSMS/BaseServiceNumber
   */
  async sendOtpSms(to: string, otpCode: string): Promise<MelipayamakSendResult> {
    const bodyId = otpBodyId;

    if (!this.isConfigured() || !bodyId) {
      logger.info({
        msg: '[MELIPAYAMAK MOCK] OTP SMS dispatch',
        to,
        bodyId: bodyId || 'NOT_CONFIGURED',
        otpCode: '[PROTECTED]',
      });
      return { success: true, mocked: true, recId: 'mock-melipayamak-otp' };
    }

    try {
      const response = await this.executeWithTimeout(() =>
        postMelipayamakRest('BaseServiceNumber', {
          text: String(otpCode),
          to,
          bodyId,
        })
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
   * Uses native HTTPS REST POST to SendSMS/BaseServiceNumber with formatted parameters
   */
  async sendReservationStatusSms(
    to: string,
    details: ReservationSmsDetails,
    customBodyId?: number
  ): Promise<MelipayamakSendResult> {
    const bodyId = customBodyId || reservationBodyId;

    const statusText = details.statusText || 'در انتظار تایید';
    const customerName = details.customerName || 'مشتری گرامی';
    const centerName = details.gamingCenterName || 'مجموعه بازی';
    const date = details.date || '';
    const time = details.time || '';
    const station = details.stationName || '';

    const patternText = [customerName, statusText, centerName, date, time, station]
      .filter(Boolean)
      .join(';');

    if (!this.isConfigured() || !bodyId) {
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
        postMelipayamakRest('BaseServiceNumber', {
          text: patternText,
          to,
          bodyId,
        })
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
   * Uses native HTTPS REST POST to SendSMS/SendSMS with MELIPAYAMAK_FROM
   */
  async sendTicketReplySms(to: string, ticketCode: string): Promise<MelipayamakSendResult> {
    const from = fromLine;
    const messageText = `کاربر گرامی، تیکت شماره ${ticketCode} شما توسط پشتیبانی پاسخ داده شد. برای مشاهده پاسخ به پنل کاربری خود در سایت مراجعه کنید.`;

    if (!this.isConfigured() || !from) {
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
        postMelipayamakRest('SendSMS', {
          to,
          from,
          text: messageText,
          isFlash: false,
        })
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

  /**
   * Type 4: Direct Text SMS
   * Uses native HTTPS REST POST to SendSMS/SendSMS with MELIPAYAMAK_FROM
   */
  async sendDirectSms(to: string, messageText: string): Promise<MelipayamakSendResult> {
    const from = fromLine;

    if (!this.isConfigured() || !from) {
      logger.info({
        msg: '[MELIPAYAMAK MOCK] Direct SMS dispatch',
        to,
        from: from || 'NOT_CONFIGURED',
        messageText,
      });
      return { success: true, mocked: true, recId: 'mock-melipayamak-direct' };
    }

    try {
      const response = await this.executeWithTimeout(() =>
        postMelipayamakRest('SendSMS', {
          to,
          from,
          text: messageText,
          isFlash: false,
        })
      );
      const recId = parseRecId(response);

      logger.info({
        msg: 'Melipayamak Direct SMS dispatched successfully',
        to,
        recId,
      });

      return {
        success: true,
        recId,
        rawResponse: response,
      };
    } catch (error) {
      logger.error({
        msg: 'Failed to send Direct SMS via Melipayamak',
        to,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};
