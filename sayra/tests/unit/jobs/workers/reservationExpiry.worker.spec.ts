import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ReservationExpiryWorker } from '../../../../src/jobs/workers/reservationExpiry.worker';
import { reservationStation } from '../../../../src/modules/reservation/reservation.station';

jest.mock('../../../../src/modules/reservation/reservation.station');

describe('ReservationExpiryWorker - Unit Tests', () => {
  const mockedReservationStation = reservationStation as jest.Mocked<typeof reservationStation>;
  let worker: ReservationExpiryWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new ReservationExpiryWorker({ pollIntervalMs: 100, batchSize: 10, enabled: true });
  });

  afterEach(async () => {
    await worker.stop();
  });

  it('should initialize and report correct running state', async () => {
    expect(worker.isRunning()).toBe(false);
    worker.start();
    expect(worker.isRunning()).toBe(true);
    await worker.stop();
    expect(worker.isRunning()).toBe(false);
  });

  it('should execute tick and process batch', async () => {
    mockedReservationStation.processExpiryBatch.mockResolvedValue({
      candidatesFound: 2,
      expiredCount: 2,
      skippedCount: 0,
      failedCount: 0,
    });

    const result = await worker.tick();

    expect(mockedReservationStation.processExpiryBatch).toHaveBeenCalledWith({
      batchSize: 10,
      now: undefined,
    });
    expect(result.expiredCount).toBe(2);
  });

  it('should handle tick errors gracefully without throwing', async () => {
    mockedReservationStation.processExpiryBatch.mockRejectedValue(new Error('Unexpected DB Error'));

    const result = await worker.tick();

    expect(result.failedCount).toBe(1);
  });

  it('should prevent overlapping tick processing', async () => {
    let resolveBatch: any;
    const batchPromise = new Promise<any>((resolve) => {
      resolveBatch = resolve;
    });

    mockedReservationStation.processExpiryBatch.mockReturnValue(batchPromise);

    const firstTick = worker.tick();
    const secondTick = worker.tick();

    const secondResult = await secondTick;
    expect(secondResult.candidatesFound).toBe(0);

    resolveBatch({
      candidatesFound: 1,
      expiredCount: 1,
      skippedCount: 0,
      failedCount: 0,
    });

    const firstResult = await firstTick;
    expect(firstResult.candidatesFound).toBe(1);
  });
});
