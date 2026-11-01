export const ADMIN_CONSTANTS = {
  ROOT_PATH: '/platform-admin-panel',
  SESSION_COOKIE_NAME: 'playnest_admin_session',
  SESSION_PREFIX: 'admin_sess:',
  SESSION_SECRET: process.env.ADMIN_SESSION_SECRET || 'playnest-platform-admin-panel-secret-session-key-32',
  COOKIE_SECRET: process.env.ADMIN_COOKIE_SECRET || 'playnest-cookie-secret-key-at-least-32-characters-long',
  SESSION_MAX_AGE_MS: 8 * 60 * 60 * 1000, // 8 hours
  DEFAULT_PAGE_SIZE: 20,
};
