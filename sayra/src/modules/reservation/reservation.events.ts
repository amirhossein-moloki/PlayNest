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
import { invalidateObsoleteReminders } from './reservation.reminders';
import { waitlistStation } from '../waitlist/waitlist.station';

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
        gamingCenterId,
        userId: manager.id,
        type,
        title,
        message,
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
  customerName: string
) => {
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
      title: `Reservation ${reservation.status}`,
      message: `Reservation ${reservation.id} status changed to ${reservation.status}`,
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

    await sendReservationStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '');

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

    // Invalidate obsolete reminders
    await invalidateObsoleteReminders(reservation.id);

    await sendReservationStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '');

    await notifyOwnerAndStaff(
      gamingCenter.id,
      NotificationType.RESERVATION_CANCELLED,
      'Reservation Cancelled',
      `Reservation ${reservation.id} was cancelled.`,
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
        'Reservation Reschedule Proposed',
        `A new time proposal was made for reservation ${reservationId}.`,
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
          title: 'Payment Successful',
          message: `Payment of ${payment.amount} ${payment.currency} succeeded. Ref: ${payment.referenceCode || payment.id}`,
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
        const templateId = env.SMSIR_PAYMENT_FAILED_TEMPLATE_ID;
        const parameters = [
          { name: 'CUSTOMER_NAME', value: reservation.customerAccount.fullName || 'Customer' },
          { name: 'AMOUNT', value: String(payment.amount) },
          { name: 'REASON', value: failureReason || 'Payment failed' },
        ];

        await NotificationStation.enqueueNotificationLog({
          gamingCenterId: payment.gamingCenterId,
          recipient: reservation.customerAccount.phone,
          channel: 'SMS',
          type: NotificationType.PAYMENT_FAILED,
          title: 'Payment Failed',
          message: `Payment of ${payment.amount} ${payment.currency} failed. Reason: ${failureReason || 'Declined'}`,
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
