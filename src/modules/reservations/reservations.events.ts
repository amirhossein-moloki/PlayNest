import { AppEvents, eventEmitter } from '../../common/events/event-emitter';
import { queueAnalyticsSync } from '../../jobs/producers/analytics.producer';
import { queueSms } from '../../jobs/producers/sms.producer';
import { Reservation, GamingCenter, Settings, ReservationStatus } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { env } from '../../config/env';

type SalonWithSettings = GamingCenter & { settings?: Settings | null };

const sendBookingStatusSms = async (reservation: Reservation, gamingCenter: SalonWithSettings, customerPhone: string, customerName: string) => {
  let templateId: number | undefined;

  if (reservation.status === ReservationStatus.CONFIRMED) {
    templateId = env.SMSIR_BOOKING_CONFIRMED_TEMPLATE_ID;
  } else if (reservation.status === ReservationStatus.PENDING) {
    templateId = env.SMSIR_BOOKING_PENDING_TEMPLATE_ID;
  } else if (reservation.status === ReservationStatus.CANCELED) {
    templateId = env.SMSIR_BOOKING_CANCELED_TEMPLATE_ID;
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

export const initBookingEvents = () => {
  eventEmitter.on(AppEvents.BOOKING_CREATED, async ({ reservation, gamingCenter, customerAccount }) => {
    queueAnalyticsSync({ type: 'BOOKING', entityId: reservation.id }).catch(console.error);
    await sendBookingStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '');
  });

  eventEmitter.on(AppEvents.BOOKING_UPDATED, async ({ updatedBooking }) => {
    // For simplicity, we sync all stats for the updated booking
    queueAnalyticsSync({ type: 'BOOKING', entityId: updatedBooking.id }).catch(console.error);
  });

  eventEmitter.on(AppEvents.BOOKING_CONFIRMED, async ({ reservation, gamingCenter, customerAccount }) => {
    queueAnalyticsSync({ type: 'BOOKING', entityId: reservation.id }).catch(console.error);
    await sendBookingStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '');
  });

  eventEmitter.on(AppEvents.BOOKING_CANCELED, async ({ reservation, gamingCenter, customerAccount }) => {
    queueAnalyticsSync({ type: 'BOOKING', entityId: reservation.id }).catch(console.error);
    await sendBookingStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '');
  });

  eventEmitter.on(AppEvents.BOOKING_COMPLETED, async ({ reservation }) => {
    queueAnalyticsSync({ type: 'BOOKING', entityId: reservation.id }).catch(console.error);
  });

  eventEmitter.on(AppEvents.BOOKING_NOSHOW, async ({ reservation }) => {
    queueAnalyticsSync({ type: 'BOOKING', entityId: reservation.id }).catch(console.error);
  });
};
