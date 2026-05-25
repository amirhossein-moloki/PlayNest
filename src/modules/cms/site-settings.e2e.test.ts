import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
  PrismaClient,
  RobotsFollow,
  RobotsIndex,
  UserRole,
} from '@prisma/client';
import app from '../../app';
import { env } from '../../config/env';

const prisma = new PrismaClient();

describe('CMS Site Settings API E2E Tests', () => {
  let testSalonId: string;
  let managerToken: string;
  let staffToken: string;

  beforeAll(async () => {
    await prisma.siteSettings.deleteMany();
    await prisma.user.deleteMany();
    await prisma.gamingCenter.deleteMany();

    const gamingCenter = await prisma.gamingCenter.create({
      data: {
        name: 'CMS Site Settings GamingCenter',
        slug: `cms-site-settings-gamingCenter-${Date.now()}`,
      },
    });

    testSalonId = gamingCenter.id;

    const manager = await prisma.user.create({
      data: {
        fullName: 'CMS Settings Manager',
        phone: `+98912133333${Date.now()}`.slice(0, 14),
        role: UserRole.MANAGER,
        gamingCenterId: testSalonId,
      },
    });

    const staff = await prisma.user.create({
      data: {
        fullName: 'CMS Settings Staff',
        phone: `+98912133334${Date.now()}`.slice(0, 14),
        role: UserRole.STAFF,
        gamingCenterId: testSalonId,
      },
    });

    managerToken = jwt.sign(
      { actorId: manager.id, actorType: 'USER', gamingCenterId: testSalonId, role: manager.role },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    staffToken = jwt.sign(
      { actorId: staff.id, actorType: 'USER', gamingCenterId: testSalonId, role: staff.role },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await prisma.siteSettings.deleteMany();
    await prisma.user.deleteMany();
    await prisma.gamingCenter.deleteMany();
    await prisma.$disconnect();
  });

  describe('Authorization', () => {
    it('should reject requests without a token', async () => {
      const response = await request(app)
        .get(`/api/v1/gamingCenters/${testSalonId}/site-settings`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization header is missing or invalid',
        },
      });
    });

    it('should reject non-manager roles', async () => {
      const response = await request(app)
        .get(`/api/v1/gamingCenters/${testSalonId}/site-settings`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Forbidden: You do not have the required permissions.',
        },
      });
    });
  });

  describe('GET /api/v1/gamingCenters/:gamingCenterId/site-settings', () => {
    it('should return null when no settings exist', async () => {
      const response = await request(app)
        .get(`/api/v1/gamingCenters/${testSalonId}/site-settings`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
    });
  });

  describe('PUT /api/v1/gamingCenters/:gamingCenterId/site-settings', () => {
    it('should create settings for the gamingCenter', async () => {
      const response = await request(app)
        .put(`/api/v1/gamingCenters/${testSalonId}/site-settings`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          logoUrl: 'https://example.com/logo.png',
          defaultSeoTitle: 'GamingCenter Title',
          defaultSeoDescription: 'GamingCenter description',
          robotsIndex: RobotsIndex.NOINDEX,
          robotsFollow: RobotsFollow.NOFOLLOW,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.logoUrl).toBe('https://example.com/logo.png');
      expect(response.body.data.robotsIndex).toBe(RobotsIndex.NOINDEX);
      expect(response.body.data.robotsFollow).toBe(RobotsFollow.NOFOLLOW);
    });

    it('should update settings without creating duplicates', async () => {
      const response = await request(app)
        .put(`/api/v1/gamingCenters/${testSalonId}/site-settings`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          logoUrl: 'https://example.com/logo-updated.png',
          faviconUrl: 'https://example.com/favicon.ico',
          robotsIndex: RobotsIndex.INDEX,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.logoUrl).toBe(
        'https://example.com/logo-updated.png'
      );
      expect(response.body.data.faviconUrl).toBe(
        'https://example.com/favicon.ico'
      );
      expect(response.body.data.robotsIndex).toBe(RobotsIndex.INDEX);

      const count = await prisma.siteSettings.count({
        where: { gamingCenterId: testSalonId },
      });
      expect(count).toBe(1);
    });
  });
});
