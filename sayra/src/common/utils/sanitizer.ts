// A (very) simple list of sensitive keys to redact from logs.
const SENSITIVE_KEYS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'idempotency-key',
  'phone',
  'email',
  // Card-related fields
  'card',
  'cardNumber',
  'cvc',
  'cvv',
  'exp_month',
  'exp_year',
];

// A more complex list for partial redaction can be added later.

/**
 * Deeply sanitizes an object by redacting values of sensitive keys.
 * This function mutates the object in place for performance.
 *
 * @param obj - The object to sanitize.
 */
export const sanitizeLog = (obj: any): any => { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.includes(lowerKey)) {
        obj[key] = '[REDACTED]';
      } else {
        // Recurse into nested objects
        sanitizeLog(obj[key]);
      }
    }
  }
  return obj;
};
