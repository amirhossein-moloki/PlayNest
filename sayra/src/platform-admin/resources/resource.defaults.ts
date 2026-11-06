/* eslint-disable @typescript-eslint/no-explicit-any */
export const SENSITIVE_PROPERTIES = [
  'passwordHash',
  'codeHash',
  'secret',
  'token',
  'refreshToken',
  'idempotencyKey',
  'deduplicationKey',
  'storageKey',
  'apiKey',
  'otp',
  'secretKey',
];

/**
 * Strips sensitive fields such as passwordHash, tokens, secrets, and idempotency keys from all AdminJS views.
 */
export function buildSensitivePropertiesConfiguration(): Record<string, any> {
  const propertiesConfig: Record<string, any> = {};

  for (const prop of SENSITIVE_PROPERTIES) {
    propertiesConfig[prop] = {
      isVisible: {
        list: false,
        show: false,
        edit: false,
        filter: false,
      },
    };
  }

  return propertiesConfig;
}
