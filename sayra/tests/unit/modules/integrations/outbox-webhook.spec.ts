/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

const mockPrisma: any = {
  gamingCenter: {
    findUnique: jest.fn(),
  },
  integrationOutboxEvent: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockInvalidatePublicPrefix = jest.fn(async (..._args: unknown[]) => undefined);
const mockInvalidateTenantCache = jest.fn(async (..._args: unknown[]) => undefined);
const mockQueueDispatch = jest.fn(async (..._args: unknown[]) => undefined);

jest.mock('../../../../src/config/prisma', () => ({
  prisma: mockPrisma,
}));

jest.mock('../../../../src/common/utils/publicCache', () => ({
  invalidatePublicCacheByPrefix: mockInvalidatePublicPrefix,
}));

jest.mock('../../../../src/common/utils/tenantCache', () => ({
  invalidateTenantCache: mockInvalidateTenantCache,
}));

jest.mock('../../../../src/jobs/producers/integrationWebhook.producer', () => ({
  queueIntegrationWebhookDispatch: mockQueueDispatch,
}));

import {
  signWebhookPayload,
  verifyWebhookSignature,
} from '../../../../src/modules/integrations/webhook.signing';
import { recordGamingCenterChangeEvent } from '../../../../src/modules/integrations/outbox.service';
import { dispatchOutboxEvent } from '../../../../src/modules/integrations/webhook.dispatcher';

describe('Integrations Outbox & HMAC Webhook', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BLOG_WEBHOOK_URL = 'http://blog_web:8000/api/integrations/webhooks/sayra-events/';
    process.env.BLOG_WEBHOOK_SECRET = 'super-secret-webhook-key-123';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it('signs and verifies HMAC-SHA256 webhook payloads and rejects tampered or expired requests', () => {
    const secret = 'my-hmac-secret';
    const nowSec = 1_760_000_000;
    const rawBody = JSON.stringify({ eventType: 'GAMING_CENTER_REVIEW_CHANGED', gamingCenterId: 'gc-1' });
    const signature = signWebhookPayload(secret, nowSec, rawBody);

    expect(signature.startsWith('sha256=')).toBe(true);
    expect(verifyWebhookSignature(secret, nowSec, rawBody, signature, 300, nowSec + 10)).toBe(
      true
    );

    // Tampered body
    expect(
      verifyWebhookSignature(
        secret,
        nowSec,
        '{"eventType":"GAMING_CENTER_REVIEW_CHANGED","gamingCenterId":"gc-2"}',
        signature,
        300,
        nowSec + 10
      )
    ).toBe(false);

    // Wrong secret
    expect(
      verifyWebhookSignature('wrong-secret', nowSec, rawBody, signature, 300, nowSec + 10)
    ).toBe(false);

    // Expired timestamp (>300s)
    expect(verifyWebhookSignature(secret, nowSec, rawBody, signature, 300, nowSec + 301)).toBe(
      false
    );

    // Malformed signature length
    expect(verifyWebhookSignature(secret, nowSec, rawBody, 'sha256=short', 300, nowSec)).toBe(
      false
    );
  });

  it('records PENDING outbox event, invalidates Express caches, and queues dispatch', async () => {
    mockPrisma.gamingCenter.findUnique.mockResolvedValue({
      slug: 'tabriz-center-1',
      addresses: [{ city: 'تبریز' }],
    });
    mockPrisma.integrationOutboxEvent.create.mockResolvedValue({ id: 'outbox-1' });

    const created = await recordGamingCenterChangeEvent({
      gamingCenterId: 'gc-1',
      eventType: 'GAMING_CENTER_PRICING_CHANGED',
      changedFields: ['hourlyRate'],
    });

    expect(created).toEqual({ id: 'outbox-1' });
    expect(mockInvalidatePublicPrefix).toHaveBeenCalledWith('public:gc:');
    expect(mockInvalidatePublicPrefix).toHaveBeenCalledWith('public:gamecenters:');
    expect(mockInvalidateTenantCache).toHaveBeenCalledWith('gc-1', undefined);

    const createCall = mockPrisma.integrationOutboxEvent.create.mock.calls[0][0].data;
    expect(createCall.status).toBe('PENDING');
    expect(createCall.gamingCenterId).toBe('gc-1');
    expect(createCall.gamingCenterSlug).toBe('tabriz-center-1');
    expect(createCall.city).toBe('تبریز');
    expect(mockQueueDispatch).toHaveBeenCalledWith('outbox-1', 0);
  });

  it('delivers signed webhook on 200 OK and marks outbox event DELIVERED', async () => {
    const outboxEvent = {
      id: 'outbox-delivered',
      eventType: 'GAMING_CENTER_REVIEW_CHANGED',
      gamingCenterId: 'gc-1',
      gamingCenterSlug: 'tabriz-center-1',
      city: 'تبریز',
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 5,
      payload: {
        eventId: 'evt-1',
        eventType: 'GAMING_CENTER_REVIEW_CHANGED',
        gamingCenterId: 'gc-1',
        city: 'تبریز',
      },
    };
    mockPrisma.integrationOutboxEvent.findUnique.mockResolvedValue(outboxEvent);
    mockPrisma.integrationOutboxEvent.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.integrationOutboxEvent.update.mockResolvedValue({});

    let capturedHeaders: Record<string, string> = {};
    let capturedBody = '';
    global.fetch = (async (_url: unknown, init?: RequestInit) => {
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      capturedBody = String(init?.body ?? '');
      return {
        ok: true,
        status: 200,
        text: async () => 'ok',
      } as Response;
    }) as typeof fetch;

    const result = await dispatchOutboxEvent('outbox-delivered');

    expect(result).toEqual({ status: 'DELIVERED', httpStatus: 200 });
    expect(capturedHeaders['X-Sayra-Event-Id']).toBe('outbox-delivered');
    expect(capturedHeaders['X-Sayra-Event-Type']).toBe('GAMING_CENTER_REVIEW_CHANGED');
    const ts = Number(capturedHeaders['X-Sayra-Timestamp']);
    expect(
      verifyWebhookSignature(
        process.env.BLOG_WEBHOOK_SECRET!,
        ts,
        capturedBody,
        capturedHeaders['X-Sayra-Signature'],
        300,
        ts
      )
    ).toBe(true);

    const updateData = mockPrisma.integrationOutboxEvent.update.mock.calls[0][0].data;
    expect(updateData.status).toBe('DELIVERED');
    expect(updateData.attempts).toBe(1);
    expect(updateData.deliveredAt).toBeInstanceOf(Date);
  });

  it('marks FAILED with retry backoff on 500 and DEAD_LETTER when maxAttempts is reached', async () => {
    mockPrisma.integrationOutboxEvent.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.integrationOutboxEvent.update.mockResolvedValue({});

    global.fetch = (async () =>
      ({
        ok: false,
        status: 500,
        text: async () => 'upstream error',
      }) as Response) as typeof fetch;

    mockPrisma.integrationOutboxEvent.findUnique.mockResolvedValueOnce({
      id: 'outbox-fail-1',
      eventType: 'GAMING_CENTER_UPDATED',
      gamingCenterId: 'gc-1',
      gamingCenterSlug: 'tabriz-1',
      city: 'تبریز',
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 5,
      payload: {},
    });

    const firstTry = await dispatchOutboxEvent('outbox-fail-1');
    expect(firstTry.status).toBe('FAILED');
    expect(firstTry.httpStatus).toBe(500);
    expect(mockPrisma.integrationOutboxEvent.update.mock.calls[0][0].data.status).toBe('FAILED');

    mockPrisma.integrationOutboxEvent.findUnique.mockResolvedValueOnce({
      id: 'outbox-dead',
      eventType: 'GAMING_CENTER_UPDATED',
      gamingCenterId: 'gc-1',
      gamingCenterSlug: 'tabriz-1',
      city: 'تبریز',
      status: 'FAILED',
      attempts: 4,
      maxAttempts: 5,
      payload: {},
    });

    const finalTry = await dispatchOutboxEvent('outbox-dead');
    expect(finalTry.status).toBe('DEAD_LETTER');
    expect(mockPrisma.integrationOutboxEvent.update.mock.calls[1][0].data.status).toBe(
      'DEAD_LETTER'
    );
  });

  it('skips delivery gracefully when BLOG_WEBHOOK_URL is unset', async () => {
    delete process.env.BLOG_WEBHOOK_URL;
    mockPrisma.integrationOutboxEvent.findUnique.mockResolvedValue({
      id: 'outbox-skip',
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 5,
    });

    const res = await dispatchOutboxEvent('outbox-skip');
    expect(res.status).toBe('SKIPPED');
  });
});
