import { Metrics } from '../../../../src/common/metrics/metrics';
import logger from '../../../../src/config/logger';
import { jest, describe, it, expect } from '@jest/globals';

jest.mock('../../../../src/config/logger');

describe('Metrics', () => {
  it('should record API latency', () => {
    Metrics.recordApiLatency('GET', '/test', 200, 100);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
      type: 'METRIC_API_LATENCY',
      method: 'GET',
      path: '/test',
      statusCode: 200,
      durationMs: 100,
    }));
  });

  it('should record reservation creation', () => {
    Metrics.recordReservationCreated(true, 'gc-1');
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
      type: 'METRIC_RESERVATION_CREATED',
      success: true,
      gamingCenterId: 'gc-1',
    }));
  });
});
