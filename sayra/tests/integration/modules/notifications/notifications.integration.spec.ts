/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NotificationStation } from '../../../../src/modules/notifications/notifications.station';
import { notificationsRepo } from '../../../../src/modules/notifications/notifications.repo';
import { SmsStation } from '../../../../src/modules/notifications/sms.station';
import { NotificationType } from '@prisma/client';

const NotificationChannel = {
  IN_APP: 'IN_APP',
  SMS: 'SMS',
  EMAIL: 'EMAIL',
} as any;

const NotificationDispatchStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as any;

describe('Notification Outbox Integration', () => {
  const gamingCenterId = 'gc-100';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should enqueue notification log and handle idempotency deduplication', async () => {
    const input = {
      gamingCenterId,
      recipient: '09123456789',
      channel: NotificationChannel.SMS,
      type: NotificationType.RESERVATION_CREATED,
      title: 'New Booking',
      message: 'Booking created',
      idempotencyKey: 'res_created_sms:res-10',
      entityType: 'Reservation',
      entityId: 'res-10',
    };

    const createdLog = {
      id: 'log-10',
      ...input,
      status: NotificationDispatchStatus.PENDING,
      attempts: 0,
      maxAttempts: 3,
    };

    jest.spyOn(notificationsRepo, 'createNotificationLog').mockResolvedValue(createdLog as any);

    const log = (await NotificationStation.enqueueNotificationLog(input as any)) as any;

    expect(notificationsRepo.createNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'res_created_sms:res-10',
      })
    );
    expect(log.id).toBe('log-10');
  });

  it('should process pending outbox logs and advance dispatch state', async () => {
    const pendingLog = {
      id: 'log-20',
      recipient: '09123456789',
      channel: NotificationChannel.SMS,
      templateId: 200,
      parameters: [{ name: 'CUSTOMER_NAME', value: 'Ali' }],
      status: NotificationDispatchStatus.PENDING,
      attempts: 0,
      maxAttempts: 3,
    };

    jest.spyOn(notificationsRepo, 'findPendingNotificationLogs').mockResolvedValue([pendingLog as any]);
    jest.spyOn(notificationsRepo, 'findLogById').mockResolvedValue(pendingLog as any);
    jest.spyOn(SmsStation, 'sendTemplateSms').mockResolvedValue({ id: 'sms-provider-456' } as any);
    jest.spyOn(notificationsRepo, 'updateNotificationLogStatus').mockResolvedValue({
      ...pendingLog,
      status: NotificationDispatchStatus.SENT,
    } as any);

    const result = await NotificationStation.processPendingNotificationLogs(10);

    expect(result.processed).toBe(1);
    expect(result.success).toBe(1);
    expect(result.failed).toBe(0);
    expect(SmsStation.sendTemplateSms).toHaveBeenCalledWith('09123456789', 200, [
      { name: 'CUSTOMER_NAME', value: 'Ali' },
    ]);
  });

  it('should cancel pending notification logs by entity on cancellation or reschedule', async () => {
    jest.spyOn(notificationsRepo, 'cancelPendingLogsByEntity').mockResolvedValue({ count: 3 } as any);

    const result = await NotificationStation.cancelPendingLogsByEntity('Reservation', 'res-100');

    expect(notificationsRepo.cancelPendingLogsByEntity).toHaveBeenCalledWith('Reservation', 'res-100');
    expect((result as any).count).toBe(3);
  });
});
