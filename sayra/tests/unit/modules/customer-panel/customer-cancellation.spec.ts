/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReservationStatus, CancellationCategory, CancellationActor, SessionActorType } from '@prisma/client';
import { CustomerPanelStation } from '../../../../src/modules/customer-panel/customer-panel.station';
import { CustomerPanelRepo } from '../../../../src/modules/customer-panel/customer-panel.repo';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { reservationLifecycle } from '../../../../src/modules/reservation/reservation.lifecycle';
import { walletService } from '../../../../src/modules/wallet/wallet.station';
import { auditService } from '../../../../src/modules/audit/audit.station';
import { AnalyticsRepo } from '../../../../src/modules/analytics/analytics.repo';
import { eventEmitter, AppEvents } from '../../../../src/common/events/event-emitter';
import AppError from '../../../../src/common/errors/AppError';
import httpStatus from 'http-status';

describe('Customer Pre-Confirmation Cancellation & Concurrency Tests', () => {
  const customerAccountId = 'cust-acc-101';
  const otherCustomerAccountId = 'cust-acc-999';
  const reservationId = 'res-test-202';
  const gamingCenterId = 'gc-test-100';

  const mockPendingReservation: any = {
    id: reservationId,
    customerAccountId,
    gamingCenterId,
    status: ReservationStatus.PENDING,
    startTime: new Date(Date.now() + 24 * 3600 * 1000),
    endTime: new Date(Date.now() + 26 * 3600 * 1000),
    stationId: 'st-1',
    totalHours: 2,
    totalPrice: 200,
    gamingCenter: {
      id: gamingCenterId,
      name: 'Game Arena',
      settings: { timeZone: 'Asia/Tehran' },
    },
    customerAccount: {
      id: customerAccountId,
      phone: '09120000000',
      fullName: 'Customer Test',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(auditService, 'log').mockResolvedValue(undefined as any);
    jest.spyOn(AnalyticsRepo, 'syncAllStatsForReservation').mockResolvedValue(undefined as any);
  });

  describe('Scenario 1 & 2: Ownership and Status Preconditions', () => {
    it('should successfully cancel PENDING reservation by owner customer and emit event', async () => {
      const canceledReservation = {
        ...mockPendingReservation,
        status: ReservationStatus.CANCELED,
        cancelReason: 'Change of plans',
        cancelCategory: CancellationCategory.CUSTOMER_CANCEL,
        cancelActor: CancellationActor.CUSTOMER,
      };

      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValue(mockPendingReservation);
      jest.spyOn(CustomerPanelRepo, 'transaction').mockImplementation(async (cb: any) => cb({} as any));
      jest.spyOn(CustomerPanelRepo, 'cancelPendingReservationAtomic').mockResolvedValue(canceledReservation);
      jest.spyOn(ReservationRepo, 'createHistory').mockResolvedValue({} as any);
      jest.spyOn(walletService, 'refundReservationToWallet').mockResolvedValue(undefined);
      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      const result = await CustomerPanelStation.cancelReservation(
        reservationId,
        customerAccountId,
        'Change of plans'
      );

      expect(result.status).toBe(ReservationStatus.CANCELED);
      expect(CustomerPanelRepo.cancelPendingReservationAtomic).toHaveBeenCalledWith(
        reservationId,
        customerAccountId,
        expect.objectContaining({
          status: ReservationStatus.CANCELED,
          cancelReason: 'Change of plans',
          cancelCategory: CancellationCategory.CUSTOMER_CANCEL,
          cancelActor: CancellationActor.CUSTOMER,
        }),
        expect.anything()
      );
      expect(ReservationRepo.createHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          reservationId,
          fromStatus: ReservationStatus.PENDING,
          toStatus: ReservationStatus.CANCELED,
          action: 'CANCEL_BY_CUSTOMER',
          actorId: customerAccountId,
          actorType: SessionActorType.CUSTOMER,
        }),
        expect.anything()
      );
      expect(walletService.refundReservationToWallet).toHaveBeenCalledWith(reservationId, expect.anything());
      expect(emitSpy).toHaveBeenCalledWith(AppEvents.RESERVATION_CANCELED, expect.objectContaining({
        reservation: canceledReservation,
      }));
    });

    it('should throw 404 NOT_FOUND if customer does not own the reservation', async () => {
      // Searching with otherCustomerAccountId returns null
      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValue(null);

      await expect(
        CustomerPanelStation.cancelReservation(reservationId, otherCustomerAccountId)
      ).rejects.toThrow(AppError);

      try {
        await CustomerPanelStation.cancelReservation(reservationId, otherCustomerAccountId);
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.NOT_FOUND);
      }
    });

    it('should throw 409 CONFLICT if reservation has already been CONFIRMED by owner', async () => {
      const confirmedRes = {
        ...mockPendingReservation,
        status: ReservationStatus.CONFIRMED,
      };
      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValue(confirmedRes);

      await expect(
        CustomerPanelStation.cancelReservation(reservationId, customerAccountId)
      ).rejects.toThrow(AppError);

      try {
        await CustomerPanelStation.cancelReservation(reservationId, customerAccountId);
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.CONFLICT);
        expect(err.message).toContain('already been confirmed');
      }
    });

    it('should throw 409 CONFLICT if reservation is COMPLETED or EXPIRED', async () => {
      const completedRes = {
        ...mockPendingReservation,
        status: ReservationStatus.COMPLETED,
      };
      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValue(completedRes);

      await expect(
        CustomerPanelStation.cancelReservation(reservationId, customerAccountId)
      ).rejects.toThrow(AppError);

      try {
        await CustomerPanelStation.cancelReservation(reservationId, customerAccountId);
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.CONFLICT);
      }
    });

    it('should handle idempotent cancellation without duplicate refund or history if already CANCELED', async () => {
      const alreadyCanceled = {
        ...mockPendingReservation,
        status: ReservationStatus.CANCELED,
      };
      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValue(alreadyCanceled);
      const cancelAtomicSpy = jest.spyOn(CustomerPanelRepo, 'cancelPendingReservationAtomic');
      const refundSpy = jest.spyOn(walletService, 'refundReservationToWallet');
      const historySpy = jest.spyOn(ReservationRepo, 'createHistory');

      const result = await CustomerPanelStation.cancelReservation(reservationId, customerAccountId);

      expect(result.status).toBe(ReservationStatus.CANCELED);
      expect(cancelAtomicSpy).not.toHaveBeenCalled();
      expect(refundSpy).not.toHaveBeenCalled();
      expect(historySpy).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 3: Owner Confirmation vs Cancellation Concurrency', () => {
    it('should prevent owner from confirming a reservation that was canceled by customer', async () => {
      const canceledRes = {
        ...mockPendingReservation,
        status: ReservationStatus.CANCELED,
      };
      jest.spyOn(ReservationRepo, 'findReservationById').mockResolvedValue(canceledRes);

      await expect(
        reservationLifecycle.confirmReservation(reservationId, gamingCenterId)
      ).rejects.toThrow(AppError);

      try {
        await reservationLifecycle.confirmReservation(reservationId, gamingCenterId);
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.CONFLICT);
        expect(err.message).toContain('already been canceled');
      }
    });

    it('should atomically resolve concurrent customer cancellation and owner confirmation without conflict', async () => {
      // Simulating race condition:
      // Initial state read is PENDING for both.
      // Customer cancel tx commits first, so owner updateMany finds count === 0.
      let currentStatus: ReservationStatus = ReservationStatus.PENDING;

      const mockTx: any = {
        reservation: {
          updateMany: jest.fn().mockImplementation(async ({ where }: any) => {
            if (where.status === currentStatus) {
              currentStatus = ReservationStatus.CONFIRMED;
              return { count: 1 };
            }
            return { count: 0 };
          }),
          findUnique: jest.fn().mockImplementation(async () => ({
            ...mockPendingReservation,
            status: currentStatus,
          })),
        },
      };

      jest.spyOn(ReservationRepo, 'findReservationById').mockImplementation(async () => ({
        ...mockPendingReservation,
        status: currentStatus,
      }));
      jest.spyOn(ReservationRepo, 'transaction').mockImplementation(async (cb: any) => cb(mockTx));
      jest.spyOn(ReservationRepo, 'createHistory').mockResolvedValue({} as any);

      // Suppose customer cancels first
      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockImplementation(async () => ({
        ...mockPendingReservation,
        status: currentStatus,
      }));
      jest.spyOn(CustomerPanelRepo, 'transaction').mockImplementation(async (cb: any) => cb({} as any));
      jest.spyOn(CustomerPanelRepo, 'cancelPendingReservationAtomic').mockImplementation(async () => {
        if (currentStatus === ReservationStatus.PENDING) {
          currentStatus = ReservationStatus.CANCELED;
          return { ...mockPendingReservation, status: ReservationStatus.CANCELED };
        }
        return null;
      });

      // Execute customer cancellation first
      const cancelResult = await CustomerPanelStation.cancelReservation(reservationId, customerAccountId);
      expect(cancelResult.status).toBe(ReservationStatus.CANCELED);

      // Now owner tries to confirm - must be rejected
      await expect(
        reservationLifecycle.confirmReservation(reservationId, gamingCenterId)
      ).rejects.toThrow('Cannot confirm a reservation that has already been canceled.');
    });

    it('should reject customer cancellation if owner confirmed concurrently', async () => {
      // Initially read as PENDING, but atomic update returns null because owner just confirmed
      const initialPending = { ...mockPendingReservation, status: ReservationStatus.PENDING };
      const nowConfirmed = { ...mockPendingReservation, status: ReservationStatus.CONFIRMED };

      jest.spyOn(CustomerPanelRepo, 'findReservationById')
        .mockResolvedValueOnce(initialPending) // first check
        .mockResolvedValueOnce(nowConfirmed);  // check after atomic update returns null

      jest.spyOn(CustomerPanelRepo, 'transaction').mockImplementation(async (cb: any) => cb({} as any));
      jest.spyOn(CustomerPanelRepo, 'cancelPendingReservationAtomic').mockResolvedValue(null);

      await expect(
        CustomerPanelStation.cancelReservation(reservationId, customerAccountId)
      ).rejects.toThrow('Reservation has already been confirmed by the gaming center and cannot be canceled via pre-confirmation flow');
    });
  });

  describe('Scenario 4: canCancel UI helper indicator', () => {
    it('should include canCancel === true for PENDING reservations and false for CONFIRMED/CANCELED in list', async () => {
      const reservations = [
        { ...mockPendingReservation, id: 'res-1', status: ReservationStatus.PENDING },
        { ...mockPendingReservation, id: 'res-2', status: ReservationStatus.CONFIRMED },
        { ...mockPendingReservation, id: 'res-3', status: ReservationStatus.CANCELED },
      ];

      jest.spyOn(CustomerPanelRepo, 'findManyReservation').mockResolvedValue(reservations);
      jest.spyOn(CustomerPanelRepo, 'countReservation').mockResolvedValue(3);

      const result = await CustomerPanelStation.getReservation(customerAccountId, {});

      expect(result.data).toHaveLength(3);
      expect(result.data[0].canCancel).toBe(true);
      expect(result.data[1].canCancel).toBe(false);
      expect(result.data[2].canCancel).toBe(false);
    });

    it('should include canCancel in getReservationDetails', async () => {
      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValue({
        ...mockPendingReservation,
        status: ReservationStatus.PENDING,
      });

      const result = await CustomerPanelStation.getReservationDetails(reservationId, customerAccountId);
      expect(result.canCancel).toBe(true);
    });
  });
});
