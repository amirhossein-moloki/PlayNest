import crypto from 'crypto';
import { Request } from 'express';
import { env } from '../../config/env';

const BOT_SIGNATURE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /googlebot/i, reason: 'crawler:googlebot' },
  { pattern: /bingbot/i, reason: 'crawler:bingbot' },
  { pattern: /yandexbot/i, reason: 'crawler:yandexbot' },
  { pattern: /baiduspider/i, reason: 'crawler:baidu' },
  { pattern: /duckduckbot/i, reason: 'crawler:duckduckgo' },
  { pattern: /applebot/i, reason: 'crawler:applebot' },
  { pattern: /telegrambot/i, reason: 'preview:telegram' },
  { pattern: /whatsapp/i, reason: 'preview:whatsapp' },
  { pattern: /slackbot/i, reason: 'preview:slack' },
  { pattern: /discordbot/i, reason: 'preview:discord' },
  { pattern: /twitterbot/i, reason: 'preview:twitter' },
  { pattern: /facebookexternalhit|facebot/i, reason: 'preview:facebook' },
  { pattern: /linkedinbot/i, reason: 'preview:linkedin' },
  { pattern: /pinterest/i, reason: 'preview:pinterest' },
  { pattern: /headlesschrome|puppeteer|playwright|phantomjs|selenium|webdriver/i, reason: 'automation:headless' },
  { pattern: /curl\/|wget\/|httpie\/|python-requests|python-urllib|aiohttp|httpx|axios\/|node-fetch|got\/|go-http-client|postmanruntime|insomnia\/|java\/|apache-httpclient|okhttp/i, reason: 'automation:http_client' },
  { pattern: /\b(bot|spider|crawler|scraper|slurp|archiver|monitoring|uptimerobot|pingdom|statuscake|ahrefsbot|semrushbot|mj12bot|dotbot)\b/i, reason: 'crawler:generic' },
];

function getPrivacySalt(): string {
  return (
    process.env.SHORT_LINK_PRIVACY_SALT ||
    env.SHORT_LINK_PRIVACY_SALT ||
    env.JWT_ACCESS_SECRET ||
    'playnest-shortlink-privacy-salt'
  );
}

/**
 * Computes a one-way salted HMAC-SHA256 digest so raw IPs are never persisted.
 */
export function hashSensitiveValue(rawValue: string, purpose = 'visitor'): string {
  return crypto
    .createHmac('sha256', `${getPrivacySalt()}:${purpose}`)
    .update(rawValue)
    .digest('hex')
    .slice(0, 32);
}

export function extractClientIp(req: Request): string {
  const expressIp = typeof req.ip === 'string' ? req.ip.trim() : '';
  if (expressIp) {
    return expressIp;
  }
  return (req.socket?.remoteAddress || 'unknown').trim();
}

/**
 * Generates an unlinkable daily-scoped visitor hash for approximate unique visitor counting.
 */
export function buildVisitorFingerprint(
  ip: string,
  userAgent: string,
  shortLinkId: string,
  utcDate: string
): string {
  const normalizedUa = (userAgent || '').trim().toLowerCase().slice(0, 200);
  return hashSensitiveValue(`${shortLinkId}:${utcDate}:${ip}:${normalizedUa}`, 'visitor');
}

export function buildIpBucketHash(ip: string): string {
  return hashSensitiveValue(ip || 'unknown', 'ip-bucket');
}

export interface ParsedUserAgent {
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown';
  os: string;
  browser: string;
  isBot: boolean;
  botReason: string | null;
}

export function parseUserAgent(rawUa: string | undefined): ParsedUserAgent {
  const ua = (rawUa || '').trim();
  if (!ua) {
    return {
      deviceType: 'bot',
      os: 'unknown',
      browser: 'unknown',
      isBot: true,
      botReason: 'missing_user_agent',
    };
  }

  for (const sig of BOT_SIGNATURE_PATTERNS) {
    if (sig.pattern.test(ua)) {
      return {
        deviceType: 'bot',
        os: detectOs(ua),
        browser: detectBrowser(ua),
        isBot: true,
        botReason: sig.reason,
      };
    }
  }

  const os = detectOs(ua);
  const browser = detectBrowser(ua);
  let deviceType: ParsedUserAgent['deviceType'] = 'unknown';

  if (/ipad|tablet|playbook|silk|kindle|android(?!.*mobile)/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/windows|macintosh|mac os x|x11|linux|cros/i.test(ua)) {
    deviceType = 'desktop';
  }

  return {
    deviceType,
    os,
    browser,
    isBot: false,
    botReason: null,
  };
}

function detectOs(ua: string): string {
  if (/iphone|ipad|ipod|cpu os|ios/i.test(ua)) return 'iOS';
  if (/android/i.test(ua)) return 'Android';
  if (/windows nt|win32|win64/i.test(ua)) return 'Windows';
  if (/mac os x|macintosh/i.test(ua)) return 'macOS';
  if (/cros/i.test(ua)) return 'ChromeOS';
  if (/linux|x11/i.test(ua)) return 'Linux';
  return 'unknown';
}

function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet';
  if (/instagram/i.test(ua)) return 'Instagram';
  if (/telegram/i.test(ua)) return 'Telegram';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/chrome|crios/i.test(ua) && !/edg\//i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) return 'Safari';
  return 'unknown';
}

export function parseReferrerAndSource(
  rawReferrer: string | undefined,
  utmSource?: string,
  utmMedium?: string
): {
  referrer: string | null;
  referrerDomain: string | null;
  trafficSource: string;
} {
  let cleanReferrer: string | null = null;
  let referrerDomain: string | null = null;

  if (typeof rawReferrer === 'string' && rawReferrer.trim()) {
    try {
      const parsed = new URL(rawReferrer.trim());
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        referrerDomain = parsed.hostname.toLowerCase();
        // Strip query/hash to avoid storing sensitive referrer query parameters
        cleanReferrer = `${parsed.origin}${parsed.pathname}`.slice(0, 500);
      }
    } catch {
      cleanReferrer = null;
    }
  }

  const combined = `${(utmSource || '').toLowerCase()} ${(utmMedium || '').toLowerCase()} ${(referrerDomain || '').toLowerCase()}`;

  let trafficSource = 'direct';
  if (/instagram/.test(combined)) {
    trafficSource = 'instagram';
  } else if (/telegram|t\.me/.test(combined)) {
    trafficSource = 'telegram';
  } else if (/whatsapp|wa\.me/.test(combined)) {
    trafficSource = 'whatsapp';
  } else if (/twitter|t\.co|x\.com/.test(combined)) {
    trafficSource = 'twitter';
  } else if (/youtube|youtu\.be/.test(combined)) {
    trafficSource = 'youtube';
  } else if (/linkedin/.test(combined)) {
    trafficSource = 'linkedin';
  } else if (/sms/.test((utmMedium || '').toLowerCase()) || /sms/.test((utmSource || '').toLowerCase())) {
    trafficSource = 'sms';
  } else if (/email|newsletter/.test(combined)) {
    trafficSource = 'email';
  } else if (/google|bing|yahoo|duckduckgo|baidu|yandex/.test(combined)) {
    trafficSource = 'search';
  } else if (/sayra-booking\.ir|playnest/.test(referrerDomain || '')) {
    trafficSource = 'internal';
  } else if (referrerDomain) {
    trafficSource = 'referral';
  } else if (utmSource) {
    trafficSource = utmSource.trim().toLowerCase().slice(0, 50) || 'campaign';
  }

  return {
    referrer: cleanReferrer,
    referrerDomain,
    trafficSource,
  };
}

function readCleanHeader(headers: Request['headers'], keys: string[], maxLen: number): string | null {
  for (const key of keys) {
    const val = headers[key];
    if (typeof val === 'string' && val.trim()) {
      const clean = val.trim().slice(0, maxLen);
      if (clean && clean !== 'XX' && clean !== 'T1') {
        return clean;
      }
    }
  }
  return null;
}

export function extractGeoFromHeaders(headers: Request['headers']): {
  countryCode: string | null;
  region: string | null;
} {
  const country = readCleanHeader(
    headers,
    ['cf-ipcountry', 'x-geo-country', 'x-vercel-ip-country', 'x-country-code'],
    8
  );
  const region = readCleanHeader(
    headers,
    ['cf-region', 'x-geo-region', 'x-vercel-ip-country-region', 'cf-ipcity', 'x-geo-city'],
    64
  );

  return {
    countryCode: country ? country.toUpperCase() : null,
    region,
  };
}
