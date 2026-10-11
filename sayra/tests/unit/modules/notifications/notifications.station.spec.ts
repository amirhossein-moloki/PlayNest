import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NotificationType } from '@prisma/client';
import { NotificationStation } from '../../../../src/modules/notifications/notifications.station';
import { notificationsRepo } from '../../../../src/modules/notifications/notifications.repo';
import { queueSms } from '../../../../src/jobs/producers/sms.producer';
import AppError from '../../../../src/common/errors/AppError';

jest.mock('../../../../src/modules/notifications/notifications.repo');
jest.mock('../../../../src/jobs/producers/sms.producer');

/* eslint-disable @typescript-eslint/no-explicit-any */

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

    it('should queue SMS when sendSms is true and parameters are provided', async () => {
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

      MockedNotificationsRepo.createNotification.mockResolvedValue(mockCreated as any);
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
      });

      expect(queueSms).toHaveBeenCalledWith({
        mobile: '09123456789',
        templateId: 100,
        parameters: [{ name: 'NAME', value: 'John' }],
      });
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

      MockedNotificationsRepo.createNotification.mockResolvedValue(mockCreated as any);
      MockedQueueSms.mockRejectedValue(new Error('Queue connection error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
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

    it('should throw FORBIDDEN error if user tries to mark another user notification', async () => {
      const mockExisting = {
        id: 'notif-1',
        userId: 'other-user',
        type: NotificationType.RESERVATION_CONFIRMED,
        title: 'Confirmed',
        message: 'Confirmed',
        isRead: false,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      MockedNotificationsRepo.findById.mockResolvedValue(mockExisting as any);

      await expect(NotificationStation.markAsRead('notif-1', mockUserId)).rejects.toThrow(
        new AppError('Access denied to notification', 403)
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should calculate and return unread count', async () => {
      MockedNotificationsRepo.getUnreadCount.mockResolvedValue(5);

      const result = await NotificationStation.getUnreadCount(mockUserId);

      expect(notificationsRepo.getUnreadCount).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual({ unreadCount: 5 });
    });
  });
});
