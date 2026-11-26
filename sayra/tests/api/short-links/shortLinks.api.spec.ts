import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
  AllowedDomainRuleType,
  ShortLinkCampaignStatus,
  ShortLinkClickClassification,
  ShortLinkOwnerType,
  ShortLinkStatus,
  ShortLinkTargetCategory,
} from '@prisma/client';
import app from '../../../src/app';
import { errorHandler } from '../../../src/common/errors/errorHandler';
import { env } from '../../../src/config/env';
import { prisma } from '../../../src/config/prisma';
import redis from '../../../src/config/redis';
import { createShortLinkRateLimiter } from '../../../src/common/middleware/rateLimit';
import { flushPendingClickAnalytics } from '../../../src/modules/short-links/clickAnalytics.service';
import { resetInMemoryClickSignalState } from '../../../src/modules/short-links/shortLinkCache';
import { invalidateDomainRulesCache } from '../../../src/modules/short-links/urlSecurity';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface InMemoryStore {
  shortLinks: any[];
  campaigns: any[];
  changeLogs: any[];
  clicks: any[];
  dailyStats: any[];
  domainRules: any[];
  ads: any[];
  auditLogs: any[];
  seq: number;
}

const CENTER_A_ID = 'ccenter_a_00000000000001';
const CENTER_B_ID = 'ccenter_b_00000000000002';
const ADMIN_ID = 'cadmin_00000000000000001';
const MANAGER_A_ID = 'cuser_mgr_a_000000000001';
const MANAGER_B_ID = 'cuser_mgr_b_000000000002';
const STAFF_A_ID = 'cuser_staff_a_0000000003';
const CUSTOMER_ID = 'ccust_000000000000000001';

const store: InMemoryStore = {
  shortLinks: [],
  campaigns: [],
  changeLogs: [],
  clicks: [],
  dailyStats: [],
  domainRules: [],
  ads: [],
  auditLogs: [],
  seq: 1,
};

function nextId(prefix: string): string {
  store.seq += 1;
  return `${prefix}_${String(store.seq).padStart(16, '0')}`;
}

function matchesWhere(row: any, where: any): boolean {
  if (!where || typeof where !== 'object') return true;

  for (const [key, cond] of Object.entries(where)) {
    if (key === 'AND' && Array.isArray(cond)) {
      if (!cond.every((c) => matchesWhere(row, c))) return false;
      continue;
    }
    if (key === 'OR' && Array.isArray(cond)) {
      if (!cond.some((c) => matchesWhere(row, c))) return false;
      continue;
    }

    const val = row[key];
    if (cond === null) {
      if (val !== null && val !== undefined) return false;
      continue;
    }
    if (typeof cond === 'object' && !(cond instanceof Date)) {
      const c = cond as Record<string, any>;
      if ('contains' in c) {
        const hay = String(val ?? '').toLowerCase();
        const needle = String(c.contains ?? '').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if ('lt' in c) {
        if (!val || new Date(val).getTime() >= new Date(c.lt).getTime()) return false;
      }
      if ('gte' in c) {
        if (!val || new Date(val).getTime() < new Date(c.gte).getTime()) return false;
      }
      if ('lte' in c) {
        if (!val || new Date(val).getTime() > new Date(c.lte).getTime()) return false;
      }
      if ('in' in c && Array.isArray(c.in)) {
        if (!c.in.includes(val)) return false;
      }
      continue;
    }

    if (val !== cond) return false;
  }

  return true;
}

function attachLinkRelations(row: any) {
  if (!row) return null;
  const campaign = row.campaignId
    ? store.campaigns.find((c) => c.id === row.campaignId) ?? null
    : null;
  const center =
    row.gamingCenterId === CENTER_A_ID
      ? { id: CENTER_A_ID, name: 'Arena Tehran VIP', slug: 'arena-tehran-vip' }
      : row.gamingCenterId === CENTER_B_ID
        ? { id: CENTER_B_ID, name: 'Cyber Club Shiraz', slug: 'cyber-club-shiraz' }
        : null;
  return {
    ...row,
    campaign: campaign
      ? {
        id: campaign.id,
        name: campaign.name,
        slug: campaign.slug,
        status: campaign.status,
        adSource: campaign.adSource,
        gamingCenterId: campaign.gamingCenterId,
        startsAt: campaign.startsAt,
        endsAt: campaign.endsAt,
        utmSource: campaign.utmSource,
        utmMedium: campaign.utmMedium,
        utmCampaign: campaign.utmCampaign,
        utmTerm: campaign.utmTerm,
        utmContent: campaign.utmContent,
      }
      : null,
    gamingCenter: center,
  };
}

function attachCampaignRelations(row: any) {
  if (!row) return null;
  const linksCount = store.shortLinks.filter((l) => l.campaignId === row.id && !l.deletedAt).length;
  const center =
    row.gamingCenterId === CENTER_A_ID
      ? { id: CENTER_A_ID, name: 'Arena Tehran VIP', slug: 'arena-tehran-vip' }
      : row.gamingCenterId === CENTER_B_ID
        ? { id: CENTER_B_ID, name: 'Cyber Club Shiraz', slug: 'cyber-club-shiraz' }
        : null;
  return {
    ...row,
    gamingCenter: center,
    _count: { links: linksCount },
  };
}

function attachAdRelations(row: any) {
  if (!row) return null;
  const link = row.shortLinkId ? store.shortLinks.find((l) => l.id === row.shortLinkId) ?? null : null;
  const center =
    row.gamingCenterId === CENTER_A_ID
      ? { id: CENTER_A_ID, name: 'Arena Tehran VIP', slug: 'arena-tehran-vip' }
      : { id: CENTER_B_ID, name: 'Cyber Club Shiraz', slug: 'cyber-club-shiraz' };
  return {
    ...row,
    gamingCenter: center,
    owner: { id: row.ownerId, fullName: 'Manager A' },
    shortLink: link ? { id: link.id, code: link.code } : null,
  };
}

function sortRows(rows: any[], orderBy: any): any[] {
  if (!orderBy) return rows;
  const orderList = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const clause of orderList) {
      const [field, dir] = Object.entries(clause)[0];
      const av = a[field] instanceof Date ? a[field].getTime() : (a[field] ?? 0);
      const bv = b[field] instanceof Date ? b[field].getTime() : (b[field] ?? 0);
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

jest.mock('../../../src/config/prisma', () => {
  const mockPrisma: any = {
    gamingCenter: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    platformAdmin: {
      findUnique: jest.fn(),
    },
    customerAccount: {
      findUnique: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    shortLink: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    shortLinkCampaign: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    shortLinkChangeLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    shortLinkClick: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    shortLinkDailyStat: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    shortLinkDomainRule: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    advertisementRequest: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  return { prisma: mockPrisma };
});

describe('PlayNest ShortLinks, Analytics, Campaigns, QR, Security & Ads API Suite', () => {
  let redisMap: Map<string, string>;
  let adminToken: string;
  let managerAToken: string;
  let managerBToken: string;
  let staffAToken: string;
  let customerToken: string;

  const originalBurstMax = env.SHORT_LINK_BURST_MAX_CLICKS_PER_MINUTE;
  const originalDedupSeconds = env.SHORT_LINK_DEDUP_WINDOW_SECONDS;
  const originalExternalPolicy = env.SHORT_LINK_EXTERNAL_POLICY;
  const originalTrustProxy = app.get('trust proxy');

  beforeAll(() => {
    app.set('trust proxy', 1);
    const secret = env.JWT_ACCESS_SECRET || 'test-access-secret';
    adminToken = jwt.sign(
      { sessionId: 'sess_admin', actorId: ADMIN_ID, actorType: 'PLATFORM_ADMIN', mfaVerified: true },
      secret,
      { expiresIn: '1h' }
    );
    managerAToken = jwt.sign(
      { sessionId: 'sess_mgr_a', actorId: MANAGER_A_ID, actorType: 'USER' },
      secret,
      { expiresIn: '1h' }
    );
    managerBToken = jwt.sign(
      { sessionId: 'sess_mgr_b', actorId: MANAGER_B_ID, actorType: 'USER' },
      secret,
      { expiresIn: '1h' }
    );
    staffAToken = jwt.sign(
      { sessionId: 'sess_staff_a', actorId: STAFF_A_ID, actorType: 'USER' },
      secret,
      { expiresIn: '1h' }
    );
    customerToken = jwt.sign(
      { sessionId: 'sess_cust', actorId: CUSTOMER_ID, actorType: 'CUSTOMER' },
      secret,
      { expiresIn: '1h' }
    );
  });

  afterAll(() => {
    app.set('trust proxy', originalTrustProxy);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    store.shortLinks = [];
    store.campaigns = [];
    store.changeLogs = [];
    store.clicks = [];
    store.dailyStats = [];
    store.domainRules = [];
    store.ads = [];
    store.auditLogs = [];
    store.seq = 1;

    (env as any).SHORT_LINK_BURST_MAX_CLICKS_PER_MINUTE = originalBurstMax;
    (env as any).SHORT_LINK_DEDUP_WINDOW_SECONDS = originalDedupSeconds;
    (env as any).SHORT_LINK_EXTERNAL_POLICY = originalExternalPolicy;

    resetInMemoryClickSignalState();
    await invalidateDomainRulesCache();

    redisMap = new Map<string, string>();
    (redis.get as jest.Mock).mockImplementation(async (key: string) => redisMap.get(key) ?? null);
    (redis.set as jest.Mock).mockImplementation(async (key: string, value: string) => {
      redisMap.set(key, String(value));
      return 'OK';
    });
    (redis.del as jest.Mock).mockImplementation(async (key: string) => {
      return redisMap.delete(key) ? 1 : 0;
    });

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: any) => any) => cb(prisma));
    (prisma.session.findUnique as jest.Mock).mockImplementation(async ({ where }: any) => {
      if (where?.id === 'sess_admin') {
        return {
          id: 'sess_admin',
          actorId: ADMIN_ID,
          actorType: 'PLATFORM_ADMIN',
          mfaVerifiedAt: new Date(),
          revokedAt: null,
          expiresAt: new Date(Date.now() + 3600_000),
        };
      }
      return null;
    });

    (prisma.platformAdmin.findUnique as jest.Mock).mockImplementation(async ({ where }: any) => {
      if (where.id === ADMIN_ID) {
        return {
          id: ADMIN_ID,
          isActive: true,
          isSuperuser: true,
          totpEnabled: true,
          totpSetupCompleted: true,
          role: 'SUPERUSER',
        };
      }
      return null;
    });

    (prisma.user.findUnique as jest.Mock).mockImplementation(async ({ where }: any) => {
      if (where.id === MANAGER_A_ID) {
        return { id: MANAGER_A_ID, isActive: true, role: 'MANAGER', gamingCenterId: CENTER_A_ID };
      }
      if (where.id === MANAGER_B_ID) {
        return { id: MANAGER_B_ID, isActive: true, role: 'MANAGER', gamingCenterId: CENTER_B_ID };
      }
      if (where.id === STAFF_A_ID) {
        return { id: STAFF_A_ID, isActive: true, role: 'STAFF', gamingCenterId: CENTER_A_ID };
      }
      return null;
    });

    (prisma.customerAccount.findUnique as jest.Mock).mockImplementation(async ({ where }: any) => {
      if (where.id === CUSTOMER_ID) {
        return { id: CUSTOMER_ID, isActive: true };
      }
      return null;
    });

    const resolveCenter = async ({ where }: any) => {
      if (where?.id === CENTER_A_ID) {
        return { id: CENTER_A_ID, name: 'Arena Tehran VIP', slug: 'arena-tehran-vip', isActive: true };
      }
      if (where?.id === CENTER_B_ID) {
        return { id: CENTER_B_ID, name: 'Cyber Club Shiraz', slug: 'cyber-club-shiraz', isActive: true };
      }
      return null;
    };
    (prisma.gamingCenter.findUnique as jest.Mock).mockImplementation(resolveCenter);
    (prisma.gamingCenter.findFirst as jest.Mock).mockImplementation(resolveCenter);
    (prisma.gamingCenter.findMany as jest.Mock).mockResolvedValue([
      { id: CENTER_A_ID, name: 'Arena Tehran VIP', slug: 'arena-tehran-vip', isActive: true },
      { id: CENTER_B_ID, name: 'Cyber Club Shiraz', slug: 'cyber-club-shiraz', isActive: true },
    ]);

    (prisma.auditLog.create as jest.Mock).mockImplementation(async ({ data }: any) => {
      const rec = { id: nextId('clog'), createdAt: new Date(), ...data };
      store.auditLogs.push(rec);
      return rec;
    });

    // ShortLink delegates
    (prisma.shortLink.findUnique as jest.Mock).mockImplementation(async ({ where }: any) => {
      const found = store.shortLinks.find((l) =>
        where.id ? l.id === where.id : where.normalizedCode ? l.normalizedCode === where.normalizedCode : false
      );
      return attachLinkRelations(found);
    });
    (prisma.shortLink.findFirst as jest.Mock).mockImplementation(async ({ where }: any) => {
      const found = store.shortLinks.find((l) => matchesWhere(l, where));
      return attachLinkRelations(found);
    });
    (prisma.shortLink.findMany as jest.Mock).mockImplementation(async ({ where, orderBy, skip = 0, take = 50 }: any = {}) => {
      const filtered = store.shortLinks.filter((l) => matchesWhere(l, where));
      return sortRows(filtered, orderBy).slice(skip, skip + take).map(attachLinkRelations);
    });
    (prisma.shortLink.count as jest.Mock).mockImplementation(async ({ where }: any = {}) => {
      return store.shortLinks.filter((l) => matchesWhere(l, where)).length;
    });
    (prisma.shortLink.create as jest.Mock).mockImplementation(async ({ data }: any) => {
      const now = new Date();
      const row = {
        id: nextId('sl'),
        code: data.code,
        normalizedCode: data.normalizedCode,
        isCustomCode: Boolean(data.isCustomCode),
        destinationUrl: data.destinationUrl,
        destinationHost: data.destinationHost,
        title: data.title ?? null,
        description: data.description ?? null,
        targetCategory: data.targetCategory ?? ShortLinkTargetCategory.OTHER,
        targetEntityId: data.targetEntityId ?? null,
        ownerType: data.ownerType ?? ShortLinkOwnerType.PLATFORM,
        gamingCenterId: data.gamingCenterId ?? null,
        ownerUserId: data.ownerUserId ?? null,
        createdByUserId: data.createdByUserId ?? null,
        createdByAdminId: data.createdByAdminId ?? null,
        campaignId: data.campaignId ?? null,
        utmSource: data.utmSource ?? null,
        utmMedium: data.utmMedium ?? null,
        utmCampaign: data.utmCampaign ?? null,
        utmTerm: data.utmTerm ?? null,
        utmContent: data.utmContent ?? null,
        appendUtmParams: data.appendUtmParams ?? true,
        status: data.status ?? ShortLinkStatus.ACTIVE,
        redirectStatusCode: data.redirectStatusCode ?? 302,
        expiresAt: data.expiresAt ?? null,
        maxClicks: data.maxClicks ?? null,
        qrConfig: data.qrConfig ?? null,
        metadata: data.metadata ?? null,
        totalClicks: 0,
        validClicks: 0,
        uniqueClicks: 0,
        duplicateClicks: 0,
        botClicks: 0,
        suspiciousClicks: 0,
        lastClickedAt: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      store.shortLinks.push(row);
      return attachLinkRelations(row);
    });
    (prisma.shortLink.update as jest.Mock).mockImplementation(async ({ where, data }: any) => {
      const row = store.shortLinks.find((l) => l.id === where.id);
      if (!row) throw new Error('ShortLink not found');
      for (const [k, v] of Object.entries(data)) {
        if (k === 'campaign') {
          const cv = v as any;
          row.campaignId = cv?.connect?.id ?? (cv?.disconnect ? null : row.campaignId);
        } else if (v && typeof v === 'object' && 'increment' in (v as any)) {
          row[k] = Number(row[k] || 0) + Number((v as any).increment);
        } else {
          row[k] = v;
        }
      }
      row.updatedAt = new Date();
      return attachLinkRelations(row);
    });

    // ChangeLogs
    (prisma.shortLinkChangeLog.create as jest.Mock).mockImplementation(async ({ data }: any) => {
      const rec = { id: nextId('slcl'), createdAt: new Date(), ...data };
      store.changeLogs.push(rec);
      return rec;
    });
    (prisma.shortLinkChangeLog.findMany as jest.Mock).mockImplementation(async ({ where, skip = 0, take = 20 }: any = {}) => {
      const filtered = store.changeLogs
        .filter((r) => matchesWhere(r, where))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return filtered.slice(skip, skip + take);
    });
    (prisma.shortLinkChangeLog.count as jest.Mock).mockImplementation(async ({ where }: any = {}) => {
      return store.changeLogs.filter((r) => matchesWhere(r, where)).length;
    });

    // Clicks & DailyStats
    (prisma.shortLinkClick.create as jest.Mock).mockImplementation(async ({ data }: any) => {
      const rec = { id: nextId('slck'), ...data };
      store.clicks.push(rec);
      return rec;
    });
    (prisma.shortLinkClick.findMany as jest.Mock).mockImplementation(async ({ where, take = 10000 }: any = {}) => {
      const filtered = store.clicks
        .filter((r) => matchesWhere(r, where))
        .sort((a, b) => new Date(b.clickedAt).getTime() - new Date(a.clickedAt).getTime());
      return filtered.slice(0, take);
    });
    (prisma.shortLinkDailyStat.upsert as jest.Mock).mockImplementation(async ({ where, update, create }: any) => {
      const key = where.shortLinkId_date;
      const existing = store.dailyStats.find(
        (d) =>
          d.shortLinkId === key.shortLinkId &&
          new Date(d.date).getTime() === new Date(key.date).getTime()
      );
      if (existing) {
        for (const [k, v] of Object.entries(update)) {
          if (v && typeof v === 'object' && 'increment' in (v as any)) {
            existing[k] = Number(existing[k] || 0) + Number((v as any).increment);
          }
        }
        return existing;
      }
      const created = { id: nextId('slds'), ...create };
      store.dailyStats.push(created);
      return created;
    });
    (prisma.shortLinkDailyStat.findMany as jest.Mock).mockImplementation(async ({ where }: any = {}) => {
      return store.dailyStats
        .filter((d) => matchesWhere(d, where))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });

    // Campaigns
    (prisma.shortLinkCampaign.findUnique as jest.Mock).mockImplementation(async ({ where }: any) => {
      const found = store.campaigns.find((c) => c.id === where.id);
      return attachCampaignRelations(found);
    });
    (prisma.shortLinkCampaign.findFirst as jest.Mock).mockImplementation(async ({ where }: any) => {
      const found = store.campaigns.find((c) => matchesWhere(c, where));
      return attachCampaignRelations(found);
    });
    (prisma.shortLinkCampaign.findMany as jest.Mock).mockImplementation(async ({ where, skip = 0, take = 20 }: any = {}) => {
      const filtered = store.campaigns
        .filter((c) => matchesWhere(c, where))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return filtered.slice(skip, skip + take).map(attachCampaignRelations);
    });
    (prisma.shortLinkCampaign.count as jest.Mock).mockImplementation(async ({ where }: any = {}) => {
      return store.campaigns.filter((c) => matchesWhere(c, where)).length;
    });
    (prisma.shortLinkCampaign.create as jest.Mock).mockImplementation(async ({ data }: any) => {
      const now = new Date();
      const rec = {
        id: nextId('slcmp'),
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        status: ShortLinkCampaignStatus.ACTIVE,
        ...data,
      };
      store.campaigns.push(rec);
      return attachCampaignRelations(rec);
    });
    (prisma.shortLinkCampaign.update as jest.Mock).mockImplementation(async ({ where, data }: any) => {
      const rec = store.campaigns.find((c) => c.id === where.id);
      if (!rec) throw new Error('Campaign not found');
      Object.assign(rec, data, { updatedAt: new Date() });
      return attachCampaignRelations(rec);
    });

    // Domain rules
    (prisma.shortLinkDomainRule.findMany as jest.Mock).mockImplementation(async ({ where }: any = {}) => {
      return store.domainRules
        .filter((r) => matchesWhere(r, where))
        .sort((a, b) => String(a.domain).localeCompare(String(b.domain)));
    });
    (prisma.shortLinkDomainRule.findUnique as jest.Mock).mockImplementation(async ({ where }: any) => {
      return (
        store.domainRules.find((r) => (where.id ? r.id === where.id : r.domain === where.domain)) ??
        null
      );
    });
    (prisma.shortLinkDomainRule.create as jest.Mock).mockImplementation(async ({ data }: any) => {
      const now = new Date();
      const rec = { id: nextId('sldr'), createdAt: now, updatedAt: now, ...data };
      store.domainRules.push(rec);
      return rec;
    });
    (prisma.shortLinkDomainRule.update as jest.Mock).mockImplementation(async ({ where, data }: any) => {
      const rec = store.domainRules.find((r) => r.id === where.id);
      if (!rec) throw new Error('DomainRule not found');
      Object.assign(rec, data, { updatedAt: new Date() });
      return rec;
    });
    (prisma.shortLinkDomainRule.delete as jest.Mock).mockImplementation(async ({ where }: any) => {
      const idx = store.domainRules.findIndex((r) => r.id === where.id);
      if (idx === -1) throw new Error('DomainRule not found');
      const [removed] = store.domainRules.splice(idx, 1);
      return removed;
    });

    // Advertisements
    (prisma.advertisementRequest.create as jest.Mock).mockImplementation(async ({ data }: any) => {
      const now = new Date();
      const rec = {
        id: nextId('ad'),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        priority: 0,
        startDate: null,
        endDate: null,
        decisionReason: null,
        adminNote: null,
        ...data,
      };
      store.ads.push(rec);
      return attachAdRelations(rec);
    });
    (prisma.advertisementRequest.findFirst as jest.Mock).mockImplementation(async ({ where }: any) => {
      const found = store.ads.find((a) => matchesWhere(a, where));
      return attachAdRelations(found);
    });
    (prisma.advertisementRequest.update as jest.Mock).mockImplementation(async ({ where, data }: any) => {
      const rec = store.ads.find((a) => a.id === where.id);
      if (!rec) throw new Error('Ad not found');
      for (const [k, v] of Object.entries(data)) {
        if (k === 'shortLink') {
          const slv = v as any;
          rec.shortLinkId = slv?.connect?.id ?? (slv?.disconnect ? null : rec.shortLinkId);
        } else if (k === 'media') {
          const mv = v as any;
          rec.mediaId = mv?.connect?.id ?? (mv?.disconnect ? null : rec.mediaId);
        } else {
          rec[k] = v;
        }
      }
      rec.updatedAt = new Date();
      return attachAdRelations(rec);
    });
  });

  afterEach(async () => {
    await flushPendingClickAnalytics();
    (env as any).SHORT_LINK_BURST_MAX_CLICKS_PER_MINUTE = originalBurstMax;
    (env as any).SHORT_LINK_DEDUP_WINDOW_SECONDS = originalDedupSeconds;
    (env as any).SHORT_LINK_EXTERNAL_POLICY = originalExternalPolicy;
  });

  it('1. Creates auto Base58 and custom alias links, and blocks duplicates (409) and reserved codes (400)', async () => {
    const autoRes = await request(app)
      .post(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        destinationUrl: 'https://sayra-booking.ir/centers/arena-tehran-vip',
        title: 'Main Center Link',
        targetCategory: ShortLinkTargetCategory.GAMING_CENTER,
      });

    expect(autoRes.status).toBe(201);
    expect(autoRes.body.data.code).toMatch(/^[23456789A-HJ-NP-Za-km-z]{6,16}$/);
    expect(autoRes.body.data.isCustomCode).toBe(false);
    expect(autoRes.body.data.shortUrl).toContain(`/r/${autoRes.body.data.code}`);

    const customRes = await request(app)
      .post(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        destinationUrl: 'https://sayra-booking.ir/centers/arena-tehran-vip/tournaments',
        customCode: 'Arena-VIP_26',
        title: 'VIP Tournament Link',
        redirectStatusCode: 301,
      });

    expect(customRes.status).toBe(201);
    expect(customRes.body.data.code).toBe('Arena-VIP_26');
    expect(customRes.body.data.isCustomCode).toBe(true);
    expect(customRes.body.data.redirectStatusCode).toBe(301);

    // Case-insensitive collision
    const dupRes = await request(app)
      .post(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        destinationUrl: 'https://sayra-booking.ir/centers/other',
        customCode: 'arena-vip_26',
      });
    expect(dupRes.status).toBe(409);

    // Reserved keyword
    const reservedRes = await request(app)
      .post(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        destinationUrl: 'https://sayra-booking.ir/centers/other',
        customCode: 'platform-admin',
      });
    expect(reservedRes.status).toBe(400);
  });

  it('2. Executes fast public redirects (/r/:code, /s/:code, /api/v1/short-links/r/:code) with UTM propagation & security headers', async () => {
    await request(app)
      .post(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        destinationUrl: 'https://sayra-booking.ir/centers/arena-tehran-vip?view=map',
        customCode: 'go-vip',
        utmSource: 'instagram',
        utmMedium: 'bio',
        utmCampaign: 'tehran-vip',
        redirectStatusCode: 302,
      });

    for (const urlPath of ['/r/GO-VIP', '/s/go-vip', '/api/v1/short-links/r/go-vip']) {
      const res = await request(app).get(`${urlPath}?utm_content=reel1`);
      expect(res.status).toBe(302);
      expect(res.headers['cache-control']).toContain('no-store');
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
      expect(res.headers['referrer-policy']).toBe('no-referrer-when-downgrade');
      const loc = new URL(res.headers.location);
      expect(loc.searchParams.get('view')).toBe('map');
      expect(loc.searchParams.get('utm_source')).toBe('instagram');
      expect(loc.searchParams.get('utm_medium')).toBe('bio');
      expect(loc.searchParams.get('utm_campaign')).toBe('tehran-vip');
      expect(loc.searchParams.get('utm_content')).toBe('reel1');
    }
  });

  it('3. Updates destination while keeping QR & code stable and logs ChangeLog + AuditLog', async () => {
    const createRes = await request(app)
      .post(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        destinationUrl: 'https://sayra-booking.ir/events/round-1',
        customCode: 'qr-stable',
      });
    const linkId = createRes.body.data.id;

    // Warm redirect cache + get baseline QR SVG
    const r1 = await request(app).get('/r/qr-stable');
    expect(r1.status).toBe(302);
    expect(r1.headers.location).toBe('https://sayra-booking.ir/events/round-1');

    const readSvg = (res: request.Response) =>
      Buffer.isBuffer(res.body) ? res.body.toString('utf8') : String(res.text || '');

    const qrBefore = await request(app)
      .get(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links/${linkId}/qr?format=svg`)
      .set('Authorization', `Bearer ${managerAToken}`);
    expect(qrBefore.status).toBe(200);
    expect(readSvg(qrBefore)).toContain('<svg');

    // Update destination
    const destRes = await request(app)
      .patch(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links/${linkId}/destination`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        destinationUrl: 'https://sayra-booking.ir/events/finals-2026',
        reason: 'Moved tournament page to finals landing',
      });
    expect(destRes.status).toBe(200);
    expect(destRes.body.data.code).toBe('qr-stable');

    // Cache invalidated -> redirect goes to new URL
    const r2 = await request(app).get('/r/qr-stable');
    expect(r2.status).toBe(302);
    expect(r2.headers.location).toBe('https://sayra-booking.ir/events/finals-2026');

    // Printed QR SVG stays byte-for-byte identical
    const qrAfter = await request(app)
      .get(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links/${linkId}/qr?format=svg`)
      .set('Authorization', `Bearer ${managerAToken}`);
    expect(readSvg(qrAfter)).toBe(readSvg(qrBefore));

    // History records LINK_CREATED + DESTINATION_CHANGED
    const historyRes = await request(app)
      .get(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links/${linkId}/history`)
      .set('Authorization', `Bearer ${managerAToken}`);
    expect(historyRes.status).toBe(200);
    const actions = historyRes.body.data.data.map((h: any) => h.action);
    expect(actions).toContain('LINK_CREATED');
    expect(actions).toContain('DESTINATION_CHANGED');
    expect(store.auditLogs.some((a) => a.action === 'SHORT_LINK_DESTINATION_CHANGED')).toBe(true);
  });

  it('4. Handles INACTIVE (410), ARCHIVED (410), expired (410), maxClicks (410), deleted (404), unknown (404), and blocked (451)', async () => {
    // Allow external domain via governance rule first
    const allowRuleRes = await request(app)
      .post('/api/v1/platform-admin/short-links/domains')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        domain: 'instagram.com',
        ruleType: AllowedDomainRuleType.ALLOW,
        includeSubdomains: true,
        isActive: true,
      });
    expect(allowRuleRes.status).toBe(201);
    const ruleId = allowRuleRes.body.data.id;

    const resLink = await request(app)
      .post(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        destinationUrl: 'https://www.instagram.com/arena_vip',
        customCode: 'lifecycle-1',
        maxClicks: 2,
      });
    expect(resLink.status).toBe(201);
    const linkId = resLink.body.data.id;

    // Missing code -> 404
    const notFoundRes = await request(app).get('/r/does-not-exist-999');
    expect(notFoundRes.status).toBe(404);

    // INACTIVE -> 410
    await request(app)
      .patch(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links/${linkId}/status`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({ status: ShortLinkStatus.INACTIVE });
    expect((await request(app).get('/r/lifecycle-1')).status).toBe(410);

    // ARCHIVED -> 410
    await request(app)
      .patch(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links/${linkId}/status`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({ status: ShortLinkStatus.ARCHIVED });
    expect((await request(app).get('/r/lifecycle-1')).status).toBe(410);

    // Reactivate -> verify expired returns 410
    await request(app)
      .patch(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links/${linkId}/status`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({ status: ShortLinkStatus.ACTIVE });
    store.shortLinks[0].expiresAt = new Date(Date.now() - 60_000);
    redisMap.clear();
    expect((await request(app).get('/r/lifecycle-1')).status).toBe(410);

    // Reset expiry, hit maxClicks -> 410
    store.shortLinks[0].expiresAt = null;
    store.shortLinks[0].totalClicks = 2;
    redisMap.clear();
    expect((await request(app).get('/r/lifecycle-1')).status).toBe(410);

    // Reset totalClicks, switch domain rule to BLOCK -> 451
    store.shortLinks[0].totalClicks = 0;
    redisMap.clear();
    const blockRuleRes = await request(app)
      .patch(`/api/v1/platform-admin/short-links/domains/${ruleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ruleType: AllowedDomainRuleType.BLOCK,
      });
    expect(blockRuleRes.status).toBe(200);
    expect((await request(app).get('/r/lifecycle-1')).status).toBe(451);

    // Soft-delete -> 404
    const delRes = await request(app)
      .delete(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links/${linkId}`)
      .set('Authorization', `Bearer ${managerAToken}`);
    expect(delRes.status).toBe(204);
    expect((await request(app).get('/r/lifecycle-1')).status).toBe(404);
  });

  it('5. Tracks clicks non-blockingly, classifies VALID/DUPLICATE/BOT/SUSPICIOUS without raw IP persistence, and returns stats breakdowns', async () => {
    (env as any).SHORT_LINK_BURST_MAX_CLICKS_PER_MINUTE = 3;

    const createRes = await request(app)
      .post(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        destinationUrl: 'https://sayra-booking.ir/centers/arena-tehran-vip',
        customCode: 'track-me',
      });
    const linkId = createRes.body.data.id;

    // 1. First human visitor -> VALID + isUniqueVisitor=true
    await request(app)
      .get('/r/track-me')
      .set('x-forwarded-for', '198.51.100.25')
      .set('user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Mobile/15E148 Safari/604.1')
      .set('referer', 'https://l.instagram.com/bio?secret=abc')
      .set('cf-ipcountry', 'IR')
      .set('cf-ipcity', 'Tehran');

    // 2. Immediate repeat same visitor -> DUPLICATE
    await request(app)
      .get('/r/track-me')
      .set('x-forwarded-for', '198.51.100.25')
      .set('user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Mobile/15E148 Safari/604.1');

    // 3. Bot UA -> BOT
    await request(app)
      .get('/r/track-me')
      .set('x-forwarded-for', '66.249.66.1')
      .set('user-agent', 'Googlebot/2.1 (+http://www.google.com/bot.html)');

    // 4. Burst clicks from another IP (> maxPerMinute=3) -> 4th becomes SUSPICIOUS
    for (let i = 0; i < 4; i += 1) {
      await request(app)
        .get('/r/track-me')
        .set('x-forwarded-for', '203.0.113.77')
        .set('user-agent', `Mozilla/5.0 Chrome/${120 + i}.0.0.0`);
    }

    await flushPendingClickAnalytics();

    expect(store.clicks).toHaveLength(7);
    // Privacy check: raw IP must NEVER be saved in click rows
    for (const click of store.clicks) {
      const serialized = JSON.stringify(click);
      expect(serialized).not.toContain('198.51.100.25');
      expect(serialized).not.toContain('203.0.113.77');
      expect(serialized).not.toContain('66.249.66.1');
      expect(click.visitorHash).toHaveLength(32);
    }

    const classifications = store.clicks.map((c) => c.classification);
    expect(classifications).toContain(ShortLinkClickClassification.VALID);
    expect(classifications).toContain(ShortLinkClickClassification.DUPLICATE);
    expect(classifications).toContain(ShortLinkClickClassification.BOT);
    expect(classifications).toContain(ShortLinkClickClassification.SUSPICIOUS);

    const statsDayRes = await request(app)
      .get(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links/${linkId}/stats?granularity=day`)
      .set('Authorization', `Bearer ${managerAToken}`);
    expect(statsDayRes.status).toBe(200);
    expect(statsDayRes.body.data.allTimeTotals.totalClicks).toBe(7);
    expect(statsDayRes.body.data.allTimeTotals.botClicks).toBe(1);
    expect(statsDayRes.body.data.allTimeTotals.duplicateClicks).toBe(1);
    expect(statsDayRes.body.data.allTimeTotals.suspiciousClicks).toBe(1);
    expect(statsDayRes.body.data.allTimeTotals.validClicks).toBe(4);
    expect(statsDayRes.body.data.timeSeries.length).toBeGreaterThanOrEqual(1);
    expect(statsDayRes.body.data.breakdowns.trafficSources.some((s: any) => s.key === 'instagram')).toBe(true);
    expect(statsDayRes.body.data.breakdowns.countries.some((c: any) => c.key === 'IR')).toBe(true);

    const statsHourRes = await request(app)
      .get(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links/${linkId}/stats?granularity=hour`)
      .set('Authorization', `Bearer ${managerAToken}`);
    expect(statsHourRes.status).toBe(200);
    expect(statsHourRes.body.data.range.granularity).toBe('hour');
    expect(statsHourRes.body.data.timeSeries.length).toBeGreaterThanOrEqual(1);
  });

  it('6. Serves QR codes in SVG, PNG, JSON, and DataURL formats with optional download header', async () => {
    const created = await request(app)
      .post(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        destinationUrl: 'https://sayra-booking.ir/centers/arena-tehran-vip',
        customCode: 'qr-art',
      });
    const linkId = created.body.data.id;

    const svgRes = await request(app)
      .get(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links/${linkId}/qr?format=svg&size=240`)
      .set('Authorization', `Bearer ${managerAToken}`);
    expect(svgRes.status).toBe(200);
    expect(svgRes.headers['content-type']).toContain('image/svg+xml');
    const svgText = Buffer.isBuffer(svgRes.body) ? svgRes.body.toString('utf8') : String(svgRes.text || '');
    expect(svgText).toContain('<svg');

    const pngRes = await request(app)
      .get(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links/${linkId}/qr?format=png&size=240&download=true`)
      .set('Authorization', `Bearer ${managerAToken}`);
    expect(pngRes.status).toBe(200);
    expect(pngRes.headers['content-type']).toContain('image/png');
    expect(pngRes.headers['content-disposition']).toContain('attachment');
    expect(Buffer.isBuffer(pngRes.body)).toBe(true);
    expect((pngRes.body as Buffer).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    const jsonRes = await request(app)
      .get(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links/${linkId}/qr?format=json&ecc=H`)
      .set('Authorization', `Bearer ${managerAToken}`);
    expect(jsonRes.status).toBe(200);
    expect(jsonRes.body.data.format).toBe('json');
    expect(jsonRes.body.data.dataUrl).toMatch(/^data:image\/svg\+xml;base64,/);

    const dataUrlRes = await request(app)
      .get(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links/${linkId}/qr?format=dataurl`)
      .set('Authorization', `Bearer ${managerAToken}`);
    expect(dataUrlRes.status).toBe(200);
    expect(dataUrlRes.body.data.format).toBe('dataurl');
    expect(dataUrlRes.body.data.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('7. Enforces multi-tenant isolation and RBAC across CUSTOMER, STAFF, MANAGER, and PLATFORM_ADMIN', async () => {
    // Manager B creates Center B link & campaign
    const linkBRes = await request(app)
      .post(`/api/v1/gamingCenters/${CENTER_B_ID}/short-links`)
      .set('Authorization', `Bearer ${managerBToken}`)
      .send({ destinationUrl: 'https://sayra-booking.ir/centers/cyber-club-shiraz' });
    const linkBId = linkBRes.body.data.id;

    const campBRes = await request(app)
      .post(`/api/v1/gamingCenters/${CENTER_B_ID}/short-link-campaigns`)
      .set('Authorization', `Bearer ${managerBToken}`)
      .send({ name: 'Shiraz Promo' });
    const campBId = campBRes.body.data.id;

    // Cross-tenant access by Manager A blocked with 404
    expect(
      (
        await request(app)
          .get(`/api/v1/gamingCenters/${CENTER_B_ID}/short-links/${linkBId}`)
          .set('Authorization', `Bearer ${managerAToken}`)
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .get(`/api/v1/short-links/${linkBId}`)
          .set('Authorization', `Bearer ${managerAToken}`)
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .get(`/api/v1/short-link-campaigns/${campBId}`)
          .set('Authorization', `Bearer ${managerAToken}`)
      ).status
    ).toBe(404);

    // CUSTOMER actor blocked with 403
    expect(
      (
        await request(app)
          .post('/api/v1/short-links')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ destinationUrl: 'https://sayra-booking.ir/promo' })
      ).status
    ).toBe(403);

    // STAFF actor: can manage their own USER link, cannot access center links or campaigns or domain rules
    const staffLink = await request(app)
      .post('/api/v1/short-links')
      .set('Authorization', `Bearer ${staffAToken}`)
      .send({ destinationUrl: 'https://sayra-booking.ir/articles/ps5-guide' });
    expect(staffLink.status).toBe(201);
    expect(staffLink.body.data.ownerType).toBe(ShortLinkOwnerType.USER);

    expect(
      (
        await request(app)
          .get(`/api/v1/short-links/${staffLink.body.data.id}`)
          .set('Authorization', `Bearer ${staffAToken}`)
      ).status
    ).toBe(200);

    expect(
      (
        await request(app)
          .post('/api/v1/short-link-campaigns')
          .set('Authorization', `Bearer ${staffAToken}`)
          .send({ name: 'Unauthorized Staff Campaign' })
      ).status
    ).toBe(403);

    expect(
      (
        await request(app)
          .get(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links`)
          .set('Authorization', `Bearer ${staffAToken}`)
      ).status
    ).toBe(403);

    // Non-admin blocked from domain rules; PLATFORM_ADMIN allowed across tenants & domain rules
    expect(
      (
        await request(app)
          .get('/api/v1/platform-admin/short-links/domains')
          .set('Authorization', `Bearer ${managerAToken}`)
      ).status
    ).toBe(403);

    const adminReadB = await request(app)
      .get(`/api/v1/platform-admin/short-links/${linkBId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminReadB.status).toBe(200);

    const adminDomainRes = await request(app)
      .post('/api/v1/platform-admin/short-links/domains')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ domain: 'partner-esports.ir', ruleType: AllowedDomainRuleType.ALLOW });
    expect(adminDomainRes.status).toBe(201);
  });

  it('8. Supports Campaign CRUD and per-link comparative campaign performance reports', async () => {
    const campRes = await request(app)
      .post(`/api/v1/gamingCenters/${CENTER_A_ID}/short-link-campaigns`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        name: 'Winter Tournament 2026',
        adSource: 'social-ads',
        utmSource: 'campaign-default',
        utmMedium: 'cpc',
        utmCampaign: 'winter-2026',
      });
    expect(campRes.status).toBe(201);
    const campaignId = campRes.body.data.id;

    const l1 = await request(app)
      .post(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        destinationUrl: 'https://sayra-booking.ir/tournaments/fc26',
        customCode: 'winter-ig',
        campaignId,
        utmSource: 'instagram',
      });
    const l2 = await request(app)
      .post(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        destinationUrl: 'https://sayra-booking.ir/tournaments/fc26',
        customCode: 'winter-tg',
        campaignId,
        utmSource: 'telegram',
      });

    // Simulate clicks on both links from distinct visitors
    await request(app)
      .get('/r/winter-ig')
      .set('x-forwarded-for', '198.51.100.1')
      .set('user-agent', 'Mozilla/5.0 Chrome/130.0.0.0');
    await request(app)
      .get('/r/winter-ig')
      .set('x-forwarded-for', '198.51.100.2')
      .set('user-agent', 'Mozilla/5.0 Chrome/130.0.0.0');
    await request(app)
      .get('/r/winter-tg')
      .set('x-forwarded-for', '198.51.100.3')
      .set('user-agent', 'Mozilla/5.0 Chrome/130.0.0.0');
    await flushPendingClickAnalytics();

    const statsRes = await request(app)
      .get(`/api/v1/gamingCenters/${CENTER_A_ID}/short-link-campaigns/${campaignId}/stats`)
      .set('Authorization', `Bearer ${managerAToken}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.totals.linksCount).toBe(2);
    expect(statsRes.body.data.totals.totalClicks).toBe(3);
    expect(statsRes.body.data.totals.validClicks).toBe(3);
    expect(statsRes.body.data.linkComparison).toHaveLength(2);
    expect(statsRes.body.data.linkComparison[0].id).toBe(l1.body.data.id);
    expect(statsRes.body.data.linkComparison[0].validClicks).toBe(2);
    expect(statsRes.body.data.linkComparison[0].validRatePct).toBe(100);
    expect(statsRes.body.data.linkComparison[1].id).toBe(l2.body.data.id);
  });

  it('9. Rejects unsafe destinations (Open Redirect, SSRF, Punycode, shortener chains, redirect loops)', async () => {
    const payloads = [
      'javascript:alert(1)',
      'http://127.0.0.1:8080/internal',
      'http://169.254.169.254/latest/meta-data/',
      'https://xn--evil-domain-5qa.com/login',
      'https://bit.ly/malicious',
      'https://sayra-booking.ir/r/loopcode',
    ];

    for (const destinationUrl of payloads) {
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ destinationUrl });
      expect(res.status).toBe(400);
    }
  });

  it('10. Integrates short links cleanly with Advertisement creation (autoCreateShortLink) and update', async () => {
    const createAdRes = await request(app)
      .post(`/api/v1/gamingCenters/${CENTER_A_ID}/advertisements`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        title: 'Winter VIP Offer',
        bannerUrl: '/uploads/banners/winter.png',
        destinationUrl: 'https://sayra-booking.ir/centers/arena-tehran-vip',
        autoCreateShortLink: true,
      });

    expect(createAdRes.status).toBe(201);
    expect(createAdRes.body.data.shortLinkId).toBeTruthy();
    expect(createAdRes.body.data.shortUrl).toMatch(/\/r\/[23456789A-HJ-NP-Za-km-z]+$/);

    const adId = createAdRes.body.data.id;
    const altLinkRes = await request(app)
      .post(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        destinationUrl: 'https://sayra-booking.ir/promotions/vip-2',
        customCode: 'ad-alt-link',
      });

    const patchAdRes = await request(app)
      .patch(`/api/v1/gamingCenters/${CENTER_A_ID}/advertisements/${adId}`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({ shortLinkId: altLinkRes.body.data.id });

    expect(patchAdRes.status).toBe(200);
    expect(patchAdRes.body.data.shortLinkId).toBe(altLinkRes.body.data.id);
    expect(patchAdRes.body.data.shortUrl).toContain('/r/ad-alt-link');

    const disconnectRes = await request(app)
      .patch(`/api/v1/gamingCenters/${CENTER_A_ID}/advertisements/${adId}`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({ shortLinkId: null });
    expect(disconnectRes.status).toBe(200);
    expect(disconnectRes.body.data.shortLinkId).toBeNull();
    expect(disconnectRes.body.data.shortUrl).toBeNull();
  });

  it('11. Enforces HTTP 429 rate limiting via createShortLinkRateLimiter when threshold is exceeded', async () => {
    const rateApp = express();
    rateApp.get(
      '/limited/:code',
      createShortLinkRateLimiter({
        windowMs: 60_000,
        max: 3,
        prefix: 'test:sl',
        message: 'Too many short link requests',
        forceEnableInTest: true,
      }),
      (_req, res) => res.status(200).json({ ok: true })
    );
    rateApp.use(errorHandler);

    for (let i = 0; i < 3; i += 1) {
      expect((await request(rateApp).get('/limited/abc')).status).toBe(200);
    }
    const blockedRes = await request(rateApp).get('/limited/abc');
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('12. Serves 500 cached public redirects cleanly at high throughput with zero repeat DB lookups', async () => {
    await request(app)
      .post(`/api/v1/gamingCenters/${CENTER_A_ID}/short-links`)
      .set('Authorization', `Bearer ${managerAToken}`)
      .send({
        destinationUrl: 'https://sayra-booking.ir/centers/arena-tehran-vip',
        customCode: 'bench-fast',
      });

    // Warm cache with 1 miss
    const warm = await request(app).get('/r/bench-fast');
    expect(warm.status).toBe(302);
    expect(redisMap.has('shortlink:code:bench-fast')).toBe(true);

    (prisma.shortLink.findUnique as jest.Mock).mockClear();

    const server = app.listen(0);
    const startNs = process.hrtime.bigint();
    const responses: request.Response[] = [];
    try {
      for (let batch = 0; batch < 10; batch += 1) {
        const chunk = await Promise.all(
          Array.from({ length: 50 }, (_v, idx) =>
            request(server)
              .get('/r/bench-fast')
              .set('x-forwarded-for', `198.51.101.${(batch * 50 + idx) % 250}`)
              .set('user-agent', 'Mozilla/5.0 Chrome/131.0.0.0')
          )
        );
        responses.push(...chunk);
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1e6;

    expect(responses).toHaveLength(500);
    expect(responses.every((r) => r.status === 302)).toBe(true);
    expect(prisma.shortLink.findUnique).not.toHaveBeenCalled();

    const rps = Math.round((500 / elapsedMs) * 1000);
    // Recorded explicitly in test output for empirical documentation
    console.info(`Benchmark 500 cached redirects: ${elapsedMs.toFixed(1)} ms (${rps} req/s)`);

    await flushPendingClickAnalytics();
  });
});
