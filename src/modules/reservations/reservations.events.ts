import { AppEvents, eventEmitter } from '../../common/events/event-emitter';
import { AnalyticsRepo } from '../analytics/analytics.repo';
import { SmsService } from '../notifications/sms.station';
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
    { name: 'SERVICE_NAME', value: reservation.(stationSnapshot as any) },
    { name: 'DATE', value: dateStr },
    { name: 'TIME', value: timeStr },
    { name: 'SALON_NAME', value: gamingCenter.name },
  ];

  try {
    await SmsService.sendTemplateSms(customerPhone, templateId, parameters);
  } catch (error) {
    console.error('Failed to send reservation SMS:', error);
  }
};

export const initBookingEvents = () => {
  eventEmitter.on(AppEvents.BOOKING_CREATED, async ({ reservation, gamingCenter, customerAccount }) => {
    AnalyticsRepo.syncAllStatsForBooking(reservation.id).catch(console.error);
    await sendBookingStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '');
  });

  eventEmitter.on(AppEvents.BOOKING_UPDATED, async ({ updatedBooking, oldBooking }) => {
    AnalyticsRepo.syncSpecificStats(
      oldBooking.gamingCenterId,
      oldBooking.startTime,
      oldBooking.staffId,
      oldBooking.stationId
    ).catch(console.error);

    AnalyticsRepo.syncSpecificStats(
      updatedBooking.gamingCenterId,
      updatedBooking.startTime,
      updatedBooking.staffId,
      updatedBooking.stationId
    ).catch(console.error);
  });

  eventEmitter.on(AppEvents.BOOKING_CONFIRMED, async ({ reservation, gamingCenter, customerAccount }) => {
    AnalyticsRepo.syncAllStatsForBooking(reservation.id).catch(console.error);
    await sendBookingStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '');
  });

  eventEmitter.on(AppEvents.BOOKING_CANCELED, async ({ reservation, gamingCenter, customerAccount }) => {
    AnalyticsRepo.syncAllStatsForBooking(reservation.id).catch(console.error);
    await sendBookingStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '');
  });

  eventEmitter.on(AppEvents.BOOKING_COMPLETED, async ({ reservation }) => {
    AnalyticsRepo.syncAllStatsForBooking(reservation.id).catch(console.error);
  });

  eventEmitter.on(AppEvents.BOOKING_NOSHOW, async ({ reservation }) => {
    AnalyticsRepo.syncAllStatsForBooking(reservation.id).catch(console.error);
  });
};
