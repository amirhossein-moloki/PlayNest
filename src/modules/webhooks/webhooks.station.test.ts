import { WebhooksService } from './webhooks.station';
import { IdempotencyRepo } from '../../common/repositories/idempotency.repo';
import { PaymentsRepo } from '../payments/payments.repo';
import { IdempotencyStatus } from '../../types/idempotency';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

jest.mock('../../common/repositories/idempotency.repo');
jest.mock('../payments/payments.repo');

const mockedIdempotencyRepo = IdempotencyRepo as jest.Mocked<typeof IdempotencyRepo>;
const mockedPaymentsRepo = PaymentsRepo as jest.Mocked<typeof PaymentsRepo>;

describe('WebhooksService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processPaymentWebhook', () => {
    const payload = {
      eventId: 'evt_123',
      paymentId: 'pay_123',
      status: 'SUCCEEDED' as const,
    };
    const provider = 'zarinpal';

    it('should throw error if payload is invalid', async () => {
      await expect(WebhooksService.processPaymentWebhook({
        provider,
        payload: { eventId: '', paymentId: '', status: 'SUCCEEDED' as any } // eslint-disable-line @typescript-eslint/no-explicit-any
      })).rejects.toThrow(new AppError('Invalid payload.', httpStatus.BAD_REQUEST));
    });

    it('should return if event already processed (COMPLETED)', async () => {
      mockedIdempotencyRepo.findKey.mockResolvedValue({ status: IdempotencyStatus.COMPLETED } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      await WebhooksService.processPaymentWebhook({ provider, payload });

      expect(mockedIdempotencyRepo.findKey).toHaveBeenCalled();
      expect(mockedIdempotencyRepo.createKey).not.toHaveBeenCalled();
    });

    it('should throw conflict if event is IN_PROGRESS', async () => {
      mockedIdempotencyRepo.findKey.mockResolvedValue({ status: IdempotencyStatus.IN_PROGRESS } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      await expect(WebhooksService.processPaymentWebhook({ provider, payload }))
        .rejects.toThrow(new AppError('Request is already being processed.', httpStatus.CONFLICT));
    });

    it('should process successful payment', async () => {
      mockedIdempotencyRepo.findKey.mockResolvedValue(null);
      mockedIdempotencyRepo.createKey.mockResolvedValue({} as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const mockTx = {};
      mockedPaymentsRepo.transaction.mockImplementation(async (cb) => cb(mockTx as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

      const mockPayment = { id: 'pay_123', reservation: {} };
      (mockTx as any).payment = { findUnique: jest.fn().mockResolvedValue(mockPayment) }; // eslint-disable-line @typescript-eslint/no-explicit-any

      await WebhooksService.processPaymentWebhook({ provider, payload });

      expect(mockedIdempotencyRepo.createKey).toHaveBeenCalled();
      expect(mockedPaymentsRepo.handleSuccessfulPayment).toHaveBeenCalledWith(mockTx, 'pay_123');
      expect(mockedIdempotencyRepo.updateKey).toHaveBeenCalledWith(expect.any(String), 'evt_123', { status: IdempotencyStatus.COMPLETED });
    });

    it('should process failed payment', async () => {
      const failPayload = { ...payload, status: 'FAILED' as const };
      mockedIdempotencyRepo.findKey.mockResolvedValue(null);

      const mockTx = {};
      mockedPaymentsRepo.transaction.mockImplementation(async (cb) => cb(mockTx as any)); // eslint-disable-line @typescript-eslint/no-explicit-any

      const mockPayment = { id: 'pay_123', reservation: {} };
      (mockTx as any).payment = { findUnique: jest.fn().mockResolvedValue(mockPayment) }; // eslint-disable-line @typescript-eslint/no-explicit-any

      await WebhooksService.processPaymentWebhook({ provider, payload: failPayload });

      expect(mockedPaymentsRepo.handleFailedPayment).toHaveBeenCalledWith(mockTx, 'pay_123');
    });

    it('should mark idempotency as FAILED if processing fails', async () => {
      mockedIdempotencyRepo.findKey.mockResolvedValue(null);
      mockedPaymentsRepo.transaction.mockRejectedValue(new Error('Processing failed'));

      await expect(WebhooksService.processPaymentWebhook({ provider, payload }))
        .rejects.toThrow('Processing failed');

      expect(mockedIdempotencyRepo.updateKey).toHaveBeenCalledWith(expect.any(String), 'evt_123', { status: IdempotencyStatus.FAILED });
    });
  });
});
