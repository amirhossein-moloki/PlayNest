/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NotificationType } from '@prisma/client';
import { NotificationStation } from '../../../../src/modules/notifications/notifications.station';
import { notificationsRepo } from '../../../../src/modules/notifications/notifications.repo';
import { queueSms } from '../../../../src/jobs/producers/sms.producer';
import { SmsStation } from '../../../../src/modules/notifications/sms.station';
import logger from '../../../../src/config/logger';
import AppError from '../../../../src/common/errors/AppError';

const NotificationChannel = {
  IN_APP: 'IN_APP',
  SMS: 'SMS',
  EMAIL: 'EMAIL',
};

const NotificationDispatchStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
};

jest.mock('../../../../src/modules/notifications/notifications.repo');
jest.mock('../../../../src/jobs/producers/sms.producer');

const MockedNotificationsRepo = notificationsRepo as jest.Mocked<typeof notificationsRepo>;
const MockedQueueSms = queueSms as jest.MockedFunction<typeof queueSms>;

describe('NotificationStation (Unit)', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotification & notifyUser', () => {
    it('should create an internal notification successfully', async () => {
      const mockCreated = {
        id: 'notif-1',
        userId: mockUserId,
        type: NotificationType.RESERVATION_CREATED,
        title: 'New Reservation',
        message: 'A reservation was created',
        isRead: false,
        metadata: { reservationId: 'res-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      MockedNotificationsRepo.createNotification.mockResolvedValue(mockCreated as any);

      const result = await NotificationStation.notifyUser({
        userId: mockUserId,
        type: NotificationType.RESERVATION_CREATED,
        title: 'New Reservation',
        message: 'A reservation was created',
        metadata: { reservationId: 'res-1' },
      });

      expect(notificationsRepo.createNotification).toHaveBeenCalledWith({
        userId: mockUserId,
        type: NotificationType.RESERVATION_CREATED,
        title: 'New Reservation',
        message: 'A reservation was created',
        metadata: { reservationId: 'res-1' },
      });
      expect(result).toEqual(mockCreated);
      expect(queueSms).not.toHaveBeenCalled();
    });

    it('should enqueue notification log when sendSms is true', async () => {
      const mockCreated = {
        id: 'notif-1',
        userId: mockUserId,
        type: NotificationType.RESERVATION_CREATED,
        title: 'New Reservation',
        message: 'A reservation was created',
        isRead: false,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockLog = {
        id: 'log-1',
        idempotencyKey: 'key-1',
        status: NotificationDispatchStatus.PENDING,
      };

      MockedNotificationsRepo.createNotification.mockResolvedValue(mockCreated as any);
      MockedNotificationsRepo.createNotificationLog.mockResolvedValue(mockLog as any);
      MockedQueueSms.mockResolvedValue(undefined as any);

      await NotificationStation.notifyUser({
        userId: mockUserId,
        type: NotificationType.RESERVATION_CREATED,
        title: 'New Reservation',
        message: 'A reservation was created',
        sendSms: true,
        mobile: '09123456789',
        templateId: 100,
        parameters: [{ name: 'NAME', value: 'John' }],
        idempotencyKey: 'key-1',
      });

      expect(notificationsRepo.createNotificationLog).toHaveBeenCalled();
    });

    it('should handle failed SMS queueing without throwing or crashing notification creation', async () => {
      const mockCreated = {
        id: 'notif-1',
        userId: mockUserId,
        type: NotificationType.RESERVATION_CREATED,
        title: 'New Reservation',
        message: 'A reservation was created',
        isRead: false,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockLog = {
        id: 'log-1',
        idempotencyKey: 'key-1',
        status: NotificationDispatchStatus.PENDING,
      };

      MockedNotificationsRepo.createNotification.mockResolvedValue(mockCreated as any);
      MockedNotificationsRepo.createNotificationLog.mockResolvedValue(mockLog as any);
      MockedQueueSms.mockRejectedValue(new Error('Queue connection error'));

      const loggerSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);

      const result = await NotificationStation.notifyUser({
        userId: mockUserId,
        type: NotificationType.RESERVATION_CREATED,
        title: 'New Reservation',
        message: 'A reservation was created',
        sendSms: true,
        mobile: '09123456789',
        templateId: 100,
      });

      expect(result).toEqual(mockCreated);
      expect(loggerSpy).toHaveBeenCalled();
      loggerSpy.mockRestore();
    });
  });

  describe('Outbox & Retry Calculations', () => {
    it('should calculate exponential backoff correctly', () => {
      expect(NotificationStation.calculateBackoff(1)).toBe(60 * 1000);
      expect(NotificationStation.calculateBackoff(2)).toBe(120 * 1000);
      expect(NotificationStation.calculateBackoff(3)).toBe(240 * 1000);
      expect(NotificationStation.calculateBackoff(10)).toBe(3600 * 1000); // capped at 1h
    });

    it('should classify permanent vs transient errors', () => {
      expect(
        NotificationStation.classifyError(new Error('Invalid phone number provided')).isTransient
      ).toBe(false);

      expect(
        NotificationStation.classifyError(new Error('Network timeout after 5000ms')).isTransient
      ).toBe(true);
    });

    it('should sanitize sensitive credentials in diagnostic logs', () => {
      const raw = 'Failed request with apiKey="secret123" and Bearer abc.def.ghi and 4111111111111111';
      const sanitized = NotificationStation.sanitizeDiagnostics(raw);

      expect(sanitized).not.toContain('secret123');
      expect(sanitized).not.toContain('4111111111111111');
      expect(sanitized).toContain('[REDACTED]');
      expect(sanitized).toContain('[CARD_REDACTED]');
    });
  });

  describe('dispatchNotificationLog', () => {
    it('should dispatch log successfully and update status to SENT', async () => {
      const mockLog = {
        id: 'log-1',
        recipient: '09123456789',
        channel: NotificationChannel.SMS,
        templateId: 100,
        parameters: [{ name: 'CODE', value: '1234' }],
        status: NotificationDispatchStatus.PENDING,
        attempts: 0,
        maxAttempts: 3,
      };

      MockedNotificationsRepo.findLogById.mockResolvedValue(mockLog as any);
      jest.spyOn(SmsStation, 'sendTemplateSms').mockResolvedValue({ id: 'provider-123' } as any);
      MockedNotificationsRepo.updateNotificationLogStatus.mockResolvedValue({
        ...mockLog,
        status: NotificationDispatchStatus.SENT,
        providerRefId: 'provider-123',
      } as any);

      const result = (await NotificationStation.dispatchNotificationLog('log-1')) as any;

      expect(SmsStation.sendTemplateSms).toHaveBeenCalledWith('09123456789', 100, [
        { name: 'CODE', value: '1234' },
      ]);
      expect(notificationsRepo.updateNotificationLogStatus).toHaveBeenCalledWith('log-1', expect.objectContaining({
        status: NotificationDispatchStatus.SENT,
        providerRefId: 'provider-123',
      }));
      expect(result.status).toBe(NotificationDispatchStatus.SENT);
    });

    it('should classify failure and schedule nextRetryAt on transient error', async () => {
      const mockLog = {
        id: 'log-1',
        recipient: '09123456789',
        channel: NotificationChannel.SMS,
        templateId: 100,
        parameters: [],
        status: NotificationDispatchStatus.PENDING,
        attempts: 0,
        maxAttempts: 3,
      };

      MockedNotificationsRepo.findLogById.mockResolvedValue(mockLog as any);
      jest.spyOn(SmsStation, 'sendTemplateSms').mockRejectedValue(new Error('Connection timed out'));
      MockedNotificationsRepo.updateNotificationLogStatus.mockResolvedValue({
        ...mockLog,
        status: NotificationDispatchStatus.FAILED,
        attempts: 1,
      } as any);

      await NotificationStation.dispatchNotificationLog('log-1');

      expect(notificationsRepo.updateNotificationLogStatus).toHaveBeenCalledWith('log-1', expect.objectContaining({
        status: NotificationDispatchStatus.FAILED,
        attempts: 1,
        nextRetryAt: expect.any(Date),
      }));
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read when user owns it', async () => {
      const mockExisting = {
        id: 'notif-1',
        userId: mockUserId,
        type: NotificationType.RESERVATION_CONFIRMED,
        title: 'Confirmed',
        message: 'Confirmed',
        isRead: false,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      MockedNotificationsRepo.findById.mockResolvedValue(mockExisting as any);
      MockedNotificationsRepo.markAsRead.mockResolvedValue({ count: 1 } as any);

      const result = await NotificationStation.markAsRead('notif-1', mockUserId);

      expect(notificationsRepo.findById).toHaveBeenCalledWith('notif-1');
      expect(notificationsRepo.markAsRead).toHaveBeenCalledWith('notif-1', mockUserId);
      expect(result.isRead).toBe(true);
    });

    it('should throw NOT_FOUND error if notification does not exist', async () => {
      MockedNotificationsRepo.findById.mockResolvedValue(null);

      await expect(NotificationStation.markAsRead('invalid-id', mockUserId)).rejects.toThrow(
        new AppError('Notification not found', 404)
      );
    });
  });
});
