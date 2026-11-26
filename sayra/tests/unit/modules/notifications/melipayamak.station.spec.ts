import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    MELIPAYAMAK_USERNAME: 'test_user',
    MELIPAYAMAK_PASSWORD: 'test_password',
    MELIPAYAMAK_FROM: '50001234',
    MELIPAYAMAK_OTP_BODY_ID: 11111,
    MELIPAYAMAK_RESERVATION_BODY_ID: 22222,
  },
}));

import { MelipayamakStation } from '../../../../src/modules/notifications/melipayamak.station';

describe('MelipayamakStation Unit Tests', () => {
  const originalFetch = global.fetch;
  let mockFetch: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = jest.fn() as jest.MockedFunction<any>;
    global.fetch = mockFetch as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('sendOtpSms', () => {
    it('dispatches OTP using BaseServiceNumber REST endpoint with bodyId from environment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ Value: '987654321', RetStatus: 1 }),
      });

      const result = await MelipayamakStation.sendOtpSms('09123456789', '458921');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber');
      expect(init.method).toBe('POST');
      const bodyParams = new URLSearchParams(init.body);
      expect(bodyParams.get('text')).toBe('458921');
      expect(bodyParams.get('to')).toBe('09123456789');
      expect(bodyParams.get('bodyId')).toBe('11111');
      expect(result).toEqual({
        success: true,
        recId: '987654321',
        rawResponse: { Value: '987654321', RetStatus: 1 },
      });
    });

    it('handles numeric or string responses from melipayamak', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '12345678',
      });

      const result = await MelipayamakStation.sendOtpSms('09123456789', '123456');

      expect(result.success).toBe(true);
      expect(result.recId).toBe('12345678');
    });

    it('throws error when external API call fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Melipayamak API connection timeout'));

      await expect(MelipayamakStation.sendOtpSms('09123456789', '123456')).rejects.toThrow(
        'Melipayamak API connection timeout'
      );
    });
  });

  describe('sendReservationStatusSms', () => {
    it('dispatches reservation status using BaseServiceNumber with bodyId and formatted params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ Value: '5551234', RetStatus: 1 }),
      });

      const result = await MelipayamakStation.sendReservationStatusSms('09123456789', {
        customerName: 'علی رضایی',
        statusText: 'تأیید شد',
        gamingCenterName: 'گیم سنتر آرنا',
        date: '1403/01/15',
        time: '18:00',
        stationName: 'PS5 VIP 1',
      });

      const [, init] = mockFetch.mock.calls[0];
      const bodyParams = new URLSearchParams(init.body);
      expect(bodyParams.get('text')).toBe(
        'علی رضایی;تأیید شد;گیم سنتر آرنا;1403/01/15;18:00;PS5 VIP 1'
      );
      expect(bodyParams.get('to')).toBe('09123456789');
      expect(bodyParams.get('bodyId')).toBe('22222');
      expect(result.success).toBe(true);
      expect(result.recId).toBe('5551234');
    });

    it('allows customBodyId override if provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ recId: '99999' }),
      });

      const result = await MelipayamakStation.sendReservationStatusSms(
        '09123456789',
        { customerName: 'سارا' },
        33333
      );

      const [, init] = mockFetch.mock.calls[0];
      const bodyParams = new URLSearchParams(init.body);
      expect(bodyParams.get('to')).toBe('09123456789');
      expect(bodyParams.get('bodyId')).toBe('33333');
      expect(result.recId).toBe('99999');
    });
  });

  describe('sendTicketReplySms', () => {
    it('dispatches ticket reply using SendSMS endpoint with MELIPAYAMAK_FROM and defined message template', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ Value: '888777' }),
      });

      const ticketCode = 'TICK-9081';
      const result = await MelipayamakStation.sendTicketReplySms('09123456789', ticketCode);

      const expectedText = `کاربر گرامی، تیکت شماره ${ticketCode} شما توسط پشتیبانی پاسخ داده شد. برای مشاهده پاسخ به پنل کاربری خود در سایت مراجعه کنید.`;
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://rest.payamak-panel.com/api/SendSMS/SendSMS');
      const bodyParams = new URLSearchParams(init.body);
      expect(bodyParams.get('to')).toBe('09123456789');
      expect(bodyParams.get('from')).toBe('50001234');
      expect(bodyParams.get('text')).toBe(expectedText);
      expect(result.success).toBe(true);
      expect(result.recId).toBe('888777');
    });

    it('handles failure when sending ticket reply', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Gateway error'));

      await expect(MelipayamakStation.sendTicketReplySms('09123456789', 'TICK-1')).rejects.toThrow(
        'Gateway error'
      );
    });
  });
});
