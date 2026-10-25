import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { reservationStation } from '../../../../src/modules/reservation/reservation.station';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';

jest.mock('../../../../src/modules/reservation/reservation.repo');

const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;

describe('Reservation Expiry - Integration & Concurrency Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockedReservationRepo.transaction.mockImplementation(async (cb: /* eslint-disable-line @typescript-eslint/no-explicit-any */ any) => cb({}));
  });

  describe('Multi-Worker Concurrency', () => {
    it('should allow only one worker instance to transition an expired reservation', async () => {
      const now = new Date('2026-12-05T12:00:00Z');
      const candidates = [
        { id: 'res-race-1', gamingCenterId: 'gc-1', expiresAt: new Date('2026-12-05T11:58:00Z') },
      ];

      MockedReservationRepo.findExpiryCandidateReservations.mockResolvedValue(candidates);
      MockedReservationRepo.findExpiryCandidateGroupBookings.mockResolvedValue([]);

      // First worker call succeeds in DB update
      MockedReservationRepo.expireReservationCandidate.mockResolvedValueOnce(true);
      // Second worker call finds 0 rows updated because status is no longer PENDING
      MockedReservationRepo.expireReservationCandidate.mockResolvedValueOnce(false);

      const [resultWorker1, resultWorker2] = await Promise.all([
        reservationStation.processExpiryBatch({ batchSize: 10, now }),
        reservationStation.processExpiryBatch({ batchSize: 10, now }),
      ]);

      expect(resultWorker1.expiredCount + resultWorker2.expiredCount).toBe(1);
      expect(resultWorker1.skippedCount + resultWorker2.skippedCount).toBe(1);
    });
  });

  describe('Payment vs Expiry Race', () => {
    it('should skip expiry if payment succeeds concurrently before worker updates DB', async () => {
      const now = new Date('2026-12-05T12:00:00Z');
      const candidates = [
        { id: 'res-paid-race', gamingCenterId: 'gc-1', expiresAt: new Date('2026-12-05T11:59:00Z') },
      ];

      MockedReservationRepo.findExpiryCandidateReservations.mockResolvedValue(candidates);
      MockedReservationRepo.findExpiryCandidateGroupBookings.mockResolvedValue([]);

      // Payment transaction set paymentState = PAID, so conditional update returns false (0 rows updated)
      MockedReservationRepo.expireReservationCandidate.mockResolvedValue(false);

      const result = await reservationStation.processExpiryBatch({ batchSize: 10, now });

      expect(result.expiredCount).toBe(0);
      expect(result.skippedCount).toBe(1);
    });
  });
});
