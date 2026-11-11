/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';
import { UserRole } from '@prisma/client';

jest.mock('../../../src/config/redis', () => ({
  get: jest.fn().mockImplementation(() => Promise.resolve(null)),
  set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
  del: jest.fn().mockImplementation(() => Promise.resolve(1)),
}));

jest.mock('../../../src/config/prisma', () => {
  return {
    prisma: {
      advertisementRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      gamingCenter: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      $extends: jest.fn().mockReturnThis(),
      $transaction: jest.fn((cb) => cb(prisma)),
    },
  };
});

describe('Owner Advertisement API (/api/v1/gamingCenters/:gamingCenterId/advertisements)', () => {
  const centerId = 'gc_owner_test_1';
  const ownerId = 'usr_owner_1';

  const generateOwnerToken = (uId = ownerId) => {
    return generateAccessToken({
      sessionId: 'sess_owner',
      actorId: uId,
      actorType: 'USER',
    });
  };

  const sampleAd = {
    id: 'ad_123',
    title: 'Spring Gaming Tournament',
    description: 'Join our local competition',
    bannerUrl: 'https://cdn.example.com/banner.png',
    destinationUrl: 'https://example.com/tournament',
    mediaType: 'IMAGE',
    proposedDurationDays: 14,
    durationDays: 14,
    priority: 0,
    startDate: null,
    endDate: null,
    status: 'PENDING',
    decisionReason: null,
    adminNote: null,
    gamingCenterId: centerId,
    ownerId,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    ((prisma as any).gamingCenter.findUnique as jest.Mock).mockResolvedValue({
      id: centerId,
      name: 'Alpha Gamenet',
      slug: 'alpha-gamenet',
      isActive: true,
    });
    ((prisma as any).gamingCenter.findFirst as jest.Mock).mockResolvedValue({
      id: centerId,
      name: 'Alpha Gamenet',
      slug: 'alpha-gamenet',
      isActive: true,
    });

    ((prisma as any).user.findUnique as jest.Mock).mockImplementation((args: any) => {
      const id = args?.where?.id;
      if (id === 'usr_other_999') {
        return Promise.resolve({
          id: 'usr_other_999',
          fullName: 'Other Owner',
          role: UserRole.MANAGER,
          gamingCenterId: 'gc_other_999',
          isActive: true,
        });
      }
      return Promise.resolve({
        id: ownerId,
        fullName: 'Gamenet Owner',
        role: UserRole.MANAGER,
        gamingCenterId: centerId,
        isActive: true,
      });
    });
  });

  describe('POST /', () => {
    it('creates an ad request in PENDING status for the gaming center owner', async () => {
      ((prisma as any).advertisementRequest.create as jest.Mock).mockResolvedValue(sampleAd);

      const token = generateOwnerToken();
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${centerId}/advertisements`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Spring Gaming Tournament',
          description: 'Join our local competition',
          bannerUrl: 'https://cdn.example.com/banner.png',
          destinationUrl: 'https://example.com/tournament',
          proposedDurationDays: 14,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe('ad_123');
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.proposedDurationDays).toBe(14);
      expect((prisma as any).advertisementRequest.create).toHaveBeenCalled();
    });

    it('rejects creation if title is too short or URL is invalid', async () => {
      const token = generateOwnerToken();
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${centerId}/advertisements`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Hi',
          bannerUrl: 'https://cdn.example.com/banner.png',
        });

      expect(res.status).toBe(400);
      expect((prisma as any).advertisementRequest.create).not.toHaveBeenCalled();
    });

    it('prevents cross-tenant creation by users of a different gaming center', async () => {
      const tokenDifferentCenter = generateOwnerToken('usr_other_999');
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${centerId}/advertisements`)
        .set('Authorization', `Bearer ${tokenDifferentCenter}`)
        .send({
          title: 'Valid Ad Title',
          bannerUrl: 'https://cdn.example.com/banner.png',
        });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /', () => {
    it('lists advertisements for the owner gaming center', async () => {
      ((prisma as any).advertisementRequest.findMany as jest.Mock).mockResolvedValue([sampleAd]);
      ((prisma as any).advertisementRequest.count as jest.Mock).mockResolvedValue(1);

      const token = generateOwnerToken();
      const res = await request(app)
        .get(`/api/v1/gamingCenters/${centerId}/advertisements`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe(sampleAd.title);
    });
  });

  describe('GET /:id', () => {
    it('retrieves single advertisement details', async () => {
      ((prisma as any).advertisementRequest.findFirst as jest.Mock).mockResolvedValue(sampleAd);

      const token = generateOwnerToken();
      const res = await request(app)
        .get(`/api/v1/gamingCenters/${centerId}/advertisements/${sampleAd.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(sampleAd.id);
    });
  });

  describe('PATCH /:id', () => {
    it('allows editing an ad when status is PENDING', async () => {
      ((prisma as any).advertisementRequest.findFirst as jest.Mock).mockResolvedValue(sampleAd);
      ((prisma as any).advertisementRequest.update as jest.Mock).mockResolvedValue({
        ...sampleAd,
        title: 'Updated Ad Title',
      });

      const token = generateOwnerToken();
      const res = await request(app)
        .patch(`/api/v1/gamingCenters/${centerId}/advertisements/${sampleAd.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Updated Ad Title',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Ad Title');
    });

    it('rejects editing if ad is already APPROVED', async () => {
      ((prisma as any).advertisementRequest.findFirst as jest.Mock).mockResolvedValue({
        ...sampleAd,
        status: 'APPROVED',
      });

      const token = generateOwnerToken();
      const res = await request(app)
        .patch(`/api/v1/gamingCenters/${centerId}/advertisements/${sampleAd.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Updated Ad Title',
        });

      expect(res.status).toBe(400);
      expect((prisma as any).advertisementRequest.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /:id', () => {
    it('soft deletes the advertisement request', async () => {
      ((prisma as any).advertisementRequest.findFirst as jest.Mock).mockResolvedValue(sampleAd);
      ((prisma as any).advertisementRequest.update as jest.Mock).mockResolvedValue({
        ...sampleAd,
        status: 'DELETED',
        deletedAt: new Date(),
      });

      const token = generateOwnerToken();
      const res = await request(app)
        .delete(`/api/v1/gamingCenters/${centerId}/advertisements/${sampleAd.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
      expect((prisma as any).advertisementRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sampleAd.id },
          data: expect.objectContaining({
            status: 'DELETED',
          }),
        })
      );
    });
  });
});
