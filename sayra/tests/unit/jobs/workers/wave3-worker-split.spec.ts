/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

describe('Wave 3 Worker Split & System Context (AMI-38)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs ReservationRemindersWorker.tick inside ReservationRemindersWorker system context', async () => {
    const capturedContexts: Array<{ isSystemContext?: boolean; systemJobName?: string }> = [];

    jest.doMock('../../../../src/common/context/request-context', () => {
      const actual = jest.requireActual('../../../../src/common/context/request-context') as any;
      return actual;
    });
    jest.doMock('../../../../src/modules/reservation/reservation.reminders', () => ({
      processReservationRemindersBatch: jest.fn(async () => {
        const { getRequestContext } = require('../../../../src/common/context/request-context');
        capturedContexts.push(getRequestContext());
        return { candidateCount: 1, scheduledCount: 1, skippedCount: 0 };
      }),
      processGameCenterRemindersBatch: jest.fn(async () => ({ candidateCount: 0, scheduledCount: 0, skippedCount: 0 })),
    }));
    jest.doMock('../../../../src/modules/notifications/notifications.station', () => ({
      NotificationStation: {
        processPendingNotificationLogs: jest.fn(async () => ({ processed: 0, success: 0, failed: 0 })),
      },
    }));

    const { ReservationRemindersWorker } = await import(
      '../../../../src/jobs/workers/reservationReminders.worker'
    );
    const worker = new ReservationRemindersWorker({ enabled: true });
    const res = await worker.tick(new Date('2026-11-24T10:00:00Z'));

    expect(res.scheduledCount).toBe(1);
    expect(capturedContexts.length).toBe(1);
    expect(capturedContexts[0].isSystemContext).toBe(true);
    expect(capturedContexts[0].systemJobName).toBe('ReservationRemindersWorker');
  });

  it('can close all queues cleanly via closeQueues()', async () => {
    const { closeQueues, smsQueue, analyticsQueue, cmsSyncMediaQueue, remindersQueue, notificationsQueue } =
      await import('../../../../src/jobs/queues');

    const spies = [smsQueue, analyticsQueue, cmsSyncMediaQueue, remindersQueue, notificationsQueue].map((q) =>
      jest.spyOn(q, 'close').mockResolvedValue(undefined as any)
    );

    await closeQueues();
    for (const spy of spies) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });
});
