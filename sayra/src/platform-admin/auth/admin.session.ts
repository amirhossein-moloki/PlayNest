import session from 'express-session';
import { RedisStore } from 'connect-redis';
import redis from '../../config/redis';
import { env } from '../../config/env';
import { ADMIN_CONSTANTS } from '../config/admin.constants';

const redisStoreClient = {
  get: (key: string) => redis.get(key),

  set: (
    key: string,
    value: string,
    options?: { expiration?: { type: string; value: number } }
  ) => {
    if (options?.expiration?.type === 'EX') {
      return redis.set(key, value, 'EX', options.expiration.value);
    }
    return redis.set(key, value);
  },

  expire: (key: string, seconds: number) =>
    redis.expire(key, seconds),

  del: (keys: string | string[]) =>
    redis.del(...(Array.isArray(keys) ? keys : [keys])),

  mGet: (keys: string[]) =>
    redis.mget(...keys),

  async *scanIterator(options: { MATCH: string; COUNT: number }) {
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        options.MATCH,
        'COUNT',
        options.COUNT
      );

      cursor = nextCursor;

      if (keys.length > 0) {
        yield keys;
      }
    } while (cursor !== '0');
  },
};

export function createAdminSessionOptions(): session.SessionOptions {
  const isProd = env.NODE_ENV === 'production';

  const redisStore = new RedisStore({
    client: redisStoreClient,
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
