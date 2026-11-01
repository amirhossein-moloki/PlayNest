/* eslint-disable @typescript-eslint/no-explicit-any */
export const SENSITIVE_PROPERTIES = [
  'passwordHash',
  'codeHash',
  'secret',
  'token',
];

/**
 * Strips sensitive fields such as passwordHash from all AdminJS views.
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
