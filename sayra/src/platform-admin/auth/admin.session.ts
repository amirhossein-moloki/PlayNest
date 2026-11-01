import session from 'express-session';
import { RedisStore } from 'connect-redis';
import redis from '../../config/redis';
import { env } from '../../config/env';
import { ADMIN_CONSTANTS } from '../config/admin.constants';

export function createAdminSessionOptions(): session.SessionOptions {
  const isProd = env.NODE_ENV === 'production';

  const redisStore = new RedisStore({
    client: redis,
    prefix: ADMIN_CONSTANTS.SESSION_PREFIX,
  });

  return {
    name: ADMIN_CONSTANTS.SESSION_COOKIE_NAME,
    secret: ADMIN_CONSTANTS.SESSION_SECRET,
    store: redisStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: ADMIN_CONSTANTS.SESSION_MAX_AGE_MS,
      path: ADMIN_CONSTANTS.ROOT_PATH,
    },
  };
}
