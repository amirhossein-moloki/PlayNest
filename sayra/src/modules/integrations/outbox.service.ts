import crypto from 'crypto';
import { IntegrationEventType, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import logger from '../../config/logger';
import { invalidatePublicCacheByPrefix } from '../../common/utils/publicCache';
import { invalidateTenantCache } from '../../common/utils/tenantCache';

export interface RecordGamingCenterChangeInput {
  gamingCenterId: string;
  eventType: IntegrationEventType;
  gamingCenterSlug?: string | null;
  city?: string | null;
  changedFields?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Invalidates Express public gaming center caches immediately and records a
 * transactional outbox event so the Django Blog & Next.js ISR stay synchronized.
 */
export async function recordGamingCenterChangeEvent(
  input: RecordGamingCenterChangeInput,
  tx?: Prisma.TransactionClient
): Promise<{ id: string } | null> {
  void invalidatePublicCacheByPrefix('public:gc:');
  void invalidatePublicCacheByPrefix('public:gamecenters:');

  if (input.gamingCenterId) {
    void invalidateTenantCache(input.gamingCenterId, input.gamingCenterSlug);
  }

  const client = (tx ?? prisma) as unknown as {
    gamingCenter?: typeof prisma.gamingCenter;
    integrationOutboxEvent?: typeof prisma.integrationOutboxEvent;
  };

  if (typeof client?.integrationOutboxEvent?.create !== 'function') {
    return null;
  }

  let resolvedSlug = input.gamingCenterSlug ?? null;
  let resolvedCity = input.city ?? null;

  if ((!resolvedSlug || !resolvedCity) && typeof client.gamingCenter?.findUnique === 'function') {
    try {
      const center = await client.gamingCenter.findUnique({
        where: { id: input.gamingCenterId },
        select: {
          slug: true,
          addresses: {
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            take: 1,
            select: { city: true },
          },
        },
      });
      if (center) {
        if (!resolvedSlug) resolvedSlug = center.slug ?? null;
        if (!resolvedCity) resolvedCity = center.addresses?.[0]?.city?.trim() || null;
      }
    } catch {
      // Best-effort metadata lookup; never block mutation
    }
  }

  const eventId = crypto.randomUUID();
  const occurredAt = new Date().toISOString();
  const payload = {
    eventId,
    eventType: input.eventType,
    gamingCenterId: input.gamingCenterId,
    gamingCenterSlug: resolvedSlug,
    city: resolvedCity,
    changedFields: input.changedFields ?? [],
    metadata: input.metadata ?? {},
    occurredAt,
  };

  try {
    const created = await client.integrationOutboxEvent.create({
      data: {
        eventType: input.eventType,
        gamingCenterId: input.gamingCenterId,
        gamingCenterSlug: resolvedSlug,
        city: resolvedCity,
        payload: payload as Prisma.InputJsonValue,
        status: 'PENDING',
        idempotencyKey: `${input.eventType}:${input.gamingCenterId}:${eventId}`,
      },
      select: { id: true },
    });

    try {
      const { queueIntegrationWebhookDispatch } = await import(
        '../../jobs/producers/integrationWebhook.producer'
      );
      await queueIntegrationWebhookDispatch(created.id, tx ? 500 : 0);
    } catch (err) {
      logger.warn({
        msg: 'Failed to enqueue integration webhook job; outbox sweeper will recover',
        outboxEventId: created.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return created;
  } catch (err) {
    logger.error({
      msg: 'Failed to record integration outbox event',
      gamingCenterId: input.gamingCenterId,
      eventType: input.eventType,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
