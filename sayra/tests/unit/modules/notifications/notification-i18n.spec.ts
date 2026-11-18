/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NotificationType } from '@prisma/client';
import {
  DEFAULT_NOTIFICATION_LANGUAGE,
  NotificationTemplateKey,
  formatCurrencyAmount,
  getLanguageDirection,
  getRecipientPreferredLanguage,
  renderLocalizedNotification,
  resolveNotificationLanguage,
} from '../../../../src/modules/notifications/notification-i18n';
import { NotificationStation } from '../../../../src/modules/notifications/notifications.station';
import { notificationsRepo } from '../../../../src/modules/notifications/notifications.repo';

jest.mock('../../../../src/modules/notifications/notifications.repo');
jest.mock('../../../../src/jobs/producers/sms.producer', () => ({
  queueSms: jest.fn().mockImplementation(() => Promise.resolve()),
}));

const MockedNotificationsRepo = notificationsRepo as jest.Mocked<typeof notificationsRepo>;

const ALL_TEMPLATE_KEYS: NotificationTemplateKey[] = [
  'RESERVATION_CREATED_STAFF',
  'RESERVATION_CONFIRMED_STAFF',
  'RESERVATION_CANCELLED_STAFF',
  'RESERVATION_TIME_PROPOSED_STAFF',
  'RESERVATION_STATUS_CONFIRMED_CUSTOMER',
  'RESERVATION_STATUS_CANCELED_CUSTOMER',
  'RESERVATION_STATUS_PENDING_CUSTOMER',
  'RESERVATION_REMINDER_CUSTOMER',
  'RESERVATION_REMINDER_STAFF',
  'PAYMENT_SUCCESS_CUSTOMER',
  'PAYMENT_FAILED_CUSTOMER',
  'WAITLIST_OFFER_CREATED',
  'WALLET_CHARGED',
  'WITHDRAWAL_SUBMITTED',
  'WITHDRAWAL_APPROVED',
  'WITHDRAWAL_REJECTED',
  'WITHDRAWAL_PROCESSING',
  'WITHDRAWAL_PAID',
  'WITHDRAWAL_FAILED',
];

describe('Notification Localization (Persian & English)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Language resolution & Persian default fallback', () => {
    it('defaults to Persian (fa) when preference is missing or unsupported', () => {
      expect(DEFAULT_NOTIFICATION_LANGUAGE).toBe('fa');
      expect(resolveNotificationLanguage(undefined)).toBe('fa');
      expect(resolveNotificationLanguage(null)).toBe('fa');
      expect(resolveNotificationLanguage('')).toBe('fa');
      expect(resolveNotificationLanguage('de')).toBe('fa');
      expect(resolveNotificationLanguage('ar-SA')).toBe('fa');
    });

    it('resolves Persian and English variants accurately', () => {
      expect(resolveNotificationLanguage('fa')).toBe('fa');
      expect(resolveNotificationLanguage('fa-IR')).toBe('fa');
      expect(resolveNotificationLanguage('FA')).toBe('fa');
      expect(resolveNotificationLanguage('en')).toBe('en');
      expect(resolveNotificationLanguage('en-US')).toBe('en');
      expect(resolveNotificationLanguage('EN_GB')).toBe('en');
    });

    it('extracts preferred language from recipient object with fa fallback', () => {
      expect(getRecipientPreferredLanguage(undefined)).toBe('fa');
      expect(getRecipientPreferredLanguage({})).toBe('fa');
      expect(getRecipientPreferredLanguage({ preferredLanguage: 'en' })).toBe('en');
      expect(getRecipientPreferredLanguage({ language: 'en-US' })).toBe('en');
      expect(getRecipientPreferredLanguage({ locale: 'fa-IR' })).toBe('fa');
    });

    it('returns rtl for Persian and ltr for English', () => {
      expect(getLanguageDirection('fa')).toBe('rtl');
      expect(getLanguageDirection('en')).toBe('ltr');
    });

    it('formats currency amounts per locale', () => {
      const faStr = formatCurrencyAmount(100000, 'IRR', 'fa');
      expect(faStr).toContain('ریال');
      const enStr = formatCurrencyAmount(100000, 'IRR', 'en');
      expect(enStr).toBe('100,000 IRR');
    });
  });

  describe('All notification templates in fa, en, and default fallback', () => {
    const sampleParams = {
      stationName: 'PS5 VIP 1',
      dateStr: '2026/11/18',
      timeStr: '18:00',
      reservationId: 'res_01',
      gamingCenterName: 'Nexus Arena',
      formattedAmount: '۱۰۰,۰۰۰ ریال',
      refCode: 'REF-123',
      reason: 'Timeout',
      paymentReference: 'PAY-999',
    };

    it.each(ALL_TEMPLATE_KEYS)('renders %s in Persian (default fallback), Persian (explicit), and English', (key) => {
      const fallback = renderLocalizedNotification(key, sampleParams);
      const persian = renderLocalizedNotification(key, sampleParams, 'fa');
      const english = renderLocalizedNotification(key, sampleParams, 'en');

      expect(fallback.language).toBe('fa');
      expect(fallback.direction).toBe('rtl');
      expect(fallback.title).toBe(persian.title);
      expect(fallback.message).toBe(persian.message);

      expect(persian.language).toBe('fa');
      expect(persian.direction).toBe('rtl');
      expect(persian.title.length).toBeGreaterThan(0);
      expect(persian.message.length).toBeGreaterThan(0);

      expect(english.language).toBe('en');
      expect(english.direction).toBe('ltr');
      expect(english.title.length).toBeGreaterThan(0);
      expect(english.message.length).toBeGreaterThan(0);
      expect(english.title).not.toBe(persian.title);
      expect(english.message).not.toBe(persian.message);
    });
  });

  describe('NotificationStation localization integration', () => {
    it('defaults to Persian RTL when no language preference is passed to notifyUser', async () => {
      MockedNotificationsRepo.createNotification.mockResolvedValue({ id: 'notif-fa' } as any);

      await NotificationStation.notifyUser({
        userId: 'user-1',
        type: NotificationType.RESERVATION_CREATED,
        templateKey: 'RESERVATION_CREATED_STAFF',
        templateParams: { stationName: 'PC-1', dateStr: '2026/11/18', timeStr: '14:00' },
        metadata: { reservationId: 'res-1' },
      });

      expect(MockedNotificationsRepo.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: NotificationType.RESERVATION_CREATED,
          title: 'رزرو جدید ثبت شد',
          message: expect.stringContaining('PC-1'),
          metadata: expect.objectContaining({
            reservationId: 'res-1',
            language: 'fa',
            direction: 'rtl',
            actionLabel: 'مشاهده رزرو',
          }),
        })
      );
    });

    it('uses English LTR when recipient prefers English in notifyUser and enqueueNotificationLog', async () => {
      MockedNotificationsRepo.createNotification.mockResolvedValue({ id: 'notif-en' } as any);
      MockedNotificationsRepo.createNotificationLog.mockResolvedValue({
        id: 'log-en',
        channel: 'SMS',
        recipient: '09123456789',
        message: '...',
        status: 'PENDING',
      } as any);

      await NotificationStation.notifyUser({
        userId: 'user-en',
        type: NotificationType.WAITLIST_OFFER_CREATED,
        templateKey: 'WAITLIST_OFFER_CREATED',
        templateParams: { stationName: 'VR Pod 2' },
        language: 'en',
        sendSms: true,
        mobile: '09123456789',
        idempotencyKey: 'waitlist-en-1',
      });

      expect(MockedNotificationsRepo.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Waitlist Opportunity Available!',
          message: expect.stringContaining('VR Pod 2'),
          metadata: expect.objectContaining({
            language: 'en',
            direction: 'ltr',
            actionLabel: 'Accept Offer',
          }),
        })
      );

      expect(MockedNotificationsRepo.createNotificationLog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Waitlist Opportunity Available!',
          message: expect.stringContaining('VR Pod 2'),
          metadata: expect.objectContaining({
            language: 'en',
            direction: 'ltr',
          }),
        })
      );
    });
  });
});
