/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SessionActorType, UserRole } from '@prisma/client';
import { BookingHoldStation } from '../../src/modules/booking-hold/booking-hold.station';
import { BookingHoldRepo } from '../../src/modules/booking-hold/booking-hold.repo';
import { reservationStation } from '../../src/modules/reservation/reservation.station';
import { ReservationRepo } from '../../src/modules/reservation/reservation.repo';
import { GroupBookingStation } from '../../src/modules/group-booking/group-booking.station';
import { GroupBookingRepo } from '../../src/modules/group-booking/group-booking.repo';
import { PaymentsStation } from '../../src/modules/payments/payments.station';
import { PaymentsRepo } from '../../src/modules/payments/payments.repo';
import { AuthRepository } from '../../src/modules/auth/auth.repository';
import { discountsStation } from '../../src/modules/discounts/discounts.station';
import { prisma } from '../../src/config/prisma';

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    customerAccount: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    gameStation: {
      findMany: jest.fn(),
    },
    customerProfile: {
      findUnique: jest.fn(),
    },
    payment: {
      findFirst: jest.fn().mockImplementation(() => Promise.resolve(null)),
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(null)),
    },
    bookingHold: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(null)),
      findFirst: jest.fn().mockImplementation(() => Promise.resolve(null)),
    },
    discount: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve([])),
    },
    discountCampaign: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve([])),
      findFirst: jest.fn().mockImplementation(() => Promise.resolve(null)),
    },
    discountUsage: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve([])),
    },
    reservationDiscount: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve([])),
    },
    stationMaintenance: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve([])),
    },
    commissionPolicy: {
      findFirst: jest.fn().mockImplementation(() => Promise.resolve(null)),
    },
    earning: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve([])),
    },
    reservation: {
      count: jest.fn().mockImplementation(() => Promise.resolve(0)),
      aggregate: jest.fn().mockImplementation(() => Promise.resolve({ _sum: { totalPrice: 0 }, _count: 0 })),
      findMany: jest.fn().mockImplementation(() => Promise.resolve([])),
    },
  },
}));

describe('SEC-004: Wallet Drain Prevention & Tautological OTP Bypass Removal', () => {
  const victimAccountId = 'ca_victim_1';
  const attackerAccountId = 'ca_attacker_2';
  const gamingCenterId = 'gc_sec4_1';
  const slug = 'sec4-arena';
  const futureStart = '2028-06-01T14:00:00Z';

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('Wallet Debit Authorization Enforcement', () => {
    it('blocks unauthenticated and cross-customer wallet debits on BookingHoldStation.checkoutGroupReservation', async () => {
      const releaseMock = jest.fn() as jest.MockedFunction<any>;
      releaseMock.mockResolvedValue({ count: 1 });
      jest.spyOn(BookingHoldStation, 'createBookingHold').mockResolvedValue({
        id: 'hold_sec4',
        gamingCenterId,
        totalAmount: 100000,
        currency: 'IRR',
        expiresAt: new Date(Date.now() + 600_000),
      } as any);
      jest.spyOn(BookingHoldRepo, 'transaction').mockImplementation(async (fn: any) =>
        fn({ bookingHold: { updateMany: releaseMock } } as any)
      );
      jest.spyOn(PaymentsRepo, 'transaction').mockImplementation(async (fn: any) =>
        fn({ bookingHold: { updateMany: releaseMock } } as any)
      );
      jest.spyOn(PaymentsRepo, 'reapStaleCustomerInitiatedPayments').mockResolvedValue(undefined as any);
      jest.spyOn(ReservationRepo, 'findCustomerAccountByPhone').mockResolvedValue({
        id: victimAccountId,
        phone: '+989120000001',
        walletBalance: 500000,
      } as any);

      // Unauthenticated caller attempting to spend victim wallet
      await expect(
        BookingHoldStation.checkoutGroupReservation(slug, {
          startTime: futureStart,
          durationMinutes: 60,
          items: [{ stationId: 'st_1' }],
          customer: { fullName: 'Victim', phone: '09120000001' },
          useWallet: true,
        })
      ).rejects.toMatchObject({ statusCode: 403, code: 'UNAUTHORIZED_WALLET_ACCESS' });
      expect(releaseMock).toHaveBeenCalled();

      // Cross-customer attacker attempting to spend victim wallet
      await expect(
        BookingHoldStation.checkoutGroupReservation(slug, {
          startTime: futureStart,
          durationMinutes: 60,
          items: [{ stationId: 'st_1' }],
          customer: { fullName: 'Victim', phone: '09120000001' },
          provider: 'WALLET',
          actor: { id: attackerAccountId, actorType: SessionActorType.CUSTOMER },
        })
      ).rejects.toMatchObject({ statusCode: 403, code: 'UNAUTHORIZED_WALLET_ACCESS' });
    });

    it('blocks unauthenticated public reservation & group booking wallet debits + staff walk-in wallet debits', async () => {
      const gc = {
        id: gamingCenterId,
        slug,
        isActive: true,
        settings: { allowOnlineBooking: true, requireOtpForPublicBooking: false, timeZone: 'UTC', minAdvanceBookingMinutes: 10 },
      };
      const station = { id: 'st_1', name: 'PS5-1', hourlyPrice: 100000, defaultDurationHours: 1, minRentHours: 1, maxRentHours: 8, stationType: 'PS5' };
      const customerAccount = { id: victimAccountId, phone: '+989120000001', walletBalance: 500000 };
      const customerProfile = { id: 'cp_victim' };
      const updateWalletSpy = jest.fn();

      const sharedTx = {
        $executeRaw: jest.fn(),
        customerAccount: { findUnique: jest.fn(), update: updateWalletSpy },
        user: { findFirst: jest.fn().mockImplementation(() => Promise.resolve({ id: 'staff_1' })) },
        discount: { findMany: jest.fn().mockImplementation(() => Promise.resolve([])) },
        discountCampaign: { findMany: jest.fn().mockImplementation(() => Promise.resolve([])), findFirst: jest.fn() },
        discountUsage: { findMany: jest.fn().mockImplementation(() => Promise.resolve([])) },
        reservationDiscount: { findMany: jest.fn().mockImplementation(() => Promise.resolve([])) },
        stationMaintenance: { findMany: jest.fn().mockImplementation(() => Promise.resolve([])) },
        commissionPolicy: { findFirst: jest.fn().mockImplementation(() => Promise.resolve(null)) },
        earning: { findMany: jest.fn().mockImplementation(() => Promise.resolve([])) },
        reservation: {
          count: jest.fn().mockImplementation(() => Promise.resolve(0)),
          aggregate: jest.fn().mockImplementation(() => Promise.resolve({ _sum: { totalPrice: 0 }, _count: 0 })),
          findMany: jest.fn().mockImplementation(() => Promise.resolve([])),
        },
        gameStationExtraController: { findMany: jest.fn().mockImplementation(() => Promise.resolve([])) },
      };
      jest.spyOn(ReservationRepo, 'transaction').mockImplementation(async (fn: any) => fn(sharedTx as any));
      jest.spyOn(discountsStation, 'calculateApplicableDiscount').mockResolvedValue({
        discountAmount: 0,
        applicableDiscount: null,
      } as any);
      jest.spyOn(GroupBookingRepo, 'transaction').mockImplementation(async (fn: any) => fn(sharedTx as any));
      jest.spyOn(ReservationRepo, 'assertActiveReservationLimitNotExceeded').mockResolvedValue(undefined as any);
      jest.spyOn(ReservationRepo, 'findGamingCenterBySlugWithSettings').mockResolvedValue(gc as any);
      jest.spyOn(ReservationRepo, 'findGamingCenterWithSettings').mockResolvedValue(gc as any);
      jest.spyOn(ReservationRepo, 'findStation').mockResolvedValue(station as any);
      jest.spyOn(ReservationRepo, 'findStaff').mockResolvedValue({ id: 'staff_1' } as any);
      jest.spyOn(ReservationRepo, 'findStaffShift').mockResolvedValue({ id: 'sh_1', startTime: '00:00', endTime: '23:59' } as any);
      jest.spyOn(ReservationRepo, 'findOverlappingReservation').mockResolvedValue(null);
      jest.spyOn(ReservationRepo, 'findCustomerAccountByPhone').mockResolvedValue(customerAccount as any);
      jest.spyOn(ReservationRepo, 'findCustomerProfile').mockResolvedValue(customerProfile as any);
      jest.spyOn(GroupBookingRepo, 'findStationsBatch').mockResolvedValue([station] as any);
      jest.spyOn(GroupBookingRepo, 'findOverlappingReservationsForStations').mockResolvedValue([]);

      // 1. Unauthenticated createPublicReservation with useWallet: true
      await expect(
        reservationStation.createPublicReservation(slug, {
          stationId: 'st_1',
          staffId: 'staff_1',
          startTime: futureStart,
          customer: { fullName: 'Victim', phone: '09120000001' },
          useWallet: true,
        } as any)
      ).rejects.toMatchObject({ statusCode: 403, code: 'UNAUTHORIZED_WALLET_ACCESS' });

      // 2. Unauthenticated createPublicGroupBooking with provider: WALLET
      await expect(
        GroupBookingStation.createPublicGroupBooking(slug, {
          startTime: futureStart,
          durationMinutes: 60,
          items: [{ stationId: 'st_1', staffId: 'staff_1' }],
          customer: { fullName: 'Victim', phone: '09120000001' },
          provider: 'WALLET',
        })
      ).rejects.toMatchObject({ statusCode: 403, code: 'UNAUTHORIZED_WALLET_ACCESS' });

      // 3. Manager/staff walk-in reservation attempting to debit victim wallet
      await expect(
        reservationStation.createReservation({
          gamingCenterId,
          stationId: 'st_1',
          staffId: 'staff_1',
          createdByUserId: 'mgr_1',
          startTime: futureStart,
          customer: { fullName: 'Victim', phone: '09120000001' },
          useWallet: true,
        })
      ).rejects.toMatchObject({ statusCode: 403, code: 'UNAUTHORIZED_WALLET_ACCESS' });

      // 4. Manager/staff walk-in group booking attempting to debit victim wallet
      await expect(
        GroupBookingStation.createGroupBooking({
          gamingCenterId,
          createdByUserId: 'mgr_1',
          startTime: futureStart,
          items: [{ stationId: 'st_1', staffId: 'staff_1' }],
          customer: { fullName: 'Victim', phone: '09120000001' },
          useWallet: true,
          actor: { id: 'mgr_1', role: UserRole.MANAGER, actorType: SessionActorType.USER },
        })
      ).rejects.toMatchObject({ statusCode: 403, code: 'UNAUTHORIZED_WALLET_ACCESS' });

      expect(updateWalletSpy).not.toHaveBeenCalled();
    });

    it('blocks USER manager and unauthenticated callers from debiting customer wallet in PaymentsStation', async () => {
      jest.spyOn(PaymentsRepo, 'findReservationForUpdate').mockResolvedValue({
        id: 'res_pay_sec4',
        gamingCenterId,
        customerAccountId: victimAccountId,
        status: 'PENDING',
        paymentState: 'UNPAID',
        totalPrice: 100000,
        customerPayableAmount: 100000,
      } as any);

      // Tenant MANAGER cannot debit customer wallet in initiatePayment
      await expect(
        PaymentsStation.initiatePayment({
          gamingCenterId,
          reservationId: 'res_pay_sec4',
          idempotencyKey: 'k1',
          useWallet: true,
          actor: { id: 'mgr_1', actorType: SessionActorType.USER, role: UserRole.MANAGER, gamingCenterId },
        })
      ).rejects.toMatchObject({ statusCode: 403, code: 'UNAUTHORIZED_WALLET_ACCESS' });

      // Unauthenticated caller cannot debit wallet via calculatePayment(useWallet: true) or initiatePayment
      await expect(
        PaymentsStation.calculatePayment({
          gamingCenterId,
          reservationId: 'res_pay_sec4',
          useWallet: true,
        })
      ).rejects.toMatchObject({ statusCode: 403, code: 'UNAUTHORIZED_WALLET_ACCESS' });
    });
  });

  describe('Tautological OTP Bypass Removal (actorCustomer.id === input.actor.id)', () => {
    it('requires OTP verification when logged-in CUSTOMER submits a different phone number across all 3 public flows', async () => {
      const gcWithOtp = {
        id: gamingCenterId,
        slug,
        isActive: true,
        settings: {
          allowOnlineBooking: true,
          requireOtpForPublicBooking: true,
          timeZone: 'UTC',
          minAdvanceBookingMinutes: 10,
        },
      };

      jest.spyOn(ReservationRepo, 'findGamingCenterBySlugWithSettings').mockResolvedValue(gcWithOtp as any);
      jest.spyOn(ReservationRepo, 'transaction').mockImplementation(async (fn: any) =>
        fn({
          customerAccount: {
            findUnique: (jest.fn() as any).mockResolvedValue({
              id: attackerAccountId,
              phone: '+989120000002',
            }),
          },
        } as any)
      );
      (prisma.customerAccount.findUnique as jest.MockedFunction<any>).mockResolvedValue({
        id: attackerAccountId,
        phone: '+989120000002',
      });
      jest.spyOn(AuthRepository, 'findRecentConsumedOtp').mockResolvedValue(null);

      // 1. BookingHoldStation.createBookingHold must reject different target phone with 401 OTP_REQUIRED
      await expect(
        BookingHoldStation.createBookingHold(slug, {
          startTime: futureStart,
          durationMinutes: 60,
          items: [{ stationId: 'st_1' }],
          customer: { fullName: 'Victim', phone: '09129999999' },
          actor: { id: attackerAccountId, actorType: SessionActorType.CUSTOMER },
        })
      ).rejects.toMatchObject({ statusCode: 401, code: 'OTP_REQUIRED' });

      // 2. reservationStation.createPublicReservation must reject different target phone with 401 OTP_REQUIRED
      await expect(
        reservationStation.createPublicReservation(slug, {
          stationId: 'st_1',
          startTime: futureStart,
          customer: { fullName: 'Victim', phone: '09129999999' },
          actor: { id: attackerAccountId, actorType: SessionActorType.CUSTOMER },
        } as any)
      ).rejects.toMatchObject({ statusCode: 401, code: 'OTP_REQUIRED' });

      // 3. GroupBookingStation.createPublicGroupBooking must reject different target phone with 401 OTP_REQUIRED
      await expect(
        GroupBookingStation.createPublicGroupBooking(slug, {
          startTime: futureStart,
          durationMinutes: 60,
          items: [{ stationId: 'st_1' }],
          customer: { fullName: 'Victim', phone: '09129999999' },
          actor: { id: attackerAccountId, actorType: SessionActorType.CUSTOMER },
        })
      ).rejects.toMatchObject({ statusCode: 401, code: 'OTP_REQUIRED' });
    });
  });
});
