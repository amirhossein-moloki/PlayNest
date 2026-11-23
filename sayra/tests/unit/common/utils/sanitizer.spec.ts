import { describe, it, expect } from '@jest/globals';
import {
  sanitizeLog,
  sanitizeLogCopy,
  pickSafeRequestHeaders,
  pickSafeResponseHeaders,
} from '../../../../src/common/utils/sanitizer';

describe('Log Sanitizer & Header Allowlisting (AMI-40)', () => {
  it('should redact camelCase and nested sensitive keys without mutating source in sanitizeLogCopy', () => {
    const source = {
      user: 'ali',
      accessToken: 'secret-access-token',
      refreshToken: 'secret-refresh-token',
      payment: {
        cardNumber: '6037-9971-0000-1111',
        amount: 50000,
      },
      items: [{ otp: '123456', label: 'slot-1' }],
    };

    const sanitized = sanitizeLogCopy(source) as Record<string, unknown>;

    expect(source.accessToken).toBe('secret-access-token');
    expect((source.payment as Record<string, unknown>).cardNumber).toBe('6037-9971-0000-1111');

    expect(sanitized.accessToken).toBe('[REDACTED]');
    expect(sanitized.refreshToken).toBe('[REDACTED]');
    expect(sanitized.user).toBe('ali');
    expect((sanitized.payment as Record<string, unknown>).cardNumber).toBe('[REDACTED]');
    expect((sanitized.payment as Record<string, unknown>).amount).toBe(50000);
    expect(((sanitized.items as Array<Record<string, unknown>>)[0]).otp).toBe('[REDACTED]');
  });

  it('should safely handle circular references and maxDepth truncation without throwing', () => {
    const circular: Record<string, unknown> = { name: 'root' };
    circular.self = circular;

    const copy = sanitizeLogCopy(circular) as Record<string, unknown>;
    expect(copy.name).toBe('root');
    expect(copy.self).toBe('[CIRCULAR]');

    const deeplyNested = { a: { b: { c: { d: { e: 'too-deep' } } } } };
    const truncated = sanitizeLogCopy(deeplyNested, 3) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(truncated.a.b.c).toBe('[TRUNCATED]');

    const inPlaceCircular: Record<string, unknown> = { token: 'abc' };
    inPlaceCircular.self = inPlaceCircular;
    sanitizeLog(inPlaceCircular);
    expect(inPlaceCircular.token).toBe('[REDACTED]');
  });

  it('should allowlist safe request/response headers and omit authorization, cookie, and CSP', () => {
    const safeReq = pickSafeRequestHeaders({
      host: 'api.sayra-booking.ir',
      authorization: 'Bearer secret.jwt.token',
      cookie: 'session=abc',
      'user-agent': 'k6',
      'x-request-id': 'req-1',
    });

    expect(safeReq).toEqual({
      host: 'api.sayra-booking.ir',
      'user-agent': 'k6',
      'x-request-id': 'req-1',
    });
    expect(safeReq.authorization).toBeUndefined();
    expect(safeReq.cookie).toBeUndefined();

    const safeRes = pickSafeResponseHeaders({
      getHeader: (name: string) => {
        const map: Record<string, string> = {
          'content-type': 'application/json',
          'content-security-policy': "default-src 'self'",
          'set-cookie': 'sid=123',
          'cache-control': 'public, max-age=60',
        };
        return map[name];
      },
    });

    expect(safeRes).toEqual({
      'content-type': 'application/json',
      'cache-control': 'public, max-age=60',
    });
    expect(safeRes['content-security-policy']).toBeUndefined();
    expect(safeRes['set-cookie']).toBeUndefined();
  });
});
