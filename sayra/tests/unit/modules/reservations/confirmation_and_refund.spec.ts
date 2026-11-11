import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { reservationStation } from '../../../../src/modules/reservation/reservation.station';
import { reservationLifecycle } from '../../../../src/modules/reservation/reservation.lifecycle';
import { walletService } from '../../../../src/modules/wallet/wallet.station';
import { ReservationStatus, Reservation } from '@prisma/client';

jest.mock('../../../../src/modules/reservation/reservation.repo');
jest.mock('../../../../src/modules/wallet/wallet.station');

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Confirmation Deadline & Expiry & Refund Unit Tests', () => {
  const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;
  const MockedWalletService = walletService as jest.Mocked<typeof walletService>;

  beforeEach(() => {
    jest.clearAllMocks();
    MockedReservationRepo.transaction.mockImplementation(async (cb: any) => cb({
      reservation: {
        updateMany: jest.fn().mockImplementation(async () => ({ count: 1 })),
        findUnique: jest.fn().mockImplementation(async () => ({ id: 'res-1' })),
      },
      reservationHistory: {
        create: jest.fn().mockImplementation(async () => ({ id: 'hist-1' })),
      },
    }));
  });

  it('should confirm reservation successfully if confirmationExpiresAt has not elapsed', async () => {
    const futureDate = new Date(Date.now() + 15 * 60 * 1000); // 15 mins in future
    const pendingRes = {
      id: 'res-1',
      gamingCenterId: 'gc-1',
      status: ReservationStatus.PENDING,
      confirmationExpiresAt: futureDate,
      expiresAt: futureDate,
    };

    MockedReservationRepo.findReservationById.mockResolvedValue(pendingRes as unknown as Reservation);
    MockedReservationRepo.createHistory.mockResolvedValue({} as any);

    const result = await reservationLifecycle.confirmReservation('res-1', 'gc-1');
    expect(result).toBeDefined();
    expect(MockedReservationRepo.createHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: 'res-1',
        fromStatus: ReservationStatus.PENDING,
        toStatus: ReservationStatus.CONFIRMED,
        action: 'CONFIRM',
      }),
      expect.anything()
    );
  });

  it('should reject confirmation and transition to EXPIRED if confirmation deadline elapsed', async () => {
    const pastDate = new Date(Date.now() - 5 * 60 * 1000); // 5 mins in past
    const expiredRes = {
      id: 'res-1',
      gamingCenterId: 'gc-1',
      status: ReservationStatus.PENDING,
      confirmationExpiresAt: pastDate,
      expiresAt: pastDate,
    };

    MockedReservationRepo.findReservationById.mockResolvedValue(expiredRes as unknown as Reservation);
    MockedReservationRepo.updateReservation.mockResolvedValue(expiredRes as unknown as Reservation);
    MockedReservationRepo.createHistory.mockResolvedValue({} as any);

    await expect(reservationLifecycle.confirmReservation('res-1', 'gc-1')).rejects.toThrow(
      'Confirmation deadline has expired.'
    );
    expect(MockedReservationRepo.updateReservation).toHaveBeenCalledWith(
      'res-1',
      'gc-1',
      { status: ReservationStatus.EXPIRED },
      expect.anything()
    );
  });

  it('should process expiry batch and trigger refund for expired reservations', async () => {
    const now = new Date();
    const candidates = [
      { id: 'res-exp-1', gamingCenterId: 'gc-1', confirmationExpiresAt: new Date(now.getTime() - 1000) },
    ];

    MockedReservationRepo.findExpiryCandidateReservations.mockResolvedValue(candidates as any);
    MockedReservationRepo.findExpiryCandidateGroupBookings.mockResolvedValue([]);
    MockedReservationRepo.expireReservationCandidate.mockResolvedValue(true);
    MockedReservationRepo.findReservationById.mockResolvedValue({
      id: 'res-exp-1',
      gamingCenterId: 'gc-1',
      stationId: 'st-1',
      startTime: now,
      endTime: new Date(now.getTime() + 3600000),
    } as unknown as Reservation);

    const result = await reservationStation.processExpiryBatch({ batchSize: 10, now });

    expect(result.expiredCount).toBe(1);
    expect(MockedReservationRepo.expireReservationCandidate).toHaveBeenCalledWith('res-exp-1', now, expect.anything());
    expect(MockedWalletService.refundReservationToWallet).toHaveBeenCalledWith('res-exp-1', expect.anything());
  });
});
