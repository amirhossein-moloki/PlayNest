import { Request } from 'express';
import httpStatus from 'http-status';
import {
  AllowedDomainRuleType,
  Prisma,
  SessionActorType,
  ShortLinkCampaignStatus,
  ShortLinkClickClassification,
  ShortLinkOwnerType,
  ShortLinkStatus,
  ShortLinkTargetCategory,
} from '@prisma/client';
import { env } from '../../config/env';
import AppError from '../../common/errors/AppError';
import { formatPaginatedResult } from '../../common/utils/pagination';
import { auditService } from '../audit/audit.station';
import { extractClientIp, hashSensitiveValue } from './clickClassifier';
import { ClickAnalyticsService } from './clickAnalytics.service';
import { generateShortLinkQr, QrErrorCorrectionLevel } from './qrCode.generator';
import {
  buildShortUrl,
  generateShortCode,
  isValidShortCodeFormat,
  normalizeShortCode,
  RESERVED_SHORT_CODES,
  validateCustomCode,
} from './shortCode';
import {
  checkAndReserveMaxClickQuota,
  getCachedShortLinkByCode,
  invalidateShortLinkCache,
} from './shortLinkCache';
import { ShortLinksRepo } from './shortLinks.repo';
import {
  CachedShortLinkPayload,
  QrRequestParams,
  ShortLinkActor,
  ShortLinkPublicSummaryDto,
  ShortLinkQrConfig,
} from './shortLinks.types';
import {
  CreateShortLinkCampaignInput,
  CreateShortLinkInput,
  ListCampaignsQuery,
  ListShortLinksQuery,
  UpdateShortLinkCampaignInput,
  UpdateShortLinkInput,
} from './shortLinks.validators';
import {
  composeRedirectTargetUrl,
  invalidateDomainRulesCache,
  isDestinationBlockedForRedirect,
  validateAndNormalizeDestinationUrl,
} from './urlSecurity';

function isPlatformAdminActor(actor: ShortLinkActor): boolean {
  return actor.actorType === SessionActorType.PLATFORM_ADMIN || Boolean(actor.isSuperuser);
}

function isCenterPrivilegedActor(actor: ShortLinkActor): boolean {
  return actor.role === 'MANAGER' || actor.role === 'ADMIN';
}

function assertNonCustomerActor(actor: ShortLinkActor): void {
  if (actor.actorType === SessionActorType.CUSTOMER) {
    throw new AppError(
      'Forbidden: Short link management is restricted to staff, managers, and platform admins.',
      httpStatus.FORBIDDEN
    );
  }
}

function slugifyCampaignName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `campaign-${Date.now()}`;
}

function toShortLinkSummaryDto(link: {
  id: string;
  code: string;
  isCustomCode: boolean;
  destinationUrl: string;
  destinationHost: string;
  title: string | null;
  description: string | null;
  targetCategory: ShortLinkTargetCategory;
  targetEntityId: string | null;
  ownerType: ShortLinkOwnerType;
  gamingCenterId: string | null;
  ownerUserId: string | null;
  campaignId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  appendUtmParams: boolean;
  status: ShortLinkStatus;
  redirectStatusCode: number;
  expiresAt: Date | null;
  maxClicks: number | null;
  qrConfig: unknown;
  totalClicks: number;
  validClicks: number;
  uniqueClicks: number;
  duplicateClicks: number;
  botClicks: number;
  suspiciousClicks: number;
  lastClickedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  campaign?: unknown;
  gamingCenter?: unknown;
}): ShortLinkPublicSummaryDto & { campaign?: unknown; gamingCenter?: unknown } {
  return {
    id: link.id,
    code: link.code,
    shortUrl: buildShortUrl(link.code),
    isCustomCode: link.isCustomCode,
    destinationUrl: link.destinationUrl,
    destinationHost: link.destinationHost,
    title: link.title,
    description: link.description,
    targetCategory: link.targetCategory,
    targetEntityId: link.targetEntityId,
    ownerType: link.ownerType,
    gamingCenterId: link.gamingCenterId,
    ownerUserId: link.ownerUserId,
    campaignId: link.campaignId,
    utmSource: link.utmSource,
    utmMedium: link.utmMedium,
    utmCampaign: link.utmCampaign,
    utmTerm: link.utmTerm,
    utmContent: link.utmContent,
    appendUtmParams: link.appendUtmParams,
    status: link.status,
    redirectStatusCode: link.redirectStatusCode,
    expiresAt: link.expiresAt,
    maxClicks: link.maxClicks,
    qrConfig: (link.qrConfig as ShortLinkQrConfig | null) ?? null,
    totalClicks: link.totalClicks,
    validClicks: link.validClicks,
    uniqueClicks: link.uniqueClicks,
    duplicateClicks: link.duplicateClicks,
    botClicks: link.botClicks,
    suspiciousClicks: link.suspiciousClicks,
    lastClickedAt: link.lastClickedAt,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
    ...(link.campaign !== undefined ? { campaign: link.campaign } : {}),
    ...(link.gamingCenter !== undefined ? { gamingCenter: link.gamingCenter } : {}),
  };
}

function assertActorCanAccessLink(
  actor: ShortLinkActor,
  link: {
    deletedAt: Date | null;
    ownerType: ShortLinkOwnerType;
    gamingCenterId: string | null;
    ownerUserId: string | null;
  }
): void {
  assertNonCustomerActor(actor);

  if (!link || link.deletedAt) {
    throw new AppError('Short link not found.', httpStatus.NOT_FOUND, { code: 'SHORT_LINK_NOT_FOUND' });
  }

  if (isPlatformAdminActor(actor)) {
    return;
  }

  if (isCenterPrivilegedActor(actor)) {
    if (actor.gamingCenterId && link.gamingCenterId === actor.gamingCenterId) {
      return;
    }
    throw new AppError('Short link not found.', httpStatus.NOT_FOUND, { code: 'SHORT_LINK_NOT_FOUND' });
  }

  if (link.ownerUserId && link.ownerUserId === actor.id && link.ownerType === ShortLinkOwnerType.USER) {
    return;
  }

  throw new AppError('Short link not found.', httpStatus.NOT_FOUND, { code: 'SHORT_LINK_NOT_FOUND' });
}

function assertActorCanAccessCampaign(
  actor: ShortLinkActor,
  campaign: {
    deletedAt: Date | null;
    gamingCenterId: string | null;
    createdByUserId: string | null;
  }
): void {
  assertNonCustomerActor(actor);

  if (!campaign || campaign.deletedAt) {
    throw new AppError('Short link campaign not found.', httpStatus.NOT_FOUND, { code: 'CAMPAIGN_NOT_FOUND' });
  }

  if (isPlatformAdminActor(actor)) {
    return;
  }

  if (isCenterPrivilegedActor(actor) && actor.gamingCenterId && campaign.gamingCenterId === actor.gamingCenterId) {
    return;
  }

  throw new AppError('Short link campaign not found.', httpStatus.NOT_FOUND, { code: 'CAMPAIGN_NOT_FOUND' });
}

function resolveOwnershipForCreate(
  actor: ShortLinkActor,
  requestedGamingCenterId?: string
): {
  ownerType: ShortLinkOwnerType;
  gamingCenterId: string | null;
  ownerUserId: string | null;
  createdByUserId: string | null;
  createdByAdminId: string | null;
} {
  assertNonCustomerActor(actor);

  if (isPlatformAdminActor(actor)) {
    if (requestedGamingCenterId) {
      return {
        ownerType: ShortLinkOwnerType.GAMING_CENTER,
        gamingCenterId: requestedGamingCenterId,
        ownerUserId: null,
        createdByUserId: null,
        createdByAdminId: actor.id,
      };
    }
    return {
      ownerType: ShortLinkOwnerType.PLATFORM,
      gamingCenterId: null,
      ownerUserId: null,
      createdByUserId: null,
      createdByAdminId: actor.id,
    };
  }

  if (!actor.gamingCenterId) {
    return {
      ownerType: ShortLinkOwnerType.USER,
      gamingCenterId: null,
      ownerUserId: actor.id,
      createdByUserId: actor.id,
      createdByAdminId: null,
    };
  }

  if (requestedGamingCenterId && requestedGamingCenterId !== actor.gamingCenterId) {
    throw new AppError('GamingCenter not found.', httpStatus.NOT_FOUND);
  }

  if (isCenterPrivilegedActor(actor)) {
    return {
      ownerType: ShortLinkOwnerType.GAMING_CENTER,
      gamingCenterId: actor.gamingCenterId,
      ownerUserId: actor.id,
      createdByUserId: actor.id,
      createdByAdminId: null,
    };
  }

  return {
    ownerType: ShortLinkOwnerType.USER,
    gamingCenterId: actor.gamingCenterId,
    ownerUserId: actor.id,
    createdByUserId: actor.id,
    createdByAdminId: null,
  };
}

function serializeAuditContext(req?: Request): { ip?: string; ipHash?: string; userAgent?: string } {
  if (!req) return {};
  const rawIp = extractClientIp(req);
  const ipHash = rawIp !== 'unknown' ? hashSensitiveValue(rawIp, 'audit') : undefined;
  const rawUa = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 300) : undefined;
  return { ip: rawIp, ipHash, userAgent: rawUa };
}

function incrementBucket(map: Map<string, number>, rawKey: string | null | undefined, fallback = 'unknown'): void {
  const key = (rawKey || fallback).trim() || fallback;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function mapToSortedBreakdown(map: Map<string, number>, limit = 20): Array<{ key: string; count: number }> {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

export const ShortLinksService = {
  async createLink(
    actor: ShortLinkActor,
    input: CreateShortLinkInput,
    req?: Request
  ) {
    const ownership = resolveOwnershipForCreate(actor, input.gamingCenterId);

    // Enforce tenant link quota for non-platform admins
    if (!isPlatformAdminActor(actor) && ownership.gamingCenterId) {
      const existingCount = await ShortLinksRepo.countActiveCenterLinks(ownership.gamingCenterId);
      const maxLinks = env.SHORT_LINK_MAX_PER_CENTER || 500;
      if (existingCount >= maxLinks) {
        throw new AppError(
          `Short link quota exceeded (max ${maxLinks} active links per gaming center).`,
          httpStatus.TOO_MANY_REQUESTS,
          { code: 'SHORT_LINK_QUOTA_EXCEEDED' }
        );
      }
    }

    // Validate campaign binding & tenant match
    if (input.campaignId) {
      const campaign = await ShortLinksRepo.findCampaignById(input.campaignId);
      if (!campaign || campaign.deletedAt) {
        throw new AppError('Campaign not found.', httpStatus.NOT_FOUND, { code: 'CAMPAIGN_NOT_FOUND' });
      }
      if (!isPlatformAdminActor(actor)) {
        if (!ownership.gamingCenterId || campaign.gamingCenterId !== ownership.gamingCenterId) {
          throw new AppError('Campaign not found.', httpStatus.NOT_FOUND, { code: 'CAMPAIGN_NOT_FOUND' });
        }
      }
    }

    if (input.expiresAt && new Date(input.expiresAt) <= new Date()) {
      throw new AppError('expiresAt must be a future date.', httpStatus.BAD_REQUEST, {
        code: 'INVALID_EXPIRATION_DATE',
      });
    }

    const validatedUrl = await validateAndNormalizeDestinationUrl(input.destinationUrl, {
      ownCode: input.customCode,
    });

    const ctx = serializeAuditContext(req);

    // Resolve unique short code (either custom or auto-generated CSPRNG with collision retries)
    let code = '';
    let normalizedCode = '';
    let isCustomCode = false;

    if (input.customCode) {
      const custom = validateCustomCode(input.customCode);
      const conflict = await ShortLinksRepo.findByNormalizedCode(custom.normalizedCode);
      if (conflict) {
        throw new AppError(
          `Short code "${custom.code}" is already in use.`,
          httpStatus.CONFLICT,
          { code: 'SHORT_CODE_ALREADY_EXISTS' }
        );
      }
      code = custom.code;
      normalizedCode = custom.normalizedCode;
      isCustomCode = true;
    } else {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = generateShortCode(env.SHORT_LINK_CODE_LENGTH || 7);
        const norm = normalizeShortCode(candidate);
        if (RESERVED_SHORT_CODES.has(norm)) continue;
        const exists = await ShortLinksRepo.findByNormalizedCode(norm);
        if (!exists) {
          code = candidate;
          normalizedCode = norm;
          break;
        }
      }
      if (!code) {
        throw new AppError(
          'Unable to allocate a unique short code after retries.',
          httpStatus.SERVICE_UNAVAILABLE,
          { code: 'SHORT_CODE_GENERATION_FAILED' }
        );
      }
    }

    try {
      const created = await ShortLinksRepo.createLink(
        {
          code,
          normalizedCode,
          isCustomCode,
          destinationUrl: validatedUrl.normalizedUrl,
          destinationHost: validatedUrl.destinationHost,
          title: input.title ?? null,
          description: input.description ?? null,
          targetCategory: input.targetCategory ?? ShortLinkTargetCategory.OTHER,
          targetEntityId: input.targetEntityId ?? null,
          ownerType: ownership.ownerType,
          gamingCenterId: ownership.gamingCenterId,
          ownerUserId: ownership.ownerUserId,
          createdByUserId: ownership.createdByUserId,
          createdByAdminId: ownership.createdByAdminId,
          campaignId: input.campaignId ?? null,
          utmSource: input.utmSource ?? null,
          utmMedium: input.utmMedium ?? null,
          utmCampaign: input.utmCampaign ?? null,
          utmTerm: input.utmTerm ?? null,
          utmContent: input.utmContent ?? null,
          appendUtmParams: input.appendUtmParams ?? true,
          status: input.status ?? ShortLinkStatus.ACTIVE,
          redirectStatusCode: input.redirectStatusCode ?? 302,
          expiresAt: input.expiresAt ?? null,
          maxClicks: input.maxClicks ?? null,
          qrConfig: input.qrConfig ? (input.qrConfig as Prisma.InputJsonValue) : Prisma.JsonNull,
          metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
        {
          actorType: actor.actorType,
          actorUserId: isPlatformAdminActor(actor) ? undefined : actor.id,
          actorAdminId: isPlatformAdminActor(actor) ? actor.id : undefined,
          ipHash: ctx.ipHash,
          userAgent: ctx.userAgent,
        }
      );

      await auditService.recordLog({
        gamingCenterId: created.gamingCenterId ?? undefined,
        userId: isPlatformAdminActor(actor) ? undefined : actor.id,
        platformAdminId: isPlatformAdminActor(actor) ? actor.id : undefined,
        actorType: actor.actorType,
        action: 'SHORT_LINK_CREATED',
        entity: 'ShortLink',
        entityId: created.id,
        newData: {
          code: created.code,
          destinationHost: created.destinationHost,
          campaignId: created.campaignId,
        },
        ipAddress: ctx.ipHash,
        userAgent: ctx.userAgent,
      });

      return toShortLinkSummaryDto(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError(
          `Short code "${code}" is already taken.`,
          httpStatus.CONFLICT,
          { code: 'SHORT_CODE_ALREADY_EXISTS' }
        );
      }
      throw err;
    }
  },

  async createInternalShortLink(params: {
    actor: ShortLinkActor;
    relativePath: string;
    targetCategory: ShortLinkTargetCategory;
    targetEntityId?: string;
    title?: string;
    gamingCenterId?: string;
    campaignId?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    req?: Request;
  }) {
    const baseFrontend = (env.FRONTEND_URL || 'https://sayra-booking.ir').replace(/\/+$/, '');
    const normalizedPath = params.relativePath.startsWith('/')
      ? params.relativePath
      : `/${params.relativePath}`;

    return this.createLink(
      params.actor,
      {
        destinationUrl: `${baseFrontend}${normalizedPath}`,
        title: params.title,
        targetCategory: params.targetCategory,
        targetEntityId: params.targetEntityId,
        gamingCenterId: params.gamingCenterId,
        campaignId: params.campaignId,
        utmSource: params.utmSource,
        utmMedium: params.utmMedium,
        utmCampaign: params.utmCampaign,
        appendUtmParams: true,
        status: ShortLinkStatus.ACTIVE,
        redirectStatusCode: 302,
      },
      params.req
    );
  },

  async listLinks(actor: ShortLinkActor, query: ListShortLinksQuery) {
    assertNonCustomerActor(actor);
    const isAdmin = isPlatformAdminActor(actor);
    const search = query.search || query.q;

    let scopedGamingCenterId: string | undefined = query.gamingCenterId;
    let scopedOwnerUserId: string | undefined;

    if (!isAdmin) {
      if (isCenterPrivilegedActor(actor) && actor.gamingCenterId) {
        scopedGamingCenterId = actor.gamingCenterId;
      } else {
        scopedOwnerUserId = actor.id;
        scopedGamingCenterId = undefined;
      }
    }

    const { items, total } = await ShortLinksRepo.listLinks({
      gamingCenterId: scopedGamingCenterId,
      ownerUserId: scopedOwnerUserId,
      search,
      status: query.status,
      targetCategory: query.targetCategory,
      campaignId: query.campaignId,
      isCustomCode: query.isCustomCode,
      expiredOnly: query.expiredOnly,
      includeDeleted: isAdmin ? query.includeDeleted : false,
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return formatPaginatedResult(items.map(toShortLinkSummaryDto), total, query.page, query.limit);
  },

  async getLinkById(actor: ShortLinkActor, linkId: string) {
    const link = await ShortLinksRepo.findById(linkId);
    assertActorCanAccessLink(actor, link as NonNullable<typeof link>);
    return toShortLinkSummaryDto(link!);
  },

  async updateLink(
    actor: ShortLinkActor,
    linkId: string,
    input: UpdateShortLinkInput,
    req?: Request
  ) {
    const existing = await ShortLinksRepo.findById(linkId);
    assertActorCanAccessLink(actor, existing as NonNullable<typeof existing>);

    let destinationUrlUpdate: { destinationUrl: string; destinationHost: string } | undefined;
    if (input.destinationUrl !== undefined) {
      const validated = await validateAndNormalizeDestinationUrl(input.destinationUrl, {
        ownCode: existing!.code,
      });
      destinationUrlUpdate = {
        destinationUrl: validated.normalizedUrl,
        destinationHost: validated.destinationHost,
      };
    }

    if (input.campaignId) {
      const campaign = await ShortLinksRepo.findCampaignById(input.campaignId);
      if (!campaign || campaign.deletedAt) {
        throw new AppError('Campaign not found.', httpStatus.NOT_FOUND, { code: 'CAMPAIGN_NOT_FOUND' });
      }
      if (!isPlatformAdminActor(actor) && campaign.gamingCenterId !== existing!.gamingCenterId) {
        throw new AppError('Campaign not found.', httpStatus.NOT_FOUND, { code: 'CAMPAIGN_NOT_FOUND' });
      }
    }

    const updateData: Prisma.ShortLinkUpdateInput = {
      ...(destinationUrlUpdate ?? {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.targetCategory !== undefined ? { targetCategory: input.targetCategory } : {}),
      ...(input.targetEntityId !== undefined ? { targetEntityId: input.targetEntityId } : {}),
      ...(input.campaignId !== undefined
        ? input.campaignId === null
          ? { campaign: { disconnect: true } }
          : { campaign: { connect: { id: input.campaignId } } }
        : {}),
      ...(input.utmSource !== undefined ? { utmSource: input.utmSource } : {}),
      ...(input.utmMedium !== undefined ? { utmMedium: input.utmMedium } : {}),
      ...(input.utmCampaign !== undefined ? { utmCampaign: input.utmCampaign } : {}),
      ...(input.utmTerm !== undefined ? { utmTerm: input.utmTerm } : {}),
      ...(input.utmContent !== undefined ? { utmContent: input.utmContent } : {}),
      ...(input.appendUtmParams !== undefined ? { appendUtmParams: input.appendUtmParams } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.redirectStatusCode !== undefined ? { redirectStatusCode: input.redirectStatusCode } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      ...(input.maxClicks !== undefined ? { maxClicks: input.maxClicks } : {}),
      ...(input.qrConfig !== undefined
        ? {
          qrConfig:
            input.qrConfig === null ? Prisma.JsonNull : (input.qrConfig as Prisma.InputJsonValue),
        }
        : {}),
      ...(input.metadata !== undefined
        ? {
          metadata:
            input.metadata === null ? Prisma.JsonNull : (input.metadata as Prisma.InputJsonValue),
        }
        : {}),
    };

    const ctx = serializeAuditContext(req);
    const updated = await ShortLinksRepo.updateLinkWithHistory(linkId, updateData, {
      action: destinationUrlUpdate ? 'DESTINATION_AND_METADATA_UPDATED' : 'LINK_UPDATED',
      actorType: actor.actorType,
      actorUserId: isPlatformAdminActor(actor) ? undefined : actor.id,
      actorAdminId: isPlatformAdminActor(actor) ? actor.id : undefined,
      previousDestinationUrl: destinationUrlUpdate ? existing!.destinationUrl : undefined,
      newDestinationUrl: destinationUrlUpdate?.destinationUrl,
      changes: input as Prisma.InputJsonValue,
      ipHash: ctx.ipHash,
      userAgent: ctx.userAgent,
    });

    await invalidateShortLinkCache(existing!.normalizedCode);

    await auditService.recordLog({
      gamingCenterId: existing!.gamingCenterId ?? undefined,
      userId: isPlatformAdminActor(actor) ? undefined : actor.id,
      platformAdminId: isPlatformAdminActor(actor) ? actor.id : undefined,
      actorType: actor.actorType,
      action: 'SHORT_LINK_UPDATED',
      entity: 'ShortLink',
      entityId: linkId,
      oldData: {
        destinationUrl: existing!.destinationUrl,
        status: existing!.status,
      },
      newData: {
        destinationUrl: updated.destinationUrl,
        status: updated.status,
      },
      ipAddress: ctx.ipHash,
      userAgent: ctx.userAgent,
    });

    return toShortLinkSummaryDto(updated);
  },

  async changeDestination(
    actor: ShortLinkActor,
    linkId: string,
    destinationUrl: string,
    reason?: string,
    req?: Request
  ) {
    const existing = await ShortLinksRepo.findById(linkId);
    assertActorCanAccessLink(actor, existing as NonNullable<typeof existing>);

    const validated = await validateAndNormalizeDestinationUrl(destinationUrl, {
      ownCode: existing!.code,
    });

    const ctx = serializeAuditContext(req);
    const updated = await ShortLinksRepo.updateLinkWithHistory(
      linkId,
      {
        destinationUrl: validated.normalizedUrl,
        destinationHost: validated.destinationHost,
      },
      {
        action: 'DESTINATION_CHANGED',
        actorType: actor.actorType,
        actorUserId: isPlatformAdminActor(actor) ? undefined : actor.id,
        actorAdminId: isPlatformAdminActor(actor) ? actor.id : undefined,
        previousDestinationUrl: existing!.destinationUrl,
        newDestinationUrl: validated.normalizedUrl,
        changes: { reason: reason ?? null },
        ipHash: ctx.ipHash,
        userAgent: ctx.userAgent,
      }
    );

    await invalidateShortLinkCache(existing!.normalizedCode);

    await auditService.recordLog({
      gamingCenterId: existing!.gamingCenterId ?? undefined,
      userId: isPlatformAdminActor(actor) ? undefined : actor.id,
      platformAdminId: isPlatformAdminActor(actor) ? actor.id : undefined,
      actorType: actor.actorType,
      action: 'SHORT_LINK_DESTINATION_CHANGED',
      entity: 'ShortLink',
      entityId: linkId,
      oldData: { destinationUrl: existing!.destinationUrl },
      newData: { destinationUrl: validated.normalizedUrl, reason: reason ?? null },
      ipAddress: ctx.ipHash,
      userAgent: ctx.userAgent,
    });

    return toShortLinkSummaryDto(updated);
  },

  async updateLinkStatus(
    actor: ShortLinkActor,
    linkId: string,
    status: ShortLinkStatus,
    reason?: string,
    req?: Request
  ) {
    const existing = await ShortLinksRepo.findById(linkId);
    assertActorCanAccessLink(actor, existing as NonNullable<typeof existing>);

    const ctx = serializeAuditContext(req);
    const updated = await ShortLinksRepo.updateLinkWithHistory(
      linkId,
      { status },
      {
        action: 'STATUS_CHANGED',
        actorType: actor.actorType,
        actorUserId: isPlatformAdminActor(actor) ? undefined : actor.id,
        actorAdminId: isPlatformAdminActor(actor) ? actor.id : undefined,
        changes: {
          previousStatus: existing!.status,
          newStatus: status,
          reason: reason ?? null,
        },
        ipHash: ctx.ipHash,
        userAgent: ctx.userAgent,
      }
    );

    await invalidateShortLinkCache(existing!.normalizedCode);

    await auditService.recordLog({
      gamingCenterId: existing!.gamingCenterId ?? undefined,
      userId: isPlatformAdminActor(actor) ? undefined : actor.id,
      platformAdminId: isPlatformAdminActor(actor) ? actor.id : undefined,
      actorType: actor.actorType,
      action: 'SHORT_LINK_STATUS_CHANGED',
      entity: 'ShortLink',
      entityId: linkId,
      oldData: { status: existing!.status },
      newData: { status, reason: reason ?? null },
      ipAddress: ctx.ipHash,
      userAgent: ctx.userAgent,
    });

    return toShortLinkSummaryDto(updated);
  },

  async deleteLink(actor: ShortLinkActor, linkId: string, req?: Request): Promise<void> {
    const existing = await ShortLinksRepo.findById(linkId);
    assertActorCanAccessLink(actor, existing as NonNullable<typeof existing>);

    const ctx = serializeAuditContext(req);
    await ShortLinksRepo.updateLinkWithHistory(
      linkId,
      {
        status: ShortLinkStatus.ARCHIVED,
        deletedAt: new Date(),
      },
      {
        action: 'LINK_DELETED',
        actorType: actor.actorType,
        actorUserId: isPlatformAdminActor(actor) ? undefined : actor.id,
        actorAdminId: isPlatformAdminActor(actor) ? actor.id : undefined,
        changes: { previousStatus: existing!.status, deleted: true },
        ipHash: ctx.ipHash,
        userAgent: ctx.userAgent,
      }
    );

    await invalidateShortLinkCache(existing!.normalizedCode);

    await auditService.recordLog({
      gamingCenterId: existing!.gamingCenterId ?? undefined,
      userId: isPlatformAdminActor(actor) ? undefined : actor.id,
      platformAdminId: isPlatformAdminActor(actor) ? actor.id : undefined,
      actorType: actor.actorType,
      action: 'SHORT_LINK_DELETED',
      entity: 'ShortLink',
      entityId: linkId,
      oldData: { code: existing!.code, status: existing!.status },
      ipAddress: ctx.ipHash,
      userAgent: ctx.userAgent,
    });
  },

  async getLinkHistory(actor: ShortLinkActor, linkId: string, page: number, limit: number) {
    const existing = await ShortLinksRepo.findById(linkId);
    assertActorCanAccessLink(actor, existing as NonNullable<typeof existing>);
    const { items, total } = await ShortLinksRepo.findChangeLogs(linkId, page, limit);
    return formatPaginatedResult(items, total, page, limit);
  },

  async getLinkStats(
    actor: ShortLinkActor,
    linkId: string,
    query: { from?: string; to?: string; granularity?: 'day' | 'hour' }
  ) {
    const existing = await ShortLinksRepo.findById(linkId);
    assertActorCanAccessLink(actor, existing as NonNullable<typeof existing>);

    const now = new Date();
    const toDate = query.to ? new Date(query.to) : now;
    const fromDate = query.from
      ? new Date(query.from)
      : new Date(toDate.getTime() - 30 * 86400_000);

    const fromDayOnly = new Date(
      Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate())
    );
    const toDayOnly = new Date(
      Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate(), 23, 59, 59, 999)
    );

    const [dailyRows, clickRows] = await Promise.all([
      ShortLinksRepo.getDailyStatsForLink(linkId, fromDayOnly, toDayOnly),
      ShortLinksRepo.getClicksInRangeForLink(linkId, fromDate, toDate),
    ]);

    const byDevice = new Map<string, number>();
    const byOs = new Map<string, number>();
    const byBrowser = new Map<string, number>();
    const byCountry = new Map<string, number>();
    const byRegion = new Map<string, number>();
    const bySource = new Map<string, number>();
    const byReferrer = new Map<string, number>();
    const byUtmSource = new Map<string, number>();
    const byUtmMedium = new Map<string, number>();
    const byUtmCampaign = new Map<string, number>();
    const byClassification = new Map<string, number>();
    const hourlyBuckets = new Map<
      string,
      {
        bucket: string;
        totalClicks: number;
        validClicks: number;
        uniqueClicks: number;
        duplicateClicks: number;
        botClicks: number;
        suspiciousClicks: number;
      }
    >();

    let rangeTotal = 0;
    let rangeValid = 0;
    let rangeUnique = 0;
    let rangeDuplicate = 0;
    let rangeBot = 0;
    let rangeSuspicious = 0;

    for (const click of clickRows) {
      rangeTotal += 1;
      if (click.classification === ShortLinkClickClassification.VALID) rangeValid += 1;
      if (click.classification === ShortLinkClickClassification.DUPLICATE) rangeDuplicate += 1;
      if (click.classification === ShortLinkClickClassification.BOT) rangeBot += 1;
      if (click.classification === ShortLinkClickClassification.SUSPICIOUS) rangeSuspicious += 1;
      if (click.isUniqueVisitor) rangeUnique += 1;

      incrementBucket(byClassification, click.classification);
      incrementBucket(byDevice, click.deviceType);
      incrementBucket(byOs, click.os);
      incrementBucket(byBrowser, click.browser);
      if (click.countryCode) incrementBucket(byCountry, click.countryCode);
      if (click.region) incrementBucket(byRegion, click.region);
      incrementBucket(bySource, click.trafficSource, 'direct');
      if (click.referrerDomain) incrementBucket(byReferrer, click.referrerDomain);
      if (click.utmSource) incrementBucket(byUtmSource, click.utmSource);
      if (click.utmMedium) incrementBucket(byUtmMedium, click.utmMedium);
      if (click.utmCampaign) incrementBucket(byUtmCampaign, click.utmCampaign);

      if (query.granularity === 'hour') {
        const dt = new Date(click.clickedAt);
        const bucketKey = `${dt.toISOString().slice(0, 13)}:00Z`;
        const b = hourlyBuckets.get(bucketKey) ?? {
          bucket: bucketKey,
          totalClicks: 0,
          validClicks: 0,
          uniqueClicks: 0,
          duplicateClicks: 0,
          botClicks: 0,
          suspiciousClicks: 0,
        };
        b.totalClicks += 1;
        if (click.classification === ShortLinkClickClassification.VALID) b.validClicks += 1;
        if (click.classification === ShortLinkClickClassification.DUPLICATE) b.duplicateClicks += 1;
        if (click.classification === ShortLinkClickClassification.BOT) b.botClicks += 1;
        if (click.classification === ShortLinkClickClassification.SUSPICIOUS) b.suspiciousClicks += 1;
        if (click.isUniqueVisitor) b.uniqueClicks += 1;
        hourlyBuckets.set(bucketKey, b);
      }
    }

    const timeSeries =
      query.granularity === 'hour'
        ? Array.from(hourlyBuckets.values()).sort((a, b) => a.bucket.localeCompare(b.bucket))
        : dailyRows.length > 0
          ? dailyRows.map((d) => ({
            bucket: new Date(d.date).toISOString().slice(0, 10),
            totalClicks: d.totalClicks,
            validClicks: d.validClicks,
            uniqueClicks: d.uniqueClicks,
            duplicateClicks: d.duplicateClicks,
            botClicks: d.botClicks,
            suspiciousClicks: d.suspiciousClicks,
          }))
          : [];

    const summary =
      dailyRows.length > 0 && clickRows.length === 0
        ? dailyRows.reduce(
          (acc, d) => ({
            totalClicks: acc.totalClicks + d.totalClicks,
            validClicks: acc.validClicks + d.validClicks,
            uniqueClicks: acc.uniqueClicks + d.uniqueClicks,
            duplicateClicks: acc.duplicateClicks + d.duplicateClicks,
            botClicks: acc.botClicks + d.botClicks,
            suspiciousClicks: acc.suspiciousClicks + d.suspiciousClicks,
          }),
          { totalClicks: 0, validClicks: 0, uniqueClicks: 0, duplicateClicks: 0, botClicks: 0, suspiciousClicks: 0 }
        )
        : {
          totalClicks: rangeTotal,
          validClicks: rangeValid,
          uniqueClicks: rangeUnique,
          duplicateClicks: rangeDuplicate,
          botClicks: rangeBot,
          suspiciousClicks: rangeSuspicious,
        };

    return {
      link: toShortLinkSummaryDto(existing!),
      range: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        granularity: query.granularity || 'day',
      },
      allTimeTotals: {
        totalClicks: existing!.totalClicks,
        validClicks: existing!.validClicks,
        uniqueClicks: existing!.uniqueClicks,
        duplicateClicks: existing!.duplicateClicks,
        botClicks: existing!.botClicks,
        suspiciousClicks: existing!.suspiciousClicks,
        lastClickedAt: existing!.lastClickedAt,
      },
      rangeTotals: summary,
      timeSeries,
      breakdowns: {
        classification: mapToSortedBreakdown(byClassification),
        deviceTypes: mapToSortedBreakdown(byDevice),
        operatingSystems: mapToSortedBreakdown(byOs),
        browsers: mapToSortedBreakdown(byBrowser),
        countries: mapToSortedBreakdown(byCountry),
        regions: mapToSortedBreakdown(byRegion),
        trafficSources: mapToSortedBreakdown(bySource),
        referrers: mapToSortedBreakdown(byReferrer),
        utmSources: mapToSortedBreakdown(byUtmSource),
        utmMediums: mapToSortedBreakdown(byUtmMedium),
        utmCampaigns: mapToSortedBreakdown(byUtmCampaign),
      },
    };
  },

  async generateLinkQr(
    actor: ShortLinkActor,
    linkId: string,
    params: Partial<QrRequestParams>
  ) {
    const existing = await ShortLinksRepo.findById(linkId);
    assertActorCanAccessLink(actor, existing as NonNullable<typeof existing>);

    const savedCfg = (existing!.qrConfig as ShortLinkQrConfig | null) ?? {};
    const shortUrl = buildShortUrl(existing!.code);

    return generateShortLinkQr(shortUrl, {
      format: params.format || 'svg',
      size: params.size ?? savedCfg.size ?? 320,
      margin: params.margin ?? savedCfg.margin ?? 4,
      errorCorrectionLevel: (params.ecc ?? savedCfg.errorCorrectionLevel ?? 'M') as QrErrorCorrectionLevel,
      foreground: params.fg ?? savedCfg.foreground,
      background: params.bg ?? savedCfg.background,
    });
  },

  /**
   * High-speed public Redirect lookup & execution:
   * reads Redis hot cache first, checks lifecycle/security invariants, and fires async analytics.
   */
  async resolveRedirect(
    rawCode: string,
    req: Request
  ): Promise<{ statusCode: number; location: string; linkId: string }> {
    const trimmed = String(rawCode || '').trim();
    if (!isValidShortCodeFormat(trimmed)) {
      throw new AppError('Short link not found.', httpStatus.NOT_FOUND, { code: 'SHORT_LINK_NOT_FOUND' });
    }

    const normalizedCode = normalizeShortCode(trimmed);
    if (RESERVED_SHORT_CODES.has(normalizedCode)) {
      throw new AppError('Short link not found.', httpStatus.NOT_FOUND, { code: 'SHORT_LINK_NOT_FOUND' });
    }

    let link = await getCachedShortLinkByCode(
      normalizedCode,
      async (): Promise<CachedShortLinkPayload | null> => {
        const dbRow = await ShortLinksRepo.findByCodeForRedirect(normalizedCode);
        if (!dbRow) return null;
        return {
          id: dbRow.id,
          code: dbRow.code,
          normalizedCode: dbRow.normalizedCode,
          destinationUrl: dbRow.destinationUrl,
          destinationHost: dbRow.destinationHost,
          status: dbRow.status,
          redirectStatusCode: dbRow.redirectStatusCode,
          expiresAt: dbRow.expiresAt ? dbRow.expiresAt.toISOString() : null,
          maxClicks: dbRow.maxClicks,
          totalClicks: dbRow.totalClicks,
          deletedAt: dbRow.deletedAt ? dbRow.deletedAt.toISOString() : null,
          gamingCenterId: dbRow.gamingCenterId,
          campaignId: dbRow.campaignId,
          utmSource: dbRow.utmSource,
          utmMedium: dbRow.utmMedium,
          utmCampaign: dbRow.utmCampaign,
          utmTerm: dbRow.utmTerm,
          utmContent: dbRow.utmContent,
          appendUtmParams: dbRow.appendUtmParams,
          campaign: dbRow.campaign
            ? {
              id: dbRow.campaign.id,
              status: dbRow.campaign.status,
              startsAt: dbRow.campaign.startsAt ? dbRow.campaign.startsAt.toISOString() : null,
              endsAt: dbRow.campaign.endsAt ? dbRow.campaign.endsAt.toISOString() : null,
              utmSource: dbRow.campaign.utmSource,
              utmMedium: dbRow.campaign.utmMedium,
              utmCampaign: dbRow.campaign.utmCampaign,
              utmTerm: dbRow.campaign.utmTerm,
              utmContent: dbRow.campaign.utmContent,
            }
            : null,
        };
      }
    );

    if (link && link.maxClicks !== null) {
      const freshDbRow = await ShortLinksRepo.findByCodeForRedirect(normalizedCode);
      if (freshDbRow) {
        link = {
          ...link,
          status: freshDbRow.status,
          expiresAt: freshDbRow.expiresAt ? freshDbRow.expiresAt.toISOString() : null,
          maxClicks: freshDbRow.maxClicks,
          totalClicks: freshDbRow.totalClicks,
          deletedAt: freshDbRow.deletedAt ? freshDbRow.deletedAt.toISOString() : null,
        };
      }
    }

    if (!link || link.deletedAt) {
      throw new AppError('Short link not found.', httpStatus.NOT_FOUND, { code: 'SHORT_LINK_NOT_FOUND' });
    }

    if (link.status === ShortLinkStatus.ARCHIVED) {
      throw new AppError('This short link has been archived.', httpStatus.GONE, {
        code: 'SHORT_LINK_ARCHIVED',
      });
    }

    if (link.status === ShortLinkStatus.INACTIVE) {
      throw new AppError('This short link is currently inactive.', httpStatus.GONE, {
        code: 'SHORT_LINK_INACTIVE',
      });
    }

    if (link.expiresAt && new Date(link.expiresAt) <= new Date()) {
      throw new AppError('This short link has expired.', httpStatus.GONE, {
        code: 'SHORT_LINK_EXPIRED',
      });
    }

    if (link.maxClicks !== null && link.totalClicks >= link.maxClicks) {
      await invalidateShortLinkCache(normalizedCode);
      throw new AppError('This short link has reached its click limit.', httpStatus.GONE, {
        code: 'SHORT_LINK_MAX_CLICKS_REACHED',
      });
    }

    const blocked = await isDestinationBlockedForRedirect(link.destinationUrl, link.code);
    if (blocked) {
      throw new AppError(
        'This destination is currently blocked due to security policy.',
        451,
        { code: 'SHORT_LINK_DESTINATION_BLOCKED' }
      );
    }

    if (link.maxClicks !== null) {
      const allowed = await checkAndReserveMaxClickQuota(link.id, link.maxClicks, link.totalClicks);
      if (!allowed) {
        await invalidateShortLinkCache(normalizedCode);
        throw new AppError('This short link has reached its click limit.', httpStatus.GONE, {
          code: 'SHORT_LINK_MAX_CLICKS_REACHED',
        });
      }
      await invalidateShortLinkCache(normalizedCode);
    }

    const { finalUrl, effectiveUtm } = composeRedirectTargetUrl(
      link.destinationUrl,
      {
        utmSource: link.utmSource,
        utmMedium: link.utmMedium,
        utmCampaign: link.utmCampaign,
        utmTerm: link.utmTerm,
        utmContent: link.utmContent,
      },
      link.campaign,
      (req.query || {}) as Record<string, unknown>,
      link.appendUtmParams
    );

    ClickAnalyticsService.recordClickNonBlocking({
      shortLinkId: link.id,
      campaignId: link.campaignId,
      gamingCenterId: link.gamingCenterId,
      utmSource: effectiveUtm.utmSource,
      utmMedium: effectiveUtm.utmMedium,
      utmCampaign: effectiveUtm.utmCampaign,
      utmTerm: effectiveUtm.utmTerm,
      utmContent: effectiveUtm.utmContent,
      req,
    });

    return {
      statusCode: link.redirectStatusCode === 301 ? 301 : 302,
      location: finalUrl,
      linkId: link.id,
    };
  },

  // =====================================
  // Campaigns
  // =====================================
  async createCampaign(
    actor: ShortLinkActor,
    input: CreateShortLinkCampaignInput,
    req?: Request
  ) {
    assertNonCustomerActor(actor);
    if (!isPlatformAdminActor(actor) && !isCenterPrivilegedActor(actor)) {
      throw new AppError(
        'Forbidden: Only gaming center managers/admins or platform admins can manage campaigns.',
        httpStatus.FORBIDDEN
      );
    }
    const ownership = resolveOwnershipForCreate(actor, input.gamingCenterId);
    const slug = (input.slug ? input.slug.trim().toLowerCase() : slugifyCampaignName(input.name));

    const duplicate = await ShortLinksRepo.findCampaignBySlug(ownership.gamingCenterId, slug);
    if (duplicate) {
      throw new AppError(
        `Campaign slug "${slug}" already exists in this scope.`,
        httpStatus.CONFLICT,
        { code: 'CAMPAIGN_SLUG_ALREADY_EXISTS' }
      );
    }

    const created = await ShortLinksRepo.createCampaign({
      name: input.name,
      slug,
      description: input.description ?? null,
      ownerType: ownership.ownerType,
      gamingCenterId: ownership.gamingCenterId,
      createdByUserId: ownership.createdByUserId,
      createdByAdminId: ownership.createdByAdminId,
      status: input.status ?? ShortLinkCampaignStatus.ACTIVE,
      adSource: input.adSource ?? null,
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? slug,
      utmTerm: input.utmTerm ?? null,
      utmContent: input.utmContent ?? null,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
    });

    const ctx = serializeAuditContext(req);
    await auditService.recordLog({
      gamingCenterId: created.gamingCenterId ?? undefined,
      userId: isPlatformAdminActor(actor) ? undefined : actor.id,
      platformAdminId: isPlatformAdminActor(actor) ? actor.id : undefined,
      actorType: actor.actorType,
      action: 'SHORT_LINK_CAMPAIGN_CREATED',
      entity: 'ShortLinkCampaign',
      entityId: created.id,
      newData: { name: created.name, slug: created.slug },
      ipAddress: ctx.ipHash,
      userAgent: ctx.userAgent,
    });

    return created;
  },

  async listCampaigns(actor: ShortLinkActor, query: ListCampaignsQuery) {
    assertNonCustomerActor(actor);
    if (!isPlatformAdminActor(actor) && !isCenterPrivilegedActor(actor)) {
      throw new AppError(
        'Forbidden: Only gaming center managers/admins or platform admins can manage campaigns.',
        httpStatus.FORBIDDEN
      );
    }
    const isAdmin = isPlatformAdminActor(actor);
    const scopedCenterId = isAdmin
      ? query.gamingCenterId
      : actor.gamingCenterId;

    if (!isAdmin && !scopedCenterId) {
      return formatPaginatedResult([], 0, query.page, query.limit);
    }

    const { items, total } = await ShortLinksRepo.listCampaigns({
      gamingCenterId: scopedCenterId,
      search: query.search,
      status: query.status,
      page: query.page,
      limit: query.limit,
    });

    return formatPaginatedResult(items, total, query.page, query.limit);
  },

  async getCampaignById(actor: ShortLinkActor, campaignId: string) {
    const campaign = await ShortLinksRepo.findCampaignById(campaignId);
    assertActorCanAccessCampaign(actor, campaign as NonNullable<typeof campaign>);
    return campaign!;
  },

  async updateCampaign(
    actor: ShortLinkActor,
    campaignId: string,
    input: UpdateShortLinkCampaignInput,
    req?: Request
  ) {
    const existing = await ShortLinksRepo.findCampaignById(campaignId);
    assertActorCanAccessCampaign(actor, existing as NonNullable<typeof existing>);

    const updated = await ShortLinksRepo.updateCampaign(campaignId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.adSource !== undefined ? { adSource: input.adSource } : {}),
      ...(input.utmSource !== undefined ? { utmSource: input.utmSource } : {}),
      ...(input.utmMedium !== undefined ? { utmMedium: input.utmMedium } : {}),
      ...(input.utmCampaign !== undefined ? { utmCampaign: input.utmCampaign } : {}),
      ...(input.utmTerm !== undefined ? { utmTerm: input.utmTerm } : {}),
      ...(input.utmContent !== undefined ? { utmContent: input.utmContent } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
    });

    // Evict cached redirects for campaign links if campaign UTM settings changed
    const links = await ShortLinksRepo.findCampaignLinks(campaignId);
    await Promise.all(links.map((l) => invalidateShortLinkCache(l.normalizedCode)));

    const ctx = serializeAuditContext(req);
    await auditService.recordLog({
      gamingCenterId: existing!.gamingCenterId ?? undefined,
      userId: isPlatformAdminActor(actor) ? undefined : actor.id,
      platformAdminId: isPlatformAdminActor(actor) ? actor.id : undefined,
      actorType: actor.actorType,
      action: 'SHORT_LINK_CAMPAIGN_UPDATED',
      entity: 'ShortLinkCampaign',
      entityId: campaignId,
      newData: input,
      ipAddress: ctx.ipHash,
      userAgent: ctx.userAgent,
    });

    return updated;
  },

  async updateCampaignStatus(
    actor: ShortLinkActor,
    campaignId: string,
    status: ShortLinkCampaignStatus,
    req?: Request
  ) {
    return this.updateCampaign(actor, campaignId, { status }, req);
  },

  async deleteCampaign(actor: ShortLinkActor, campaignId: string, req?: Request): Promise<void> {
    const existing = await ShortLinksRepo.findCampaignById(campaignId);
    assertActorCanAccessCampaign(actor, existing as NonNullable<typeof existing>);

    await ShortLinksRepo.updateCampaign(campaignId, {
      status: ShortLinkCampaignStatus.ARCHIVED,
      deletedAt: new Date(),
    });

    const ctx = serializeAuditContext(req);
    await auditService.recordLog({
      gamingCenterId: existing!.gamingCenterId ?? undefined,
      userId: isPlatformAdminActor(actor) ? undefined : actor.id,
      platformAdminId: isPlatformAdminActor(actor) ? actor.id : undefined,
      actorType: actor.actorType,
      action: 'SHORT_LINK_CAMPAIGN_DELETED',
      entity: 'ShortLinkCampaign',
      entityId: campaignId,
      ipAddress: ctx.ipHash,
      userAgent: ctx.userAgent,
    });
  },

  async getCampaignStats(
    actor: ShortLinkActor,
    campaignId: string,
    query: { from?: string; to?: string; granularity?: 'day' | 'hour' }
  ) {
    const campaign = await ShortLinksRepo.findCampaignById(campaignId);
    assertActorCanAccessCampaign(actor, campaign as NonNullable<typeof campaign>);

    const now = new Date();
    const toDate = query.to ? new Date(query.to) : now;
    const fromDate = query.from
      ? new Date(query.from)
      : new Date(toDate.getTime() - 30 * 86400_000);

    const [links, clicks] = await Promise.all([
      ShortLinksRepo.findCampaignLinks(campaignId),
      ShortLinksRepo.findCampaignClicksInRange(campaignId, fromDate, toDate),
    ]);

    const perLinkClicks = new Map<
      string,
      {
        totalClicks: number;
        validClicks: number;
        uniqueClicks: number;
        duplicateClicks: number;
        botClicks: number;
        suspiciousClicks: number;
      }
    >();
    const timeline = new Map<
      string,
      {
        bucket: string;
        totalClicks: number;
        validClicks: number;
        uniqueClicks: number;
        duplicateClicks: number;
        botClicks: number;
        suspiciousClicks: number;
      }
    >();
    const bySource = new Map<string, number>();
    const byDevice = new Map<string, number>();

    for (const c of clicks) {
      const linkAcc = perLinkClicks.get(c.shortLinkId) ?? {
        totalClicks: 0,
        validClicks: 0,
        uniqueClicks: 0,
        duplicateClicks: 0,
        botClicks: 0,
        suspiciousClicks: 0,
      };
      linkAcc.totalClicks += 1;
      if (c.classification === ShortLinkClickClassification.VALID) linkAcc.validClicks += 1;
      if (c.classification === ShortLinkClickClassification.DUPLICATE) linkAcc.duplicateClicks += 1;
      if (c.classification === ShortLinkClickClassification.BOT) linkAcc.botClicks += 1;
      if (c.classification === ShortLinkClickClassification.SUSPICIOUS) linkAcc.suspiciousClicks += 1;
      if (c.isUniqueVisitor) linkAcc.uniqueClicks += 1;
      perLinkClicks.set(c.shortLinkId, linkAcc);

      const dt = new Date(c.clickedAt);
      const bucketKey =
        query.granularity === 'hour'
          ? `${dt.toISOString().slice(0, 13)}:00Z`
          : dt.toISOString().slice(0, 10);
      const tAcc = timeline.get(bucketKey) ?? {
        bucket: bucketKey,
        totalClicks: 0,
        validClicks: 0,
        uniqueClicks: 0,
        duplicateClicks: 0,
        botClicks: 0,
        suspiciousClicks: 0,
      };
      tAcc.totalClicks += 1;
      if (c.classification === ShortLinkClickClassification.VALID) tAcc.validClicks += 1;
      if (c.classification === ShortLinkClickClassification.DUPLICATE) tAcc.duplicateClicks += 1;
      if (c.classification === ShortLinkClickClassification.BOT) tAcc.botClicks += 1;
      if (c.classification === ShortLinkClickClassification.SUSPICIOUS) tAcc.suspiciousClicks += 1;
      if (c.isUniqueVisitor) tAcc.uniqueClicks += 1;
      timeline.set(bucketKey, tAcc);

      incrementBucket(bySource, c.trafficSource, 'direct');
      incrementBucket(byDevice, c.deviceType, 'unknown');
    }

    const linkComparison = links
      .map((l) => {
        const rangeStats = perLinkClicks.get(l.id);
        const total = clicks.length > 0 ? (rangeStats?.totalClicks ?? 0) : l.totalClicks;
        const valid = clicks.length > 0 ? (rangeStats?.validClicks ?? 0) : l.validClicks;
        const unique = clicks.length > 0 ? (rangeStats?.uniqueClicks ?? 0) : l.uniqueClicks;
        const duplicate = clicks.length > 0 ? (rangeStats?.duplicateClicks ?? 0) : l.duplicateClicks;
        const bot = clicks.length > 0 ? (rangeStats?.botClicks ?? 0) : l.botClicks;
        const suspicious = clicks.length > 0 ? (rangeStats?.suspiciousClicks ?? 0) : l.suspiciousClicks;

        return {
          id: l.id,
          code: l.code,
          shortUrl: buildShortUrl(l.code),
          title: l.title,
          destinationUrl: l.destinationUrl,
          status: l.status,
          totalClicks: total,
          validClicks: valid,
          uniqueClicks: unique,
          duplicateClicks: duplicate,
          botClicks: bot,
          suspiciousClicks: suspicious,
          validRatePct: total > 0 ? Math.round((valid / total) * 10000) / 100 : 0,
        };
      })
      .sort((a, b) => b.validClicks - a.validClicks || b.totalClicks - a.totalClicks);

    const totals = linkComparison.reduce(
      (acc, l) => ({
        totalClicks: acc.totalClicks + l.totalClicks,
        validClicks: acc.validClicks + l.validClicks,
        uniqueClicks: acc.uniqueClicks + l.uniqueClicks,
        duplicateClicks: acc.duplicateClicks + l.duplicateClicks,
        botClicks: acc.botClicks + l.botClicks,
        suspiciousClicks: acc.suspiciousClicks + l.suspiciousClicks,
      }),
      { totalClicks: 0, validClicks: 0, uniqueClicks: 0, duplicateClicks: 0, botClicks: 0, suspiciousClicks: 0 }
    );

    return {
      campaign,
      range: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        granularity: query.granularity || 'day',
      },
      totals: {
        linksCount: links.length,
        ...totals,
      },
      timeSeries: Array.from(timeline.values()).sort((a, b) => a.bucket.localeCompare(b.bucket)),
      linkComparison,
      breakdowns: {
        trafficSources: mapToSortedBreakdown(bySource),
        deviceTypes: mapToSortedBreakdown(byDevice),
      },
    };
  },

  // =====================================
  // Platform Admin Domain Security Rules
  // =====================================
  async listDomainRules() {
    return ShortLinksRepo.listDomainRules();
  },

  async createDomainRule(
    actor: ShortLinkActor,
    input: {
      domain: string;
      ruleType: AllowedDomainRuleType;
      includeSubdomains: boolean;
      isActive: boolean;
      description?: string | null;
    },
    req?: Request
  ) {
    if (!isPlatformAdminActor(actor)) {
      throw new AppError('Forbidden: PLATFORM_ADMIN access required.', httpStatus.FORBIDDEN);
    }
    const cleanDomain = input.domain.trim().toLowerCase().replace(/^\*\.+/, '').replace(/\.+$/, '');
    const existing = await ShortLinksRepo.findDomainRuleByDomain(cleanDomain);
    if (existing) {
      throw new AppError(`Domain rule for "${cleanDomain}" already exists.`, httpStatus.CONFLICT, {
        code: 'DOMAIN_RULE_EXISTS',
      });
    }

    const created = await ShortLinksRepo.createDomainRule({
      domain: cleanDomain,
      ruleType: input.ruleType,
      includeSubdomains: input.includeSubdomains,
      isActive: input.isActive,
      description: input.description ?? null,
      createdByAdminId: actor.id,
    });

    await invalidateDomainRulesCache();

    const ctx = serializeAuditContext(req);
    await auditService.recordLog({
      platformAdminId: actor.id,
      actorType: SessionActorType.PLATFORM_ADMIN,
      action: 'SHORT_LINK_DOMAIN_RULE_CREATED',
      entity: 'ShortLinkDomainRule',
      entityId: created.id,
      newData: { domain: created.domain, ruleType: created.ruleType },
      ipAddress: ctx.ipHash,
      userAgent: ctx.userAgent,
    });

    return created;
  },

  async updateDomainRule(
    actor: ShortLinkActor,
    ruleId: string,
    input: {
      ruleType?: AllowedDomainRuleType;
      includeSubdomains?: boolean;
      isActive?: boolean;
      description?: string | null;
    },
    req?: Request
  ) {
    if (!isPlatformAdminActor(actor)) {
      throw new AppError('Forbidden: PLATFORM_ADMIN access required.', httpStatus.FORBIDDEN);
    }
    const existing = await ShortLinksRepo.findDomainRuleById(ruleId);
    if (!existing) {
      throw new AppError('Domain rule not found.', httpStatus.NOT_FOUND);
    }

    const updated = await ShortLinksRepo.updateDomainRule(ruleId, input);
    await invalidateDomainRulesCache();

    const ctx = serializeAuditContext(req);
    await auditService.recordLog({
      platformAdminId: actor.id,
      actorType: SessionActorType.PLATFORM_ADMIN,
      action: 'SHORT_LINK_DOMAIN_RULE_UPDATED',
      entity: 'ShortLinkDomainRule',
      entityId: ruleId,
      oldData: existing,
      newData: updated,
      ipAddress: ctx.ipHash,
      userAgent: ctx.userAgent,
    });

    return updated;
  },

  async deleteDomainRule(actor: ShortLinkActor, ruleId: string, req?: Request): Promise<void> {
    if (!isPlatformAdminActor(actor)) {
      throw new AppError('Forbidden: PLATFORM_ADMIN access required.', httpStatus.FORBIDDEN);
    }
    const existing = await ShortLinksRepo.findDomainRuleById(ruleId);
    if (!existing) {
      throw new AppError('Domain rule not found.', httpStatus.NOT_FOUND);
    }

    await ShortLinksRepo.deleteDomainRule(ruleId);
    await invalidateDomainRulesCache();

    const ctx = serializeAuditContext(req);
    await auditService.recordLog({
      platformAdminId: actor.id,
      actorType: SessionActorType.PLATFORM_ADMIN,
      action: 'SHORT_LINK_DOMAIN_RULE_DELETED',
      entity: 'ShortLinkDomainRule',
      entityId: ruleId,
      oldData: existing,
      ipAddress: ctx.ipHash,
      userAgent: ctx.userAgent,
    });
  },
};
