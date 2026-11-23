/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  NotificationType,
  NotificationCategory,
  ReservationStatus,
  UserRole,
} from '@prisma/client';
import { NotificationStation } from '../../../../src/modules/notifications/notifications.station';
import { notificationsRepo } from '../../../../src/modules/notifications/notifications.repo';
import { prisma } from '../../../../src/config/prisma';
import { renderLocalizedNotification } from '../../../../src/modules/notifications/notification-i18n';
import {
  revalidateAndSendGameCenterReminder,
  processGameCenterRemindersBatch,
} from '../../../../src/modules/reservation/reservation.reminders';

jest.mock('../../../../src/modules/notifications/notifications.repo');
jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    gamingCenter: {
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    reservation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const MockedRepo = notificationsRepo as jest.Mocked<typeof notificationsRepo>;
const MockedPrisma = prisma as unknown as {
  gamingCenter: { findUnique: jest.MockedFunction<any> };
  user: { findMany: jest.MockedFunction<any> };
  reservation: { findUnique: jest.MockedFunction<any>; findMany: jest.MockedFunction<any> };
};

describe('GameCenter Notification System (Unit & Verification)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Channel Mapping Enforcement', () => {
    it('Customer ticket events should use SMS only and never create In-App notifications', async () => {
      MockedRepo.createNotificationLog.mockResolvedValue({
        id: 'log-ticket-1',
        status: 'PENDING',
      } as any);

      // Customer ticket created
      const resultCreated = await NotificationStation.notifyUser({
        userId: 'cust-1',
        mobile: '09121111111',
        type: NotificationType.TICKET_CREATED,
        templateKey: 'TICKET_CREATED',
        templateParams: { ticketCode: 'TCK-101', subject: 'Login issue' },
      });

      expect(MockedRepo.createNotification).not.toHaveBeenCalled();
      expect(MockedRepo.createNotificationLog).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: '09121111111',
          category: NotificationCategory.CUSTOMER,
          channel: 'SMS',
          type: NotificationType.TICKET_CREATED,
        })
      );
      expect(resultCreated).toBeDefined();

      // Customer ticket replied
      await NotificationStation.notifyCustomerTicket({
        phone: '09122222222',
        type: NotificationType.TICKET_REPLIED,
        ticketId: 'tck-202',
        ticketCode: 'TCK-202',
      });

      expect(MockedRepo.createNotification).not.toHaveBeenCalled();
      expect(MockedRepo.createNotificationLog).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: '09122222222',
          category: NotificationCategory.CUSTOMER,
          channel: 'SMS',
          type: NotificationType.TICKET_REPLIED,
        })
      );

      // Customer ticket closed
      await NotificationStation.notifyCustomerTicket({
        phone: '09123333333',
        type: NotificationType.TICKET_CLOSED,
        ticketId: 'tck-303',
        ticketCode: 'TCK-303',
      });

      expect(MockedRepo.createNotification).not.toHaveBeenCalled();
      expect(MockedRepo.createNotificationLog).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: '09123333333',
          category: NotificationCategory.CUSTOMER,
          channel: 'SMS',
          type: NotificationType.TICKET_CLOSED,
        })
      );
    });

    it('GameCenter notifications must use In-App only without duplicate SMS', async () => {
      MockedRepo.createNotification.mockResolvedValue({
        id: 'notif-gc-1',
        userId: 'staff-1',
        category: NotificationCategory.GAME_CENTER,
        type: NotificationType.GAME_CENTER_BOOKING_REQUESTED,
        title: 'New Booking',
        message: 'A booking was requested',
        isRead: false,
      } as any);

      // Attempting to pass sendSms: true on a GameCenter event must be suppressed
      const result = await NotificationStation.notifyUser({
        gamingCenterId: 'gc-1',
        userId: 'staff-1',
        type: NotificationType.GAME_CENTER_BOOKING_REQUESTED,
        templateKey: 'GAME_CENTER_BOOKING_REQUESTED',
        templateParams: {
          stationName: 'PS5-01',
          dateStr: '2026/11/22',
          timeStr: '18:00',
          customerName: 'Sina',
        },
        sendSms: true,
        mobile: '09129999999',
      });

      expect(MockedRepo.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'staff-1',
          category: NotificationCategory.GAME_CENTER,
          type: NotificationType.GAME_CENTER_BOOKING_REQUESTED,
        })
      );
      // Verify no SMS outbox log was created
      expect(MockedRepo.createNotificationLog).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('Manager notifications must use In-App only without duplicate SMS', async () => {
      MockedRepo.createNotification.mockResolvedValue({
        id: 'notif-mgr-1',
        userId: 'admin-1',
        category: NotificationCategory.MANAGER,
        type: NotificationType.NEW_GAME_CENTER_REGISTRATION,
        title: 'New GameCenter',
        message: 'A center registered',
        isRead: false,
      } as any);

      await NotificationStation.notifyUser({
        userId: 'admin-1',
        type: NotificationType.NEW_GAME_CENTER_REGISTRATION,
        templateKey: 'NEW_GAME_CENTER_REGISTRATION',
        templateParams: { gameCenterName: 'Nexus Arena', ownerName: 'Reza' },
        sendSms: true,
        mobile: '09128888888',
      });

      expect(MockedRepo.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-1',
          category: NotificationCategory.MANAGER,
          type: NotificationType.NEW_GAME_CENTER_REGISTRATION,
        })
      );
      expect(MockedRepo.createNotificationLog).not.toHaveBeenCalled();
    });
  });

  describe('2. Recipient Resolution', () => {
    it('notifyGameCenter should deliver In-App notifications to center manager and active staff', async () => {
      MockedPrisma.gamingCenter.findUnique.mockResolvedValue({
        id: 'gc-100',
        managerId: 'owner-user-1',
      });

      MockedPrisma.user.findMany.mockResolvedValue([
        { id: 'owner-user-1', role: UserRole.MANAGER, preferredLanguage: 'fa' },
        { id: 'staff-user-2', role: UserRole.STAFF, preferredLanguage: 'en' },
      ]);

      MockedRepo.createNotification.mockImplementation(async (data: any) => ({
        id: `notif-${data.userId}`,
        ...data,
      }));

      const results = await NotificationStation.notifyGameCenter({
        gamingCenterId: 'gc-100',
        type: NotificationType.GAME_CENTER_BOOKING_CONFIRMED,
        templateKey: 'GAME_CENTER_BOOKING_CONFIRMED',
        templateParams: { bookingId: 'res-777', stationName: 'VR Station' },
      });

      expect(MockedPrisma.gamingCenter.findUnique).toHaveBeenCalledWith({
        where: { id: 'gc-100' },
        select: { managerId: true },
      });
      expect(results).toHaveLength(2);
      expect(MockedRepo.createNotification).toHaveBeenCalledTimes(2);
      expect(MockedRepo.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'owner-user-1',
          category: NotificationCategory.GAME_CENTER,
          type: NotificationType.GAME_CENTER_BOOKING_CONFIRMED,
        })
      );
      expect(MockedRepo.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'staff-user-2',
          category: NotificationCategory.GAME_CENTER,
          type: NotificationType.GAME_CENTER_BOOKING_CONFIRMED,
        })
      );
    });

    it('notifyManagers should deliver In-App notifications to platform admins and managers in a batch', async () => {
      MockedPrisma.user.findMany.mockResolvedValue([
        { id: 'admin-1', role: UserRole.ADMIN, preferredLanguage: 'fa' },
        { id: 'manager-2', role: UserRole.MANAGER, preferredLanguage: 'en' },
      ]);

      (MockedRepo as any).createNotificationsBatch.mockImplementation(async (items: any[]) =>
        items.map((data) => ({
          id: `notif-${data.userId}`,
          ...data,
        }))
      );

      const results = await NotificationStation.notifyManagers({
        type: NotificationType.SYSTEM_ERROR,
        templateKey: 'SYSTEM_ERROR',
        templateParams: { component: 'PaymentGateway', errorMessage: 'Timeout' },
      });

      expect(results).toHaveLength(2);
      expect((MockedRepo as any).createNotificationsBatch).toHaveBeenCalledTimes(1);
      expect((MockedRepo as any).createNotificationsBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: 'admin-1',
            category: NotificationCategory.MANAGER,
            type: NotificationType.SYSTEM_ERROR,
          }),
          expect.objectContaining({
            userId: 'manager-2',
            category: NotificationCategory.MANAGER,
            type: NotificationType.SYSTEM_ERROR,
          }),
        ])
      );
    });
  });

  describe('3. Scheduled Reminder State Revalidation & Windows', () => {
    const mockReservationActive = {
      id: 'res-valid-1',
      status: ReservationStatus.CONFIRMED,
      canceledAt: null,
      startTime: new Date('2026-11-25T14:00:00.000Z'),
      stationSnapshot: { name: 'VIP PC 1' },
      gamingCenter: {
        id: 'gc-1',
        name: 'Nexus Gaming',
        managerId: 'manager-1',
        settings: { timeZone: 'Asia/Tehran' },
      },
      customerAccount: {
        fullName: 'Kaveh',
        phone: '09120000000',
      },
    };

    it('should successfully send In-App reminder for 24H window when reservation is confirmed', async () => {
      MockedRepo.findLogByIdempotencyKey.mockResolvedValue(null);
      MockedPrisma.reservation.findUnique.mockResolvedValue(mockReservationActive);
      MockedPrisma.user.findMany.mockResolvedValue([
        { id: 'manager-1', role: UserRole.MANAGER },
      ]);
      MockedRepo.createNotification.mockResolvedValue({ id: 'notif-1' } as any);
      MockedRepo.createNotificationLog.mockResolvedValue({ id: 'log-1' } as any);

      const result = await revalidateAndSendGameCenterReminder('res-valid-1', '24H');

      expect(result.sent).toBe(true);
      expect(MockedRepo.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'manager-1',
          category: NotificationCategory.GAME_CENTER,
          type: NotificationType.GAME_CENTER_BOOKING_REMINDER_24H,
        })
      );
      expect(MockedRepo.createNotificationLog).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: 'reminder:res-valid-1:24H',
          channel: 'IN_APP',
          status: 'SENT',
        })
      );
    });

    it('should skip reminder if booking was cancelled', async () => {
      MockedRepo.findLogByIdempotencyKey.mockResolvedValue(null);
      MockedPrisma.reservation.findUnique.mockResolvedValue({
        ...mockReservationActive,
        canceledAt: new Date(),
        status: ReservationStatus.CANCELED,
      });

      const result = await revalidateAndSendGameCenterReminder('res-valid-1', '2H');

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('CANCELLED');
      expect(MockedRepo.createNotification).not.toHaveBeenCalled();
    });

    it('should skip reminder if booking status is inactive (e.g. EXPIRED)', async () => {
      MockedRepo.findLogByIdempotencyKey.mockResolvedValue(null);
      MockedPrisma.reservation.findUnique.mockResolvedValue({
        ...mockReservationActive,
        status: ReservationStatus.EXPIRED,
      });

      const result = await revalidateAndSendGameCenterReminder('res-valid-1', '15M');

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('INACTIVE_STATUS');
      expect(MockedRepo.createNotification).not.toHaveBeenCalled();
    });

    it('should skip reminder if booking does not exist in database', async () => {
      MockedRepo.findLogByIdempotencyKey.mockResolvedValue(null);
      MockedPrisma.reservation.findUnique.mockResolvedValue(null);

      const result = await revalidateAndSendGameCenterReminder('res-nonexistent', '15M');

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('NOT_FOUND');
      expect(MockedRepo.createNotification).not.toHaveBeenCalled();
    });

    it('should prevent duplicate reminders when already sent (Idempotency)', async () => {
      MockedRepo.findLogByIdempotencyKey.mockResolvedValue({
        id: 'existing-log',
        idempotencyKey: 'reminder:res-valid-1:2H',
      } as any);

      const result = await revalidateAndSendGameCenterReminder('res-valid-1', '2H');

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('ALREADY_SENT');
      expect(MockedPrisma.reservation.findUnique).not.toHaveBeenCalled();
      expect(MockedRepo.createNotification).not.toHaveBeenCalled();
    });

    it('should skip reminder if no active staff recipients exist', async () => {
      MockedRepo.findLogByIdempotencyKey.mockResolvedValue(null);
      MockedPrisma.reservation.findUnique.mockResolvedValue(mockReservationActive);
      MockedPrisma.user.findMany.mockResolvedValue([]); // No staff

      const result = await revalidateAndSendGameCenterReminder('res-valid-1', '15M');

      expect(result.sent).toBe(false);
      expect(result.reason).toBe('NO_VALID_RECIPIENT');
      expect(MockedRepo.createNotification).not.toHaveBeenCalled();
    });

    it('processGameCenterRemindersBatch should scan and dispatch for 24H, 2H, and 15M windows', async () => {
      const now = new Date('2026-11-21T12:00:00.000Z');

      MockedPrisma.reservation.findMany.mockImplementation(async () => [
        { id: 'res-batch-1' },
      ]);
      MockedRepo.findLogByIdempotencyKey.mockResolvedValue(null);
      MockedPrisma.reservation.findUnique.mockResolvedValue(mockReservationActive);
      MockedPrisma.user.findMany.mockResolvedValue([{ id: 'staff-1', role: UserRole.STAFF }]);
      MockedRepo.createNotification.mockResolvedValue({ id: 'notif-1' } as any);
      MockedRepo.createNotificationLog.mockResolvedValue({ id: 'log-1' } as any);

      const batchResult = await processGameCenterRemindersBatch({ batchSize: 50, now });

      expect(batchResult.candidateCount).toBe(3); // 1 per window
      expect(batchResult.scheduledCount).toBe(3);
    });
  });

  describe('4. Multilingual Templates & Dynamic Interpolation', () => {
    it('should accurately render Persian (default) and English with interpolation for all new events', () => {
      // 1. TICKET_CREATED
      const tcFa = renderLocalizedNotification('TICKET_CREATED', { ticketCode: '99', subject: 'ورود' }, 'fa');
      const tcEn = renderLocalizedNotification('TICKET_CREATED', { ticketCode: '99', subject: 'Login' }, 'en');
      expect(tcFa.title).toContain('تیکت');
      expect(tcFa.message).toContain('99');
      expect(tcFa.direction).toBe('rtl');
      expect(tcEn.title).toBe('Ticket Created');
      expect(tcEn.message).toContain('Login');
      expect(tcEn.direction).toBe('ltr');

      // 2. GAME_CENTER_BOOKING_REQUESTED
      const bReqFa = renderLocalizedNotification('GAME_CENTER_BOOKING_REQUESTED', {
        stationName: 'VIP 1',
        dateStr: '1405/01/01',
        timeStr: '20:00',
        customerName: 'کامران',
      }, 'fa');
      expect(bReqFa.title).toBe('درخواست رزرو جدید');
      expect(bReqFa.message).toContain('VIP 1');
      expect(bReqFa.message).toContain('کامران');

      // 3. GAME_CENTER_BOOKING_REMINDER_24H / 2H / 15M
      const r24h = renderLocalizedNotification('GAME_CENTER_BOOKING_REMINDER_24H', { bookingId: 'BK1', stationName: 'PS5' }, 'fa');
      const r2h = renderLocalizedNotification('GAME_CENTER_BOOKING_REMINDER_2H', { bookingId: 'BK2', stationName: 'PS5', timeStr: '14:00' }, 'fa');
      const r15m = renderLocalizedNotification('GAME_CENTER_BOOKING_REMINDER_15M', { bookingId: 'BK3', stationName: 'PS5', timeStr: '14:15' }, 'en');
      expect(r24h.message).toContain('۲۴ ساعت');
      expect(r2h.message).toContain('۲ ساعت');
      expect(r15m.message).toContain('15 minutes');

      // 4. GAME_CENTER_REVIEW_RECEIVED
      const revFa = renderLocalizedNotification('GAME_CENTER_REVIEW_RECEIVED', {
        gameCenterName: 'آرنا',
        customerName: 'سارا',
        rating: 5,
      }, 'fa');
      expect(revFa.title).toBe('دیدگاه جدید ثبت شد');
      expect(revFa.message).toContain('5 ستاره');

      // 5. Manager Notifications: NEW_GAME_CENTER_REGISTRATION & DAILY_BOOKING_SUMMARY
      const regEn = renderLocalizedNotification('NEW_GAME_CENTER_REGISTRATION', {
        gameCenterName: 'Nexus Hub',
        ownerName: 'Ali',
      }, 'en');
      expect(regEn.title).toBe('New GameCenter Registration');
      expect(regEn.message).toContain('Nexus Hub');

      const sumFa = renderLocalizedNotification('DAILY_BOOKING_SUMMARY', {
        totalBookings: 42,
        formattedAmount: '۴,۲۰۰,۰۰۰ ریال',
      }, 'fa');
      expect(sumFa.title).toBe('گزارش روزانه رزروها');
      expect(sumFa.message).toContain('42');
    });
  });
});
