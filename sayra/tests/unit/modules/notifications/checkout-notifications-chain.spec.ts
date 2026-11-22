/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  NotificationType,
  PaymentStatus,
  ReservationPaymentState,
  ReservationStatus,
} from '@prisma/client';
import { AppEvents, eventEmitter } from '../../../../src/common/events/event-emitter';
import { prisma } from '../../../../src/config/prisma';
import { NotificationStation } from '../../../../src/modules/notifications/notifications.station';
import { initReservationEvents } from '../../../../src/modules/reservation/reservation.events';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    reservation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    groupBooking: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    bookingHold: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    gamingCenter: {
      findUnique: jest.fn(),
    },
    customerNotification: {
      create: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../../../src/modules/notifications/notifications.station', () => ({
  NotificationStation: {
    enqueueNotificationLog: jest.fn().mockImplementation(() => Promise.resolve({ id: 'log-1' })),
    notifyManagers: jest.fn().mockImplementation(() => Promise.resolve([])),
    notifyUser: jest.fn().mockImplementation(() => Promise.resolve({})),
    notifyGameCenter: jest.fn().mockImplementation(() => Promise.resolve({})),
  },
}));

jest.mock('../../../../src/jobs/producers/analytics.producer', () => ({
  queueAnalyticsSync: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../../src/modules/reservation/reservation.reminders', () => ({
  scheduleReservationReminders: jest.fn().mockImplementation(() => Promise.resolve()),
  invalidateObsoleteReminders: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe('Checkout Notifications Chain & Multi-Station Events', () => {
  const gamingCenterId = 'gc-chain-1';
  const customerAccountId = 'cust-chain-1';

  const mockCustomerAccount = {
    id: customerAccountId,
    phone: '09121112233',
    fullName: 'Test Customer',
    preferredLanguage: 'fa',
  };

  const mockGamingCenter = {
    id: gamingCenterId,
    name: 'Arena One',
    settings: { timeZone: 'Asia/Tehran' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    initReservationEvents();
  });

  it('PAYMENT_SUCCESS: creates CustomerNotification and enqueues SMS when payment has groupBookingId and reservationId=null', async () => {
    const groupBookingId = 'gb-multi-1';
    const payment = {
      id: 'pay-chain-1',
      gamingCenterId,
      reservationId: null,
      groupBookingId,
      bookingHoldId: 'hold-1',
      amount: 400000,
      currency: 'IRR',
      referenceCode: 'REF-CHAIN-1',
      status: PaymentStatus.PAID,
    };

    const mockChildReservation = {
      id: 'res-child-1',
      gamingCenterId,
      status: ReservationStatus.CONFIRMED,
      paymentState: ReservationPaymentState.PAID,
      startTime: new Date('2026-12-01T14:00:00Z'),
      stationSnapshot: { name: 'PC Station 1' },
    };

    (prisma.groupBooking.findUnique as any).mockResolvedValue({
      id: groupBookingId,
      gamingCenterId,
      customerAccountId,
      status: ReservationStatus.CONFIRMED,
      customerAccount: mockCustomerAccount,
      gamingCenter: mockGamingCenter,
      reservations: [mockChildReservation],
    });

    const confirmedSpy = jest.fn();
    eventEmitter.on(AppEvents.RESERVATION_CONFIRMED, confirmedSpy);

    eventEmitter.emit(AppEvents.PAYMENT_SUCCESS, { payment });

    // Allow event listener async microtasks to run
    await new Promise((r) => setTimeout(r, 50));

    // 1. In-app CustomerNotification created
    expect(prisma.customerNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerAccountId,
          type: 'PAYMENT_SUCCESS',
          metadata: expect.objectContaining({
            paymentId: payment.id,
            groupBookingId,
          }),
        }),
      })
    );

    // 2. SMS enqueued for payment success
    expect(NotificationStation.enqueueNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        gamingCenterId,
        recipient: mockCustomerAccount.phone,
        type: NotificationType.PAYMENT_SUCCESS,
        channel: 'SMS',
      })
    );

    // 3. RESERVATION_CONFIRMED was triggered for child reservation
    expect(confirmedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        reservation: mockChildReservation,
        gamingCenter: mockGamingCenter,
        customerAccount: mockCustomerAccount,
      })
    );
  });

  it('PAYMENT_SUCCESS: creates CustomerNotification when payment only has bookingHoldId', async () => {
    const bookingHoldId = 'hold-chain-only';
    const payment = {
      id: 'pay-chain-hold',
      gamingCenterId,
      reservationId: null,
      groupBookingId: null,
      bookingHoldId,
      amount: 150000,
      currency: 'IRR',
      referenceCode: 'REF-HOLD-1',
      status: PaymentStatus.PAID,
    };

    (prisma.bookingHold.findUnique as any).mockResolvedValue({
      id: bookingHoldId,
      gamingCenterId,
      customerAccountId,
      convertedGroupBookingId: 'gb-converted-1',
      customerAccount: mockCustomerAccount,
      gamingCenter: mockGamingCenter,
    });

    (prisma.groupBooking.findUnique as any).mockResolvedValue({
      id: 'gb-converted-1',
      reservations: [],
      gamingCenter: mockGamingCenter,
    });

    eventEmitter.emit(AppEvents.PAYMENT_SUCCESS, { payment });
    await new Promise((r) => setTimeout(r, 50));

    expect(prisma.customerNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerAccountId,
          type: 'PAYMENT_SUCCESS',
        }),
      })
    );
  });

  it('PAYMENT_FAILED: creates CustomerNotification and notifies managers when payment has groupBookingId', async () => {
    const groupBookingId = 'gb-fail-1';
    const payment = {
      id: 'pay-fail-1',
      gamingCenterId,
      reservationId: null,
      groupBookingId,
      amount: 250000,
      currency: 'IRR',
      status: PaymentStatus.FAILED,
    };

    (prisma.groupBooking.findUnique as any).mockResolvedValue({
      id: groupBookingId,
      gamingCenterId,
      customerAccountId,
      customerAccount: mockCustomerAccount,
      gamingCenter: mockGamingCenter,
      reservations: [],
    });

    eventEmitter.emit(AppEvents.PAYMENT_FAILED, {
      payment,
      failureReason: 'User cancelled transaction',
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(prisma.customerNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerAccountId,
          type: 'PAYMENT_FAILED',
        }),
      })
    );

    expect(NotificationStation.notifyManagers).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.PAYMENT_FAILED,
        gamingCenterId,
        entityId: payment.id,
      })
    );
  });
});
