import { IntegrationOutboxStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import logger from '../../config/logger';
import { signWebhookPayload } from './webhook.signing';

const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000, 7_200_000];
const WEBHOOK_TIMEOUT_MS = 5000;

export interface DispatchOutboxResult {
  status: 'DELIVERED' | 'FAILED' | 'DEAD_LETTER' | 'SKIPPED';
  httpStatus?: number;
  error?: string;
}

function getRetryDelayMs(attemptNumber: number): number {
  const index = Math.min(Math.max(attemptNumber - 1, 0), RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index];
}

export async function dispatchOutboxEvent(outboxEventId: string): Promise<DispatchOutboxResult> {
  if (typeof prisma.integrationOutboxEvent?.findUnique !== 'function') {
    return { status: 'SKIPPED', error: 'Outbox model unavailable' };
  }

  const event = await prisma.integrationOutboxEvent.findUnique({
    where: { id: outboxEventId },
  });

  if (!event) {
    return { status: 'SKIPPED', error: 'Event not found' };
  }

  if (
    event.status === IntegrationOutboxStatus.DELIVERED ||
    event.status === IntegrationOutboxStatus.DEAD_LETTER
  ) {
    return { status: 'SKIPPED' };
  }

  const webhookUrl = (process.env.BLOG_WEBHOOK_URL ?? env.BLOG_WEBHOOK_URL ?? '').trim();
  const webhookSecret = (process.env.BLOG_WEBHOOK_SECRET ?? env.BLOG_WEBHOOK_SECRET ?? '').trim();

  if (!webhookUrl) {
    logger.debug({
      msg: 'BLOG_WEBHOOK_URL is not configured; skipping outbound webhook delivery',
      outboxEventId,
    });
    return { status: 'SKIPPED', error: 'BLOG_WEBHOOK_URL not configured' };
  }

  const nextAttempts = event.attempts + 1;

  if (!webhookSecret) {
    const errorMsg = 'BLOG_WEBHOOK_SECRET is not configured';
    const nextStatus =
      nextAttempts >= event.maxAttempts
        ? IntegrationOutboxStatus.DEAD_LETTER
        : IntegrationOutboxStatus.FAILED;
    await prisma.integrationOutboxEvent.update({
      where: { id: event.id },
      data: {
        status: nextStatus,
        attempts: nextAttempts,
        nextRetryAt: new Date(Date.now() + getRetryDelayMs(nextAttempts)),
        lastError: errorMsg,
      },
    });
    return { status: nextStatus, error: errorMsg };
  }

  // Claim row to reduce concurrent delivery races
  if (typeof prisma.integrationOutboxEvent.updateMany === 'function') {
    const claim = await prisma.integrationOutboxEvent.updateMany({
      where: {
        id: event.id,
        status: {
          in: [IntegrationOutboxStatus.PENDING, IntegrationOutboxStatus.FAILED],
        },
      },
      data: {
        status: IntegrationOutboxStatus.PROCESSING,
      },
    });
    if (claim.count === 0) {
      return { status: 'SKIPPED' };
    }
  }

  const timestampSec = Math.floor(Date.now() / 1000);
  const bodyObj =
    event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
      ? {
          ...(event.payload as Record<string, unknown>),
          outboxEventId: event.id,
          attempt: nextAttempts,
        }
      : {
          outboxEventId: event.id,
          eventType: event.eventType,
          gamingCenterId: event.gamingCenterId,
          gamingCenterSlug: event.gamingCenterSlug,
          city: event.city,
          attempt: nextAttempts,
        };

  const rawBody = JSON.stringify(bodyObj);
  const signature = signWebhookPayload(webhookSecret, timestampSec, rawBody);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sayra-Event-Id': event.id,
        'X-Sayra-Event-Type': event.eventType,
        'X-Sayra-Timestamp': String(timestampSec),
        'X-Sayra-Signature': signature,
      },
      body: rawBody,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (response.ok) {
      await prisma.integrationOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: IntegrationOutboxStatus.DELIVERED,
          attempts: nextAttempts,
          deliveredAt: new Date(),
          lastError: null,
        },
      });
      logger.info({
        msg: 'Delivered Sayra integration webhook',
        outboxEventId: event.id,
        eventType: event.eventType,
        gamingCenterId: event.gamingCenterId,
        httpStatus: response.status,
      });
      return { status: 'DELIVERED', httpStatus: response.status };
    }

    const responseText = await response.text().catch(() => '');
    const errorMsg = `HTTP ${response.status}: ${responseText.slice(0, 300)}`;
    const nextStatus =
      nextAttempts >= event.maxAttempts
        ? IntegrationOutboxStatus.DEAD_LETTER
        : IntegrationOutboxStatus.FAILED;

    await prisma.integrationOutboxEvent.update({
      where: { id: event.id },
      data: {
        status: nextStatus,
        attempts: nextAttempts,
        nextRetryAt: new Date(Date.now() + getRetryDelayMs(nextAttempts)),
        lastError: errorMsg,
      },
    });

    logger.warn({
      msg: 'Blog webhook delivery returned non-2xx status',
      outboxEventId: event.id,
      attempts: nextAttempts,
      nextStatus,
      httpStatus: response.status,
    });

    return { status: nextStatus, httpStatus: response.status, error: errorMsg };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const nextStatus =
      nextAttempts >= event.maxAttempts
        ? IntegrationOutboxStatus.DEAD_LETTER
        : IntegrationOutboxStatus.FAILED;

    await prisma.integrationOutboxEvent.update({
      where: { id: event.id },
      data: {
        status: nextStatus,
        attempts: nextAttempts,
        nextRetryAt: new Date(Date.now() + getRetryDelayMs(nextAttempts)),
        lastError: errorMsg.slice(0, 500),
      },
    });

    logger.warn({
      msg: 'Blog webhook delivery failed with network/timeout error',
      outboxEventId: event.id,
      attempts: nextAttempts,
      nextStatus,
      error: errorMsg,
    });

    return { status: nextStatus, error: errorMsg };
  }
}

export async function processPendingOutboxEvents(
  batchSize = env.INTEGRATION_OUTBOX_BATCH_SIZE,
  now: Date = new Date()
): Promise<{ processed: number; delivered: number; failed: number; deadLetter: number }> {
  if (typeof prisma.integrationOutboxEvent?.findMany !== 'function') {
    return { processed: 0, delivered: 0, failed: 0, deadLetter: 0 };
  }

  const webhookUrl = (process.env.BLOG_WEBHOOK_URL ?? env.BLOG_WEBHOOK_URL ?? '').trim();
  if (!webhookUrl) {
    return { processed: 0, delivered: 0, failed: 0, deadLetter: 0 };
  }

  const events = await prisma.integrationOutboxEvent.findMany({
    where: {
      status: {
        in: [IntegrationOutboxStatus.PENDING, IntegrationOutboxStatus.FAILED],
      },
      nextRetryAt: {
        lte: now,
      },
    },
    orderBy: [{ nextRetryAt: 'asc' }, { createdAt: 'asc' }],
    take: batchSize,
    select: { id: true },
  });

  let delivered = 0;
  let failed = 0;
  let deadLetter = 0;

  for (const item of events) {
    const res = await dispatchOutboxEvent(item.id);
    if (res.status === 'DELIVERED') delivered += 1;
    else if (res.status === 'FAILED') failed += 1;
    else if (res.status === 'DEAD_LETTER') deadLetter += 1;
  }

  return {
    processed: events.length,
    delivered,
    failed,
    deadLetter,
  };
}
