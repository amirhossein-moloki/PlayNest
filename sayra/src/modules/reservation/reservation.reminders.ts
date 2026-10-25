import { prisma } from '../../config/prisma';
import { ReservationStatus, NotificationType, NotificationChannel } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { env } from '../../config/env';
import { NotificationStation } from '../notifications/notifications.station';
import { notificationsRepo } from '../notifications/notifications.repo';
import logger from '../../config/logger';

export interface ProcessRemindersOptions {
  leadTimeMinutes?: number;
  batchSize?: number;
  now?: Date;
}

export const processReservationRemindersBatch = async (options: ProcessRemindersOptions = {}) => {
  const leadTimeMinutes = options.leadTimeMinutes ?? env.RESERVATION_REMINDER_LEAD_TIME_MINUTES;
  const batchSize = options.batchSize ?? env.RESERVATION_REMINDER_BATCH_SIZE;
  const now = options.now ?? new Date();

  const windowStart = now;
  const windowEnd = new Date(now.getTime() + leadTimeMinutes * 60 * 1000);

  const eligibleReservations = await prisma.reservation.findMany({
    where: {
      status: {
        in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING],
      },
      startTime: {
        gte: windowStart,
        lte: windowEnd,
      },
      canceledAt: null,
    },
    include: {
      gamingCenter: {
        include: {
          settings: true,
        },
      },
      customerAccount: true,
      customerProfile: true,
    },
    take: batchSize,
    orderBy: { startTime: 'asc' },
  });

  const candidateCount = eligibleReservations.length;
  let scheduledCount = 0;
  let skippedCount = 0;

  for (const reservation of eligibleReservations) {
    const idempotencyKey = `reminder:${reservation.id}`;

    const existingLog = await notificationsRepo.findLogByIdempotencyKey(idempotencyKey);

    if (existingLog) {
      skippedCount++;
      continue;
    }

    if (
      reservation.status !== ReservationStatus.CONFIRMED &&
      reservation.status !== ReservationStatus.PENDING
    ) {
      skippedCount++;
      continue;
    }

    const gamingCenter = reservation.gamingCenter;
    const customerAccount = reservation.customerAccount;
    const timeZone = gamingCenter.settings?.timeZone || 'UTC';

    const dateStr = formatInTimeZone(reservation.startTime, timeZone, 'yyyy/MM/dd');
    const timeStr = formatInTimeZone(reservation.startTime, timeZone, 'HH:mm');
    const stationName =
      ((reservation.stationSnapshot as Record<string, unknown>)?.name as string | undefined) || 'N/A';

    const templateId =
      env.SMSIR_RESERVATION_REMINDER_TEMPLATE_ID ||
      env.SMSIR_RESERVATION_CONFIRMED_TEMPLATE_ID;

    const parameters = [
      { name: 'CUSTOMER_NAME', value: customerAccount.fullName || 'Customer' },
      { name: 'SERVICE_NAME', value: stationName },
      { name: 'DATE', value: dateStr },
      { name: 'TIME', value: timeStr },
      { name: 'SALON_NAME', value: gamingCenter.name },
    ];

    const message = `Reminder: Your reservation for ${stationName} at ${gamingCenter.name} is on ${dateStr} at ${timeStr}.`;

    try {
      await NotificationStation.enqueueNotificationLog({
        gamingCenterId: gamingCenter.id,
        recipient: customerAccount.phone,
        channel: NotificationChannel.SMS,
        type: NotificationType.RESERVATION_REMINDER,
        title: 'Upcoming Reservation Reminder',
        message,
        templateId,
        parameters,
        idempotencyKey,
        entityType: 'Reservation',
        entityId: reservation.id,
      });

      const staffUsers = await prisma.user.findMany({
        where: {
          gamingCenterId: gamingCenter.id,
          role: 'MANAGER',
          isActive: true,
        },
      });

      for (const staff of staffUsers) {
        await NotificationStation.notifyUser({
          gamingCenterId: gamingCenter.id,
          userId: staff.id,
          type: NotificationType.RESERVATION_REMINDER,
          title: 'Upcoming Reservation Reminder',
          message: `Upcoming reservation ${reservation.id} (${stationName}) starts at ${timeStr}.`,
          metadata: { reservationId: reservation.id },
        });
      }

      scheduledCount++;
    } catch (error) {
      logger.error({
        msg: 'Failed to schedule reminder for reservation',
        reservationId: reservation.id,
        error,
      });
    }
  }

  return {
    candidateCount,
    scheduledCount,
    skippedCount,
  };
};

export const invalidateObsoleteReminders = async (reservationId: string) => {
  return NotificationStation.cancelPendingLogsByEntity('Reservation', reservationId);
};
