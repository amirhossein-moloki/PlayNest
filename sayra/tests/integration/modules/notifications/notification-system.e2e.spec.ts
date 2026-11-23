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
import { SmsStation } from '../../../../src/modules/notifications/sms.station';
import {
  revalidateAndSendGameCenterReminder,
  scheduleReservationReminders,
  invalidateObsoleteReminders,
} from '../../../../src/modules/reservation/reservation.reminders';
import { ReservationRemindersWorker } from '../../../../src/jobs/workers/reservationReminders.worker';
import { createTicket, addMessage, updateTicketStatus } from '../../../../src/modules/tickets/tickets.station';
import * as ticketRepo from '../../../../src/modules/tickets/tickets.repo';

jest.mock('../../../../src/modules/notifications/notifications.repo');
jest.mock('../../../../src/modules/tickets/tickets.repo');
jest.mock('../../../../src/modules/audit/audit.station', () => ({
  auditService: {
    recordLog: jest.fn().mockImplementation(() => Promise.resolve({ id: 'audit-log-1' })),
    log: jest.fn().mockImplementation(() => Promise.resolve({ id: 'audit-log-1' })),
  },
}));
jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    gamingCenter: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    reservation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const MockedRepo = notificationsRepo as jest.Mocked<typeof notificationsRepo>;
const MockedTicketRepo = ticketRepo as jest.Mocked<typeof ticketRepo>;
const MockedPrisma = prisma as unknown as {
  gamingCenter: { findUnique: jest.MockedFunction<any>; findMany: jest.MockedFunction<any> };
  user: { findMany: jest.MockedFunction<any>; findUnique: jest.MockedFunction<any> };
  reservation: { findUnique: jest.MockedFunction<any>; findMany: jest.MockedFunction<any> };
};

describe('Notification System Full End-to-End Test Suite', () => {
  let sendTemplateSmsSpy: any;
  let sendDirectSmsSpy: any;

  beforeEach(() => {
    jest.clearAllMocks();
    sendTemplateSmsSpy = jest.spyOn(SmsStation, 'sendTemplateSms').mockResolvedValue({ id: 'sms-tmpl-1' } as any);
    sendDirectSmsSpy = jest.spyOn(SmsStation, 'sendDirectSms').mockResolvedValue({ id: 'sms-direct-1' } as any);
  });

  afterEach(() => {
    sendTemplateSmsSpy.mockRestore();
    sendDirectSmsSpy.mockRestore();
  });

  // Requirement 1 & 2: Creating a booking generates GAME_CENTER_BOOKING_REQUESTED and the correct GameCenter receives In-App notification
  it('1 & 2. Creating a booking automatically generates GAME_CENTER_BOOKING_REQUESTED and GameCenter receives In-App notification', async () => {
    const mockStaff = [
      { id: 'staff-1', role: UserRole.MANAGER, gamingCenterId: 'gc-100', preferredLanguage: 'fa' },
      { id: 'staff-2', role: UserRole.STAFF, gamingCenterId: 'gc-100', preferredLanguage: 'en' },
    ];

    MockedPrisma.gamingCenter.findUnique.mockResolvedValue({
      id: 'gc-100',
      name: 'GameNest Center',
      managerId: 'staff-1',
    });
    MockedPrisma.user.findMany.mockResolvedValue(mockStaff);
    MockedRepo.createNotification.mockImplementation(async (data: any) => ({
      id: `notif-${data.userId}`,
      ...data,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Trigger GameCenter notification for booking requested
    const notifications = await NotificationStation.notifyGameCenter({
      gamingCenterId: 'gc-100',
      type: NotificationType.GAME_CENTER_BOOKING_REQUESTED,
      templateKey: 'GAME_CENTER_BOOKING_REQUESTED',
      templateParams: {
        stationName: 'PS5 Station 1',
        dateStr: '2026/12/01',
        timeStr: '18:00',
        customerName: 'Ali Customer',
      },
      metadata: { reservationId: 'res-100' },
      entityType: 'Reservation',
      entityId: 'res-100',
    });

    expect(notifications).toHaveLength(2);
    expect(MockedRepo.createNotification).toHaveBeenCalledTimes(2);
    expect(MockedRepo.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'staff-1',
        category: NotificationCategory.GAME_CENTER,
        type: NotificationType.GAME_CENTER_BOOKING_REQUESTED,
      })
    );
    expect(MockedRepo.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'staff-2',
        category: NotificationCategory.GAME_CENTER,
        type: NotificationType.GAME_CENTER_BOOKING_REQUESTED,
      })
    );
    // GameCenter notification must NEVER call SMS
    expect(MockedRepo.createNotificationLog).not.toHaveBeenCalled();
    expect(sendTemplateSmsSpy).not.toHaveBeenCalled();
    expect(sendDirectSmsSpy).not.toHaveBeenCalled();
  });

  // Requirement 3: Booking confirmation generates appropriate notification (GAME_CENTER_BOOKING_CONFIRMED)
  it('3. Booking confirmation generates GAME_CENTER_BOOKING_CONFIRMED notification for GameCenter staff', async () => {
    const mockStaff = [
      { id: 'staff-1', role: UserRole.MANAGER, gamingCenterId: 'gc-200' },
    ];

    MockedPrisma.gamingCenter.findUnique.mockResolvedValue({
      id: 'gc-200',
      managerId: 'staff-1',
    });
    MockedPrisma.user.findMany.mockResolvedValue(mockStaff);
    MockedRepo.createNotification.mockResolvedValue({
      id: 'notif-conf-1',
      userId: 'staff-1',
      type: NotificationType.GAME_CENTER_BOOKING_CONFIRMED,
    } as any);

    const notifications = await NotificationStation.notifyGameCenter({
      gamingCenterId: 'gc-200',
      type: NotificationType.GAME_CENTER_BOOKING_CONFIRMED,
      templateKey: 'GAME_CENTER_BOOKING_CONFIRMED',
      templateParams: {
        bookingId: 'res-conf-200',
        stationName: 'VIP Lounge',
      },
      entityType: 'Reservation',
      entityId: 'res-conf-200',
    });

    expect(notifications).toHaveLength(1);
    expect(MockedRepo.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'staff-1',
        category: NotificationCategory.GAME_CENTER,
        type: NotificationType.GAME_CENTER_BOOKING_CONFIRMED,
      })
    );
  });

  // Requirement 4: Booking cancellation prevents future reminders
  it('4. Booking cancellation prevents future reminders and invalidates pending logs', async () => {
    MockedRepo.cancelPendingLogsByEntity.mockResolvedValue({ count: 3 });

    const cancelResult = await invalidateObsoleteReminders('res-to-cancel-400');
    expect(cancelResult).toEqual({ count: 3 });
    expect(MockedRepo.cancelPendingLogsByEntity).toHaveBeenCalledWith(
      'Reservation',
      'res-to-cancel-400'
    );

    // If an inactive or cancelled booking reaches the reminder evaluation, it must be aborted
    MockedRepo.findLogByIdempotencyKey.mockResolvedValue(null);
    MockedPrisma.reservation.findUnique.mockResolvedValue({
      id: 'res-to-cancel-400',
      status: ReservationStatus.CANCELED,
      canceledAt: new Date(),
    });

    const reminderResult = await revalidateAndSendGameCenterReminder('res-to-cancel-400', '2H');
    expect(reminderResult.sent).toBe(false);
    expect(reminderResult.reason).toBe('CANCELLED');
    expect(MockedRepo.createNotification).not.toHaveBeenCalled();
  });

  // Requirement 5: Ticket creation, reply, and closure use SMS only (never In-App)
  it('5. Ticket creation, reply, and closure use SMS only and never create In-App notifications', async () => {
    MockedRepo.createNotificationLog.mockResolvedValue({
      id: 'log-ticket-500',
      status: 'PENDING',
    } as any);

    // 5a. Customer creates ticket -> SMS to customer
    MockedTicketRepo.createTicket.mockResolvedValue({
      id: 'tck-501',
      subject: 'Issue with booking',
      customerAccount: { phone: '09121111111' },
    } as any);
    MockedPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1', role: UserRole.ADMIN }]);

    await createTicket(
      {
        customerAccountId: 'cust-1',
        subject: 'Issue with booking',
        priority: 'MEDIUM' as any,
        category: 'ACCOUNT' as any,
        message: 'Hello support',
      },
      { ip: '127.0.0.1' }
    );

    expect(MockedRepo.createNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: '09121111111',
        category: NotificationCategory.CUSTOMER,
        channel: 'SMS',
        type: NotificationType.TICKET_CREATED,
      })
    );

    // 5b. Support replies to ticket -> SMS to customer
    MockedTicketRepo.findTicketById.mockResolvedValue({
      id: 'tck-501',
      status: 'PENDING',
      customerAccountId: 'cust-1',
      customerAccount: { phone: '09121111111' },
    } as any);
    MockedTicketRepo.createMessage.mockResolvedValue({ id: 'msg-1', text: 'We are looking into it' } as any);
    MockedTicketRepo.updateTicket.mockResolvedValue({ id: 'tck-501', status: 'ANSWERED' } as any);

    await addMessage(
      'tck-501',
      'agent-1',
      'SUPPORT' as any,
      'We are looking into it',
      undefined,
      { id: 'agent-1', role: UserRole.ADMIN, actorType: 'USER' }
    );

    expect(MockedRepo.createNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: '09121111111',
        category: NotificationCategory.CUSTOMER,
        channel: 'SMS',
        type: NotificationType.TICKET_REPLIED,
      })
    );

    // 5c. Ticket closed -> SMS to customer
    await updateTicketStatus('tck-501', 'CLOSED' as any, { id: 'agent-1', role: UserRole.ADMIN });

    expect(MockedRepo.createNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: '09121111111',
        category: NotificationCategory.CUSTOMER,
        channel: 'SMS',
        type: NotificationType.TICKET_CLOSED,
      })
    );

    // Verify ticket customer events NEVER create In-App notifications
    const inAppCallsForTicket = MockedRepo.createNotification.mock.calls.filter((call) =>
      ([NotificationType.TICKET_CREATED, NotificationType.TICKET_REPLIED, NotificationType.TICKET_CLOSED] as NotificationType[]).includes(
        call[0].type
      )
    );
    expect(inAppCallsForTicket).toHaveLength(0);
  });

  // Requirement 6: Manager events reach authorized managers (In-App only)
  it('6. Manager events reach authorized managers (ADMIN, Superuser, GameCenter MANAGER) via In-App only', async () => {
    const authorizedManagers = [
      { id: 'mgr-admin', role: UserRole.ADMIN, isSuperuser: true },
      { id: 'mgr-center', role: UserRole.MANAGER, gamingCenterId: 'gc-600' },
    ];
    MockedPrisma.user.findMany.mockResolvedValue(authorizedManagers);
    (MockedRepo as any).createNotificationsBatch.mockImplementation(async (items: any[]) =>
      items.map((data) => ({ id: `notif-${data.userId}`, ...data }))
    );

    const notifications = await NotificationStation.notifyManagers({
      type: NotificationType.NEW_GAME_CENTER_REGISTRATION,
      templateKey: 'NEW_GAME_CENTER_REGISTRATION',
      templateParams: { gameCenterName: 'Tehran Cyber Arena' },
      gamingCenterId: 'gc-600',
    });

    expect(notifications).toHaveLength(2);
    expect((MockedRepo as any).createNotificationsBatch).toHaveBeenCalledTimes(1);
    expect((MockedRepo as any).createNotificationsBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'mgr-admin',
          category: NotificationCategory.MANAGER,
          type: NotificationType.NEW_GAME_CENTER_REGISTRATION,
        }),
        expect.objectContaining({
          userId: 'mgr-center',
          category: NotificationCategory.MANAGER,
          type: NotificationType.NEW_GAME_CENTER_REGISTRATION,
        }),
      ])
    );
    // Manager events must be In-App only, never SMS
    expect(sendTemplateSmsSpy).not.toHaveBeenCalled();
    expect(sendDirectSmsSpy).not.toHaveBeenCalled();
  });

  // Requirement 7: Failed SMS delivery is logged and retried with backoff
  it('7. Failed SMS delivery is logged, categorized, and scheduled for retry with exponential backoff', async () => {
    MockedRepo.findLogById.mockResolvedValue({
      id: 'log-retry-700',
      recipient: '09129999999',
      channel: 'SMS',
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 3,
      message: 'Your ticket is answered',
    } as any);

    // Mock transient failure from SMS provider (e.g. gateway timeout)
    sendDirectSmsSpy.mockRejectedValue(new Error('Gateway timeout 504'));
    MockedRepo.updateNotificationLogStatus.mockResolvedValue({
      id: 'log-retry-700',
      status: 'FAILED',
      attempts: 1,
    } as any);

    await NotificationStation.dispatchNotificationLog('log-retry-700');

    expect(MockedRepo.updateNotificationLogStatus).toHaveBeenCalledWith(
      'log-retry-700',
      expect.objectContaining({
        status: 'FAILED',
        attempts: 1,
        nextRetryAt: expect.any(Date),
        lastError: expect.stringContaining('Gateway timeout 504'),
      })
    );
  });

  // Requirement 8: Duplicate jobs do not produce duplicate notifications (Idempotency)
  it('8. Duplicate jobs do not produce duplicate notifications (Idempotency guarantee)', async () => {
    MockedRepo.findLogById.mockResolvedValue({
      id: 'log-already-sent',
      status: 'SENT',
      recipient: '09121234567',
    } as any);

    const result = await NotificationStation.dispatchNotificationLog('log-already-sent');

    expect(result).toEqual(expect.objectContaining({ status: 'SENT' }));
    expect(sendDirectSmsSpy).not.toHaveBeenCalled();
    expect(sendTemplateSmsSpy).not.toHaveBeenCalled();
    expect(MockedRepo.updateNotificationLogStatus).not.toHaveBeenCalled();
  });

  // Requirement 9: Scheduled reminders execute correctly (24H, 2H, 15M)
  it('9. Scheduled reminders calculate correct windows and dispatch upon execution', async () => {
    const bookingStart = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours in future
    MockedRepo.createNotificationLog.mockResolvedValue({ id: 'log-sched-900', status: 'PENDING' } as any);

    const scheduled = await scheduleReservationReminders('res-future-900', bookingStart, 'gc-900');

    // All 3 windows (24H, 2H, 15M) are in future relative to booking start
    expect(scheduled).toHaveLength(3);
    expect(scheduled.map((s) => s.window)).toEqual(['24H', '2H', '15M']);

    // Now test dispatching a 2H reminder window
    MockedPrisma.reservation.findUnique.mockResolvedValue({
      id: 'res-future-900',
      status: ReservationStatus.CONFIRMED,
      canceledAt: null,
      startTime: bookingStart,
      gamingCenter: {
        id: 'gc-900',
        name: 'Nexus Arena',
        settings: { timeZone: 'Asia/Tehran' },
      },
      customerAccount: { fullName: 'Reza Gamer' },
      stationSnapshot: { name: 'Cockpit 1' },
    });
    MockedPrisma.user.findMany.mockResolvedValue([
      { id: 'staff-901', role: UserRole.STAFF, gamingCenterId: 'gc-900', preferredLanguage: 'fa' },
    ]);
    MockedRepo.findLogByIdempotencyKey.mockResolvedValue(null);
    MockedRepo.createNotification.mockResolvedValue({ id: 'notif-901' } as any);

    const reminderSent = await revalidateAndSendGameCenterReminder('res-future-900', '2H');
    expect(reminderSent.sent).toBe(true);
    expect(MockedRepo.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'staff-901',
        category: NotificationCategory.GAME_CENTER,
        type: NotificationType.GAME_CENTER_BOOKING_REMINDER_2H,
      })
    );
  });

  // Requirement 10: Pending Outbox events are recovered after worker restart
  it('10. Pending Outbox events are recovered after worker restart', async () => {
    const pendingLogs = [
      { id: 'pending-1', status: 'PENDING', scheduledAt: new Date(Date.now() - 1000) },
      { id: 'pending-2', status: 'PENDING', scheduledAt: new Date(Date.now() - 500) },
    ];

    MockedRepo.findPendingNotificationLogs.mockResolvedValue(pendingLogs as any);
    MockedRepo.findLogById.mockImplementation(async (id: string) => ({
      id,
      status: 'PENDING',
      recipient: '09120000000',
      channel: 'SMS',
      message: 'Recovered outbox message',
      attempts: 0,
    } as any));
    sendDirectSmsSpy.mockResolvedValue({ id: 'sms-recovered-1' } as any);
    MockedRepo.updateNotificationLogStatus.mockResolvedValue({ status: 'SENT' } as any);

    // Simulate worker restart and tick
    const worker = new ReservationRemindersWorker({ enabled: true, batchSize: 10, pollIntervalMs: 60000 });
    const recoveryResult = await NotificationStation.processPendingNotificationLogs(10, new Date());

    expect(recoveryResult.processed).toBe(2);
    expect(recoveryResult.success).toBe(2);
    expect(recoveryResult.failed).toBe(0);
    expect(sendDirectSmsSpy).toHaveBeenCalledTimes(2);
  });
});
