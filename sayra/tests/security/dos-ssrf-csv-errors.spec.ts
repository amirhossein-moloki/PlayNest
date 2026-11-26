/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import express from 'express';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  AllowedDomainRuleType,
  Prisma,
  SessionActorType,
  ShortLinkStatus,
  UserRole,
} from '@prisma/client';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { prisma } from '../../src/config/prisma';
import { generateAccessToken } from '../../src/modules/auth/auth.tokens';
import { escapeCsvCell } from '../../src/modules/platform-admin/platform-admin.controller';
import { errorHandler } from '../../src/common/errors/errorHandler';
import { extractClientIp } from '../../src/modules/short-links/clickClassifier';
import {
  invalidateDomainRulesCache,
  validateAndNormalizeDestinationUrl,
} from '../../src/modules/short-links/urlSecurity';
import { resetInMemoryClickSignalState } from '../../src/modules/short-links/shortLinkCache';
import { searchGameCentersQuerySchema } from '../../src/modules/search/search.validators';
import { SearchService } from '../../src/modules/search/search.service';

const redisMap = new Map<string, string>();

jest.mock('../../src/config/redis', () => {
  const mockRedis: any = {
    status: 'ready',
    get: jest.fn(async (key: string) => redisMap.get(key) ?? null),
    set: jest.fn(async (key: string, val: string, ...args: any[]) => {
      if (args.includes('NX') && redisMap.has(key)) {
        return null;
      }
      redisMap.set(key, String(val));
      return 'OK';
    }),
    incr: jest.fn(async (key: string) => {
      const next = (Number(redisMap.get(key) ?? '0') || 0) + 1;
      redisMap.set(key, String(next));
      return next;
    }),
    expire: jest.fn(async () => 1),
    del: jest.fn(async (...keys: string[]) => {
      let deleted = 0;
      for (const k of keys) {
        if (redisMap.delete(k)) deleted += 1;
      }
      return deleted;
    }),
    scan: jest.fn(async () => ['0', []]),
  };
  return {
    __esModule: true,
    redis: mockRedis,
    default: mockRedis,
  };
});

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    gamingCenter: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    gameCatalog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    gameAlias: {
      findMany: jest.fn(),
    },
    gamingCenterGame: {
      findMany: jest.fn(),
    },
    gameStation: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    rating: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    shortLink: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    shortLinkDomainRule: {
      findMany: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
    },
    analyticsWatermark: {
      findMany: jest.fn(),
    },
    analyticsIngestionRun: {
      findMany: jest.fn(),
    },
    notificationLog: {
      groupBy: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    platformAdmin: {
      findUnique: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

describe('SEC-030 & SEC-026 (Sayra): Search DoS, IPv6 SSRF Bypass, maxClicks Cache, CSV Injection, Error Redaction & Telemetry RBAC', () => {
  const centerId = 'c111111111111111111111111';
  const managerId = 'c222222222222222222222222';
  const platformAdminId = 'c333333333333333333333333';

  const origNodeEnv = env.NODE_ENV;
  const origExternalPolicy = env.SHORT_LINK_EXTERNAL_POLICY;

  let managerToken: string;
  let adminToken: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    redisMap.clear();
    resetInMemoryClickSignalState();
    await invalidateDomainRulesCache();

    managerToken = generateAccessToken({
      sessionId: 'sess_mgr_sec030',
      actorId: managerId,
      actorType: SessionActorType.USER,
    });
    adminToken = generateAccessToken({
      sessionId: 'sess_pa_sec030',
      actorId: platformAdminId,
      actorType: SessionActorType.PLATFORM_ADMIN,
      mfaVerified: true,
    });

    (prisma.session.findUnique as jest.Mock).mockImplementation((async (args: any) => {
      if (args?.where?.id === 'sess_pa_sec030') {
        return {
          id: 'sess_pa_sec030',
          actorId: platformAdminId,
          actorType: SessionActorType.PLATFORM_ADMIN,
          mfaVerifiedAt: new Date(),
          revokedAt: null,
          expiresAt: new Date(Date.now() + 600_000),
        };
      }
      return {
        id: 'sess_mgr_sec030',
        actorId: managerId,
        actorType: SessionActorType.USER,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 600_000),
      };
    }) as any);

    (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue({
      id: centerId,
      slug: 'sec-center',
      name: 'Sec Center',
      isActive: true,
    } as never);
    (prisma.gamingCenter.findMany as jest.Mock).mockResolvedValue([] as never);
    (prisma.gamingCenter.count as jest.Mock).mockResolvedValue(0 as never);
    (prisma.gameCatalog.findMany as jest.Mock).mockResolvedValue([] as never);
    (prisma.gameCatalog.count as jest.Mock).mockResolvedValue(0 as never);
    (prisma.gameAlias.findMany as jest.Mock).mockResolvedValue([] as never);
    (prisma.gamingCenterGame.findMany as jest.Mock).mockResolvedValue([] as never);
    (prisma.gameStation.findMany as jest.Mock).mockResolvedValue([] as never);
    (prisma.gameStation.groupBy as jest.Mock).mockResolvedValue([] as never);
    (prisma.rating.findMany as jest.Mock).mockResolvedValue([] as never);
    (prisma.rating.groupBy as jest.Mock).mockResolvedValue([] as never);
    (prisma.shortLinkDomainRule.findMany as jest.Mock).mockResolvedValue([] as never);
    (prisma.notificationLog.groupBy as jest.Mock).mockResolvedValue([] as never);
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([] as never);

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: managerId,
      gamingCenterId: centerId,
      role: UserRole.MANAGER,
      isActive: true,
    } as never);
    (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: platformAdminId,
      username: 'sec030_admin',
      isActive: true,
      isSuperuser: true,
      totpEnabled: true,
      totpSetupCompleted: true,
    } as never);
  });

  afterEach(async () => {
    (env as any).NODE_ENV = origNodeEnv;
    (env as any).SHORT_LINK_EXTERNAL_POLICY = origExternalPolicy;
    await invalidateDomainRulesCache();
  });

  it('1. Rejects search strings > 120 chars with 400 and bounds sub-phrase token expansion to 8 tokens', async () => {
    const longQ = 'a'.repeat(121);
    const gcSearchRes = await request(app)
      .get('/api/v1/public/search/gamecenters')
      .query({ q: longQ });
    expect(gcSearchRes.status).toBe(400);

    const gamesSearchRes = await request(app)
      .get('/api/v1/public/search/games')
      .query({ search: longQ });
    expect(gamesSearchRes.status).toBe(400);

    // 25 short tokens <= 120 chars must be capped cleanly inside searchService without combinatorial explosion
    const manyTokens = Array.from({ length: 20 }, (_, i) => `t${i}`).join(' ');
    expect(manyTokens.length).toBeLessThanOrEqual(120);
    const parsed = searchGameCentersQuerySchema.parse({ q: manyTokens });
    await SearchService.searchGameCenters(parsed);
    // Bounded to at most 8 tokens -> max 26 sub-phrases + 1 initial lookup, far below 20*4 combinatorial expansion
    expect((prisma.gameCatalog.findMany as jest.Mock).mock.calls.length).toBeLessThanOrEqual(30);
  });

  it('2. Blocks hex & dotted IPv4-mapped IPv6 internal targets and enforces maxClicks: 1 despite hot cache', async () => {
    (env as any).SHORT_LINK_EXTERNAL_POLICY = 'BLOCKLIST_ONLY';
    await invalidateDomainRulesCache();

    const blockedUrls = [
      'http://[::ffff:127.0.0.1]/admin',
      'http://[::ffff:7f00:1]/admin',
      'http://[::ffff:a9fe:a9fe]/latest/meta-data/',
      'http://[0:0:0:0:0:ffff:7f00:1]/',
      'http://[::ffff:0a00:0001]/',
    ];
    for (const url of blockedUrls) {
      await expect(validateAndNormalizeDestinationUrl(url)).rejects.toThrow();
    }

    // maxClicks: 1 -> 1st redirect returns 302, 2nd returns 410 even though dbRow.totalClicks stayed 0 & cache existed
    (prisma.shortLinkDomainRule.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'rule_allow_ig',
        domain: 'instagram.com',
        ruleType: AllowedDomainRuleType.ALLOW,
        includeSubdomains: true,
        isActive: true,
      },
    ] as never);
    await invalidateDomainRulesCache();

    const cappedRow = {
      id: 'sl_cap_1',
      code: 'cap-once',
      normalizedCode: 'cap-once',
      destinationUrl: 'https://www.instagram.com/playnest_ir',
      destinationHost: 'www.instagram.com',
      status: ShortLinkStatus.ACTIVE,
      redirectStatusCode: 302,
      expiresAt: null,
      maxClicks: 1,
      totalClicks: 0,
      deletedAt: null,
      gamingCenterId: centerId,
      campaignId: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
      appendUtmParams: false,
      campaign: null,
    };
    (prisma.shortLink.findUnique as jest.Mock).mockResolvedValue(cappedRow as never);

    // Pre-populate stale hot cache with totalClicks: 0
    redisMap.set('shortlink:code:cap-once', JSON.stringify(cappedRow));

    const firstRes = await request(app).get('/r/cap-once');
    expect(firstRes.status).toBe(302);

    const secondRes = await request(app).get('/r/cap-once');
    expect(secondRes.status).toBe(410);
    expect(secondRes.body.error?.code).toBe('SHORT_LINK_MAX_CLICKS_REACHED');
  });

  it('3. extractClientIp ignores client-spoofed X-Forwarded-For and relies on Express req.ip', () => {
    const fakeReq = {
      ip: '198.51.100.42',
      headers: {
        'x-forwarded-for': '127.0.0.1, 10.0.0.5',
      },
      socket: { remoteAddress: '172.16.0.1' },
    } as any;

    expect(extractClientIp(fakeReq)).toBe('198.51.100.42');
  });

  it('4. Neutralizes CSV formula prefixes and escapes quotes in escapeCsvCell and /platform-admin/financials/export', async () => {
    expect(escapeCsvCell(`=cmd|' /C calc'!A0`)).toBe(`"'=cmd|' /C calc'!A0"`);
    expect(escapeCsvCell('+1+1')).toBe(`"'+1+1"`);
    expect(escapeCsvCell('-2+3')).toBe(`"'-2+3"`);
    expect(escapeCsvCell('@SUM(1,1)')).toBe(`"'@SUM(1,1)"`);
    expect(escapeCsvCell('  =HYPERLINK("x","y")')).toBe(`"'  =HYPERLINK(""x"",""y"")"`);

    (prisma.payment.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'pay_1',
        gamingCenter: { name: '=1+1,"Evil" Center' },
        amount: 50000,
        currency: 'IRR',
        status: 'PAID',
        method: 'ONLINE',
        provider: 'ZIBAL',
        createdAt: new Date('2026-11-26T10:00:00.000Z'),
      },
    ] as never);

    const csvRes = await request(app)
      .get('/api/v1/platform-admin/financials/export')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.text).toContain(`"'=1+1,""Evil"" Center"`);
    expect(csvRes.text).not.toMatch(/,"=1\+1/);
  });

  it('5. Omits Prisma error meta and internal messages in production while preserving safe status codes', async () => {
    (env as any).NODE_ENV = 'production';
    const testApp = express();
    testApp.get('/p2002', (_req, _res, next) => {
      next(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`phone`)', {
          code: 'P2002',
          clientVersion: '5.22.0',
          meta: { target: ['phone'] },
        })
      );
    });
    testApp.get('/validation', (_req, _res, next) => {
      next(new Prisma.PrismaClientValidationError('Unknown arg `passwordHash` in query', { clientVersion: '5.22.0' }));
    });
    testApp.use(errorHandler);

    const p2002Res = await request(testApp).get('/p2002');
    expect(p2002Res.status).toBe(409);
    expect(p2002Res.body.error.details).toBeUndefined();
    expect(p2002Res.body.error.message).toBe('Duplicate value for field');

    const valRes = await request(testApp).get('/validation');
    expect(valRes.status).toBe(400);
    expect(valRes.body.error.details).toBeUndefined();
    expect(valRes.body.error.message).toBe('Invalid database query parameters.');
  });

  it('6. Restricts global ingestion-status and operations/jobs telemetry to PLATFORM_ADMIN (403 for MANAGER, 200 for PA)', async () => {
    (prisma.analyticsWatermark.findMany as jest.Mock).mockResolvedValue([] as never);
    (prisma.analyticsIngestionRun.findMany as jest.Mock).mockResolvedValue([] as never);

    const mgrIngest = await request(app)
      .get(`/api/v1/gamingCenters/${centerId}/analytics/ingestion-status`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(mgrIngest.status).toBe(403);

    const mgrJobs = await request(app)
      .get(`/api/v1/gamingCenters/${centerId}/analytics/operations/jobs`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(mgrJobs.status).toBe(403);

    const paIngest = await request(app)
      .get(`/api/v1/gamingCenters/${centerId}/analytics/ingestion-status`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(paIngest.status).toBe(200);

    const paJobs = await request(app)
      .get(`/api/v1/gamingCenters/${centerId}/analytics/operations/jobs`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(paJobs.status).toBe(200);
  });
});
