/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { PaymentStatus } from '@prisma/client';
import { ZarinPalProvider } from '../../../../src/modules/payments/providers/zarinpal.provider';
import { MelipayamakStation } from '../../../../src/modules/notifications/melipayamak.station';
import { NotificationStation } from '../../../../src/modules/notifications/notifications.station';
import { notificationsRepo } from '../../../../src/modules/notifications/notifications.repo';
import * as notificationsProducer from '../../../../src/jobs/producers/notifications.producer';

describe('AMI-42 Outbound Timeouts, Timer Cleanup, and Notification Deduplication', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('aborts hung ZarinPal initiatePayment calls cleanly with 504 GATEWAY_TIMEOUT', async () => {
    const provider = new ZarinPalProvider(35);
    global.fetch = jest.fn(
      (_url: any, init: any) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(init.signal.reason || Object.assign(new Error('Aborted'), { name: 'TimeoutError' }));
          });
        })
    ) as any;

    await expect(
      provider.initiatePayment({
        amount: 100000,
        currency: 'IRR',
        description: 'Timeout test',
        callbackUrl: 'http://localhost/cb',
        reservationId: 'res-timeout',
        gamingCenterId: 'gc-1',
      })
    ).rejects.toMatchObject({
      statusCode: 504,
      message: 'Payment gateway request timed out.',
    });
  });

  it('returns clean FAILED result on hung ZarinPal verifyPayment timeout', async () => {
    const provider = new ZarinPalProvider(35);
    global.fetch = jest.fn(
      (_url: any, init: any) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(init.signal.reason || Object.assign(new Error('Aborted'), { name: 'TimeoutError' }));
          });
        })
    ) as any;

    const result = await provider.verifyPayment({ authority: 'A001', amount: 100000 });
    expect(result.success).toBe(false);
    expect(result.status).toBe(PaymentStatus.FAILED);
    expect(result.failureReason).toBe('Payment gateway verification timed out.');
    expect(result.rawPayload).toEqual({ timeout: true });
  });

  it('clears timeout handles in MelipayamakStation.executeWithTimeout on fast resolve & reject', async () => {
    const clearSpy = jest.spyOn(global, 'clearTimeout');

    const ok = await MelipayamakStation.executeWithTimeout(async () => 'fast-ok', 5000);
    expect(ok).toBe('fast-ok');

    await expect(
      MelipayamakStation.executeWithTimeout(async () => {
        throw new Error('fast-fail');
      }, 5000)
    ).rejects.toThrow('fast-fail');

    expect(clearSpy).toHaveBeenCalledTimes(2);
  });

  it('dispatches via BullMQ once without duplicate inline synchronous dispatch when enqueue succeeds', async () => {
    jest.spyOn(notificationsRepo, 'createNotificationLog').mockResolvedValue({
      id: 'log-dedup-1',
      status: 'PENDING',
    } as any);
    const queueSpy = jest
      .spyOn(notificationsProducer, 'queueNotificationDispatch')
      .mockResolvedValue({ id: 'job-1' } as any);
    const inlineDispatchSpy = jest
      .spyOn(NotificationStation, 'dispatchNotificationLog')
      .mockResolvedValue({ id: 'log-dedup-1', status: 'SENT' } as any);

    const log = await NotificationStation.enqueueNotificationLog({
      gamingCenterId: 'gc-1',
      recipient: '09123456789',
      type: 'RESERVATION_CREATED' as any,
      title: 'Test',
      message: 'Body',
      idempotencyKey: 'ami42-dedup-1',
    });

    expect((log as any).id).toBe('log-dedup-1');
    expect(queueSpy).toHaveBeenCalledTimes(1);
    expect(inlineDispatchSpy).not.toHaveBeenCalled();
  });

  it('falls back to inline synchronous dispatch when BullMQ enqueue throws or returns false', async () => {
    jest.spyOn(notificationsRepo, 'createNotificationLog').mockResolvedValue({
      id: 'log-fallback-1',
      status: 'PENDING',
    } as any);
    const queueSpy = jest
      .spyOn(notificationsProducer, 'queueNotificationDispatch')
      .mockRejectedValueOnce(new Error('Redis offline'))
      .mockResolvedValueOnce(false);
    const inlineDispatchSpy = jest
      .spyOn(NotificationStation, 'dispatchNotificationLog')
      .mockResolvedValue({ id: 'log-fallback-1', status: 'SENT' } as any);

    const logFromReject = await NotificationStation.enqueueNotificationLog({
      gamingCenterId: 'gc-1',
      recipient: '09123456789',
      type: 'RESERVATION_CREATED' as any,
      title: 'Test',
      message: 'Body',
      idempotencyKey: 'ami42-fallback-reject',
    });

    const logFromFalse = await NotificationStation.enqueueNotificationLog({
      gamingCenterId: 'gc-1',
      recipient: '09123456789',
      type: 'RESERVATION_CREATED' as any,
      title: 'Test',
      message: 'Body',
      idempotencyKey: 'ami42-fallback-false',
    });

    expect(queueSpy).toHaveBeenCalledTimes(2);
    expect(inlineDispatchSpy).toHaveBeenCalledTimes(2);
    expect(inlineDispatchSpy).toHaveBeenCalledWith('log-fallback-1');
    expect((logFromReject as any).status).toBe('SENT');
    expect((logFromFalse as any).status).toBe('SENT');
  });
});
