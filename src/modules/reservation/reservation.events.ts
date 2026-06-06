import { AppEvents, eventEmitter } from '../../common/events/event-emitter';
import { queueAnalyticsSync } from '../../jobs/producers/analytics.producer';
import { queueSms } from '../../jobs/producers/sms.producer';
import { Reservation, GamingCenter, Settings, ReservationStatus } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { env } from '../../config/env';

type GamingCenterWithSettings = GamingCenter & { settings?: Settings | null };

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
    await sendReservationStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '');
  });

  eventEmitter.on(AppEvents.RESERVATION_UPDATED, async ({ updatedReservation }) => {
    // For simplicity, we sync all stats for the updated reservation
    queueAnalyticsSync({ type: 'RESERVATION', entityId: updatedReservation.id }).catch(console.error);
  });

  eventEmitter.on(AppEvents.RESERVATION_CONFIRMED, async ({ reservation, gamingCenter, customerAccount }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservation.id }).catch(console.error);
    await sendReservationStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '');
  });

  eventEmitter.on(AppEvents.RESERVATION_CANCELED, async ({ reservation, gamingCenter, customerAccount }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservation.id }).catch(console.error);
    await sendReservationStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '');
  });

  eventEmitter.on(AppEvents.RESERVATION_COMPLETED, async ({ reservation }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservation.id }).catch(console.error);
  });

  eventEmitter.on(AppEvents.RESERVATION_NOSHOW, async ({ reservation }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservation.id }).catch(console.error);
  });
};
