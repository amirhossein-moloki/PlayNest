import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';
import { LinkType } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    address: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    socialLink: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe('CMS Addresses & Links API', () => {
  const gamingCenterId = 'gc-1';
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

  describe('POST /api/v1/gamingCenters/:gamingCenterId/addresses', () => {
    it('should create address with valid payload (HTTP 201)', async () => {
      const mockCreatedAddress = {
        id: 'addr-1',
        gamingCenterId,
        city: 'رشت',
        addressLine: 'آدرس واردشده توسط کاربر',
        province: 'گیلان',
        lat: 37.2809,
        lng: 49.5924,
      };

      ((prisma as any).address.create as jest.Mock).mockResolvedValue(mockCreatedAddress);

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/addresses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          city: 'رشت',
          addressLine: 'آدرس واردشده توسط کاربر',
          province: 'گیلان',
          lat: 37.2809,
          lng: 49.5924,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(mockCreatedAddress);
      expect((prisma as any).address.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          city: 'رشت',
          addressLine: 'آدرس واردشده توسط کاربر',
          province: 'گیلان',
          lat: 37.2809,
          lng: 49.5924,
          gamingCenterId,
        }),
      });
    });

    it('should return 400 when missing city', async () => {
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/addresses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          addressLine: 'خیابان آزادی',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 400 when missing addressLine', async () => {
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/addresses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          city: 'تهران',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 400 on invalid data types', async () => {
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/addresses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          city: 123,
          addressLine: 'آدرس',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/gamingCenters/:gamingCenterId/addresses/:addressId', () => {
    it('should update address with partial payload (HTTP 200)', async () => {
      const addressId = 'addr-1';
      ((prisma as any).address.findUnique as jest.Mock).mockResolvedValue({
        id: addressId,
        gamingCenterId,
        city: 'رشت',
        addressLine: 'آدرس قدیمی',
      });
      ((prisma as any).address.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const res = await request(app)
        .patch(`/api/v1/gamingCenters/${gamingCenterId}/addresses/${addressId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          city: 'بندرانزلی',
        });

      expect(res.status).toBe(200);
      expect((prisma as any).address.updateMany).toHaveBeenCalledWith({
        where: { id: addressId, gamingCenterId },
        data: { city: 'بندرانزلی' },
      });
    });

    it('should reject invalid field types in PATCH', async () => {
      const addressId = 'addr-1';
      const res = await request(app)
        .patch(`/api/v1/gamingCenters/${gamingCenterId}/addresses/${addressId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          lat: 'not-a-number',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/gamingCenters/:gamingCenterId/links', () => {
    it('should create link with valid payload (HTTP 201)', async () => {
      const mockCreatedLink = {
        id: 'link-1',
        gamingCenterId,
        type: LinkType.INSTAGRAM,
        value: 'https://instagram.com/mycenter',
      };

      ((prisma as any).socialLink.create as jest.Mock).mockResolvedValue(mockCreatedLink);

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/links`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: LinkType.INSTAGRAM,
          value: 'https://instagram.com/mycenter',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual(mockCreatedLink);
    });

    it('should reject invalid link type enum', async () => {
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/links`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'INVALID_ENUM',
          value: 'https://example.com',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/gamingCenters/:gamingCenterId/links/:linkId', () => {
    it('should update link with partial payload (HTTP 200)', async () => {
      const linkId = 'link-1';
      ((prisma as any).socialLink.findUnique as jest.Mock).mockResolvedValue({
        id: linkId,
        gamingCenterId,
        type: LinkType.INSTAGRAM,
        value: 'https://instagram.com/old',
      });
      ((prisma as any).socialLink.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const res = await request(app)
        .patch(`/api/v1/gamingCenters/${gamingCenterId}/links/${linkId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          value: 'https://instagram.com/new',
        });

      expect(res.status).toBe(200);
    });
  });
});
