import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const AnalyticsEventSchema = z.object({
  eventType: z.enum([
    'page_view',
    'center_view',
    'station_view',
    'booking_started',
    'checkout_started',
    'payment_succeeded',
    'booking_completed',
    'booking_cancelled',
  ]),
  visitorId: z.string().min(1).max(100),
  sessionId: z.string().min(1).max(100),
  gamingCenterId: z.string().optional(),
  pagePath: z.string().max(500).optional(),
  stationId: z.string().optional(),
  reservationId: z.string().optional(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
  deduplicationKey: z.string().max(200).optional(),
  timestamp: z.coerce.date().optional(),
  payload: z.record(z.unknown()).optional(),
});

export type AnalyticsEventInput = z.infer<typeof AnalyticsEventSchema>;

const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'token',
  'secret',
  'creditcard',
  'cardnumber',
  'cvv',
  'ssn',
  'ip',
  'ipaddress',
  'fingerprint',
  'auth',
];

function sanitizePayload(rawPayload?: Record<string, unknown>): Record<string, unknown> {
  if (!rawPayload || typeof rawPayload !== 'object') return {};
  const sanitized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(rawPayload)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED_SENSITIVE]';
    } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      sanitized[key] = sanitizePayload(val as Record<string, unknown>);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export const EventsCollector = {
  async collectEvent(input: AnalyticsEventInput) {
    const validated = AnalyticsEventSchema.parse(input);

    const now = new Date();
    let eventTime = validated.timestamp || now;
    const timeDiffMs = Math.abs(now.getTime() - eventTime.getTime());

    // Sanity check timestamp: if > 7 days old or > 5 min in future, reset to now
    if (eventTime.getTime() > now.getTime() + 5 * 60 * 1000 || timeDiffMs > 7 * 24 * 60 * 60 * 1000) {
      eventTime = now;
    }

    // Deduplication Key Construction
    const effectiveDedupKey =
      validated.deduplicationKey ||
      `${validated.visitorId}:${validated.eventType}:${validated.pagePath || ''}:${validated.stationId || ''}:${validated.reservationId || ''}:${Math.floor(eventTime.getTime() / 60000)}`;

    // Check for existing event with same deduplicationKey
    const existing = await prisma.analyticsEvent.findUnique({
      where: { deduplicationKey: effectiveDedupKey },
    });

    if (existing) {
      return {
        status: 'DUPLICATE_IGNORED',
        eventId: existing.id,
        eventType: existing.eventType,
        deduplicationKey: effectiveDedupKey,
      };
    }

    // Sanitize Payload
    const cleanPayload = sanitizePayload(validated.payload);

    // Server-side Payment Verification for Client Payment Claims
    if (validated.eventType === 'payment_succeeded' || validated.eventType === 'booking_completed') {
      if (validated.reservationId) {
        const res = await prisma.reservation.findUnique({
          where: { id: validated.reservationId },
          select: { paymentState: true, status: true },
        });

        const isServerVerified =
          res &&
          (res.paymentState === 'PAID' || res.status === 'COMPLETED' || res.status === 'CONFIRMED');

        cleanPayload._serverVerified = Boolean(isServerVerified);
        cleanPayload._verificationSource = 'SERVER_DATABASE_CHECK';
      } else {
        cleanPayload._serverVerified = false;
        cleanPayload._verificationSource = 'UNVERIFIED_CLIENT_CLAIM';
      }
    }

    // Save Event
    const created = await prisma.analyticsEvent.create({
      data: {
        gamingCenterId: validated.gamingCenterId || null,
        eventType: validated.eventType,
        visitorId: validated.visitorId,
        sessionId: validated.sessionId,
        pagePath: validated.pagePath || null,
        stationId: validated.stationId || null,
        reservationId: validated.reservationId || null,
        utmSource: validated.utmSource || null,
        utmMedium: validated.utmMedium || null,
        utmCampaign: validated.utmCampaign || null,
        deduplicationKey: effectiveDedupKey,
        payload: cleanPayload as Prisma.InputJsonValue,
        timestamp: eventTime,
      },
    });

    return {
      status: 'COLLECTED',
      eventId: created.id,
      eventType: created.eventType,
      deduplicationKey: created.deduplicationKey,
    };
  },
};
