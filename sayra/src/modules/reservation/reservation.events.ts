import { AppEvents, eventEmitter } from '../../common/events/event-emitter';
import { queueAnalyticsSync } from '../../jobs/producers/analytics.producer';
import {
  Reservation,
  GamingCenter,
  Settings,
  ReservationStatus,
  UserRole,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { NotificationStation } from '../notifications/notifications.station';
import {
  NotificationTemplateKey,
  formatCurrencyAmount,
  getRecipientPreferredLanguage,
} from '../notifications/notification-i18n';
import { invalidateObsoleteReminders } from './reservation.reminders';
import { waitlistStation } from '../waitlist/waitlist.station';

type GamingCenterWithSettings = GamingCenter & { settings?: Settings | null };

const notifyOwnerAndStaff = async (
  gamingCenterId: string,
  type: NotificationType,
  templateKey: NotificationTemplateKey,
  templateParams: Record<string, string | number | undefined | null>,
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
      const language = getRecipientPreferredLanguage(manager);
      await NotificationStation.notifyUser({
        gamingCenterId,
        userId: manager.id,
        type,
        templateKey,
        templateParams,
        language,
        metadata,
        sendSms: Boolean(smsTemplateId && manager.phone),
        mobile: manager.phone,
        templateId: smsTemplateId,
        parameters: smsParams,
        idempotencyKey: `staff_notif:${type}:${manager.id}:${(metadata as Record<string, unknown>)?.reservationId || Date.now()}`,
        entityType: 'Reservation',
        entityId: String((metadata as Record<string, unknown>)?.reservationId || ''),
      });
    }
  } catch (error) {
    console.error('Failed to notify owner/staff:', error);
  }
};

const sendReservationStatusSms = async (
  reservation: Reservation,
  gamingCenter: GamingCenterWithSettings,
  customerPhone: string,
  customerName: string,
  customerLanguage?: string | null
) => {
  let templateId: number | undefined;
  let templateKey: NotificationTemplateKey = 'RESERVATION_STATUS_PENDING_CUSTOMER';

  if (reservation.status === ReservationStatus.CONFIRMED) {
    templateId = env.MELIPAYAMAK_RESERVATION_BODY_ID || env.SMSIR_RESERVATION_CONFIRMED_TEMPLATE_ID;
    templateKey = 'RESERVATION_STATUS_CONFIRMED_CUSTOMER';
  } else if (reservation.status === ReservationStatus.PENDING) {
    templateId = env.MELIPAYAMAK_RESERVATION_BODY_ID || env.SMSIR_RESERVATION_PENDING_TEMPLATE_ID;
    templateKey = 'RESERVATION_STATUS_PENDING_CUSTOMER';
  } else if (reservation.status === ReservationStatus.CANCELED) {
    templateId = env.MELIPAYAMAK_RESERVATION_BODY_ID || env.SMSIR_RESERVATION_CANCELED_TEMPLATE_ID;
    templateKey = 'RESERVATION_STATUS_CANCELED_CUSTOMER';
  }

  if (!templateId) return;

  const timeZone = gamingCenter.settings?.timeZone || 'UTC';
  const dateStr = formatInTimeZone(reservation.startTime, timeZone, 'yyyy/MM/dd');
  const timeStr = formatInTimeZone(reservation.startTime, timeZone, 'HH:mm');
  const stationName =
    ((reservation.stationSnapshot as Record<string, unknown>)?.name as string | undefined) || 'N/A';

  const parameters = [
    { name: 'CUSTOMER_NAME', value: customerName },
    { name: 'SERVICE_NAME', value: stationName },
    { name: 'DATE', value: dateStr },
    { name: 'TIME', value: timeStr },
    { name: 'SALON_NAME', value: gamingCenter.name },
  ];

  const idempotencyKey = `cust_sms:${reservation.status}:${reservation.id}`;

  try {
    await NotificationStation.enqueueNotificationLog({
      gamingCenterId: gamingCenter.id,
      recipient: customerPhone,
      channel: 'SMS',
      type:
        reservation.status === ReservationStatus.CONFIRMED
          ? NotificationType.RESERVATION_CONFIRMED
          : reservation.status === ReservationStatus.CANCELED
            ? NotificationType.RESERVATION_CANCELLED
            : NotificationType.RESERVATION_CREATED,
      templateKey,
      templateParams: { reservationId: reservation.id },
      language: customerLanguage,
      templateId,
      parameters,
      idempotencyKey,
      entityType: 'Reservation',
      entityId: reservation.id,
    });
  } catch (error) {
    console.error('Failed to queue reservation SMS outbox log:', error);
  }
};

export const initReservationEvents = () => {
  eventEmitter.on(AppEvents.RESERVATION_CREATED, async ({ reservation, gamingCenter, customerAccount }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservation.id }).catch(console.error);

    const customerLang = getRecipientPreferredLanguage(customerAccount);
    await sendReservationStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '', customerLang);

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
      'RESERVATION_CREATED_STAFF',
      { stationName, dateStr, timeStr },
      { reservationId: reservation.id, gamingCenterId: gamingCenter.id, customerAccountId: customerAccount.id },
      env.SMSIR_OWNER_RESERVATION_CREATED_TEMPLATE_ID,
      ownerSmsParams
    );
  });

  eventEmitter.on(AppEvents.RESERVATION_UPDATED, async ({ updatedReservation, oldReservation }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: updatedReservation.id }).catch(console.error);
    if (oldReservation) {
      waitlistStation.processAvailableSlot(
        oldReservation.gamingCenterId,
        oldReservation.stationId,
        oldReservation.startTime,
        oldReservation.endTime
      ).catch(console.error);
    }
  });

  eventEmitter.on(AppEvents.RESERVATION_CONFIRMED, async ({ reservation, gamingCenter, customerAccount }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservation.id }).catch(console.error);
    const customerLang = getRecipientPreferredLanguage(customerAccount);
    await sendReservationStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '', customerLang);

    await notifyOwnerAndStaff(
      gamingCenter.id,
      NotificationType.RESERVATION_CONFIRMED,
      'RESERVATION_CONFIRMED_STAFF',
      { reservationId: reservation.id },
      { reservationId: reservation.id, gamingCenterId: gamingCenter.id }
    );
  });

  eventEmitter.on(AppEvents.RESERVATION_CANCELED, async ({ reservation, gamingCenter, customerAccount }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservation.id }).catch(console.error);

    // Invalidate obsolete reminders
    await invalidateObsoleteReminders(reservation.id);

    const customerLang = getRecipientPreferredLanguage(customerAccount);
    await sendReservationStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '', customerLang);

    await notifyOwnerAndStaff(
      gamingCenter.id,
      NotificationType.RESERVATION_CANCELLED,
      'RESERVATION_CANCELLED_STAFF',
      { reservationId: reservation.id },
      { reservationId: reservation.id, gamingCenterId: gamingCenter.id }
    );

    await waitlistStation.processAvailableSlot(
      reservation.gamingCenterId,
      reservation.stationId,
      reservation.startTime,
      reservation.endTime
    ).catch(console.error);
  });

  eventEmitter.on(AppEvents.RESERVATION_EXPIRED, async ({ reservation }) => {
    if (reservation) {
      waitlistStation.processAvailableSlot(
        reservation.gamingCenterId,
        reservation.stationId,
        reservation.startTime,
        reservation.endTime
      ).catch(console.error);
    }
  });

  eventEmitter.on(AppEvents.RESERVATION_COMPLETED, async ({ reservation }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservation.id }).catch(console.error);
    await invalidateObsoleteReminders(reservation.id);
  });

  eventEmitter.on(AppEvents.RESERVATION_NOSHOW, async ({ reservation }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservation.id }).catch(console.error);
    await invalidateObsoleteReminders(reservation.id);
  });

  eventEmitter.on(AppEvents.RESERVATION_TIME_PROPOSED, async ({ reservationId, gamingCenterId, proposal }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservationId }).catch(console.error);

    // Invalidate obsolete reminders on reschedule proposal
    await invalidateObsoleteReminders(reservationId);

    if (gamingCenterId) {
      await notifyOwnerAndStaff(
        gamingCenterId,
        NotificationType.RESERVATION_TIME_PROPOSED,
        'RESERVATION_TIME_PROPOSED_STAFF',
        { reservationId },
        { reservationId, proposalId: proposal?.id }
      );
    }
  });

  eventEmitter.on(AppEvents.PAYMENT_SUCCESS, async ({ payment }) => {
    if (!payment) return;

    try {
      const reservation = payment.reservationId
        ? await prisma.reservation.findUnique({
          where: { id: payment.reservationId },
          include: { customerAccount: true, gamingCenter: true },
        })
        : null;

      if (reservation && reservation.customerAccount?.phone) {
        const customerLang = getRecipientPreferredLanguage(reservation.customerAccount);
        const formattedAmount = formatCurrencyAmount(payment.amount, payment.currency, customerLang);
        const templateId = env.SMSIR_PAYMENT_SUCCESS_TEMPLATE_ID;
        const parameters = [
          { name: 'CUSTOMER_NAME', value: reservation.customerAccount.fullName || 'Customer' },
          { name: 'AMOUNT', value: String(payment.amount) },
          { name: 'REF_CODE', value: payment.referenceCode || payment.id },
        ];

        await NotificationStation.enqueueNotificationLog({
          gamingCenterId: payment.gamingCenterId,
          recipient: reservation.customerAccount.phone,
          channel: 'SMS',
          type: NotificationType.PAYMENT_SUCCESS,
          templateKey: 'PAYMENT_SUCCESS_CUSTOMER',
          templateParams: {
            formattedAmount,
            refCode: payment.referenceCode || payment.id,
          },
          language: customerLang,
          templateId,
          parameters,
          idempotencyKey: `pay_success_sms:${payment.id}`,
          entityType: 'Payment',
          entityId: payment.id,
        });
      }
    } catch (error) {
      console.error('Failed to handle PAYMENT_SUCCESS notification event:', error);
    }
  });

  eventEmitter.on(AppEvents.PAYMENT_FAILED, async ({ payment, failureReason }) => {
    if (!payment) return;

    try {
      const reservation = payment.reservationId
        ? await prisma.reservation.findUnique({
          where: { id: payment.reservationId },
          include: { customerAccount: true, gamingCenter: true },
        })
        : null;

      if (reservation && reservation.customerAccount?.phone) {
        const customerLang = getRecipientPreferredLanguage(reservation.customerAccount);
        const formattedAmount = formatCurrencyAmount(payment.amount, payment.currency, customerLang);
        const templateId = env.SMSIR_PAYMENT_FAILED_TEMPLATE_ID;
        const parameters = [
          { name: 'CUSTOMER_NAME', value: reservation.customerAccount.fullName || 'Customer' },
          { name: 'AMOUNT', value: String(payment.amount) },
          { name: 'REASON', value: failureReason || (customerLang === 'en' ? 'Payment failed' : 'پرداخت ناموفق') },
        ];

        await NotificationStation.enqueueNotificationLog({
          gamingCenterId: payment.gamingCenterId,
          recipient: reservation.customerAccount.phone,
          channel: 'SMS',
          type: NotificationType.PAYMENT_FAILED,
          templateKey: 'PAYMENT_FAILED_CUSTOMER',
          templateParams: {
            formattedAmount,
            reason: failureReason || (customerLang === 'en' ? 'Declined' : 'تراکنش ناموفق'),
          },
          language: customerLang,
          templateId,
          parameters,
          idempotencyKey: `pay_failed_sms:${payment.id}`,
          entityType: 'Payment',
          entityId: payment.id,
        });
      }
    } catch (error) {
      console.error('Failed to handle PAYMENT_FAILED notification event:', error);
    }
  });
};
