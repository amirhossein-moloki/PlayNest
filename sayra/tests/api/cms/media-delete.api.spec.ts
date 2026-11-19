import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    media: {
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    rating: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../../src/common/stations/upload.station', () => ({
  deleteStoredImage: jest.fn().mockResolvedValue(undefined),
}));

describe('CMS Media Deletion & Rating Reply API', () => {
  const gamingCenterId = 'cmwlxvn5r0014137pppik07te';
  const mediaId = 'cmwly4svx002b137pwem9snx1';
  let token: string;

  beforeEach(() => {
    jest.clearAllMocks();

    ((prisma as any).user.findUnique as jest.Mock).mockResolvedValue({
      id: 'usr-1',
      role: 'MANAGER',
      gamingCenterId,
      isActive: true,
      tokenVersion: 0,
    });

    token = generateAccessToken({
      sessionId: 'sess-1',
      actorId: 'usr-1',
      actorType: 'USER',
    });
  });

  describe('DELETE /api/v1/gamingCenters/:gamingCenterId/media/:mediaId', () => {
    it('should successfully delete media and return 204 No Content', async () => {
      ((prisma as any).media.findFirst as jest.Mock).mockResolvedValue({
        id: mediaId,
        gamingCenterId,
        url: '/uploads/test.jpg',
        thumbUrl: '/uploads/thumbnails/test.jpg',
      });
      ((prisma as any).media.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      const response = await request(app)
        .delete(`/api/v1/gamingCenters/${gamingCenterId}/media/${mediaId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(204);
      expect((prisma as any).media.deleteMany).toHaveBeenCalledWith({
        where: { id: mediaId, gamingCenterId },
      });
    });

    it('should return 404 if media is not found', async () => {
      ((prisma as any).media.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/v1/gamingCenters/${gamingCenterId}/media/${mediaId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Rating Reply APIs', () => {
    const ratingId = 'rating-1';

    it('POST /api/v1/gamingCenters/:gamingCenterId/ratings/:id/reply should add a reply', async () => {
      ((prisma as any).rating.findFirst as jest.Mock).mockResolvedValue({
        id: ratingId,
        gamingCenterId,
      });
      ((prisma as any).rating.update as jest.Mock).mockResolvedValue({
        id: ratingId,
        gamingCenterId,
        replyComment: 'Thank you for your review!',
      });

      const response = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/ratings/${ratingId}/reply`)
        .set('Authorization', `Bearer ${token}`)
        .send({ replyComment: 'Thank you for your review!' });

      expect(response.status).toBe(200);
      expect(response.body.data.replyComment).toBe('Thank you for your review!');
    });

    it('DELETE /api/v1/gamingCenters/:gamingCenterId/ratings/:id/reply should remove reply', async () => {
      ((prisma as any).rating.findFirst as jest.Mock).mockResolvedValue({
        id: ratingId,
        gamingCenterId,
      });
      ((prisma as any).rating.update as jest.Mock).mockResolvedValue({
        id: ratingId,
        gamingCenterId,
        replyComment: null,
      });

      const response = await request(app)
        .delete(`/api/v1/gamingCenters/${gamingCenterId}/ratings/${ratingId}/reply`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(204);
    });
  });
});
