import { Request, Response } from 'express';
import { authMiddleware, getActorCacheKey, invalidateActorCache } from '../../../../src/common/middleware/auth';
import redis from '../../../../src/config/redis';
import { prisma } from '../../../../src/config/prisma';
import { generateAccessToken } from '../../../../src/modules/auth/auth.tokens';
import { UserRole } from '@prisma/client';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    customerAccount: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../../../src/config/redis', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

describe('authMiddleware Redis Caching (FIND-05)', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      headers: {},
    };
    res = {};
    next = jest.fn();
  });

  it('should return 401 if authorization header is missing', async () => {
    await authMiddleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Authorization header is missing or invalid', statusCode: 401 })
    );
  });

  it('should hit Redis cache when cached actor exists and account is active', async () => {
    const token = generateAccessToken({ actorId: 'user-123', actorType: 'USER', sessionId: 'sess-1' });
    req.headers = { authorization: `Bearer ${token}` };

    const cachedUser = {
      id: 'user-123',
      actorId: 'user-123',
      role: UserRole.STAFF,
      gamingCenterId: 'gc-1',
      actorType: 'USER',
      isActive: true,
    };

    (redis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedUser));

    await authMiddleware(req as Request, res as Response, next);

    expect(redis.get).toHaveBeenCalledWith(getActorCacheKey('user-123', 'USER'));
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(req.actor).toEqual({
      id: 'user-123',
      actorId: 'user-123',
      role: UserRole.STAFF,
      gamingCenterId: 'gc-1',
      actorType: 'USER',
      sessionId: 'sess-1',
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('should reject request when cached user is deactivated', async () => {
    const token = generateAccessToken({ actorId: 'user-123', actorType: 'USER', sessionId: 'sess-1' });
    req.headers = { authorization: `Bearer ${token}` };

    const cachedUser = {
      id: 'user-123',
      actorId: 'user-123',
      role: UserRole.STAFF,
      gamingCenterId: 'gc-1',
      actorType: 'USER',
      isActive: false,
    };

    (redis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedUser));

    await authMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'User account is deactivated', statusCode: 401 })
    );
  });

  it('should fetch from Prisma and populate Redis cache on cache miss', async () => {
    const token = generateAccessToken({ actorId: 'user-123', actorType: 'USER', sessionId: 'sess-1' });
    req.headers = { authorization: `Bearer ${token}` };

    (redis.get as jest.Mock).mockResolvedValueOnce(null);
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'user-123',
      role: UserRole.MANAGER,
      gamingCenterId: 'gc-1',
      isActive: true,
    });

    await authMiddleware(req as Request, res as Response, next);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-123' } });
    expect(redis.set).toHaveBeenCalledWith(
      getActorCacheKey('user-123', 'USER'),
      JSON.stringify({
        id: 'user-123',
        actorId: 'user-123',
        role: UserRole.MANAGER,
        gamingCenterId: 'gc-1',
        actorType: 'USER',
        isActive: true,
      }),
      'EX',
      60
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('should fallback to Prisma safely if Redis throws an error during read', async () => {
    const token = generateAccessToken({ actorId: 'cust-123', actorType: 'CUSTOMER', sessionId: 'sess-2' });
    req.headers = { authorization: `Bearer ${token}` };

    (redis.get as jest.Mock).mockRejectedValueOnce(new Error('Redis connection timeout'));
    (prisma.customerAccount.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'cust-123',
    });

    await authMiddleware(req as Request, res as Response, next);

    expect(prisma.customerAccount.findUnique).toHaveBeenCalledWith({ where: { id: 'cust-123' } });
    expect(next).toHaveBeenCalledWith();
  });

  it('should invalidate Redis actor cache key properly when invalidateActorCache is called', async () => {
    await invalidateActorCache('user-123', 'USER');
    expect(redis.del).toHaveBeenCalledWith(getActorCacheKey('user-123', 'USER'));
  });
});
