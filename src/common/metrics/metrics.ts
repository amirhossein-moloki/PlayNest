import logger from '../../config/logger';

export class Metrics {
  static recordApiLatency(method: string, path: string, statusCode: number, durationMs: number) {
    logger.info({
      type: 'METRIC_API_LATENCY',
      method,
      path,
      statusCode,
      durationMs,
    });
  }

  static recordReservationCreated(success: boolean, gamingCenterId: string) {
    logger.info({
      type: 'METRIC_RESERVATION_CREATED',
      success,
      gamingCenterId,
    });
  }

  static recordQueueDepth(queueName: string, count: number) {
    logger.info({
      type: 'METRIC_QUEUE_DEPTH',
      queueName,
      count,
    });
  }

  static recordWorkerError(queueName: string, error: string) {
    logger.error({
      type: 'METRIC_WORKER_ERROR',
      queueName,
      error,
    });
  }
}
