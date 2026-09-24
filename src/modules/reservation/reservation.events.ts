import { AppEvents, eventEmitter } from '../../common/events/event-emitter';
import { queueAnalyticsSync } from '../../jobs/producers/analytics.producer';
import { queueSms } from '../../jobs/producers/sms.producer';
import { Reservation, GamingCenter, Settings, ReservationStatus, UserRole, NotificationType, Prisma } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { NotificationStation } from '../notifications/notifications.station';

type GamingCenterWithSettings = GamingCenter & { settings?: Settings | null };

const notifyOwnerAndStaff = async (
  gamingCenterId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: Prisma.InputJsonValue,
  smsTemplateId?: number,
  smsParams?: Array<{ name: string; value: string }>
) => {
  try {
    const managers = await prisma.user.findMany({
      where: {
        gamingCenterId,
        role: UserRole.MANAGER,
        isActive: true,
      },
    });

    for (const manager of managers) {
      await NotificationStation.notifyUser({
        userId: manager.id,
        type,
        title,
        message,
        metadata,
        sendSms: Boolean(smsTemplateId && manager.phone),
        mobile: manager.phone,
        templateId: smsTemplateId,
        parameters: smsParams,
      });
    }
  } catch (error) {
    console.error('Failed to notify owner/staff:', error);
  }
};

const sendReservationStatusSms = async (reservation: Reservation, gamingCenter: GamingCenterWithSettings, customerPhone: string, customerName: string) => {
  let templateId: number | undefined;

  if (reservation.status === ReservationStatus.CONFIRMED) {
    templateId = env.SMSIR_RESERVATION_CONFIRMED_TEMPLATE_ID;
  } else if (reservation.status === ReservationStatus.PENDING) {
    templateId = env.SMSIR_RESERVATION_PENDING_TEMPLATE_ID;
  } else if (reservation.status === ReservationStatus.CANCELED) {
    templateId = env.SMSIR_RESERVATION_CANCELED_TEMPLATE_ID;
  }

  if (!templateId) return;

  const timeZone = gamingCenter.settings?.timeZone || 'UTC';
  const dateStr = formatInTimeZone(reservation.startTime, timeZone, 'yyyy/MM/dd');
  const timeStr = formatInTimeZone(reservation.startTime, timeZone, 'HH:mm');

  const parameters = [
    { name: 'CUSTOMER_NAME', value: customerName },
    { name: 'SERVICE_NAME', value: ((reservation.stationSnapshot as Record<string, unknown>)?.name as string | undefined || 'N/A') },
    { name: 'DATE', value: dateStr },
    { name: 'TIME', value: timeStr },
    { name: 'SALON_NAME', value: gamingCenter.name },
  ];

  try {
    await queueSms({ mobile: customerPhone, templateId, parameters });
  } catch (error) {
    console.error('Failed to queue reservation SMS:', error);
  }
};

export const initReservationEvents = () => {
  eventEmitter.on(AppEvents.RESERVATION_CREATED, async ({ reservation, gamingCenter, customerAccount }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservation.id }).catch(console.error);

    // Customer SMS
    await sendReservationStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '');

    // Owner / Manager Notification & Owner SMS
    const timeZone = gamingCenter.settings?.timeZone || 'UTC';
    const dateStr = formatInTimeZone(reservation.startTime, timeZone, 'yyyy/MM/dd');
    const timeStr = formatInTimeZone(reservation.startTime, timeZone, 'HH:mm');
    const stationName = (reservation.stationSnapshot as Record<string, unknown>)?.name as string | undefined || 'N/A';

    const ownerSmsParams = [
      { name: 'CUSTOMER_NAME', value: customerAccount.fullName || 'Customer' },
      { name: 'SERVICE_NAME', value: stationName },
      { name: 'DATE', value: dateStr },
      { name: 'TIME', value: timeStr },
      { name: 'SALON_NAME', value: gamingCenter.name },
    ];

    await notifyOwnerAndStaff(
      gamingCenter.id,
      NotificationType.RESERVATION_CREATED,
      'New Reservation Created',
      `A new reservation request has been created for your gaming center (${stationName} on ${dateStr} at ${timeStr}).`,
      { reservationId: reservation.id, gamingCenterId: gamingCenter.id, customerAccountId: customerAccount.id },
      env.SMSIR_OWNER_RESERVATION_CREATED_TEMPLATE_ID,
      ownerSmsParams
    );
  });

  eventEmitter.on(AppEvents.RESERVATION_UPDATED, async ({ updatedReservation }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: updatedReservation.id }).catch(console.error);
  });

  eventEmitter.on(AppEvents.RESERVATION_CONFIRMED, async ({ reservation, gamingCenter, customerAccount }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservation.id }).catch(console.error);
    await sendReservationStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '');

    await notifyOwnerAndStaff(
      gamingCenter.id,
      NotificationType.RESERVATION_CONFIRMED,
      'Reservation Confirmed',
      `Reservation ${reservation.id} has been confirmed.`,
      { reservationId: reservation.id, gamingCenterId: gamingCenter.id }
    );
  });

  eventEmitter.on(AppEvents.RESERVATION_CANCELED, async ({ reservation, gamingCenter, customerAccount }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservation.id }).catch(console.error);
    await sendReservationStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '');

    await notifyOwnerAndStaff(
      gamingCenter.id,
      NotificationType.RESERVATION_CANCELLED,
      'Reservation Cancelled',
      `Reservation ${reservation.id} was cancelled.`,
      { reservationId: reservation.id, gamingCenterId: gamingCenter.id }
    );
  });

  eventEmitter.on(AppEvents.RESERVATION_COMPLETED, async ({ reservation }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservation.id }).catch(console.error);
  });

  eventEmitter.on(AppEvents.RESERVATION_NOSHOW, async ({ reservation }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservation.id }).catch(console.error);
  });

  eventEmitter.on(AppEvents.RESERVATION_TIME_PROPOSED, async ({ reservationId, gamingCenterId, proposal }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservationId }).catch(console.error);

    if (gamingCenterId) {
      await notifyOwnerAndStaff(
        gamingCenterId,
        NotificationType.RESERVATION_TIME_PROPOSED,
        'Reservation Reschedule Proposed',
        `A new time proposal was made for reservation ${reservationId}.`,
        { reservationId, proposalId: proposal?.id }
      );
    }
  });
};
