// Lowercase set of sensitive keys to redact from logs.
const SENSITIVE_KEY_SET = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'set-cookie',
  'idempotency-key',
  'x-api-key',
  'phone',
  'email',
  'otp',
  // Card-related fields
  'card',
  'cardnumber',
  'cvc',
  'cvv',
  'exp_month',
  'exp_year',
]);

export const SAFE_REQUEST_HEADERS = [
  'host',
  'user-agent',
  'x-request-id',
  'x-correlation-id',
  'content-type',
  'content-length',
  'accept',
  'x-forwarded-for',
  'x-real-ip',
] as const;

export const SAFE_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'cache-control',
  'x-request-id',
  'x-correlation-id',
  'etag',
] as const;

/**
 * Deeply sanitizes an object in place by redacting values of sensitive keys.
 * Guards against circular references cleanly without JSON cloning.
 */
export const sanitizeLog = (obj: any, seen = new WeakSet<object>()): any => { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (seen.has(obj)) {
    return '[CIRCULAR]';
  }
  seen.add(obj);

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = sanitizeLog(obj[i], seen);
    }
    return obj;
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (SENSITIVE_KEY_SET.has(key.toLowerCase())) {
        obj[key] = '[REDACTED]';
      } else {
        obj[key] = sanitizeLog(obj[key], seen);
      }
    }
  }
  return obj;
};

/**
 * Fast non-mutating redacting copy for HTTP log payloads without JSON.parse(JSON.stringify).
 */
export const sanitizeLogCopy = (
  value: unknown,
  maxDepth = 4,
  depth = 0,
  seen = new WeakSet<object>()
): unknown => {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (seen.has(value)) {
    return '[CIRCULAR]';
  }

  if (depth >= maxDepth) {
    return '[TRUNCATED]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogCopy(item, maxDepth, depth + 1, seen));
  }

  const out: Record<string, unknown> = {};
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (SENSITIVE_KEY_SET.has(key.toLowerCase())) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = sanitizeLogCopy(record[key], maxDepth, depth + 1, seen);
    }
  }
  return out;
};

export const pickSafeRequestHeaders = (headers?: Record<string, unknown>): Record<string, unknown> => {
  if (!headers || typeof headers !== 'object') {
    return {};
  }
  const safe: Record<string, unknown> = {};
  for (const key of SAFE_REQUEST_HEADERS) {
    const val = headers[key];
    if (val !== undefined) {
      safe[key] = val;
    }
  }
  return safe;
};

export const pickSafeResponseHeaders = (
  res?: {
    getHeader?: (name: string) => unknown;
    headers?: Record<string, unknown>;
    _headers?: Record<string, unknown>;
  }
): Record<string, unknown> => {
  if (!res || typeof res !== 'object') {
    return {};
  }
  const safe: Record<string, unknown> = {};
  const fallbackHeaders = res.headers || res._headers;
  for (const key of SAFE_RESPONSE_HEADERS) {
    const val = typeof res.getHeader === 'function' ? res.getHeader(key) : fallbackHeaders?.[key];
    if (val !== undefined) {
      safe[key] = val;
    }
  }
  return safe;
};
