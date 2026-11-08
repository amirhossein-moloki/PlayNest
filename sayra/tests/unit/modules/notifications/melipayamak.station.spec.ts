import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockSendByBaseNumber = jest.fn() as jest.MockedFunction<any>;
const mockSend = jest.fn() as jest.MockedFunction<any>;

jest.mock('melipayamak', () => {
  return jest.fn().mockImplementation(() => ({
    sms: () => ({
      sendByBaseNumber: mockSendByBaseNumber,
      send: mockSend,
    }),
  }));
});

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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendOtpSms', () => {
    it('dispatches OTP using sendByBaseNumber with bodyId from environment', async () => {
      mockSendByBaseNumber.mockResolvedValueOnce({ Value: '987654321', RetStatus: 1 });

      const result = await MelipayamakStation.sendOtpSms('09123456789', '458921');

      expect(mockSendByBaseNumber).toHaveBeenCalledWith('458921', '09123456789', 11111);
      expect(result).toEqual({
        success: true,
        recId: '987654321',
        rawResponse: { Value: '987654321', RetStatus: 1 },
      });
    });

    it('handles numeric or string responses from melipayamak', async () => {
      mockSendByBaseNumber.mockResolvedValueOnce(12345678);

      const result = await MelipayamakStation.sendOtpSms('09123456789', '123456');

      expect(result.success).toBe(true);
      expect(result.recId).toBe('12345678');
    });

    it('throws error when external API call fails', async () => {
      mockSendByBaseNumber.mockRejectedValueOnce(new Error('Melipayamak API connection timeout'));

      await expect(MelipayamakStation.sendOtpSms('09123456789', '123456')).rejects.toThrow(
        'Melipayamak API connection timeout'
      );
    });
  });

  describe('sendReservationStatusSms', () => {
    it('dispatches reservation status using sendByBaseNumber with bodyId and formatted params', async () => {
      mockSendByBaseNumber.mockResolvedValueOnce({ Value: '5551234', RetStatus: 1 });

      const result = await MelipayamakStation.sendReservationStatusSms('09123456789', {
        customerName: 'علی رضایی',
        statusText: 'تأیید شد',
        gamingCenterName: 'گیم سنتر آرنا',
        date: '1403/01/15',
        time: '18:00',
        stationName: 'PS5 VIP 1',
      });

      expect(mockSendByBaseNumber).toHaveBeenCalledWith(
        'علی رضایی;تأیید شد;گیم سنتر آرنا;1403/01/15;18:00;PS5 VIP 1',
        '09123456789',
        22222
      );
      expect(result.success).toBe(true);
      expect(result.recId).toBe('5551234');
    });

    it('allows customBodyId override if provided', async () => {
      mockSendByBaseNumber.mockResolvedValueOnce({ recId: '99999' });

      const result = await MelipayamakStation.sendReservationStatusSms(
        '09123456789',
        { customerName: 'سارا' },
        33333
      );

      expect(mockSendByBaseNumber).toHaveBeenCalledWith(expect.any(String), '09123456789', 33333);
      expect(result.recId).toBe('99999');
    });
  });

  describe('sendTicketReplySms', () => {
    it('dispatches ticket reply using standard send method with MELIPAYAMAK_FROM and defined message template', async () => {
      mockSend.mockResolvedValueOnce({ Value: '888777' });

      const ticketCode = 'TICK-9081';
      const result = await MelipayamakStation.sendTicketReplySms('09123456789', ticketCode);

      const expectedText = `کاربر گرامی، تیکت شماره ${ticketCode} شما توسط پشتیبانی پاسخ داده شد. برای مشاهده پاسخ به پنل کاربری خود در سایت مراجعه کنید.`;
      expect(mockSend).toHaveBeenCalledWith('09123456789', '50001234', expectedText);
      expect(result.success).toBe(true);
      expect(result.recId).toBe('888777');
    });

    it('handles failure when sending ticket reply', async () => {
      mockSend.mockRejectedValueOnce(new Error('Gateway error'));

      await expect(MelipayamakStation.sendTicketReplySms('09123456789', 'TICK-1')).rejects.toThrow(
        'Gateway error'
      );
    });
  });
});
