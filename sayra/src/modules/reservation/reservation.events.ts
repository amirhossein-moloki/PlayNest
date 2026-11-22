import { AppEvents, eventEmitter } from '../../common/events/event-emitter';
import { queueAnalyticsSync } from '../../jobs/producers/analytics.producer';
import {
  Reservation,
  GamingCenter,
  CustomerAccount,
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
  renderLocalizedNotification,
} from '../notifications/notification-i18n';
import { invalidateObsoleteReminders, scheduleReservationReminders } from './reservation.reminders';
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
    const managers = (typeof prisma.user?.findMany === 'function'
      ? await prisma.user.findMany({
        where: {
          gamingCenterId,
          role: UserRole.MANAGER,
          isActive: true,
        },
      })
      : []) || [];

    if (!Array.isArray(managers)) return;

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

const notifyCustomerInApp = async (
  customerAccountId: string,
  type: string,
  templateKey: NotificationTemplateKey,
  templateParams: Record<string, string | number | undefined | null>,
  metadata?: Prisma.InputJsonValue,
  language?: string | null
) => {
  try {
    const localized = renderLocalizedNotification(templateKey, templateParams, language);
    await prisma.customerNotification.create({
      data: {
        customerAccountId,
        title: localized.title,
        message: localized.message,
        type,
        metadata: metadata ?? Prisma.JsonNull,
      },
    });
  } catch (error) {
    console.error('Failed to create customer in-app notification:', error);
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

    if (customerAccount?.id) {
      await notifyCustomerInApp(
        customerAccount.id,
        'RESERVATION_CREATED',
        'RESERVATION_STATUS_PENDING_CUSTOMER',
        { reservationId: reservation.id },
        { reservationId: reservation.id, gamingCenterId: gamingCenter.id },
        customerLang
      );
    }

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

    // Notify GameCenter of new booking request (In-App only)
    NotificationStation.notifyGameCenter({
      gamingCenterId: gamingCenter.id,
      type: NotificationType.GAME_CENTER_BOOKING_REQUESTED,
      templateKey: 'GAME_CENTER_BOOKING_REQUESTED',
      templateParams: {
        stationName,
        dateStr,
        timeStr,
        customerName: customerAccount.fullName || 'Customer',
      },
      metadata: { reservationId: reservation.id },
      entityType: 'Reservation',
      entityId: reservation.id,
    }).catch(console.error);

    // Schedule 24H, 2H, and 15M reminders from actual booking date/time
    scheduleReservationReminders(reservation.id, reservation.startTime, gamingCenter.id).catch(console.error);
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

    // Invalidate old scheduled reminders and reschedule for new time if updated
    if (updatedReservation?.id) {
      await invalidateObsoleteReminders(updatedReservation.id);
      if (updatedReservation.startTime && updatedReservation.gamingCenterId) {
        scheduleReservationReminders(
          updatedReservation.id,
          updatedReservation.startTime,
          updatedReservation.gamingCenterId
        ).catch(console.error);
      }
    }

    if (updatedReservation?.gamingCenterId) {
      NotificationStation.notifyGameCenter({
        gamingCenterId: updatedReservation.gamingCenterId,
        type: NotificationType.GAME_CENTER_BOOKING_UPDATED,
        templateKey: 'GAME_CENTER_BOOKING_UPDATED',
        templateParams: {
          bookingId: updatedReservation.id,
          stationName: ((updatedReservation.stationSnapshot as Record<string, unknown>)?.name as string | undefined) || 'N/A',
        },
        metadata: { reservationId: updatedReservation.id },
        entityType: 'Reservation',
        entityId: updatedReservation.id,
      }).catch(console.error);
    }
  });

  eventEmitter.on(AppEvents.RESERVATION_CONFIRMED, async ({ reservation, gamingCenter, customerAccount }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservation.id }).catch(console.error);
    const customerLang = getRecipientPreferredLanguage(customerAccount);
    await sendReservationStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '', customerLang);

    if (customerAccount?.id) {
      await notifyCustomerInApp(
        customerAccount.id,
        'RESERVATION_CONFIRMED',
        'RESERVATION_STATUS_CONFIRMED_CUSTOMER',
        { reservationId: reservation.id },
        { reservationId: reservation.id, gamingCenterId: gamingCenter.id },
        customerLang
      );
    }

    await notifyOwnerAndStaff(
      gamingCenter.id,
      NotificationType.RESERVATION_CONFIRMED,
      'RESERVATION_CONFIRMED_STAFF',
      { reservationId: reservation.id },
      { reservationId: reservation.id, gamingCenterId: gamingCenter.id }
    );

    NotificationStation.notifyGameCenter({
      gamingCenterId: gamingCenter.id,
      type: NotificationType.GAME_CENTER_BOOKING_CONFIRMED,
      templateKey: 'GAME_CENTER_BOOKING_CONFIRMED',
      templateParams: {
        bookingId: reservation.id,
        stationName: ((reservation.stationSnapshot as Record<string, unknown>)?.name as string | undefined) || 'N/A',
      },
      metadata: { reservationId: reservation.id },
      entityType: 'Reservation',
      entityId: reservation.id,
    }).catch(console.error);

    // Schedule 24H, 2H, and 15M reminders from actual booking date/time
    scheduleReservationReminders(reservation.id, reservation.startTime, gamingCenter.id).catch(console.error);
  });

  eventEmitter.on(AppEvents.RESERVATION_CANCELED, async ({ reservation, gamingCenter, customerAccount }) => {
    queueAnalyticsSync({ type: 'RESERVATION', entityId: reservation.id }).catch(console.error);

    // Invalidate obsolete reminders
    await invalidateObsoleteReminders(reservation.id);

    const customerLang = getRecipientPreferredLanguage(customerAccount);
    await sendReservationStatusSms(reservation, gamingCenter, customerAccount.phone, customerAccount.fullName || '', customerLang);

    if (customerAccount?.id) {
      await notifyCustomerInApp(
        customerAccount.id,
        'RESERVATION_CANCELLED',
        'RESERVATION_STATUS_CANCELED_CUSTOMER',
        { reservationId: reservation.id },
        { reservationId: reservation.id, gamingCenterId: gamingCenter.id },
        customerLang
      );
    }

    await notifyOwnerAndStaff(
      gamingCenter.id,
      NotificationType.RESERVATION_CANCELLED,
      'RESERVATION_CANCELLED_STAFF',
      { reservationId: reservation.id },
      { reservationId: reservation.id, gamingCenterId: gamingCenter.id }
    );

    NotificationStation.notifyGameCenter({
      gamingCenterId: gamingCenter.id,
      type: NotificationType.GAME_CENTER_BOOKING_CANCELLED,
      templateKey: 'GAME_CENTER_BOOKING_CANCELLED',
      templateParams: {
        bookingId: reservation.id,
        stationName: ((reservation.stationSnapshot as Record<string, unknown>)?.name as string | undefined) || 'N/A',
        reason: reservation.canceledReason || 'No reason specified',
      },
      metadata: { reservationId: reservation.id },
      entityType: 'Reservation',
      entityId: reservation.id,
    }).catch(console.error);

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

    if (reservationId) {
      try {
        const res = await prisma.reservation.findUnique({
          where: { id: reservationId },
          include: { customerAccount: true },
        });
        if (res?.customerAccount?.id) {
          const customerLang = getRecipientPreferredLanguage(res.customerAccount);
          await notifyCustomerInApp(
            res.customerAccount.id,
            'RESERVATION_TIME_PROPOSED',
            'RESERVATION_TIME_PROPOSED_STAFF',
            { reservationId },
            { reservationId, proposalId: proposal?.id },
            customerLang
          );
        }
      } catch (err) {
        console.error('Failed to notify customer In-App of time proposal:', err);
      }
    }
  });

  eventEmitter.on(AppEvents.PAYMENT_SUCCESS, async ({ payment }) => {
    if (!payment) return;

    try {
      let customerAccount: (CustomerAccount & { preferredLanguage?: string | null }) | null = null;
      let gamingCenter: GamingCenterWithSettings | null = null;
      let reservationId: string | undefined = payment.reservationId || undefined;
      let groupBookingId: string | undefined = payment.groupBookingId || undefined;
      const reservationsToConfirm: Reservation[] = [];

      // 1. Try resolving via reservationId
      if (payment.reservationId && typeof prisma.reservation?.findUnique === 'function') {
        const reservation = await prisma.reservation.findUnique({
          where: { id: payment.reservationId },
          include: { customerAccount: true, gamingCenter: { include: { settings: true } } },
        });
        if (reservation) {
          customerAccount = reservation.customerAccount;
          gamingCenter = reservation.gamingCenter;
          if (reservation.status === ReservationStatus.CONFIRMED) {
            reservationsToConfirm.push(reservation);
          }
        }
      }

      // 2. Try resolving via groupBookingId
      if (payment.groupBookingId && typeof prisma.groupBooking?.findUnique === 'function') {
        const groupBooking = await prisma.groupBooking.findUnique({
          where: { id: payment.groupBookingId },
          include: {
            customerAccount: true,
            gamingCenter: { include: { settings: true } },
            reservations: true,
          },
        });
        if (groupBooking) {
          if (!customerAccount) customerAccount = groupBooking.customerAccount;
          if (!gamingCenter) gamingCenter = groupBooking.gamingCenter;
          if (!reservationId && groupBooking.reservations?.length > 0) {
            reservationId = groupBooking.reservations[0].id;
          }
          if (groupBooking.status === ReservationStatus.CONFIRMED && Array.isArray(groupBooking.reservations)) {
            for (const res of groupBooking.reservations) {
              if (!reservationsToConfirm.some((r) => r.id === res.id)) {
                reservationsToConfirm.push(res);
              }
            }
          }
        }
      }

      // 3. Try resolving via bookingHoldId
      if ((!customerAccount || !groupBookingId) && payment.bookingHoldId && typeof prisma.bookingHold?.findUnique === 'function') {
        const hold = await prisma.bookingHold.findUnique({
          where: { id: payment.bookingHoldId },
          include: {
            customerAccount: true,
            gamingCenter: { include: { settings: true } },
          },
        });
        if (hold) {
          if (!customerAccount) customerAccount = hold.customerAccount;
          if (!gamingCenter) gamingCenter = hold.gamingCenter;
          if (!groupBookingId && hold.convertedGroupBookingId) {
            groupBookingId = hold.convertedGroupBookingId;
            if (typeof prisma.groupBooking?.findUnique === 'function') {
              const gb = await prisma.groupBooking.findUnique({
                where: { id: hold.convertedGroupBookingId },
                include: { reservations: true, gamingCenter: { include: { settings: true } } },
              });
              if (gb && Array.isArray(gb.reservations)) {
                if (!gamingCenter && gb.gamingCenter) gamingCenter = gb.gamingCenter;
                for (const res of gb.reservations) {
                  if (!reservationsToConfirm.some((r) => r.id === res.id)) {
                    reservationsToConfirm.push(res);
                  }
                }
              }
            }
          }
        }
      }

      // 4. Try resolving via gamingCenterId directly if needed
      if (!gamingCenter && payment.gamingCenterId && typeof prisma.gamingCenter?.findUnique === 'function') {
        gamingCenter = await prisma.gamingCenter.findUnique({
          where: { id: payment.gamingCenterId },
          include: { settings: true },
        });
      }

      if (customerAccount) {
        const customerLang = getRecipientPreferredLanguage(customerAccount);
        const formattedAmount = formatCurrencyAmount(payment.amount, payment.currency, customerLang);

        if (customerAccount.id && typeof prisma.customerNotification?.create === 'function') {
          await notifyCustomerInApp(
            customerAccount.id,
            'PAYMENT_SUCCESS',
            'PAYMENT_SUCCESS_CUSTOMER',
            {
              formattedAmount,
              refCode: payment.referenceCode || payment.id,
            },
            {
              paymentId: payment.id,
              ...(reservationId ? { reservationId } : {}),
              ...(groupBookingId ? { groupBookingId } : {}),
            },
            customerLang
          );
        }

        if (customerAccount.phone && typeof NotificationStation?.enqueueNotificationLog === 'function') {
          const templateId = env.SMSIR_PAYMENT_SUCCESS_TEMPLATE_ID;
          const parameters = [
            { name: 'CUSTOMER_NAME', value: customerAccount.fullName || 'Customer' },
            { name: 'AMOUNT', value: String(payment.amount) },
            { name: 'REF_CODE', value: payment.referenceCode || payment.id },
          ];

          await NotificationStation.enqueueNotificationLog({
            gamingCenterId: payment.gamingCenterId,
            recipient: customerAccount.phone,
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
      }

      // Emit RESERVATION_CONFIRMED for any confirmed reservations linked to this payment
      if (gamingCenter && customerAccount && reservationsToConfirm.length > 0) {
        for (const res of reservationsToConfirm) {
          eventEmitter.emit(AppEvents.RESERVATION_CONFIRMED, {
            reservation: res,
            gamingCenter,
            customerAccount,
          });
        }
      }
    } catch (error) {
      console.error('Failed to handle PAYMENT_SUCCESS notification event:', error);
    }
  });

  eventEmitter.on(AppEvents.PAYMENT_FAILED, async ({ payment, failureReason }) => {
    if (!payment) return;

    try {
      let customerAccount: (CustomerAccount & { preferredLanguage?: string | null }) | null = null;
      let reservationId: string | undefined = payment.reservationId || undefined;
      let groupBookingId: string | undefined = payment.groupBookingId || undefined;

      // 1. Try resolving via reservationId
      if (payment.reservationId && typeof prisma.reservation?.findUnique === 'function') {
        const reservation = await prisma.reservation.findUnique({
          where: { id: payment.reservationId },
          include: { customerAccount: true, gamingCenter: true },
        });
        if (reservation) {
          customerAccount = reservation.customerAccount;
        }
      }

      // 2. Try resolving via groupBookingId
      if (!customerAccount && payment.groupBookingId && typeof prisma.groupBooking?.findUnique === 'function') {
        const groupBooking = await prisma.groupBooking.findUnique({
          where: { id: payment.groupBookingId },
          include: { customerAccount: true, gamingCenter: true, reservations: { select: { id: true } } },
        });
        if (groupBooking) {
          customerAccount = groupBooking.customerAccount;
          if (!reservationId && groupBooking.reservations?.length > 0) {
            reservationId = groupBooking.reservations[0].id;
          }
        }
      }

      // 3. Try resolving via bookingHoldId
      if (!customerAccount && payment.bookingHoldId && typeof prisma.bookingHold?.findUnique === 'function') {
        const hold = await prisma.bookingHold.findUnique({
          where: { id: payment.bookingHoldId },
          include: { customerAccount: true, gamingCenter: true },
        });
        if (hold) {
          customerAccount = hold.customerAccount;
          if (!groupBookingId && hold.convertedGroupBookingId) {
            groupBookingId = hold.convertedGroupBookingId;
          }
        }
      }

      if (customerAccount) {
        const customerLang = getRecipientPreferredLanguage(customerAccount);
        const formattedAmount = formatCurrencyAmount(payment.amount, payment.currency, customerLang);

        if (customerAccount.id && typeof prisma.customerNotification?.create === 'function') {
          await notifyCustomerInApp(
            customerAccount.id,
            'PAYMENT_FAILED',
            'PAYMENT_FAILED_CUSTOMER',
            {
              formattedAmount,
              reason: failureReason || (customerLang === 'en' ? 'Declined' : 'تراکنش ناموفق'),
            },
            {
              paymentId: payment.id,
              ...(reservationId ? { reservationId } : {}),
              ...(groupBookingId ? { groupBookingId } : {}),
            },
            customerLang
          );
        }

        if (customerAccount.phone && typeof NotificationStation?.enqueueNotificationLog === 'function') {
          const templateId = env.SMSIR_PAYMENT_FAILED_TEMPLATE_ID;
          const parameters = [
            { name: 'CUSTOMER_NAME', value: customerAccount.fullName || 'Customer' },
            { name: 'AMOUNT', value: String(payment.amount) },
            { name: 'REASON', value: failureReason || (customerLang === 'en' ? 'Payment failed' : 'پرداخت ناموفق') },
          ];

          await NotificationStation.enqueueNotificationLog({
            gamingCenterId: payment.gamingCenterId,
            recipient: customerAccount.phone,
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
      }

      // Notify managers In-App of failed payment
      if (typeof NotificationStation?.notifyManagers === 'function') {
        const formattedAmount = `${payment.amount} ${payment.currency}`;
        await NotificationStation.notifyManagers({
          type: NotificationType.PAYMENT_FAILED,
          templateKey: 'PAYMENT_FAILED',
          templateParams: {
            paymentId: payment.id,
            formattedAmount,
            errorMessage: failureReason || 'Payment failed',
          },
          gamingCenterId: payment.gamingCenterId || undefined,
          entityType: 'Payment',
          entityId: payment.id,
        });
      }
    } catch (error) {
      console.error('Failed to handle PAYMENT_FAILED notification event:', error);
    }
  });
};
