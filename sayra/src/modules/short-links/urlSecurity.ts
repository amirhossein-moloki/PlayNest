import net from 'net';
import httpStatus from 'http-status';
import { AllowedDomainRuleType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import redis from '../../config/redis';
import { env } from '../../config/env';
import AppError from '../../common/errors/AppError';
import { normalizeShortCode } from './shortCode';

const MAX_DESTINATION_URL_LENGTH = 2048;
const DOMAIN_RULES_CACHE_KEY = 'shortlinks:domain-rules:v1';
const DOMAIN_RULES_TTL_SECONDS = 60;

const THIRD_PARTY_SHORTENER_HOSTS = new Set<string>([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'rb.gy',
  'cutt.ly',
  'shorturl.at',
  'buff.ly',
  'rebrand.ly',
  'tiny.cc',
  'bl.ink',
  'v.gd',
  'short.io',
]);

export interface CachedDomainRule {
  id: string;
  domain: string;
  ruleType: AllowedDomainRuleType;
  includeSubdomains: boolean;
  isActive: boolean;
}

let memoryDomainRulesCache: { expiresAt: number; rules: CachedDomainRule[] } | null = null;

export async function invalidateDomainRulesCache(): Promise<void> {
  memoryDomainRulesCache = null;
  try {
    if (typeof redis?.del === 'function') {
      await redis.del(DOMAIN_RULES_CACHE_KEY);
    }
  } catch {
    // Cache eviction errors must not block mutations
  }
}

export async function loadActiveDomainRules(): Promise<CachedDomainRule[]> {
  const isTest = process.env.NODE_ENV === 'test';
  if (!isTest && memoryDomainRulesCache && memoryDomainRulesCache.expiresAt > Date.now()) {
    return memoryDomainRulesCache.rules;
  }

  if (!isTest) {
    try {
      const raw = await redis.get(DOMAIN_RULES_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedDomainRule[];
        if (Array.isArray(parsed)) {
          memoryDomainRulesCache = { expiresAt: Date.now() + 30_000, rules: parsed };
          return parsed;
        }
      }
    } catch {
      // Fall through to DB
    }
  }

  if (typeof prisma.shortLinkDomainRule?.findMany !== 'function') {
    return [];
  }

  const rows = await prisma.shortLinkDomainRule.findMany({
    where: { isActive: true },
    select: {
      id: true,
      domain: true,
      ruleType: true,
      includeSubdomains: true,
      isActive: true,
    },
  });

  const normalized: CachedDomainRule[] = (rows || []).map((r) => ({
    id: r.id,
    domain: String(r.domain).trim().toLowerCase().replace(/\.+$/, ''),
    ruleType: r.ruleType,
    includeSubdomains: Boolean(r.includeSubdomains),
    isActive: Boolean(r.isActive),
  }));

  if (!isTest) {
    memoryDomainRulesCache = { expiresAt: Date.now() + 30_000, rules: normalized };
    try {
      await redis.set(
        DOMAIN_RULES_CACHE_KEY,
        JSON.stringify(normalized),
        'EX',
        DOMAIN_RULES_TTL_SECONDS
      );
    } catch {
      // Ignore Redis write error
    }
  }

  return normalized;
}

function matchesDomainPattern(hostname: string, pattern: string, includeSubdomains: boolean): boolean {
  const cleanHost = hostname.toLowerCase().replace(/\.+$/, '');
  const cleanPattern = pattern.toLowerCase().replace(/^\*\.+/, '').replace(/\.+$/, '');
  if (!cleanHost || !cleanPattern) return false;
  if (cleanHost === cleanPattern) return true;
  if (includeSubdomains && cleanHost.endsWith(`.${cleanPattern}`)) return true;
  return false;
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 ("this network")
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 192 && b === 0 && (parts[2] === 0 || parts[2] === 2)) return true; // test/protocol
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
  if (a >= 224) return true; // multicast & reserved
  return false;
}

function isPrivateOrReservedIpv6(rawIp: string): boolean {
  const ip = rawIp.replace(/^\[|\]$/g, '').toLowerCase().split('%')[0];
  if (!ip) return true;
  if (ip === '::' || ip === '::1' || ip === '0:0:0:0:0:0:0:1' || ip === '0:0:0:0:0:0:0:0') {
    return true;
  }
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // fc00::/7 ULA
  if (/^fe[89ab][0-9a-f]/i.test(ip) || ip.startsWith('fe80:')) return true; // link-local
  if (ip.startsWith('ff')) return true; // multicast
  if (ip.startsWith('::ffff:')) {
    const mapped = ip.slice('::ffff:'.length);
    if (net.isIPv4(mapped)) return isPrivateOrReservedIpv4(mapped);
    const hexMatch = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMatch) {
      const hi = parseInt(hexMatch[1], 16);
      const lo = parseInt(hexMatch[2], 16);
      const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      return isPrivateOrReservedIpv4(ipv4);
    }
  }
  const expandedMapped = ip.match(/^0{1,4}:0{1,4}:0{1,4}:0{1,4}:0{1,4}:ffff:(.+)$/);
  if (expandedMapped) {
    const suffix = expandedMapped[1];
    if (net.isIPv4(suffix)) return isPrivateOrReservedIpv4(suffix);
    const hexMatch = suffix.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMatch) {
      const hi = parseInt(hexMatch[1], 16);
      const lo = parseInt(hexMatch[2], 16);
      const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      return isPrivateOrReservedIpv4(ipv4);
    }
  }
  return false;
}

function isDangerousIpOrInternalHost(hostname: string): boolean {
  const clean = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  if (!clean) return true;

  if (
    clean === 'localhost' ||
    clean.endsWith('.localhost') ||
    clean.endsWith('.local') ||
    clean.endsWith('.internal') ||
    clean.endsWith('.localdomain') ||
    clean.endsWith('.arpa')
  ) {
    return true;
  }

  // Block obfuscated single-label numeric/hex/octal IPs (e.g. 2130706433, 0x7f000001, 0177)
  if (/^(\d+|0x[0-9a-f]+|0[0-7]+)$/i.test(clean)) {
    return true;
  }

  // Block octal/hex dotted IPv4 segments (e.g. 0177.0.0.1)
  if (/^(0x[0-9a-f]+|0[0-7]+|\d+)\.(0x[0-9a-f]+|0[0-7]+|\d+)\.(0x[0-9a-f]+|0[0-7]+|\d+)\.(0x[0-9a-f]+|0[0-7]+|\d+)$/i.test(clean)) {
    const segments = clean.split('.');
    if (segments.some((s) => /^0x/i.test(s) || (s.length > 1 && s.startsWith('0')))) {
      return true;
    }
    return isPrivateOrReservedIpv4(clean);
  }

  const ipVersion = net.isIP(clean);
  if (ipVersion === 4) {
    return isPrivateOrReservedIpv4(clean);
  }
  if (ipVersion === 6) {
    return isPrivateOrReservedIpv6(clean);
  }

  // Must look like a valid DNS domain name with at least one dot
  if (!clean.includes('.') || clean.includes('..')) {
    return true;
  }

  return false;
}

function getConfiguredInternalHosts(): string[] {
  const hosts = new Set<string>();
  const urlCandidates = [
    env.FRONTEND_URL,
    env.SHORT_LINK_BASE_URL,
    env.MEDIA_PUBLIC_BASE_URL,
  ];
  for (const raw of urlCandidates) {
    if (!raw) continue;
    try {
      const parsed = new URL(raw);
      const h = parsed.hostname.toLowerCase();
      if (h && !isDangerousIpOrInternalHost(h)) {
        hosts.add(h);
        // Treat root PlayNest domain (stripping www. or api.) as allowing its subdomains
        const root = h.replace(/^(www|api|blog|r)\./, '');
        if (root.includes('.')) hosts.add(root);
      }
    } catch {
      // Ignore malformed optional env URL
    }
  }

  return Array.from(hosts);
}

function getConfiguredEnvAllowedDomains(): string[] {
  return (env.SHORT_LINK_ALLOWED_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/\.+$/, ''))
    .filter(Boolean);
}

function isShortenerRedirectLoop(parsed: URL, ownShortCode?: string): boolean {
  const host = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  const pathname = parsed.pathname;

  let shortBaseHost = '';
  let shortBasePrefix = '/r';
  try {
    const baseUrl = new URL(env.SHORT_LINK_BASE_URL || 'https://sayra-booking.ir/r');
    shortBaseHost = baseUrl.hostname.toLowerCase().replace(/\.+$/, '');
    shortBasePrefix = baseUrl.pathname.replace(/\/+$/, '') || '/r';
  } catch {
    shortBaseHost = 'sayra-booking.ir';
  }

  const sameShortHost =
    host === shortBaseHost ||
    getConfiguredInternalHosts().some((h) => matchesDomainPattern(host, h, true));

  if (sameShortHost) {
    if (
      pathname === shortBasePrefix ||
      pathname.startsWith(`${shortBasePrefix}/`) ||
      pathname.startsWith('/r/') ||
      pathname.startsWith('/s/') ||
      pathname.startsWith('/api/v1/short-links/r/')
    ) {
      return true;
    }
  }

  if (ownShortCode) {
    const normCode = normalizeShortCode(ownShortCode);
    const segments = pathname.split('/').filter(Boolean).map((s) => normalizeShortCode(s));
    if (segments.includes(normCode) && sameShortHost) {
      return true;
    }
  }

  return false;
}

export interface ValidatedDestinationResult {
  normalizedUrl: string;
  destinationHost: string;
  isInternalPlayNestDomain: boolean;
}

/**
 * Strictly validates destination URLs against Open Redirect, SSRF, protocol smuggling,
 * Punycode homographs, redirect loops, shortener chains, and platform allow/block rules.
 */
export async function validateAndNormalizeDestinationUrl(
  rawUrl: string,
  options: { ownCode?: string; skipDomainRules?: boolean } = {}
): Promise<ValidatedDestinationResult> {
  if (typeof rawUrl !== 'string') {
    throw new AppError('Destination URL must be a valid URL string.', httpStatus.BAD_REQUEST, {
      code: 'INVALID_DESTINATION_URL',
    });
  }

  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > MAX_DESTINATION_URL_LENGTH) {
    throw new AppError(
      `Destination URL must be between 1 and ${MAX_DESTINATION_URL_LENGTH} characters.`,
      httpStatus.BAD_REQUEST,
      { code: 'INVALID_DESTINATION_URL' }
    );
  }

  // Reject control characters, newlines, tabs, or backslashes before scheme
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F\s]/.test(trimmed) || trimmed.startsWith('//') || trimmed.startsWith('\\\\')) {
    throw new AppError(
      'Destination URL contains invalid characters or relative authority prefix.',
      httpStatus.BAD_REQUEST,
      { code: 'INVALID_DESTINATION_URL' }
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError('Malformed destination URL.', httpStatus.BAD_REQUEST, {
      code: 'INVALID_DESTINATION_URL',
    });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError(
      'Only HTTP and HTTPS destination URLs are permitted.',
      httpStatus.BAD_REQUEST,
      { code: 'UNSUPPORTED_URL_SCHEME' }
    );
  }

  if (parsed.username || parsed.password) {
    throw new AppError(
      'Destination URLs containing embedded credentials are not allowed.',
      httpStatus.BAD_REQUEST,
      { code: 'CREDENTIALS_IN_URL_FORBIDDEN' }
    );
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  if (isDangerousIpOrInternalHost(hostname)) {
    throw new AppError(
      'Destination host points to an internal, loopback, or invalid IP address.',
      httpStatus.BAD_REQUEST,
      { code: 'UNSAFE_DESTINATION_HOST' }
    );
  }

  if (isShortenerRedirectLoop(parsed, options.ownCode)) {
    throw new AppError(
      'Destination URL would create a short-link redirect loop.',
      httpStatus.BAD_REQUEST,
      { code: 'REDIRECT_LOOP_DETECTED' }
    );
  }

  const rules = options.skipDomainRules ? [] : await loadActiveDomainRules();

  // Explicit BLOCK rules always take highest precedence
  const blockedRule = rules.find(
    (r) =>
      r.ruleType === AllowedDomainRuleType.BLOCK &&
      matchesDomainPattern(hostname, r.domain, r.includeSubdomains)
  );
  if (blockedRule) {
    throw new AppError(
      `Destination domain "${hostname}" is blocked by platform security policy.`,
      httpStatus.BAD_REQUEST,
      { code: 'BLOCKED_DESTINATION_DOMAIN' }
    );
  }

  const explicitlyAllowedByRule = rules.some(
    (r) =>
      r.ruleType === AllowedDomainRuleType.ALLOW &&
      matchesDomainPattern(hostname, r.domain, r.includeSubdomains)
  );

  // Punycode homograph protection (unless explicitly allowlisted by platform admin)
  const hasPunycodeLabel = hostname.split('.').some((label) => label.startsWith('xn--'));
  if (hasPunycodeLabel && !explicitlyAllowedByRule) {
    throw new AppError(
      'Internationalized Punycode (xn--) domains require explicit platform allowlist approval.',
      httpStatus.BAD_REQUEST,
      { code: 'PUNYCODE_DOMAIN_FORBIDDEN' }
    );
  }

  // Shortener-chaining defense (unless explicitly allowlisted)
  if (THIRD_PARTY_SHORTENER_HOSTS.has(hostname) && !explicitlyAllowedByRule) {
    throw new AppError(
      'Linking to external URL shorteners is blocked to prevent redirect chains and phishing.',
      httpStatus.BAD_REQUEST,
      { code: 'SHORTENER_CHAIN_FORBIDDEN' }
    );
  }

  const internalHosts = getConfiguredInternalHosts();
  const isInternalPlayNestDomain = internalHosts.some((h) =>
    matchesDomainPattern(hostname, h, true)
  );
  const envAllowedDomains = getConfiguredEnvAllowedDomains();
  const isEnvAllowedExternalDomain = envAllowedDomains.some((h) =>
    matchesDomainPattern(hostname, h, true)
  );

  const policy = env.SHORT_LINK_EXTERNAL_POLICY || 'ALLOWLIST_ONLY';
  if (
    policy === 'ALLOWLIST_ONLY' &&
    !isInternalPlayNestDomain &&
    !isEnvAllowedExternalDomain &&
    !explicitlyAllowedByRule
  ) {
    throw new AppError(
      `External domain "${hostname}" is not allowlisted. Platform admin approval is required.`,
      httpStatus.BAD_REQUEST,
      { code: 'DOMAIN_NOT_ALLOWLISTED' }
    );
  }

  return {
    normalizedUrl: parsed.toString(),
    destinationHost: hostname,
    isInternalPlayNestDomain,
  };
}

/**
 * Defense-in-depth runtime verification executed during public redirects:
 * rejects if domain was newly blacklisted or URL became unsafe after creation.
 */
export async function isDestinationBlockedForRedirect(
  destinationUrl: string,
  code: string
): Promise<boolean> {
  try {
    const parsed = new URL(destinationUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return true;
    }
    const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, '');
    if (isDangerousIpOrInternalHost(hostname)) {
      return true;
    }
    if (isShortenerRedirectLoop(parsed, code)) {
      return true;
    }
    const rules = await loadActiveDomainRules();
    const isBlocked = rules.some(
      (r) =>
        r.ruleType === AllowedDomainRuleType.BLOCK &&
        matchesDomainPattern(hostname, r.domain, r.includeSubdomains)
    );
    return isBlocked;
  } catch {
    return true;
  }
}

export interface UtmBundle {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
}

const SAFE_UTM_VALUE_REGEX = /^[\p{L}\p{N}._:@/+ -]{1,128}$/u;

function pickSafeUtm(val: unknown): string | undefined {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (!trimmed || !SAFE_UTM_VALUE_REGEX.test(trimmed)) return undefined;
  return trimmed;
}

/**
 * Resolves effective UTM attribution and safely merges parameters into the final redirect URL.
 */
export function composeRedirectTargetUrl(
  destinationUrl: string,
  linkUtms: UtmBundle,
  campaignUtms: UtmBundle | null | undefined,
  incomingQuery: Record<string, unknown>,
  appendUtmParams: boolean
): {
  finalUrl: string;
  effectiveUtm: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
  };
} {
  const effectiveUtm = {
    utmSource:
      pickSafeUtm(incomingQuery.utm_source) ??
      pickSafeUtm(linkUtms.utmSource) ??
      pickSafeUtm(campaignUtms?.utmSource),
    utmMedium:
      pickSafeUtm(incomingQuery.utm_medium) ??
      pickSafeUtm(linkUtms.utmMedium) ??
      pickSafeUtm(campaignUtms?.utmMedium),
    utmCampaign:
      pickSafeUtm(incomingQuery.utm_campaign) ??
      pickSafeUtm(linkUtms.utmCampaign) ??
      pickSafeUtm(campaignUtms?.utmCampaign),
    utmTerm:
      pickSafeUtm(incomingQuery.utm_term) ??
      pickSafeUtm(linkUtms.utmTerm) ??
      pickSafeUtm(campaignUtms?.utmTerm),
    utmContent:
      pickSafeUtm(incomingQuery.utm_content) ??
      pickSafeUtm(linkUtms.utmContent) ??
      pickSafeUtm(campaignUtms?.utmContent),
  };

  if (!appendUtmParams) {
    return { finalUrl: destinationUrl, effectiveUtm };
  }

  try {
    const parsed = new URL(destinationUrl);
    const paramPairs: Array<[string, string | undefined]> = [
      ['utm_source', effectiveUtm.utmSource],
      ['utm_medium', effectiveUtm.utmMedium],
      ['utm_campaign', effectiveUtm.utmCampaign],
      ['utm_term', effectiveUtm.utmTerm],
      ['utm_content', effectiveUtm.utmContent],
    ];

    for (const [key, value] of paramPairs) {
      if (value && !parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, value);
      }
    }

    return { finalUrl: parsed.toString(), effectiveUtm };
  } catch {
    return { finalUrl: destinationUrl, effectiveUtm };
  }
}
