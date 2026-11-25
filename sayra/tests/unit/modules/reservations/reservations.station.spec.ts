import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { reservationStation } from '../../../../src/modules/reservation/reservation.station';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { discountsStation } from '../../../../src/modules/discounts/discounts.station';
import { walletService } from '../../../../src/modules/wallet/wallet.station';
import { eventEmitter } from '../../../../src/common/events/event-emitter';
import { ReservationStatus, ReservationPaymentState, SessionActorType, UserRole } from '@prisma/client';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    customerAccount: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('../../../../src/modules/payments/payments.repo', () => ({
  PaymentsRepo: {
    reapStaleCustomerInitiatedPayments: jest.fn().mockImplementation(() => Promise.resolve()),
  },
}));
jest.mock('../../../../src/modules/payments/ledger.repo', () => ({
  LedgerRepo: {
    createCollectionEntry: jest.fn().mockImplementation(() => Promise.resolve({})),
  },
}));
jest.mock('../../../../src/modules/reservation/reservation.repo');
jest.mock('../../../../src/modules/auth/auth.repository');
jest.mock('../../../../src/modules/wallet/wallet.station');
jest.mock('../../../../src/modules/commissions/commissions.station', () => ({
  commissionsStation: {
    calculateCommission: jest.fn().mockImplementation(() => Promise.resolve()),
  },
}));
jest.mock('../../../../src/modules/audit/audit.station');
jest.mock('../../../../src/common/events/event-emitter');
jest.mock('../../../../src/modules/discounts/discounts.station');

const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;
const MockedwalletService = walletService as jest.Mocked<typeof walletService>;
const MockedEventEmitter = eventEmitter as jest.Mocked<typeof eventEmitter>;
const MockedDiscountsStation = discountsStation as jest.Mocked<typeof discountsStation>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('reservationstationStation', () => {
  const gamingCenterId = 'gc-1';
  const stationId = 'st-1';
  const staffId = 'u-1';
  const customerId = 'ca-1';
  const profileId = 'cp-1';

  beforeEach(() => {
    jest.clearAllMocks();
    MockedReservationRepo.transaction.mockImplementation(async (fn) => fn({} as any));
    MockedDiscountsStation.calculateApplicableDiscount.mockResolvedValue({ applicableDiscount: null, discountAmount: 0 });
  });

  describe('createReservation', () => {
    const input = {
      gamingCenterId,
      stationId,
      staffId,
      customer: { fullName: 'John Doe', phone: '09123456789' },
      startTime: '2023-12-01T10:00:00Z',
      createdByUserId: 'u-admin',
    };

    it('should create a reservation successfully', async () => {
      const station = { id: stationId, name: 'PS5', defaultDurationHours: 1, hourlyPrice: 50, stationType: 'CONSOLE' };
      const staff = { id: staffId };
      const customerAccount = { id: customerId, phone: '09123456789' };
      const customerProfile = { id: profileId };
      const gamingCenter = { id: gamingCenterId, settings: {} };
      const reservation = { id: 'res-1', ...input, status: ReservationStatus.CONFIRMED };

      MockedReservationRepo.findStation.mockResolvedValue(station as any);
      MockedReservationRepo.findStaff.mockResolvedValue(staff as any);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue(customerAccount as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue(customerProfile as any);
      MockedReservationRepo.findGamingCenterWithSettings.mockResolvedValue(gamingCenter as any);
      MockedReservationRepo.createReservation.mockResolvedValue(reservation as any);

      const result = await reservationStation.createReservation(input);

      expect(result).toEqual(reservation);
      expect(MockedEventEmitter.emit).toHaveBeenCalledWith('reservation.created', expect.anything());
    });

    it('should forbid panel walk-in reservation from debiting customer wallet balance directly', async () => {
      const station = { id: stationId, name: 'PS5', defaultDurationHours: 1, hourlyPrice: 50000, stationType: 'CONSOLE' };
      const staff = { id: staffId };
      const customerAccount = { id: customerId, phone: '09123456789' };
      const customerProfile = { id: profileId };
      const gamingCenter = { id: gamingCenterId, settings: {} };

      const txMock = {
        $executeRaw: jest.fn().mockImplementation(() => Promise.resolve(1)),
        customerAccount: {
          findUnique: jest.fn().mockImplementation(() => Promise.resolve({ walletBalance: 10000 })),
          update: jest.fn(),
        },
      };

      MockedReservationRepo.transaction.mockImplementationOnce(async (fn) => fn(txMock as any));
      MockedReservationRepo.findStation.mockResolvedValue(station as any);
      MockedReservationRepo.findStaff.mockResolvedValue(staff as any);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue(customerAccount as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue(customerProfile as any);
      MockedReservationRepo.findGamingCenterWithSettings.mockResolvedValue(gamingCenter as any);

      await expect(
        reservationStation.createReservation({ ...input, useWallet: true })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'UNAUTHORIZED_WALLET_ACCESS',
      });

      expect(MockedReservationRepo.createReservation).not.toHaveBeenCalled();
      expect(txMock.customerAccount.update).not.toHaveBeenCalled();
    });

    it('should forbid panel walk-in reservation with provider=WALLET without debiting wallet balance', async () => {
      const station = { id: stationId, name: 'PS5', defaultDurationHours: 1, hourlyPrice: 50000, stationType: 'CONSOLE' };
      const staff = { id: staffId };
      const customerAccount = { id: customerId, phone: '09123456789' };
      const customerProfile = { id: profileId };
      const gamingCenter = { id: gamingCenterId, settings: {} };

      const txMock = {
        $executeRaw: jest.fn().mockImplementation(() => Promise.resolve(1)),
        customerAccount: {
          findUnique: jest.fn().mockImplementation(() => Promise.resolve({ walletBalance: 80000 })),
          update: jest.fn(),
        },
      };

      MockedReservationRepo.transaction.mockImplementationOnce(async (fn) => fn(txMock as any));
      MockedReservationRepo.findStation.mockResolvedValue(station as any);
      MockedReservationRepo.findStaff.mockResolvedValue(staff as any);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue(customerAccount as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue(customerProfile as any);
      MockedReservationRepo.findGamingCenterWithSettings.mockResolvedValue(gamingCenter as any);

      await expect(
        reservationStation.createReservation({ ...input, provider: 'WALLET' })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'UNAUTHORIZED_WALLET_ACCESS',
      });

      expect(MockedReservationRepo.createReservation).not.toHaveBeenCalled();
      expect(txMock.customerAccount.update).not.toHaveBeenCalled();
    });
  });

  describe('createPublicReservation', () => {
    const gamingCenterSlug = 'my-gamingCenter';
    const input = {
      stationId,
      staffId,
      startTime: '2027-06-06T10:00:00Z',
      customer: { fullName: 'Jane Doe', phone: '09123456789' },
    };

    it('should create a public reservation successfully', async () => {
      const gamingCenter = { id: gamingCenterId, settings: { allowOnlineBooking: true, timeZone: 'UTC' } };
      const station = { id: stationId, name: 'PS5', defaultDurationHours: 1, hourlyPrice: 50, stationType: 'CONSOLE' };
      const staff = { id: staffId };
      const staffShift = { id: 'shift-1', startTime: '08:00', endTime: '22:00' };
      const customerAccount = { id: customerId, phone: '09123456789' };
      const customerProfile = { id: profileId };
      const reservation = { id: 'res-1', status: ReservationStatus.PENDING };

      MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue(gamingCenter as any);
      MockedReservationRepo.findStation.mockResolvedValue(station as any);
      MockedReservationRepo.findStaff.mockResolvedValue(staff as any);
      MockedReservationRepo.findStaffShift.mockResolvedValue(staffShift as any);
      MockedReservationRepo.findOverlappingReservation.mockResolvedValue(null);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue(customerAccount as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue(customerProfile as any);
      MockedReservationRepo.createReservation.mockResolvedValue(reservation as any);

      const result = await reservationStation.createPublicReservation(gamingCenterSlug, input);

      expect(result).toEqual(reservation);
      expect(MockedReservationRepo.createReservation).toHaveBeenCalledWith(
        expect.objectContaining({
          totalHours: 1,
        }),
        expect.anything()
      );
    });

    it('should support multiple hours when durationHours is provided', async () => {
      const gamingCenter = { id: gamingCenterId, settings: { allowOnlineBooking: true, timeZone: 'UTC' } };
      const station = { id: stationId, name: 'PS5', defaultDurationHours: 1, hourlyPrice: 50, stationType: 'CONSOLE' };
      const staff = { id: staffId };
      const staffShift = { id: 'shift-1', startTime: '08:00', endTime: '22:00' };
      const customerAccount = { id: customerId, phone: '09123456789' };
      const customerProfile = { id: profileId };
      const reservation = { id: 'res-multi', status: ReservationStatus.PENDING };

      MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue(gamingCenter as any);
      MockedReservationRepo.findStation.mockResolvedValue(station as any);
      MockedReservationRepo.findStaff.mockResolvedValue(staff as any);
      MockedReservationRepo.findStaffShift.mockResolvedValue(staffShift as any);
      MockedReservationRepo.findOverlappingReservation.mockResolvedValue(null);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue(customerAccount as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue(customerProfile as any);
      MockedReservationRepo.createReservation.mockResolvedValue(reservation as any);

      const result = await reservationStation.createPublicReservation(gamingCenterSlug, {
        ...input,
        durationHours: 3,
      });

      expect(result).toEqual(reservation);
      expect(MockedReservationRepo.createReservation).toHaveBeenCalledWith(
        expect.objectContaining({
          totalHours: 3,
          endTime: new Date('2027-06-06T13:00:00Z'),
          customerPayableAmount: 150,
        }),
        expect.anything()
      );
    });

    it('should reject createPublicReservation with useWallet or provider=WALLET when wallet balance is insufficient without creating reservation', async () => {
      const gamingCenter = { id: gamingCenterId, settings: { allowOnlineBooking: true, onlineBookingAutoConfirm: true, timeZone: 'UTC' } };
      const station = { id: stationId, name: 'PS5', defaultDurationHours: 1, hourlyPrice: 50000, stationType: 'CONSOLE' };
      const staff = { id: staffId };
      const staffShift = { id: 'shift-1', startTime: '08:00', endTime: '22:00' };
      const customerAccount = { id: customerId, phone: '09123456789' };
      const customerProfile = { id: profileId };

      const txMock = {
        $executeRaw: jest.fn().mockImplementation(() => Promise.resolve(1)),
        customerAccount: {
          findUnique: jest.fn().mockImplementation(() => Promise.resolve({ walletBalance: 10000 })),
          update: jest.fn(),
        },
      };

      MockedReservationRepo.transaction.mockImplementation(async (fn) => fn(txMock as any));
      MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue(gamingCenter as any);
      MockedReservationRepo.findStation.mockResolvedValue(station as any);
      MockedReservationRepo.findStaff.mockResolvedValue(staff as any);
      MockedReservationRepo.findStaffShift.mockResolvedValue(staffShift as any);
      MockedReservationRepo.findOverlappingReservation.mockResolvedValue(null);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue(customerAccount as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue(customerProfile as any);

      const ownerActor = { id: customerId, actorType: SessionActorType.CUSTOMER } as any;

      await expect(
        reservationStation.createPublicReservation(gamingCenterSlug, { ...input, useWallet: true, actor: ownerActor })
      ).rejects.toMatchObject({ statusCode: 400, code: 'INSUFFICIENT_WALLET_BALANCE' });

      await expect(
        reservationStation.createPublicReservation(gamingCenterSlug, { ...input, provider: 'WALLET', actor: ownerActor })
      ).rejects.toMatchObject({ statusCode: 400, code: 'INSUFFICIENT_WALLET_BALANCE' });

      expect(MockedReservationRepo.createReservation).not.toHaveBeenCalled();
      expect(txMock.customerAccount.update).not.toHaveBeenCalled();
    });

    it('should deduct wallet and set PAID/CONFIRMED when useWallet is true with sufficient balance', async () => {
      const gamingCenter = { id: gamingCenterId, settings: { allowOnlineBooking: true, onlineBookingAutoConfirm: true, timeZone: 'UTC' } };
      const station = { id: stationId, name: 'PS5', defaultDurationHours: 1, hourlyPrice: 50000, stationType: 'CONSOLE' };
      const staff = { id: staffId };
      const staffShift = { id: 'shift-1', startTime: '08:00', endTime: '22:00' };
      const customerAccount = { id: customerId, phone: '09123456789' };
      const customerProfile = { id: profileId };
      const createdRes = { id: 'res-w-1', gamingCenterId, status: ReservationStatus.CONFIRMED, paymentState: ReservationPaymentState.PAID };

      const txMock = {
        $executeRaw: jest.fn().mockImplementation(() => Promise.resolve(1)),
        customerAccount: {
          findUnique: jest.fn().mockImplementation(() => Promise.resolve({ walletBalance: 100000 })),
          update: jest.fn().mockImplementation(() => Promise.resolve({ walletBalance: 50000 })),
        },
        payment: {
          create: jest.fn().mockImplementation(() => Promise.resolve({ id: 'pay-w-1' })),
        },
        walletTransaction: {
          create: jest.fn().mockImplementation(() => Promise.resolve({ id: 'wtx-w-1' })),
        },
      };

      MockedReservationRepo.transaction.mockImplementationOnce(async (fn) => fn(txMock as any));
      MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue(gamingCenter as any);
      MockedReservationRepo.findStation.mockResolvedValue(station as any);
      MockedReservationRepo.findStaff.mockResolvedValue(staff as any);
      MockedReservationRepo.findStaffShift.mockResolvedValue(staffShift as any);
      MockedReservationRepo.findOverlappingReservation.mockResolvedValue(null);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue(customerAccount as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue(customerProfile as any);
      MockedReservationRepo.createReservation.mockResolvedValue(createdRes as any);

      const result = await reservationStation.createPublicReservation(gamingCenterSlug, {
        ...input,
        useWallet: true,
        actor: { id: customerId, actorType: SessionActorType.CUSTOMER } as any,
      });

      expect(result.paymentState).toBe(ReservationPaymentState.PAID);
      expect(result.status).toBe(ReservationStatus.CONFIRMED);
      expect(txMock.customerAccount.update).toHaveBeenCalledWith({
        where: { id: customerId },
        data: { walletBalance: { decrement: 50000 } },
      });
    });

    it('should forbid authenticated customer from spending another account wallet via different phone number', async () => {
      const gamingCenter = { id: gamingCenterId, settings: { allowOnlineBooking: true, timeZone: 'UTC' } };
      const station = { id: stationId, name: 'PS5', defaultDurationHours: 1, hourlyPrice: 50000, stationType: 'CONSOLE' };
      const staff = { id: staffId };
      const staffShift = { id: 'shift-1', startTime: '08:00', endTime: '22:00' };
      const victimAccount = { id: 'victim-ca', phone: '+989120000000' };
      const victimProfile = { id: 'victim-cp' };

      MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue(gamingCenter as any);
      MockedReservationRepo.findStation.mockResolvedValue(station as any);
      MockedReservationRepo.findStaff.mockResolvedValue(staff as any);
      MockedReservationRepo.findStaffShift.mockResolvedValue(staffShift as any);
      MockedReservationRepo.findOverlappingReservation.mockResolvedValue(null);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue(victimAccount as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue(victimProfile as any);

      await expect(
        reservationStation.createPublicReservation(gamingCenterSlug, {
          ...input,
          useWallet: true,
          actor: { id: 'attacker-ca', actorType: SessionActorType.CUSTOMER } as any,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'UNAUTHORIZED_WALLET_ACCESS',
      });

      expect(MockedReservationRepo.createReservation).not.toHaveBeenCalled();
    });

    it('should keep unpaid payable online reservation PENDING with expiresAt even when onlineBookingAutoConfirm is true', async () => {
      const gamingCenter = {
        id: gamingCenterId,
        settings: {
          allowOnlineBooking: true,
          onlineBookingAutoConfirm: true,
          autoReleaseUnpaidMinutes: 15,
          reservationConfirmationTimeoutMinutes: 30,
          timeZone: 'UTC',
        },
      };
      const station = { id: stationId, name: 'PS5', defaultDurationHours: 1, hourlyPrice: 50000, stationType: 'CONSOLE' };
      const staff = { id: staffId };
      const staffShift = { id: 'shift-1', startTime: '08:00', endTime: '22:00' };
      const customerAccount = { id: customerId, phone: '09123456789' };
      const customerProfile = { id: profileId };
      const createdRes = { id: 'res-unpaid', status: ReservationStatus.PENDING, paymentState: ReservationPaymentState.UNPAID };

      MockedReservationRepo.findGamingCenterBySlugWithSettings.mockResolvedValue(gamingCenter as any);
      MockedReservationRepo.findStation.mockResolvedValue(station as any);
      MockedReservationRepo.findStaff.mockResolvedValue(staff as any);
      MockedReservationRepo.findStaffShift.mockResolvedValue(staffShift as any);
      MockedReservationRepo.findOverlappingReservation.mockResolvedValue(null);
      MockedReservationRepo.findCustomerAccountByPhone.mockResolvedValue(customerAccount as any);
      MockedReservationRepo.findCustomerProfile.mockResolvedValue(customerProfile as any);
      MockedReservationRepo.createReservation.mockResolvedValue(createdRes as any);

      await reservationStation.createPublicReservation(gamingCenterSlug, input);

      expect(MockedReservationRepo.createReservation).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ReservationStatus.PENDING,
          paymentState: ReservationPaymentState.UNPAID,
          expiresAt: expect.any(Date),
          confirmationExpiresAt: expect.any(Date),
        }),
        expect.anything()
      );
    });
  });

  describe('updateReservation', () => {
    const reservationId = 'res-1';
    const actor = { id: 'u-admin', actorType: SessionActorType.USER };

    it('should update reservation successfully', async () => {
      const reservation = { id: reservationId, status: ReservationStatus.CONFIRMED, stationId, staffId, startTime: new Date(), totalHours: 1, stationSnapshot: { hourlyPrice: 50 } };
      const data = { note: 'Updated note' };
      const updated = { ...reservation, ...data };

      MockedReservationRepo.findReservationById.mockResolvedValue(reservation as any);
      MockedReservationRepo.updateReservation.mockResolvedValue(updated as any);

      const result = await reservationStation.updateReservation(reservationId, gamingCenterId, data, actor);

      expect(result).toEqual(updated);
    });
  });

  describe('cancelReservation', () => {
    const reservationId = 'res-1';
    const actor = { id: 'u-admin', role: UserRole.MANAGER, actorType: SessionActorType.USER };

    it('should cancel reservation and trigger refund', async () => {
      const reservation = { id: reservationId, status: ReservationStatus.CONFIRMED, gamingCenterId };
      const updated = { ...reservation, status: ReservationStatus.CANCELED };

      MockedReservationRepo.findReservationById.mockResolvedValue(reservation as any);
      MockedReservationRepo.updateReservationWithInclude.mockResolvedValue(updated as any);

      const result = await reservationStation.cancelReservation(reservationId, gamingCenterId, actor, { reason: 'Test' });

      expect(result.status).toBe(ReservationStatus.CANCELED);
      expect(MockedwalletService.refundReservationToWallet).toHaveBeenCalledWith(reservationId, expect.anything());
    });
  });
});
