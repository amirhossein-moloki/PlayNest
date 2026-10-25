/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReservationStatus } from '@prisma/client';
import { processReservationRemindersBatch, invalidateObsoleteReminders } from '../../../../src/modules/reservation/reservation.reminders';
import { ReservationRemindersWorker } from '../../../../src/jobs/workers/reservationReminders.worker';
import { prisma } from '../../../../src/config/prisma';
import { NotificationStation } from '../../../../src/modules/notifications/notifications.station';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    reservation: {
      findMany: jest.fn(),
    },
    notificationLog: {
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../../../src/modules/notifications/notifications.station');

const MockedNotificationStation = NotificationStation as jest.Mocked<typeof NotificationStation>;

describe('ReservationRemindersWorker (Unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processReservationRemindersBatch', () => {
    it('should query active reservations within leadTime window and enqueue reminders', async () => {
      const now = new Date('2026-10-25T10:00:00.000Z');
      const startTime = new Date('2026-10-25T10:30:00.000Z');

      const mockReservations = [
        {
          id: 'res-1',
          status: ReservationStatus.CONFIRMED,
          startTime,
          stationSnapshot: { name: 'PC VIP 1' },
          gamingCenter: {
            id: 'gc-1',
            name: 'Arena 1',
            settings: { timeZone: 'Asia/Tehran' },
          },
          customerAccount: {
            id: 'cust-1',
            phone: '09123456789',
            fullName: 'Ali Customer',
          },
        },
      ];

      (prisma.reservation.findMany as jest.MockedFunction<any>).mockResolvedValue(mockReservations);
      ((prisma as any).notificationLog.findUnique as jest.MockedFunction<any>).mockResolvedValue(null);
      (prisma.user.findMany as jest.MockedFunction<any>).mockResolvedValue([]);
      MockedNotificationStation.enqueueNotificationLog.mockResolvedValue({ id: 'log-1' } as any);

      const result = await processReservationRemindersBatch({
        leadTimeMinutes: 60,
        batchSize: 10,
        now,
      });

      expect(prisma.reservation.findMany).toHaveBeenCalled();
      expect(NotificationStation.enqueueNotificationLog).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: '09123456789',
          idempotencyKey: 'reminder:res-1',
          entityId: 'res-1',
        })
      );
      expect(result.candidateCount).toBe(1);
      expect(result.scheduledCount).toBe(1);
    });

    it('should skip reservations that already have a reminder logged', async () => {
      const now = new Date('2026-10-25T10:00:00.000Z');
      const mockReservations = [
        {
          id: 'res-1',
          status: ReservationStatus.CONFIRMED,
          startTime: new Date('2026-10-25T10:30:00.000Z'),
          stationSnapshot: { name: 'PC 1' },
          gamingCenter: { id: 'gc-1', name: 'Arena 1' },
          customerAccount: { id: 'cust-1', phone: '09123456789' },
        },
      ];

      (prisma.reservation.findMany as jest.MockedFunction<any>).mockResolvedValue(mockReservations);
      ((prisma as any).notificationLog.findUnique as jest.MockedFunction<any>).mockResolvedValue({ id: 'existing-log' });

      const result = await processReservationRemindersBatch({
        leadTimeMinutes: 60,
        now,
      });

      expect(NotificationStation.enqueueNotificationLog).not.toHaveBeenCalled();
      expect(result.skippedCount).toBe(1);
      expect(result.scheduledCount).toBe(0);
    });
  });

  describe('invalidateObsoleteReminders', () => {
    it('should delegate to NotificationStation to cancel pending reminder logs', async () => {
      MockedNotificationStation.cancelPendingLogsByEntity.mockResolvedValue({ count: 2 } as any);

      await invalidateObsoleteReminders('res-123');

      expect(NotificationStation.cancelPendingLogsByEntity).toHaveBeenCalledWith('Reservation', 'res-123');
    });
  });

  describe('ReservationRemindersWorker lifecycle', () => {
    it('should start and stop gracefully', async () => {
      const worker = new ReservationRemindersWorker({
        pollIntervalMs: 1000,
        enabled: true,
      });

      expect(worker.isRunning()).toBe(false);
      worker.start();
      expect(worker.isRunning()).toBe(true);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
    });
  });
});
