import { prisma } from '../../config/prisma';
import { ReservationStatus, NotificationType, NotificationCategory, NotificationChannel, UserRole } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { env } from '../../config/env';
import { NotificationStation } from '../notifications/notifications.station';
import { notificationsRepo } from '../notifications/notifications.repo';
import { getRecipientPreferredLanguage } from '../notifications/notification-i18n';
import logger from '../../config/logger';

export interface ProcessRemindersOptions {
  leadTimeMinutes?: number;
  batchSize?: number;
  now?: Date;
}

export type ReminderWindowKey = '24H' | '2H' | '15M';

export const revalidateAndSendGameCenterReminder = async (
  reservationId: string,
  windowKey: ReminderWindowKey,
  now = new Date()
): Promise<{ sent: boolean; reason?: string }> => {
  const windowTypeMap = {
    '24H': {
      type: NotificationType.GAME_CENTER_BOOKING_REMINDER_24H,
      templateKey: 'GAME_CENTER_BOOKING_REMINDER_24H' as const,
    },
    '2H': {
      type: NotificationType.GAME_CENTER_BOOKING_REMINDER_2H,
      templateKey: 'GAME_CENTER_BOOKING_REMINDER_2H' as const,
    },
    '15M': {
      type: NotificationType.GAME_CENTER_BOOKING_REMINDER_15M,
      templateKey: 'GAME_CENTER_BOOKING_REMINDER_15M' as const,
    },
  };

  const windowConfig = windowTypeMap[windowKey];
  const idempotencyKey = `reminder:${reservationId}:${windowKey}`;

  // 1. Idempotency check: has this specific window reminder already been sent?
  const existingLog = (await notificationsRepo.findLogByIdempotencyKey(idempotencyKey)) as Record<string, unknown> | null;
  if (existingLog && existingLog.status !== 'PENDING') {
    logger.info({
      msg: 'GameCenter reminder skipped: already sent or cancelled',
      reservationId,
      window: windowKey,
      idempotencyKey,
      status: existingLog.status,
    });
    return { sent: false, reason: existingLog.status === 'CANCELLED' ? 'CANCELLED' : 'ALREADY_SENT' };
  }

  // 2. Query database fresh to re-fetch booking
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      gamingCenter: {
        include: {
          settings: true,
        },
      },
      customerAccount: true,
    },
  });

  // 3. Verify booking still exists
  if (!reservation) {
    logger.warn({
      msg: 'GameCenter reminder skipped: booking does not exist',
      reservationId,
      window: windowKey,
    });
    return { sent: false, reason: 'NOT_FOUND' };
  }

  // 4. Verify booking has not been cancelled
  if (reservation.canceledAt) {
    logger.info({
      msg: 'GameCenter reminder skipped: booking was cancelled',
      reservationId,
      window: windowKey,
      canceledAt: reservation.canceledAt,
    });
    return { sent: false, reason: 'CANCELLED' };
  }

  // 5. Verify booking status is active/confirmed
  if (
    reservation.status !== ReservationStatus.CONFIRMED &&
    reservation.status !== ReservationStatus.PENDING
  ) {
    logger.info({
      msg: 'GameCenter reminder skipped: booking status is not active or confirmed',
      reservationId,
      window: windowKey,
      status: reservation.status,
    });
    return { sent: false, reason: 'INACTIVE_STATUS' };
  }

  // 6. Verify target recipients are still valid
  const gamingCenter = reservation.gamingCenter;
  if (!gamingCenter) {
    logger.warn({
      msg: 'GameCenter reminder skipped: gaming center not found',
      reservationId,
      window: windowKey,
    });
    return { sent: false, reason: 'NO_GAMING_CENTER' };
  }

  const staffUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { gamingCenterId: gamingCenter.id },
        ...(gamingCenter.managerId ? [{ id: gamingCenter.managerId }] : []),
      ],
      role: { in: [UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.STAFF, UserRole.ADMIN] },
    },
  });

  if (staffUsers.length === 0) {
    logger.warn({
      msg: 'GameCenter reminder skipped: no valid active staff recipients found',
      reservationId,
      gamingCenterId: gamingCenter.id,
      window: windowKey,
    });
    return { sent: false, reason: 'NO_VALID_RECIPIENT' };
  }

  // 7. Format details
  const timeZone = gamingCenter.settings?.timeZone || 'UTC';
  const dateStr = formatInTimeZone(reservation.startTime, timeZone, 'yyyy/MM/dd');
  const timeStr = formatInTimeZone(reservation.startTime, timeZone, 'HH:mm');
  const stationName =
    ((reservation.stationSnapshot as Record<string, unknown>)?.name as string | undefined) || 'N/A';

  // 8. Deliver In-App notification to each authorized GameCenter recipient
  for (const staff of staffUsers) {
    await NotificationStation.notifyUser({
      gamingCenterId: gamingCenter.id,
      userId: staff.id,
      category: NotificationCategory.GAME_CENTER,
      type: windowConfig.type,
      templateKey: windowConfig.templateKey,
      templateParams: {
        bookingId: reservation.id,
        stationName,
        dateStr,
        timeStr,
        customerName: reservation.customerAccount?.fullName || 'Customer',
      },
      language: getRecipientPreferredLanguage(staff),
      metadata: { reservationId: reservation.id, window: windowKey },
      sendSms: false, // In-App only per channel rules
      entityType: 'Reservation',
      entityId: reservation.id,
    });
  }

  // 9. Record idempotency log
  if (existingLog && existingLog.id) {
    await notificationsRepo.updateNotificationLogStatus(String(existingLog.id), {
      status: 'SENT',
      sentAt: now,
    });
  } else {
    await notificationsRepo.createNotificationLog({
      gamingCenterId: gamingCenter.id,
      recipient: `gamecenter:${gamingCenter.id}`,
      category: NotificationCategory.GAME_CENTER,
      channel: 'IN_APP',
      type: windowConfig.type,
      title: `GameCenter Reminder ${windowKey}`,
      message: `Reminder for booking ${reservation.id} delivered to ${staffUsers.length} staff members.`,
      status: 'SENT',
      scheduledAt: now,
      idempotencyKey,
      entityType: 'Reservation',
      entityId: reservation.id,
    });
  }

  return { sent: true };
};

export const scheduleReservationReminders = async (
  reservationId: string,
  startTime: Date,
  gamingCenterId: string,
  now = new Date()
) => {
  const windows: Array<{ key: ReminderWindowKey; leadTimeMs: number }> = [
    { key: '24H', leadTimeMs: 24 * 60 * 60 * 1000 },
    { key: '2H', leadTimeMs: 2 * 60 * 60 * 1000 },
    { key: '15M', leadTimeMs: 15 * 60 * 1000 },
  ];

  const windowTypeMap = {
    '24H': NotificationType.GAME_CENTER_BOOKING_REMINDER_24H,
    '2H': NotificationType.GAME_CENTER_BOOKING_REMINDER_2H,
    '15M': NotificationType.GAME_CENTER_BOOKING_REMINDER_15M,
  };

  const results = [];
  for (const win of windows) {
    const scheduledTime = new Date(startTime.getTime() - win.leadTimeMs);
    const idempotencyKey = `reminder:${reservationId}:${win.key}`;

    if (scheduledTime > now) {
      try {
        const log = (await notificationsRepo.createNotificationLog({
          gamingCenterId,
          recipient: `gamecenter:${gamingCenterId}`,
          category: NotificationCategory.GAME_CENTER,
          channel: 'IN_APP',
          type: windowTypeMap[win.key],
          title: `GameCenter Reminder ${win.key}`,
          message: `Scheduled reminder for booking ${reservationId} (${win.key})`,
          status: 'PENDING',
          scheduledAt: scheduledTime,
          idempotencyKey,
          entityType: 'Reservation',
          entityId: reservationId,
        })) as Record<string, unknown>;

        const delayMs = scheduledTime.getTime() - now.getTime();
        try {
          const { queueNotificationDispatch } = await import('../../jobs/producers/notifications.producer');
          await queueNotificationDispatch(String(log.id), delayMs);
        } catch (queueErr) {
          logger.warn({ msg: 'Failed to enqueue reminder to BullMQ', logId: log.id, error: queueErr });
        }

        results.push({ window: win.key, scheduledAt: scheduledTime, scheduled: true });
      } catch (err) {
        logger.warn({
          msg: 'Failed to schedule reservation reminder log',
          reservationId,
          window: win.key,
          error: err,
        });
      }
    }
  }

  return results;
};

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

    const customerLang = getRecipientPreferredLanguage(customerAccount);

    try {
      await NotificationStation.enqueueNotificationLog({
        gamingCenterId: gamingCenter.id,
        recipient: customerAccount.phone,
        channel: NotificationChannel.SMS,
        type: NotificationType.RESERVATION_REMINDER,
        templateKey: 'RESERVATION_REMINDER_CUSTOMER',
        templateParams: {
          stationName,
          gamingCenterName: gamingCenter.name,
          dateStr,
          timeStr,
        },
        language: customerLang,
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
          templateKey: 'RESERVATION_REMINDER_STAFF',
          templateParams: {
            reservationId: reservation.id,
            stationName,
            timeStr,
          },
          language: getRecipientPreferredLanguage(staff),
          metadata: { reservationId: reservation.id },
        });
      }

      // Trigger GameCenter In-App reminder windows if applicable
      try {
        if (typeof prisma.reservation.findUnique === 'function') {
          const diffMs = reservation.startTime.getTime() - now.getTime();
          const diffMinutes = Math.round(diffMs / (60 * 1000));
          if (diffMinutes >= -5 && diffMinutes <= 25) {
            await revalidateAndSendGameCenterReminder(reservation.id, '15M', now);
          } else if (diffMinutes > 25 && diffMinutes <= 130) {
            await revalidateAndSendGameCenterReminder(reservation.id, '2H', now);
          } else if (diffMinutes > 130 && diffMinutes <= 1450) {
            await revalidateAndSendGameCenterReminder(reservation.id, '24H', now);
          }
        }
      } catch (gcErr) {
        logger.warn({ msg: 'Failed to evaluate GameCenter reminder windows during batch', error: gcErr });
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

export const processGameCenterRemindersBatch = async (options: { batchSize?: number; now?: Date } = {}) => {
  const batchSize = options.batchSize ?? env.RESERVATION_REMINDER_BATCH_SIZE;
  const now = options.now ?? new Date();

  const windows: Array<{ key: ReminderWindowKey; minMinutes: number; maxMinutes: number }> = [
    { key: '24H', minMinutes: 23 * 60, maxMinutes: 24 * 60 + 15 },
    { key: '2H', minMinutes: 105, maxMinutes: 130 },
    { key: '15M', minMinutes: -5, maxMinutes: 25 },
  ];

  let candidateCount = 0;
  let scheduledCount = 0;
  let skippedCount = 0;

  for (const win of windows) {
    const windowStart = new Date(now.getTime() + win.minMinutes * 60 * 1000);
    const windowEnd = new Date(now.getTime() + win.maxMinutes * 60 * 1000);

    const eligible = await prisma.reservation.findMany({
      where: {
        status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING] },
        startTime: { gte: windowStart, lte: windowEnd },
        canceledAt: null,
      },
      select: { id: true },
      take: batchSize,
      orderBy: { startTime: 'asc' },
    });

    candidateCount += eligible.length;

    for (const res of eligible) {
      const resResult = await revalidateAndSendGameCenterReminder(res.id, win.key, now);
      if (resResult.sent) scheduledCount++;
      else skippedCount++;
    }
  }

  return { candidateCount, scheduledCount, skippedCount };
};
