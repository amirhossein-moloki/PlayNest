import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { reservationLifecycle } from '../../../../src/modules/reservation/reservation.lifecycle';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { GamingSessionsRepo } from '../../../../src/modules/gamingSessions/gamingSessions.repo';
import { gamingSessionsStation } from '../../../../src/modules/gamingSessions/gamingSessions.station';
import { walletService } from '../../../../src/modules/wallet/wallet.station';
import { eventEmitter, AppEvents } from '../../../../src/common/events/event-emitter';
import {
  GamingSessionStatus,
  ReservationPaymentState,
  ReservationSource,
  ReservationStatus,
  SessionActorType,
  UserRole,
} from '@prisma/client';
import AppError from '../../../../src/common/errors/AppError';

jest.mock('../../../../src/modules/reservation/reservation.repo');
jest.mock('../../../../src/modules/gamingSessions/gamingSessions.repo');
jest.mock('../../../../src/modules/gamingSessions/gamingSessions.station');
jest.mock('../../../../src/modules/wallet/wallet.station');
jest.mock('../../../../src/modules/commissions/commissions.station', () => ({
  commissionsStation: { calculateCommission: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) },
}));
jest.mock('../../../../src/modules/audit/audit.station', () => ({
  auditService: { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) },
}));
jest.mock('../../../../src/common/events/event-emitter', () => ({
  AppEvents: {
    RESERVATION_EXPIRED: 'reservation.expired',
    RESERVATION_CANCELED: 'reservation.canceled',
    RESERVATION_COMPLETED: 'reservation.completed',
    RESERVATION_CONFIRMED: 'reservation.confirmed',
    RESERVATION_NOSHOW: 'reservation.noshow',
  },
  eventEmitter: { emit: jest.fn() },
}));

const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;
const MockedGamingSessionsRepo = GamingSessionsRepo as jest.Mocked<typeof GamingSessionsRepo>;
const MockedGamingSessionsStation = gamingSessionsStation as jest.Mocked<typeof gamingSessionsStation>;
const MockedWalletService = walletService as jest.Mocked<typeof walletService>;
const MockedEventEmitter = eventEmitter as jest.Mocked<typeof eventEmitter>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Reservation Lifecycle Improvements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockedReservationRepo.transaction.mockImplementation(async (fn: any) => fn({}));
  });

  it('confirmReservation should commit EXPIRED status, refund wallet, emit event, and throw CONFIRMATION_EXPIRED when deadline passed', async () => {
    const pastDeadline = new Date(Date.now() - 60_000);
    MockedReservationRepo.findReservationById.mockResolvedValue({
      id: 'res-exp',
      gamingCenterId: 'gc-1',
      status: ReservationStatus.PENDING,
      confirmationExpiresAt: pastDeadline,
      expiresAt: pastDeadline,
    } as any);
    MockedReservationRepo.updateReservation.mockResolvedValue({
      id: 'res-exp',
      status: ReservationStatus.EXPIRED,
    } as any);
    MockedReservationRepo.createHistory.mockResolvedValue({} as any);
    MockedWalletService.refundReservationToWallet.mockResolvedValue(undefined as any);

    await expect(reservationLifecycle.confirmReservation('res-exp', 'gc-1')).rejects.toThrow(AppError);

    expect(MockedReservationRepo.updateReservation).toHaveBeenCalledWith(
      'res-exp',
      'gc-1',
      { status: ReservationStatus.EXPIRED },
      expect.anything()
    );
    expect(MockedWalletService.refundReservationToWallet).toHaveBeenCalledWith('res-exp', expect.anything());
    expect(MockedEventEmitter.emit).toHaveBeenCalledWith(
      AppEvents.RESERVATION_EXPIRED,
      expect.objectContaining({ reservationId: 'res-exp', gamingCenterId: 'gc-1' })
    );
  });

  it('cancelReservation on IN_PROGRESS reservation should cancel active GamingSession and pending proposals', async () => {
    MockedReservationRepo.findReservationById.mockResolvedValue({
      id: 'res-prog',
      gamingCenterId: 'gc-1',
      status: ReservationStatus.IN_PROGRESS,
    } as any);
    MockedReservationRepo.updateReservationWithInclude.mockResolvedValue({
      id: 'res-prog',
      gamingCenterId: 'gc-1',
      status: ReservationStatus.CANCELED,
      gamingCenter: {},
      customerAccount: {},
    } as any);
    MockedReservationRepo.createHistory.mockResolvedValue({} as any);
    MockedReservationRepo.cancelPendingProposals.mockResolvedValue({ count: 1 } as any);
    MockedGamingSessionsRepo.findActiveOrPausedSessionByReservationId.mockResolvedValue({
      id: 'sess-1',
      status: GamingSessionStatus.ACTIVE,
    } as any);
    MockedGamingSessionsRepo.updateSession.mockResolvedValue({} as any);
    MockedWalletService.refundReservationToWallet.mockResolvedValue(undefined as any);

    await reservationLifecycle.cancelReservation(
      'res-prog',
      'gc-1',
      { id: 'mgr-1', role: UserRole.MANAGER, actorType: SessionActorType.USER },
      { reason: 'Power outage' }
    );

    expect(MockedReservationRepo.cancelPendingProposals).toHaveBeenCalledWith('res-prog', expect.anything());
    expect(MockedGamingSessionsRepo.updateSession).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        status: GamingSessionStatus.INTERRUPTED,
        pausedAt: null,
      }),
      expect.anything()
    );
    expect(MockedWalletService.refundReservationToWallet).toHaveBeenCalledWith('res-prog', expect.anything());
  });

  it('cancelReservation should set canceledByUserId only for USER actors and null for CUSTOMER/PLATFORM_ADMIN', async () => {
    const baseReservation = {
      id: 'res-actor-check',
      gamingCenterId: 'gc-1',
      status: ReservationStatus.CONFIRMED,
    };
    const canceledReservation = {
      ...baseReservation,
      status: ReservationStatus.CANCELED,
      gamingCenter: {},
      customerAccount: {},
    };

    MockedReservationRepo.findReservationById.mockResolvedValue(baseReservation as any);
    MockedReservationRepo.updateReservationWithInclude.mockResolvedValue(canceledReservation as any);
    MockedReservationRepo.createHistory.mockResolvedValue({} as any);
    MockedReservationRepo.cancelPendingProposals.mockResolvedValue({ count: 0 } as any);
    MockedWalletService.refundReservationToWallet.mockResolvedValue(undefined as any);

    await reservationLifecycle.cancelReservation(
      'res-actor-check',
      'gc-1',
      { id: 'mgr-1', role: UserRole.MANAGER, actorType: SessionActorType.USER },
      { reason: 'Staff cancel' }
    );
    expect(MockedReservationRepo.updateReservationWithInclude).toHaveBeenLastCalledWith(
      'res-actor-check',
      'gc-1',
      expect.objectContaining({ canceledByUserId: 'mgr-1' }),
      expect.any(Object),
      expect.anything()
    );

    await reservationLifecycle.cancelReservation(
      'res-actor-check',
      'gc-1',
      { id: 'ca-1', role: UserRole.STAFF, actorType: SessionActorType.CUSTOMER },
      { reason: 'Customer cancel' }
    );
    expect(MockedReservationRepo.updateReservationWithInclude).toHaveBeenLastCalledWith(
      'res-actor-check',
      'gc-1',
      expect.objectContaining({ canceledByUserId: null }),
      expect.any(Object),
      expect.anything()
    );

    await reservationLifecycle.cancelReservation(
      'res-actor-check',
      'gc-1',
      { id: 'pa-1', role: UserRole.ADMIN, actorType: SessionActorType.PLATFORM_ADMIN },
      { reason: 'Admin cancel' }
    );
    expect(MockedReservationRepo.updateReservationWithInclude).toHaveBeenLastCalledWith(
      'res-actor-check',
      'gc-1',
      expect.objectContaining({ canceledByUserId: null }),
      expect.any(Object),
      expect.anything()
    );
  });

  it('completeReservation on IN_PROGRESS should not fail if no active GamingSession exists', async () => {
    MockedReservationRepo.findReservationById.mockResolvedValue({
      id: 'res-prog-2',
      gamingCenterId: 'gc-1',
      status: ReservationStatus.IN_PROGRESS,
    } as any);
    MockedReservationRepo.updateReservation.mockResolvedValue({
      id: 'res-prog-2',
      gamingCenterId: 'gc-1',
      status: ReservationStatus.COMPLETED,
    } as any);
    MockedReservationRepo.createHistory.mockResolvedValue({} as any);
    MockedGamingSessionsRepo.findActiveOrPausedSessionByReservationId.mockResolvedValue(null);

    const res = await reservationLifecycle.completeReservation(
      'res-prog-2',
      'gc-1',
      { id: 'mgr-1', role: UserRole.MANAGER, actorType: SessionActorType.USER }
    );

    expect(res.status).toBe(ReservationStatus.COMPLETED);
    expect(MockedGamingSessionsStation.endSession).not.toHaveBeenCalled();
  });

  it('confirmReservation and startReservation should reject unpaid online reservations (PAYMENT_REQUIRED)', async () => {
    MockedReservationRepo.findReservationById.mockResolvedValue({
      id: 'res-unpaid-online',
      gamingCenterId: 'gc-1',
      status: ReservationStatus.PENDING,
      source: ReservationSource.ONLINE,
      paymentState: ReservationPaymentState.UNPAID,
      customerPayableAmount: 100000,
      totalPrice: 100000,
      confirmationExpiresAt: new Date(Date.now() + 600_000),
    } as any);

    await expect(reservationLifecycle.confirmReservation('res-unpaid-online', 'gc-1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'PAYMENT_REQUIRED',
    });

    MockedReservationRepo.findReservationById.mockResolvedValue({
      id: 'res-unpaid-online-start',
      gamingCenterId: 'gc-1',
      status: ReservationStatus.CONFIRMED,
      source: ReservationSource.ONLINE,
      paymentState: ReservationPaymentState.UNPAID,
      customerPayableAmount: 100000,
      totalPrice: 100000,
    } as any);

    await expect(
      reservationLifecycle.startReservation('res-unpaid-online-start', 'gc-1', {
        id: 'mgr-1',
        role: UserRole.MANAGER,
        actorType: SessionActorType.USER,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'PAYMENT_REQUIRED',
    });
  });

  it('confirmReservation and startReservation should reject reservations with FAILED or CANCELED paymentState (PAYMENT_FAILED)', async () => {
    MockedReservationRepo.findReservationById.mockResolvedValue({
      id: 'res-failed-pay',
      gamingCenterId: 'gc-1',
      status: ReservationStatus.PENDING,
      source: ReservationSource.ONLINE,
      paymentState: ReservationPaymentState.FAILED,
      customerPayableAmount: 100000,
      totalPrice: 100000,
      confirmationExpiresAt: new Date(Date.now() + 600_000),
    } as any);

    await expect(reservationLifecycle.confirmReservation('res-failed-pay', 'gc-1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'PAYMENT_FAILED',
    });

    MockedReservationRepo.findReservationById.mockResolvedValue({
      id: 'res-canceled-pay',
      gamingCenterId: 'gc-1',
      status: ReservationStatus.CONFIRMED,
      source: ReservationSource.WALK_IN,
      paymentState: ReservationPaymentState.CANCELED,
      customerPayableAmount: 100000,
      totalPrice: 100000,
    } as any);

    await expect(
      reservationLifecycle.startReservation('res-canceled-pay', 'gc-1', {
        id: 'mgr-1',
        role: UserRole.MANAGER,
        actorType: SessionActorType.USER,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'PAYMENT_FAILED',
    });
  });
});
