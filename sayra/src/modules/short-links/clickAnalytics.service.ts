import { Request } from 'express';
import { ShortLinkClickClassification } from '@prisma/client';
import logger from '../../config/logger';
import {
  buildIpBucketHash,
  buildVisitorFingerprint,
  extractClientIp,
  extractGeoFromHeaders,
  parseReferrerAndSource,
  parseUserAgent,
} from './clickClassifier';
import { checkAndTrackClickSignals } from './shortLinkCache';
import { ShortLinksRepo } from './shortLinks.repo';
import { ShortLinkClickEventJobData } from './shortLinks.types';

const pendingAnalyticsTasks = new Set<Promise<void>>();

/**
 * Waits for any in-flight background click persistence tasks (primarily for test assertions & graceful shutdown).
 */
export async function flushPendingClickAnalytics(): Promise<void> {
  if (pendingAnalyticsTasks.size === 0) return;
  await Promise.allSettled(Array.from(pendingAnalyticsTasks));
}

export interface RecordRedirectClickInput {
  shortLinkId: string;
  campaignId: string | null;
  gamingCenterId: string | null;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  req: Request;
}

export const ClickAnalyticsService = {
  async processClickEvent(event: ShortLinkClickEventJobData): Promise<void> {
    await ShortLinksRepo.persistClickEvent({
      ...event,
      clickedAt: new Date(event.clickedAt),
    });
  },

  async recordClickEventFromRequest(input: RecordRedirectClickInput): Promise<void> {
    const now = new Date();
    const utcDate = now.toISOString().slice(0, 10);
    const clientIp = extractClientIp(input.req);
    const rawUa = typeof input.req.headers['user-agent'] === 'string'
      ? input.req.headers['user-agent']
      : undefined;
    const rawReferer = typeof input.req.headers.referer === 'string'
      ? input.req.headers.referer
      : typeof input.req.headers.referrer === 'string'
        ? input.req.headers.referrer
        : undefined;

    const ua = parseUserAgent(rawUa);
    const visitorHash = buildVisitorFingerprint(clientIp, rawUa || '', input.shortLinkId, utcDate);
    const ipBucketHash = buildIpBucketHash(clientIp);
    const { referrer, referrerDomain, trafficSource } = parseReferrerAndSource(
      rawReferer,
      input.utmSource,
      input.utmMedium
    );
    const { countryCode, region } = extractGeoFromHeaders(input.req.headers);

    const signals = await checkAndTrackClickSignals(
      input.shortLinkId,
      visitorHash,
      ipBucketHash,
      utcDate
    );

    let classification: ShortLinkClickClassification = ShortLinkClickClassification.VALID;
    let botReason: string | null = ua.botReason;

    if (ua.isBot) {
      classification = ShortLinkClickClassification.BOT;
    } else if (signals.isBurstSuspicious) {
      classification = ShortLinkClickClassification.SUSPICIOUS;
      botReason = 'burst_rate_exceeded';
    } else if (signals.isDuplicate) {
      classification = ShortLinkClickClassification.DUPLICATE;
    }

    const jobData: ShortLinkClickEventJobData = {
      shortLinkId: input.shortLinkId,
      campaignId: input.campaignId,
      gamingCenterId: input.gamingCenterId,
      clickedAt: now.toISOString(),
      classification,
      isUniqueVisitor: signals.isUniqueVisitor && !ua.isBot,
      visitorHash,
      deviceType: ua.deviceType,
      os: ua.os,
      browser: ua.browser,
      countryCode,
      region,
      referrer,
      referrerDomain,
      trafficSource,
      utmSource: input.utmSource || null,
      utmMedium: input.utmMedium || null,
      utmCampaign: input.utmCampaign || null,
      utmTerm: input.utmTerm || null,
      utmContent: input.utmContent || null,
      botReason,
    };

    // Enqueue onto BullMQ in production; execute directly as fallback or in test mode
    if (process.env.NODE_ENV !== 'test') {
      try {
        const { enqueueShortLinkClickJob } = await import('../../jobs/producers/shortLinkClicks.producer');
        await enqueueShortLinkClickJob(jobData);
        return;
      } catch (err) {
        logger.warn({
          msg: 'Failed to enqueue short-link click job, falling back to inline write',
          shortLinkId: input.shortLinkId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await this.processClickEvent(jobData);
  },

  /**
   * Fires click classification & storage without blocking HTTP redirect latency.
   */
  recordClickNonBlocking(input: RecordRedirectClickInput): void {
    const task = this.recordClickEventFromRequest(input)
      .catch((err) => {
        logger.warn({
          msg: 'ShortLink click tracking error (non-blocking)',
          shortLinkId: input.shortLinkId,
          error: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        pendingAnalyticsTasks.delete(task);
      });

    pendingAnalyticsTasks.add(task);
  },
};
