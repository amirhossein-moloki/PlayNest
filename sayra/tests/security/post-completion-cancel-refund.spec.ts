/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  GamingSessionStatus,
  ReservationPaymentState,
  ReservationProposalStatus,
  ReservationStatus,
  SessionActorType,
  UserRole,
} from '@prisma/client';
import { prisma } from '../../src/config/prisma';
import { CustomerPanelStation } from '../../src/modules/customer-panel/customer-panel.station';
import { CustomerPanelRepo } from '../../src/modules/customer-panel/customer-panel.repo';
import { GroupBookingStation } from '../../src/modules/group-booking/group-booking.station';
import { GroupBookingRepo } from '../../src/modules/group-booking/group-booking.repo';
import { ReservationRepo } from '../../src/modules/reservation/reservation.repo';
import { reservationLifecycle } from '../../src/modules/reservation/reservation.lifecycle';
import { walletService } from '../../src/modules/wallet/wallet.station';
import { WalletRepo } from '../../src/modules/wallet/wallet.repo';

describe('Post-Completion / Post-Start Cancellation, Reschedule & Wallet Refund Security', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('CustomerPanelStation.cancelReservation', () => {
    it('blocks customer cancellation with 409 INVALID_TRANSITION (and never refunds) for COMPLETED, NO_SHOW, EXPIRED, and IN_PROGRESS', async () => {
      const refundSpy = jest.spyOn(walletService, 'refundReservationToWallet').mockResolvedValue(undefined as any);
      const futureStart = new Date(Date.now() + 2 * 3600 * 1000);
      const futureEnd = new Date(Date.now() + 3 * 3600 * 1000);

      for (const status of [
        ReservationStatus.COMPLETED,
        ReservationStatus.NO_SHOW,
        ReservationStatus.EXPIRED,
        ReservationStatus.IN_PROGRESS,
      ]) {
        jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValueOnce({
          id: `res-${status}`,
          gamingCenterId: 'gc-1',
          customerAccountId: 'cust-1',
          status,
          startTime: futureStart,
          endTime: futureEnd,
          completedAt: status === ReservationStatus.COMPLETED ? new Date() : null,
          gamingCenter: { id: 'gc-1', settings: { cancellationWindowMinutes: 0 } },
        } as any);

        await expect(
          CustomerPanelStation.cancelReservation(`res-${status}`, 'cust-1', 'Refund abuse')
        ).rejects.toMatchObject({
          statusCode: 409,
          code: 'INVALID_TRANSITION',
        });
      }

      expect(refundSpy).not.toHaveBeenCalled();
    });

    it('blocks customer cancellation when CONFIRMED reservation endTime has already passed (RESERVATION_ALREADY_ENDED)', async () => {
      const refundSpy = jest.spyOn(walletService, 'refundReservationToWallet').mockResolvedValue(undefined as any);
      const pastStart = new Date(Date.now() - 3 * 3600 * 1000);
      const pastEnd = new Date(Date.now() - 1 * 3600 * 1000);

      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValueOnce({
        id: 'res-ended',
        gamingCenterId: 'gc-1',
        customerAccountId: 'cust-1',
        status: ReservationStatus.CONFIRMED,
        startTime: pastStart,
        endTime: pastEnd,
        completedAt: null,
        gamingCenter: { id: 'gc-1', settings: { cancellationWindowMinutes: 0 } },
      } as any);

      await expect(
        CustomerPanelStation.cancelReservation('res-ended', 'cust-1', 'Late cancel')
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'RESERVATION_ALREADY_ENDED',
      });
      expect(refundSpy).not.toHaveBeenCalled();
    });

    it('blocks customer cancellation when CONFIRMED reservation startTime has passed even when cancellationWindowMinutes === 0', async () => {
      const refundSpy = jest.spyOn(walletService, 'refundReservationToWallet').mockResolvedValue(undefined as any);
      const pastStart = new Date(Date.now() - 10 * 60 * 1000);
      const futureEnd = new Date(Date.now() + 50 * 60 * 1000);

      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValueOnce({
        id: 'res-started',
        gamingCenterId: 'gc-1',
        customerAccountId: 'cust-1',
        status: ReservationStatus.CONFIRMED,
        startTime: pastStart,
        endTime: futureEnd,
        completedAt: null,
        gamingCenter: { id: 'gc-1', settings: { cancellationWindowMinutes: 0 } },
      } as any);

      await expect(
        CustomerPanelStation.cancelReservation('res-started', 'cust-1', 'Already started')
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'RESERVATION_ALREADY_STARTED',
      });
      expect(refundSpy).not.toHaveBeenCalled();
    });

    it('blocks customer cancellation when a GamingSession already exists for the reservation', async () => {
      const refundSpy = jest.spyOn(walletService, 'refundReservationToWallet').mockResolvedValue(undefined as any);
      const futureStart = new Date(Date.now() + 2 * 3600 * 1000);
      const futureEnd = new Date(Date.now() + 3 * 3600 * 1000);

      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValueOnce({
        id: 'res-with-session',
        gamingCenterId: 'gc-1',
        customerAccountId: 'cust-1',
        status: ReservationStatus.CONFIRMED,
        startTime: futureStart,
        endTime: futureEnd,
        completedAt: null,
        gamingCenter: { id: 'gc-1', settings: { cancellationWindowMinutes: 15 } },
      } as any);

      const txMock: any = {
        $executeRaw: jest.fn(async () => 1),
        reservation: {
          findFirst: jest.fn(async () => ({
            id: 'res-with-session',
            status: ReservationStatus.CONFIRMED,
            startTime: futureStart,
            endTime: futureEnd,
            completedAt: null,
            groupBookingId: null,
            gamingCenterId: 'gc-1',
            campaignId: null,
            discountId: null,
          })),
        },
        gamingSession: {
          findFirst: jest.fn(async () => ({ id: 'sess-1', status: GamingSessionStatus.COMPLETED })),
        },
      };
      jest.spyOn(CustomerPanelRepo, 'transaction').mockImplementationOnce(async (cb: any) => cb(txMock));

      await expect(
        CustomerPanelStation.cancelReservation('res-with-session', 'cust-1', 'Session already ran')
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'RESERVATION_SESSION_STARTED',
      });
      expect(refundSpy).not.toHaveBeenCalled();
    });

    it('blocks TOCTOU race when reservation transitions to COMPLETED before lock or updateReservation returns null', async () => {
      const refundSpy = jest.spyOn(walletService, 'refundReservationToWallet').mockResolvedValue(undefined as any);
      const futureStart = new Date(Date.now() + 2 * 3600 * 1000);
      const futureEnd = new Date(Date.now() + 3 * 3600 * 1000);

      // Case 1: locked row shows COMPLETED
      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValueOnce({
        id: 'res-race-1',
        gamingCenterId: 'gc-1',
        customerAccountId: 'cust-1',
        status: ReservationStatus.CONFIRMED,
        startTime: futureStart,
        endTime: futureEnd,
        completedAt: null,
        gamingCenter: { id: 'gc-1', settings: { cancellationWindowMinutes: 15 } },
      } as any);

      const txRace1: any = {
        $executeRaw: jest.fn(async () => 1),
        reservation: {
          findFirst: jest.fn(async () => ({
            id: 'res-race-1',
            status: ReservationStatus.COMPLETED,
            startTime: futureStart,
            endTime: futureEnd,
            completedAt: new Date(),
            groupBookingId: null,
            gamingCenterId: 'gc-1',
            campaignId: null,
            discountId: null,
          })),
        },
      };
      jest.spyOn(CustomerPanelRepo, 'transaction').mockImplementationOnce(async (cb: any) => cb(txRace1));

      await expect(
        CustomerPanelStation.cancelReservation('res-race-1', 'cust-1', 'Race 1')
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'INVALID_TRANSITION',
      });

      // Case 2: updateReservation conditional WHERE returns null
      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValueOnce({
        id: 'res-race-2',
        gamingCenterId: 'gc-1',
        customerAccountId: 'cust-1',
        status: ReservationStatus.CONFIRMED,
        startTime: futureStart,
        endTime: futureEnd,
        completedAt: null,
        gamingCenter: { id: 'gc-1', settings: { cancellationWindowMinutes: 15 } },
      } as any);

      const txRace2: any = {
        $executeRaw: jest.fn(async () => 1),
        reservation: {
          findFirst: jest.fn(async () => ({
            id: 'res-race-2',
            status: ReservationStatus.CONFIRMED,
            startTime: futureStart,
            endTime: futureEnd,
            completedAt: null,
            groupBookingId: null,
            gamingCenterId: 'gc-1',
            campaignId: null,
            discountId: null,
          })),
        },
        gamingSession: {
          findFirst: jest.fn(async () => null),
        },
      };
      jest.spyOn(CustomerPanelRepo, 'transaction').mockImplementationOnce(async (cb: any) => cb(txRace2));
      jest.spyOn(CustomerPanelRepo, 'updateReservation').mockResolvedValueOnce(null);

      await expect(
        CustomerPanelStation.cancelReservation('res-race-2', 'cust-1', 'Race 2')
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'INVALID_TRANSITION',
      });
      expect(refundSpy).not.toHaveBeenCalled();
    });
  });

  describe('Reschedule-Then-Cancel & Proposal Acceptance Guards', () => {
    it('blocks customer reschedule for IN_PROGRESS, ended, already-started, inside cancellation window, and existing GamingSession', async () => {
      const futureTarget = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const customerActor = { id: 'cust-1', actorType: SessionActorType.CUSTOMER };

      // 1. IN_PROGRESS -> 409 INVALID_TRANSITION
      jest.spyOn(ReservationRepo, 'transaction').mockImplementationOnce(async (cb: any) => cb({}));
      jest.spyOn(ReservationRepo, 'lockReservationForUpdate').mockResolvedValue(undefined);
      jest.spyOn(ReservationRepo, 'findReservationById').mockResolvedValueOnce({
        id: 'res-inprog',
        gamingCenterId: 'gc-1',
        stationId: 'st-1',
        customerAccountId: 'cust-1',
        status: ReservationStatus.IN_PROGRESS,
        startTime: new Date(Date.now() + 2 * 3600 * 1000),
        endTime: new Date(Date.now() + 3 * 3600 * 1000),
      } as any);
      await expect(
        reservationLifecycle.rescheduleReservation('res-inprog', 'gc-1', { startTime: futureTarget }, customerActor)
      ).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_TRANSITION' });

      // 2. endTime <= now -> 409 RESERVATION_ALREADY_ENDED
      jest.spyOn(ReservationRepo, 'transaction').mockImplementationOnce(async (cb: any) => cb({}));
      jest.spyOn(ReservationRepo, 'findReservationById').mockResolvedValueOnce({
        id: 'res-past-end',
        gamingCenterId: 'gc-1',
        stationId: 'st-1',
        customerAccountId: 'cust-1',
        status: ReservationStatus.CONFIRMED,
        startTime: new Date(Date.now() - 3 * 3600 * 1000),
        endTime: new Date(Date.now() - 1 * 3600 * 1000),
      } as any);
      await expect(
        reservationLifecycle.rescheduleReservation('res-past-end', 'gc-1', { startTime: futureTarget }, customerActor)
      ).rejects.toMatchObject({ statusCode: 409, code: 'RESERVATION_ALREADY_ENDED' });

      // 3. startTime <= now -> 409 RESERVATION_ALREADY_STARTED
      jest.spyOn(ReservationRepo, 'transaction').mockImplementationOnce(async (cb: any) => cb({}));
      jest.spyOn(ReservationRepo, 'findReservationById').mockResolvedValueOnce({
        id: 'res-past-start',
        gamingCenterId: 'gc-1',
        stationId: 'st-1',
        customerAccountId: 'cust-1',
        status: ReservationStatus.CONFIRMED,
        startTime: new Date(Date.now() - 10 * 60 * 1000),
        endTime: new Date(Date.now() + 50 * 60 * 1000),
      } as any);
      await expect(
        reservationLifecycle.rescheduleReservation('res-past-start', 'gc-1', { startTime: futureTarget }, customerActor)
      ).rejects.toMatchObject({ statusCode: 409, code: 'RESERVATION_ALREADY_STARTED' });

      // 4. Existing GamingSession -> 409 RESERVATION_SESSION_STARTED
      jest.spyOn(ReservationRepo, 'transaction').mockImplementationOnce(async (cb: any) =>
        cb({
          gamingSession: {
            findFirst: jest.fn(async () => ({ id: 'sess-1' })),
          },
        })
      );
      jest.spyOn(ReservationRepo, 'findReservationById').mockResolvedValueOnce({
        id: 'res-session',
        gamingCenterId: 'gc-1',
        stationId: 'st-1',
        customerAccountId: 'cust-1',
        status: ReservationStatus.CONFIRMED,
        startTime: new Date(Date.now() + 2 * 3600 * 1000),
        endTime: new Date(Date.now() + 3 * 3600 * 1000),
      } as any);
      await expect(
        reservationLifecycle.rescheduleReservation('res-session', 'gc-1', { startTime: futureTarget }, customerActor)
      ).rejects.toMatchObject({ statusCode: 409, code: 'RESERVATION_SESSION_STARTED' });

      // 5. Inside cancellationWindowMinutes -> 400 CANCELLATION_DEADLINE_EXCEEDED
      jest.spyOn(ReservationRepo, 'transaction').mockImplementationOnce(async (cb: any) => cb({}));
      jest.spyOn(ReservationRepo, 'findReservationById').mockResolvedValueOnce({
        id: 'res-near',
        gamingCenterId: 'gc-1',
        stationId: 'st-1',
        staffId: null,
        customerAccountId: 'cust-1',
        status: ReservationStatus.CONFIRMED,
        paymentState: ReservationPaymentState.PAID,
        totalHours: 1,
        totalPrice: 100000,
        customerPayableAmount: 100000,
        startTime: new Date(Date.now() + 10 * 60 * 1000),
        endTime: new Date(Date.now() + 70 * 60 * 1000),
      } as any);
      jest.spyOn(ReservationRepo, 'lockStationForUpdate').mockResolvedValue(undefined);
      jest.spyOn(ReservationRepo, 'findStation').mockResolvedValueOnce({
        id: 'st-1',
        name: 'PS5',
        hourlyPrice: 100000,
        defaultDurationHours: 1,
        stationType: 'PS5',
        isActive: true,
      } as any);
      jest.spyOn(ReservationRepo, 'findGamingCenterWithSettings').mockResolvedValueOnce({
        id: 'gc-1',
        settings: { cancellationWindowMinutes: 15, minAdvanceBookingMinutes: 30, timeZone: 'UTC' },
      } as any);
      await expect(
        reservationLifecycle.rescheduleReservation('res-near', 'gc-1', { startTime: futureTarget }, customerActor)
      ).rejects.toMatchObject({ statusCode: 400, code: 'CANCELLATION_DEADLINE_EXCEEDED' });
    });

    it('blocks CustomerPanelStation.acceptProposal for IN_PROGRESS, past startTime/endTime, and existing GamingSession', async () => {
      const futureProposal = {
        id: 'prop-1',
        reservationId: 'res-1',
        status: ReservationProposalStatus.PENDING,
        proposedStartTime: new Date(Date.now() + 24 * 3600 * 1000),
        proposedEndTime: new Date(Date.now() + 25 * 3600 * 1000),
      };

      // 1. IN_PROGRESS
      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValueOnce({
        id: 'res-1',
        gamingCenterId: 'gc-1',
        customerAccountId: 'cust-1',
        status: ReservationStatus.IN_PROGRESS,
        startTime: new Date(Date.now() + 2 * 3600 * 1000),
        endTime: new Date(Date.now() + 3 * 3600 * 1000),
      } as any);
      jest.spyOn(ReservationRepo, 'findProposalById').mockResolvedValueOnce(futureProposal as any);
      await expect(
        CustomerPanelStation.acceptProposal('res-1', 'prop-1', 'cust-1')
      ).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_TRANSITION' });

      // 2. Past endTime
      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValueOnce({
        id: 'res-1',
        gamingCenterId: 'gc-1',
        customerAccountId: 'cust-1',
        status: ReservationStatus.CONFIRMED,
        startTime: new Date(Date.now() - 3 * 3600 * 1000),
        endTime: new Date(Date.now() - 1 * 3600 * 1000),
      } as any);
      jest.spyOn(ReservationRepo, 'findProposalById').mockResolvedValueOnce(futureProposal as any);
      await expect(
        CustomerPanelStation.acceptProposal('res-1', 'prop-1', 'cust-1')
      ).rejects.toMatchObject({ statusCode: 409, code: 'RESERVATION_ALREADY_ENDED' });

      // 3. Past startTime
      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValueOnce({
        id: 'res-1',
        gamingCenterId: 'gc-1',
        customerAccountId: 'cust-1',
        status: ReservationStatus.CONFIRMED,
        startTime: new Date(Date.now() - 10 * 60 * 1000),
        endTime: new Date(Date.now() + 50 * 60 * 1000),
      } as any);
      jest.spyOn(ReservationRepo, 'findProposalById').mockResolvedValueOnce(futureProposal as any);
      await expect(
        CustomerPanelStation.acceptProposal('res-1', 'prop-1', 'cust-1')
      ).rejects.toMatchObject({ statusCode: 409, code: 'RESERVATION_ALREADY_STARTED' });

      // 4. Existing GamingSession inside tx
      jest.spyOn(CustomerPanelRepo, 'findReservationById').mockResolvedValueOnce({
        id: 'res-1',
        gamingCenterId: 'gc-1',
        customerAccountId: 'cust-1',
        status: ReservationStatus.CONFIRMED,
        startTime: new Date(Date.now() + 2 * 3600 * 1000),
        endTime: new Date(Date.now() + 3 * 3600 * 1000),
      } as any);
      jest.spyOn(ReservationRepo, 'findProposalById').mockResolvedValueOnce(futureProposal as any);
      jest.spyOn(ReservationRepo, 'transaction').mockImplementationOnce(async (cb: any) =>
        cb({
          $executeRaw: jest.fn(async () => 1),
          reservation: {
            findFirst: jest.fn(async () => ({
              id: 'res-1',
              status: ReservationStatus.CONFIRMED,
              startTime: new Date(Date.now() + 2 * 3600 * 1000),
              endTime: new Date(Date.now() + 3 * 3600 * 1000),
              completedAt: null,
            })),
          },
          gamingSession: {
            findFirst: jest.fn(async () => ({ id: 'sess-1' })),
          },
        })
      );
      await expect(
        CustomerPanelStation.acceptProposal('res-1', 'prop-1', 'cust-1')
      ).rejects.toMatchObject({ statusCode: 409, code: 'RESERVATION_SESSION_STARTED' });
    });
  });

  describe('GroupBooking & Manager/Staff Cancellation Guards', () => {
    it('blocks GroupBookingStation.cancelGroupBooking (customer & manager) when a child reservation is COMPLETED, NO_SHOW, or past endTime', async () => {
      const refundSpy = jest.spyOn(walletService, 'refundReservationToWallet').mockResolvedValue(undefined as any);
      const futureStart = new Date(Date.now() + 2 * 3600 * 1000);
      const futureEnd = new Date(Date.now() + 3 * 3600 * 1000);

      const customerActor = { id: 'cust-1', actorType: SessionActorType.CUSTOMER, customerAccountId: 'cust-1' };
      const managerActor = { id: 'mgr-1', role: UserRole.MANAGER, actorType: SessionActorType.USER };

      for (const actor of [customerActor, managerActor]) {
        // Child COMPLETED even though parent GroupBooking.status was still CONFIRMED
        jest.spyOn(GroupBookingRepo, 'findGroupBookingById').mockResolvedValueOnce({
          id: 'gb-1',
          gamingCenterId: 'gc-1',
          customerAccountId: 'cust-1',
          status: ReservationStatus.CONFIRMED,
          startTime: futureStart,
          endTime: futureEnd,
          reservations: [
            { id: 'res-c1', status: ReservationStatus.COMPLETED, completedAt: new Date(), startTime: futureStart, endTime: futureEnd },
            { id: 'res-c2', status: ReservationStatus.CONFIRMED, startTime: futureStart, endTime: futureEnd },
          ],
        } as any);
        await expect(
          GroupBookingStation.cancelGroupBooking('gb-1', 'gc-1', actor, 'Abuse')
        ).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_TRANSITION' });

        // Child NO_SHOW
        jest.spyOn(GroupBookingRepo, 'findGroupBookingById').mockResolvedValueOnce({
          id: 'gb-2',
          gamingCenterId: 'gc-1',
          customerAccountId: 'cust-1',
          status: ReservationStatus.CONFIRMED,
          startTime: futureStart,
          endTime: futureEnd,
          reservations: [
            { id: 'res-c1', status: ReservationStatus.NO_SHOW, startTime: futureStart, endTime: futureEnd },
          ],
        } as any);
        await expect(
          GroupBookingStation.cancelGroupBooking('gb-2', 'gc-1', actor, 'Abuse')
        ).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_TRANSITION' });

        // Child past endTime
        jest.spyOn(GroupBookingRepo, 'findGroupBookingById').mockResolvedValueOnce({
          id: 'gb-3',
          gamingCenterId: 'gc-1',
          customerAccountId: 'cust-1',
          status: ReservationStatus.CONFIRMED,
          startTime: futureStart,
          endTime: futureEnd,
          reservations: [
            {
              id: 'res-c1',
              status: ReservationStatus.CONFIRMED,
              startTime: new Date(Date.now() - 3 * 3600 * 1000),
              endTime: new Date(Date.now() - 1 * 3600 * 1000),
            },
          ],
        } as any);
        await expect(
          GroupBookingStation.cancelGroupBooking('gb-3', 'gc-1', actor, 'Abuse')
        ).rejects.toMatchObject({ statusCode: 409, code: 'RESERVATION_ALREADY_ENDED' });
      }

      // Customer blocked when child is IN_PROGRESS or has GamingSession
      jest.spyOn(GroupBookingRepo, 'findGroupBookingById').mockResolvedValueOnce({
        id: 'gb-4',
        gamingCenterId: 'gc-1',
        customerAccountId: 'cust-1',
        status: ReservationStatus.CONFIRMED,
        startTime: futureStart,
        endTime: futureEnd,
        reservations: [
          { id: 'res-c1', status: ReservationStatus.IN_PROGRESS, startTime: futureStart, endTime: futureEnd },
        ],
      } as any);
      await expect(
        GroupBookingStation.cancelGroupBooking('gb-4', 'gc-1', customerActor, 'Abuse')
      ).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_TRANSITION' });

      jest.spyOn(GroupBookingRepo, 'findGroupBookingById').mockResolvedValueOnce({
        id: 'gb-5',
        gamingCenterId: 'gc-1',
        customerAccountId: 'cust-1',
        status: ReservationStatus.CONFIRMED,
        startTime: futureStart,
        endTime: futureEnd,
        gamingCenter: { settings: { cancellationWindowMinutes: 15 } },
        reservations: [
          { id: 'res-c1', status: ReservationStatus.CONFIRMED, startTime: futureStart, endTime: futureEnd },
        ],
      } as any);
      jest.spyOn(GroupBookingRepo, 'transaction').mockImplementationOnce(async (cb: any) =>
        cb({
          $executeRaw: jest.fn(async () => 1),
          groupBooking: {
            findFirst: jest.fn(async () => ({
              id: 'gb-5',
              status: ReservationStatus.CONFIRMED,
              startTime: futureStart,
              endTime: futureEnd,
              reservations: [
                { id: 'res-c1', status: ReservationStatus.CONFIRMED, startTime: futureStart, endTime: futureEnd },
              ],
            })),
          },
          gamingSession: {
            findFirst: jest.fn(async () => ({ id: 'sess-gb-1' })),
          },
        })
      );
      await expect(
        GroupBookingStation.cancelGroupBooking('gb-5', 'gc-1', customerActor, 'Session exists')
      ).rejects.toMatchObject({ statusCode: 409, code: 'RESERVATION_SESSION_STARTED' });

      expect(refundSpy).not.toHaveBeenCalled();
    });

    it('blocks manager/staff reservationLifecycle.cancelReservation when endTime has passed or COMPLETED GamingSession exists', async () => {
      const refundSpy = jest.spyOn(walletService, 'refundReservationToWallet').mockResolvedValue(undefined as any);
      const managerActor = { id: 'mgr-1', role: UserRole.MANAGER, actorType: SessionActorType.USER };

      for (const status of [ReservationStatus.CONFIRMED, ReservationStatus.IN_PROGRESS]) {
        jest.spyOn(ReservationRepo, 'findReservationById').mockResolvedValueOnce({
          id: `res-mgr-ended-${status}`,
          gamingCenterId: 'gc-1',
          status,
          startTime: new Date(Date.now() - 3 * 3600 * 1000),
          endTime: new Date(Date.now() - 1 * 3600 * 1000),
          completedAt: null,
        } as any);

        await expect(
          reservationLifecycle.cancelReservation(`res-mgr-ended-${status}`, 'gc-1', managerActor, { reason: 'Late' })
        ).rejects.toMatchObject({
          statusCode: 409,
          code: 'RESERVATION_ALREADY_ENDED',
        });
      }

      const futureStart = new Date(Date.now() + 2 * 3600 * 1000);
      const futureEnd = new Date(Date.now() + 3 * 3600 * 1000);
      jest.spyOn(ReservationRepo, 'findReservationById').mockResolvedValueOnce({
        id: 'res-mgr-session',
        gamingCenterId: 'gc-1',
        status: ReservationStatus.CONFIRMED,
        startTime: futureStart,
        endTime: futureEnd,
        completedAt: null,
      } as any);
      jest.spyOn(ReservationRepo, 'lockReservationForUpdate').mockResolvedValue(undefined);
      jest.spyOn(ReservationRepo, 'transaction').mockImplementationOnce(async (cb: any) =>
        cb({
          reservation: {
            findFirst: jest.fn(async () => ({
              id: 'res-mgr-session',
              status: ReservationStatus.CONFIRMED,
              endTime: futureEnd,
              completedAt: null,
              groupBookingId: null,
              campaignId: null,
              discountId: null,
            })),
          },
          gamingSession: {
            findFirst: jest.fn(async () => ({ id: 'sess-completed-1' })),
          },
        })
      );

      await expect(
        reservationLifecycle.cancelReservation('res-mgr-session', 'gc-1', managerActor, { reason: 'Session done' })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'INVALID_TRANSITION',
      });

      expect(refundSpy).not.toHaveBeenCalled();
    });
  });

  describe('Defense-in-Depth: walletService.refundReservationToWallet', () => {
    it('refuses to credit wallet for COMPLETED, NO_SHOW, IN_PROGRESS, CONFIRMED, PENDING, completedAt != null, or COMPLETED GamingSession', async () => {
      const creditSpy = jest.spyOn(walletService, 'credit').mockResolvedValue(undefined as any);
      jest.spyOn(WalletRepo, 'findRefundTransaction').mockResolvedValue(null);
      jest.spyOn(WalletRepo, 'findTotalPaidForReservation').mockResolvedValue(100000);

      const nonRefundableStatuses = [
        ReservationStatus.COMPLETED,
        ReservationStatus.NO_SHOW,
        ReservationStatus.IN_PROGRESS,
        ReservationStatus.CONFIRMED,
        ReservationStatus.PENDING,
      ];

      for (const status of nonRefundableStatuses) {
        jest.spyOn(WalletRepo, 'findReservation').mockResolvedValueOnce({
          id: `res-status-${status}`,
          customerAccountId: 'cust-1',
          status,
          completedAt: null,
          customerPayableAmount: 100000,
          stationSnapshot: { currency: 'IRR' },
        } as any);

        const txMock: any = {
          $executeRaw: jest.fn(async () => 1),
          gamingSession: { findFirst: jest.fn(async () => null) },
        };
        jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => cb(txMock));

        await walletService.refundReservationToWallet(`res-status-${status}`);
      }

      // Even if status were somehow CANCELED, completedAt != null must block refund
      jest.spyOn(WalletRepo, 'findReservation').mockResolvedValueOnce({
        id: 'res-completedAt',
        customerAccountId: 'cust-1',
        status: ReservationStatus.CANCELED,
        completedAt: new Date(),
        customerPayableAmount: 100000,
        stationSnapshot: { currency: 'IRR' },
      } as any);
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) =>
        cb({
          $executeRaw: jest.fn(async () => 1),
          gamingSession: { findFirst: jest.fn(async () => null) },
        })
      );
      await walletService.refundReservationToWallet('res-completedAt');

      // Even if status were somehow CANCELED and completedAt null, a COMPLETED GamingSession must block refund
      jest.spyOn(WalletRepo, 'findReservation').mockResolvedValueOnce({
        id: 'res-completed-session',
        customerAccountId: 'cust-1',
        status: ReservationStatus.CANCELED,
        completedAt: null,
        customerPayableAmount: 100000,
        stationSnapshot: { currency: 'IRR' },
      } as any);
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) =>
        cb({
          $executeRaw: jest.fn(async () => 1),
          gamingSession: { findFirst: jest.fn(async () => ({ id: 'sess-done-1' })) },
        })
      );
      await walletService.refundReservationToWallet('res-completed-session');

      expect(creditSpy).not.toHaveBeenCalled();
    });
  });
});
