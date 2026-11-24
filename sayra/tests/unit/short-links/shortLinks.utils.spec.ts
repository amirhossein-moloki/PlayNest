import { AllowedDomainRuleType } from '@prisma/client';
import { env } from '../../../src/config/env';
import { prisma } from '../../../src/config/prisma';
import {
  buildShortUrl,
  generateShortCode,
  isValidShortCodeFormat,
  normalizeShortCode,
  RESERVED_SHORT_CODES,
  validateCustomCode,
} from '../../../src/modules/short-links/shortCode';
import {
  invalidateDomainRulesCache,
  validateAndNormalizeDestinationUrl,
  isDestinationBlockedForRedirect,
  composeRedirectTargetUrl,
} from '../../../src/modules/short-links/urlSecurity';
import {
  buildIpBucketHash,
  buildVisitorFingerprint,
  extractGeoFromHeaders,
  hashSensitiveValue,
  parseReferrerAndSource,
  parseUserAgent,
} from '../../../src/modules/short-links/clickClassifier';
import {
  generateQrMatrix,
  generateShortLinkQr,
} from '../../../src/modules/short-links/qrCode.generator';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    shortLinkDomainRule: {
      findMany: jest.fn(),
    },
  },
}));

describe('ShortLinks Core Utilities Unit Suite', () => {
  const originalExternalPolicy = env.SHORT_LINK_EXTERNAL_POLICY;
  const originalAllowedDomains = env.SHORT_LINK_ALLOWED_DOMAINS;
  const originalBaseUrl = env.SHORT_LINK_BASE_URL;

  beforeEach(async () => {
    jest.clearAllMocks();
    (prisma.shortLinkDomainRule.findMany as jest.Mock).mockResolvedValue([]);
    (env as any).SHORT_LINK_EXTERNAL_POLICY = 'ALLOWLIST_ONLY';
    (env as any).SHORT_LINK_ALLOWED_DOMAINS = 'instagram.com,t.me,youtube.com,aparat.com,linkedin.com';
    (env as any).SHORT_LINK_BASE_URL = 'https://sayra-booking.ir/r';
    await invalidateDomainRulesCache();
  });

  afterEach(async () => {
    (env as any).SHORT_LINK_EXTERNAL_POLICY = originalExternalPolicy;
    (env as any).SHORT_LINK_ALLOWED_DOMAINS = originalAllowedDomains;
    (env as any).SHORT_LINK_BASE_URL = originalBaseUrl;
    await invalidateDomainRulesCache();
  });

  describe('shortCode (CSPRNG Base58 & Alias Validation)', () => {
    it('generates unique Base58 codes without visually ambiguous characters', () => {
      const generated = new Set<string>();
      for (let i = 0; i < 1000; i += 1) {
        const code = generateShortCode(8);
        expect(code).toHaveLength(8);
        expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{8}$/);
        expect(code).not.toMatch(/[0OIl]/);
        generated.add(code);
      }
      expect(generated.size).toBe(1000);
    });

    it('normalizes codes case-insensitively and enforces valid format bounds', () => {
      expect(normalizeShortCode('  VIP_Summer-26  ')).toBe('vip_summer-26');
      expect(isValidShortCodeFormat('vip-26')).toBe(true);
      expect(isValidShortCodeFormat('ab')).toBe(false);
      expect(isValidShortCodeFormat('-badstart')).toBe(false);
      expect(isValidShortCodeFormat('bad.dot')).toBe(false);
      expect(isValidShortCodeFormat('a/b')).toBe(false);
    });

    it('rejects reserved platform paths and validates clean custom aliases', () => {
      for (const word of ['admin', 'API', 'login', 'platform-admin', 'r', 's', 'health', 'short-links']) {
        if (word.length >= 3) {
          expect(() => validateCustomCode(word)).toThrow(/reserved/i);
        } else {
          expect(RESERVED_SHORT_CODES.has(word.toLowerCase())).toBe(true);
          expect(() => validateCustomCode(word)).toThrow();
        }
      }

      const valid = validateCustomCode('  Tehran-VIP_2026  ');
      expect(valid).toEqual({
        code: 'Tehran-VIP_2026',
        normalizedCode: 'tehran-vip_2026',
      });
    });

    it('builds full short URLs cleanly without double slashes', () => {
      expect(buildShortUrl('vip2026')).toBe('https://sayra-booking.ir/r/vip2026');
    });
  });

  describe('urlSecurity (SSRF, Open Redirect, Punycode, Domain Rules, UTM Composition)', () => {
    it('allows internal PlayNest destinations and allowlisted external domains', async () => {
      const internal = await validateAndNormalizeDestinationUrl(
        'https://sayra-booking.ir/centers/tehran-vip?tab=stations'
      );
      expect(internal.normalizedUrl).toBe('https://sayra-booking.ir/centers/tehran-vip?tab=stations');
      expect(internal.destinationHost).toBe('sayra-booking.ir');
      expect(internal.isInternalPlayNestDomain).toBe(true);

      const external = await validateAndNormalizeDestinationUrl('https://www.instagram.com/playnest.ir');
      expect(external.destinationHost).toBe('www.instagram.com');
      expect(external.isInternalPlayNestDomain).toBe(false);

      // External allowlisted domains containing /s/ or /r/ path must not falsely trigger redirect-loop defense
      const externalStory = await validateAndNormalizeDestinationUrl('https://www.instagram.com/s/story123');
      expect(externalStory.destinationHost).toBe('www.instagram.com');
      expect(externalStory.isInternalPlayNestDomain).toBe(false);
    });

    it('blocks unsafe schemes, embedded credentials, localhost, private IPs, and obfuscated numeric IPs', async () => {
      const unsafeUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'vbscript:msgbox(1)',
        '//evil.example.com/phish',
        'https://user:pass@sayra-booking.ir/admin',
        'http://localhost:3000/secret',
        'http://127.0.0.1/admin',
        'http://[::1]/internal',
        'http://10.0.0.1/router',
        'http://172.16.5.4/panel',
        'http://192.168.1.10/db',
        'http://169.254.169.254/latest/meta-data/',
        'http://0x7f000001/',
        'http://2130706433/',
        'http://0177.0.0.1/',
        'https://evil.internal/api',
      ];

      for (const bad of unsafeUrls) {
        await expect(validateAndNormalizeDestinationUrl(bad)).rejects.toThrow();
      }
    });

    it('blocks Punycode homograph domains, shortener chains, and redirect loops', async () => {
      await expect(
        validateAndNormalizeDestinationUrl('https://xn--pple-43d.com/login')
      ).rejects.toThrow(/Punycode/i);

      await expect(
        validateAndNormalizeDestinationUrl('https://bit.ly/3xYzAbC')
      ).rejects.toThrow(/shorteners/i);

      await expect(
        validateAndNormalizeDestinationUrl('https://tinyurl.com/abc123')
      ).rejects.toThrow(/shorteners/i);

      await expect(
        validateAndNormalizeDestinationUrl('https://sayra-booking.ir/r/selfcode', { ownCode: 'selfcode' })
      ).rejects.toThrow(/loop/i);

      await expect(
        validateAndNormalizeDestinationUrl('https://sayra-booking.ir/s/othercode')
      ).rejects.toThrow(/loop/i);
    });

    it('enforces ALLOWLIST_ONLY vs BLOCKLIST_ONLY policies and DB BLOCK > ALLOW precedence', async () => {
      // ALLOWLIST_ONLY rejects unknown external domain
      await expect(
        validateAndNormalizeDestinationUrl('https://untrusted-partner.org/promo')
      ).rejects.toThrow(/not allowlisted/i);

      // DB ALLOW rule permits exact domain (or subdomains when includeSubdomains=true)
      (prisma.shortLinkDomainRule.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rule_allow_1',
          domain: 'partner.gg',
          ruleType: AllowedDomainRuleType.ALLOW,
          includeSubdomains: true,
          isActive: true,
        },
        {
          id: 'rule_block_1',
          domain: 'bad.partner.gg',
          ruleType: AllowedDomainRuleType.BLOCK,
          includeSubdomains: true,
          isActive: true,
        },
      ]);

      const okPartner = await validateAndNormalizeDestinationUrl('https://promo.partner.gg/sale');
      expect(okPartner.destinationHost).toBe('promo.partner.gg');

      // BLOCK rule overrides parent wildcard ALLOW
      await expect(
        validateAndNormalizeDestinationUrl('https://bad.partner.gg/phish')
      ).rejects.toThrow(/blocked/i);

      // Runtime redirect guard also respects dynamic BLOCK rules
      expect(await isDestinationBlockedForRedirect('https://bad.partner.gg/phish', 'code1')).toBe(true);
      expect(await isDestinationBlockedForRedirect('https://promo.partner.gg/sale', 'code1')).toBe(false);

      // BLOCKLIST_ONLY allows non-blocked external domains
      (env as any).SHORT_LINK_EXTERNAL_POLICY = 'BLOCKLIST_ONLY';
      const externalOk = await validateAndNormalizeDestinationUrl('https://untrusted-partner.org/promo');
      expect(externalOk.destinationHost).toBe('untrusted-partner.org');
    });

    it('composes redirect URLs with campaign, link, and query UTMs without overwriting explicit params', () => {
      const composed = composeRedirectTargetUrl(
        'https://sayra-booking.ir/centers/vip?ref=banner',
        { utmSource: 'instagram', utmMedium: null, utmCampaign: 'vip-launch' },
        { utmSource: 'campaign-fallback', utmMedium: 'social', utmCampaign: 'camp-1', utmContent: 'story' },
        { utm_content: 'story-override' },
        true
      );

      const url = new URL(composed.finalUrl);
      expect(url.searchParams.get('ref')).toBe('banner');
      expect(url.searchParams.get('utm_source')).toBe('instagram');
      expect(url.searchParams.get('utm_medium')).toBe('social');
      expect(url.searchParams.get('utm_campaign')).toBe('vip-launch');
      expect(url.searchParams.get('utm_content')).toBe('story-override');

      const disabledUtm = composeRedirectTargetUrl(
        'https://sayra-booking.ir/centers/vip',
        { utmSource: 'instagram' },
        null,
        {},
        false
      );
      expect(disabledUtm.finalUrl).toBe('https://sayra-booking.ir/centers/vip');
    });
  });

  describe('clickClassifier (Salted HMAC Privacy, UA Bots/Devices, Referrer, Geo)', () => {
    it('hashes sensitive IP and visitor fingerprints cleanly without leaking raw IPs', () => {
      const rawIp = '185.120.22.44';
      const hash1 = hashSensitiveValue(rawIp, 'audit');
      const fpDay1 = buildVisitorFingerprint(rawIp, 'Mozilla/5.0 Chrome/130.0', 'link_1', '2026-11-24');
      const fpDay2 = buildVisitorFingerprint(rawIp, 'Mozilla/5.0 Chrome/130.0', 'link_1', '2026-11-25');
      const ipBucket = buildIpBucketHash(rawIp);

      expect(hash1).toHaveLength(32);
      expect(fpDay1).toHaveLength(32);
      expect(ipBucket).toHaveLength(32);
      expect(hash1).not.toContain('185');
      expect(fpDay1).not.toContain('185');
      expect(ipBucket).not.toContain('185');
      expect(fpDay1).not.toBe(fpDay2);
      expect(fpDay1).toBe(
        buildVisitorFingerprint(rawIp, 'Mozilla/5.0 Chrome/130.0', 'link_1', '2026-11-24')
      );
    });

    it('detects bots, mobile, tablet, desktop devices, OS, and browsers accurately', () => {
      expect(parseUserAgent('Googlebot/2.1 (+http://www.google.com/bot.html)')).toMatchObject({
        deviceType: 'bot',
        isBot: true,
        botReason: 'crawler:googlebot',
      });
      expect(parseUserAgent('curl/8.5.0')).toMatchObject({
        deviceType: 'bot',
        isBot: true,
        botReason: 'automation:http_client',
      });
      expect(
        parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')
      ).toMatchObject({
        deviceType: 'mobile',
        os: 'iOS',
        browser: 'Safari',
        isBot: false,
      });
      expect(
        parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36')
      ).toMatchObject({
        deviceType: 'desktop',
        os: 'Windows',
        browser: 'Chrome',
        isBot: false,
      });
    });

    it('strips sensitive query strings from referrer and classifies traffic source & geo headers', () => {
      const ref = parseReferrerAndSource('https://l.instagram.com/redirect?token=secret', undefined, undefined);
      expect(ref.referrer).toBe('https://l.instagram.com/redirect');
      expect(ref.referrerDomain).toBe('l.instagram.com');
      expect(ref.trafficSource).toBe('instagram');

      const geo = extractGeoFromHeaders({
        'cf-ipcountry': 'ir',
        'cf-ipcity': 'Tehran',
      });
      expect(geo).toEqual({ countryCode: 'IR', region: 'Tehran' });
    });
  });

  describe('qrCode.generator (Pure-TS ISO 18004 Matrix + SVG/PNG/JSON/DataURL)', () => {
    it('builds valid QR matrices for error correction levels L, M, Q, H', () => {
      for (const ecc of ['L', 'M', 'Q', 'H'] as const) {
        const matrix = generateQrMatrix('https://sayra-booking.ir/r/vip2026', ecc);
        expect(matrix.version).toBeGreaterThanOrEqual(1);
        expect(matrix.version).toBeLessThanOrEqual(10);
        expect(matrix.size).toBe(21 + (matrix.version - 1) * 4);
        expect(matrix.modules).toHaveLength(matrix.size);
      }
    });

    it('renders crisp SVG, PNG binary signature, JSON, and DataURL payloads', async () => {
      const shortUrl = 'https://sayra-booking.ir/r/vip2026';
      const svgOut = await generateShortLinkQr(shortUrl, { format: 'svg', size: 256 });
      expect(svgOut.mimeType).toContain('image/svg+xml');
      expect(svgOut.svg).toContain('<svg');
      expect(svgOut.meta.shortUrl).toBe(shortUrl);

      const pngOut = await generateShortLinkQr(shortUrl, { format: 'png', size: 256 });
      expect(pngOut.mimeType).toBe('image/png');
      expect(pngOut.buffer).toBeDefined();
      expect(pngOut.buffer!.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

      const jsonOut = await generateShortLinkQr(shortUrl, { format: 'json', errorCorrectionLevel: 'H' });
      expect(jsonOut.dataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
      expect(jsonOut.svg).toContain('<rect');

      const dataUrlOut = await generateShortLinkQr(shortUrl, { format: 'dataurl', size: 200 });
      expect(dataUrlOut.dataUrl).toMatch(/^data:image\/png;base64,/);
    });
  });
});
