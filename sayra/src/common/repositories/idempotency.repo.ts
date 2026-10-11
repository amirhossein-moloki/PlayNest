import { IdempotencyStatus } from '../../types/idempotency';
import redis from '../../config/redis';
import { differenceInSeconds } from 'date-fns';

const KEY_PREFIX = 'idempotency';

export interface IdempotencyRecord {
  id: string;
  key: string;
  scope: string;
  requestHash: string;
  status: IdempotencyStatus;
  responseBody: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  responseStatusCode: number | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const getRedisKey = (scope: string, key: string) => `${KEY_PREFIX}:${scope}:${key}`;

export const IdempotencyRepo = {
  async findKey(scope: string, key: string): Promise<IdempotencyRecord | null> {
    const redisKey = getRedisKey(scope, key);
    const data = await redis.get(redisKey);
    if (!data) return null;

    const record = JSON.parse(data);
    return {
      ...record,
      expiresAt: new Date(record.expiresAt),
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };
  },

  async createKey(data: {
    key: string;
    scope: string;
    requestHash: string;
    status: IdempotencyStatus;
    expiresAt: Date;
  }) {
    const redisKey = getRedisKey(data.scope, data.key);
    const now = new Date();
    const record: IdempotencyRecord = {
      id: `${data.scope}:${data.key}`, // Redis doesn't need cuid, but keeping it for compatibility
      ...data,
      responseBody: null,
      responseStatusCode: null,
      createdAt: now,
      updatedAt: now,
    };

    const ttlSeconds = differenceInSeconds(data.expiresAt, now);

    // Use SET with NX to ensure atomicity (preventing race conditions)
    const result = await redis.set(
      redisKey,
      JSON.stringify(record),
      'EX',
      Math.max(ttlSeconds, 1),
      'NX'
    );

    if (!result) {
      // Redis SET NX returns null if key already exists, mimicking Prisma unique constraint error
      const error = new Error('Unique constraint failed on the fields: (`scope`,`key`)');
      (error as any).code = 'P2002'; // eslint-disable-line @typescript-eslint/no-explicit-any
      throw error;
    }

    return record;
  },

  async updateKey(scope: string, key: string, data: Partial<IdempotencyRecord>) {
    const redisKey = getRedisKey(scope, key);
    const existing = await this.findKey(scope, key);
    if (!existing) {
      throw new Error('Record not found');
    }

    const updatedRecord: IdempotencyRecord = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };

    const ttlSeconds = differenceInSeconds(updatedRecord.expiresAt, new Date());

    await redis.set(
      redisKey,
      JSON.stringify(updatedRecord),
      'EX',
      Math.max(ttlSeconds, 1)
    );

    return updatedRecord;
  },

  async deleteKey(idOrScope: string, key?: string) {
    let redisKey: string;
    if (key) {
      redisKey = getRedisKey(idOrScope, key);
    } else {
      // If only one arg, it's the full redisKey or the id we generated
      redisKey = `${KEY_PREFIX}:${idOrScope}`;
    }
    return redis.del(redisKey);
  },

  async clearAll() {
    const keys = await redis.keys(`${KEY_PREFIX}:*`);
    if (keys.length > 0) {
      return redis.del(...keys);
    }
  }
};
