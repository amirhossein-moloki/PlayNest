const DEFAULT_SESSION_SECRET = 'playnest-platform-admin-panel-secret-session-key-32';
const DEFAULT_COOKIE_SECRET = 'playnest-cookie-secret-key-at-least-32-characters-long';

export function validateAdminSecrets(envSource: NodeJS.ProcessEnv = process.env): {
  sessionSecret: string;
  cookieSecret: string;
} {
  const isProduction = envSource.NODE_ENV === 'production';
  const sessionSecret = envSource.ADMIN_SESSION_SECRET || (isProduction ? '' : DEFAULT_SESSION_SECRET);
  const cookieSecret = envSource.ADMIN_COOKIE_SECRET || (isProduction ? '' : DEFAULT_COOKIE_SECRET);

  if (isProduction) {
    if (!sessionSecret || sessionSecret.length < 32 || sessionSecret === DEFAULT_SESSION_SECRET) {
      throw new Error(
        'FATAL: ADMIN_SESSION_SECRET must be set to a non-default secret (>=32 chars) in production.'
      );
    }
    if (!cookieSecret || cookieSecret.length < 32 || cookieSecret === DEFAULT_COOKIE_SECRET) {
      throw new Error(
        'FATAL: ADMIN_COOKIE_SECRET must be set to a non-default secret (>=32 chars) in production.'
      );
    }
  }

  return { sessionSecret, cookieSecret };
}

const resolvedSecrets = validateAdminSecrets(process.env);

export const ADMIN_CONSTANTS = {
  ROOT_PATH: '/platform-admin-panel',
  SESSION_COOKIE_NAME: 'playnest_admin_session',
  SESSION_PREFIX: 'admin_sess:',
  SESSION_SECRET: resolvedSecrets.sessionSecret,
  COOKIE_SECRET: resolvedSecrets.cookieSecret,
  SESSION_MAX_AGE_MS: 8 * 60 * 60 * 1000, // 8 hours
  DEFAULT_PAGE_SIZE: 20,
};
