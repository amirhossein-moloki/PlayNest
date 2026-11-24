import crypto from 'crypto';

/**
 * Computes an HMAC-SHA256 signature over `${timestampSec}.${rawBody}`.
 */
export function signWebhookPayload(
  secret: string,
  timestampSec: number,
  rawBody: string
): string {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${timestampSec}.${rawBody}`, 'utf8')
    .digest('hex');
  return `sha256=${digest}`;
}

/**
 * Timing-safe verification of an incoming/test HMAC-SHA256 webhook signature.
 */
export function verifyWebhookSignature(
  secret: string,
  timestampSec: number,
  rawBody: string,
  signature: string,
  maxSkewSec = 300,
  nowSec = Math.floor(Date.now() / 1000)
): boolean {
  if (!secret || !signature || !Number.isFinite(timestampSec)) {
    return false;
  }

  if (Math.abs(nowSec - timestampSec) > maxSkewSec) {
    return false;
  }

  const expected = signWebhookPayload(secret, timestampSec, rawBody);
  const actualBuf = Buffer.from(signature.trim(), 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}
