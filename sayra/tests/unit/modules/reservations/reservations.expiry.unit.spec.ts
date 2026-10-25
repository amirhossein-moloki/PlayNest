import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ReservationRepo } from '../../../../src/modules/reservation/reservation.repo';
import { reservationStation } from '../../../../src/modules/reservation/reservation.station';

jest.mock('../../../../src/modules/reservation/reservation.repo');

describe('Reservation Expiry - Unit Tests', () => {
  const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Expiry Eligibility & Boundary Tests', () => {
    it('should find candidates with PENDING status and expiresAt <= now', async () => {
      const now = new Date('2026-12-05T12:00:00Z');
      const candidates = [
        { id: 'res-1', gamingCenterId: 'gc-1', expiresAt: new Date('2026-12-05T11:59:59Z') },
      ];

      MockedReservationRepo.findExpiryCandidateReservations.mockResolvedValue(candidates);
      MockedReservationRepo.findExpiryCandidateGroupBookings.mockResolvedValue([]);
      MockedReservationRepo.transaction.mockImplementation(async (cb: /* eslint-disable-line @typescript-eslint/no-explicit-any */ any) => cb({}));
      MockedReservationRepo.expireReservationCandidate.mockResolvedValue(true);

      const result = await reservationStation.processExpiryBatch({ batchSize: 50, now });

      expect(MockedReservationRepo.findExpiryCandidateReservations).toHaveBeenCalledWith(50, now);
      expect(result.candidatesFound).toBe(1);
      expect(result.expiredCount).toBe(1);
      expect(result.skippedCount).toBe(0);
    });

    it('should handle empty candidates without attempting processing', async () => {
      const now = new Date('2026-12-05T12:00:00Z');
      MockedReservationRepo.findExpiryCandidateReservations.mockResolvedValue([]);
      MockedReservationRepo.findExpiryCandidateGroupBookings.mockResolvedValue([]);

      const result = await reservationStation.processExpiryBatch({ batchSize: 50, now });

      expect(result.candidatesFound).toBe(0);
      expect(result.expiredCount).toBe(0);
      expect(MockedReservationRepo.expireReservationCandidate).not.toHaveBeenCalled();
    });

    it('should mark as skipped when atomic transition returns false (concurrent update)', async () => {
      const now = new Date('2026-12-05T12:00:00Z');
      const candidates = [
        { id: 'res-concurrent', gamingCenterId: 'gc-1', expiresAt: new Date('2026-12-05T11:59:00Z') },
      ];

      MockedReservationRepo.findExpiryCandidateReservations.mockResolvedValue(candidates);
      MockedReservationRepo.findExpiryCandidateGroupBookings.mockResolvedValue([]);
      MockedReservationRepo.transaction.mockImplementation(async (cb: /* eslint-disable-line @typescript-eslint/no-explicit-any */ any) => cb({}));
      MockedReservationRepo.expireReservationCandidate.mockResolvedValue(false);

      const result = await reservationStation.processExpiryBatch({ batchSize: 50, now });

      expect(result.candidatesFound).toBe(1);
      expect(result.expiredCount).toBe(0);
      expect(result.skippedCount).toBe(1);
    });

    it('should increment failedCount if processing an item throws an error', async () => {
      const now = new Date('2026-12-05T12:00:00Z');
      const candidates = [
        { id: 'res-err', gamingCenterId: 'gc-1', expiresAt: new Date('2026-12-05T11:59:00Z') },
      ];

      MockedReservationRepo.findExpiryCandidateReservations.mockResolvedValue(candidates);
      MockedReservationRepo.findExpiryCandidateGroupBookings.mockResolvedValue([]);
      MockedReservationRepo.transaction.mockRejectedValue(new Error('DB Connection Error'));

      const result = await reservationStation.processExpiryBatch({ batchSize: 50, now });

      expect(result.candidatesFound).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.expiredCount).toBe(0);
    });
  });
});
