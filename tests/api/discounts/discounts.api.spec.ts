/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { UserRole, DiscountTargetType, DiscountValueType, SessionActorType } from '@prisma/client';
import routes from '../../../src/routes';
import { discountsStation } from '../../../src/modules/discounts/discounts.station';
import { errorHandler } from '../../../src/common/errors/errorHandler';
import { responseMiddleware } from '../../../src/common/middleware/response';

jest.mock('../../../src/modules/discounts/discounts.station');
jest.mock('../../../src/common/middleware/auth', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    const roleHeader = req.headers['x-test-role'] as string;
    const role = roleHeader ? (roleHeader as UserRole) : UserRole.MANAGER;
    (req as any).actor = {
      id: 'clx0000000000000000000001',
      actorType: SessionActorType.USER,
      role,
      gamingCenterId: req.params.gamingCenterId || 'clx0000000000000000000000',
    };
    next();
  },
}));

jest.mock('../../../src/common/middleware/tenantGuard', () => ({
  tenantGuard: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).tenant = { gamingCenterId: req.params.gamingCenterId || 'clx0000000000000000000000' };
    next();
  },
}));

const MockedDiscountsStation = discountsStation as jest.Mocked<typeof discountsStation>;

const app = express();
app.use(express.json());
app.use(responseMiddleware);
app.use('/api/v1', routes);
app.use(errorHandler);

describe('Discounts API Integration Tests', () => {
  const gamingCenterId = 'clx0000000000000000000000';
  const discountId = 'clx0000000000000000000002';

  const sampleDiscount = {
    id: discountId,
    gamingCenterId,
    targetType: DiscountTargetType.GAMING_CENTER,
    targetId: gamingCenterId,
    valueType: DiscountValueType.PERCENTAGE,
    value: 20,
    startAt: '2026-01-01T00:00:00.000Z',
    endAt: '2026-12-31T23:59:59.000Z',
    isActive: true,
    createdByUserId: 'clx0000000000000000000001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authorization checks', () => {
    it('should reject non-authorized role (STAFF) from managing discounts', async () => {
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/discounts`)
        .set('x-test-role', 'STAFF')
        .send({
          targetType: DiscountTargetType.GAMING_CENTER,
          targetId: gamingCenterId,
          valueType: DiscountValueType.PERCENTAGE,
          value: 20,
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /gamingCenters/:gamingCenterId/discounts', () => {
    it('should create discount successfully for MANAGER role', async () => {
      MockedDiscountsStation.createDiscount.mockResolvedValue(sampleDiscount as any);

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/discounts`)
        .set('x-test-role', 'MANAGER')
        .send({
          targetType: DiscountTargetType.GAMING_CENTER,
          targetId: gamingCenterId,
          valueType: DiscountValueType.PERCENTAGE,
          value: 20,
          startAt: '2026-01-01T00:00:00.000Z',
          endAt: '2026-12-31T23:59:59.000Z',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(discountId);
    });

    it('should reject invalid percentage (> 100)', async () => {
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/discounts`)
        .set('x-test-role', 'MANAGER')
        .send({
          targetType: DiscountTargetType.GAMING_CENTER,
          targetId: gamingCenterId,
          valueType: DiscountValueType.PERCENTAGE,
          value: 150,
          startAt: '2026-01-01T00:00:00.000Z',
          endAt: '2026-12-31T23:59:59.000Z',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /gamingCenters/:gamingCenterId/discounts', () => {
    it('should list discounts with pagination', async () => {
      MockedDiscountsStation.listDiscounts.mockResolvedValue({
        data: [sampleDiscount as any],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });

      const res = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenterId}/discounts`)
        .set('x-test-role', 'MANAGER');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /gamingCenters/:gamingCenterId/discounts/:id', () => {
    it('should get discount by ID', async () => {
      MockedDiscountsStation.getDiscountById.mockResolvedValue(sampleDiscount as any);

      const res = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenterId}/discounts/${discountId}`)
        .set('x-test-role', 'MANAGER');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(discountId);
    });
  });

  describe('PATCH /gamingCenters/:gamingCenterId/discounts/:id/status', () => {
    it('should update discount active status', async () => {
      const updated = { ...sampleDiscount, isActive: false };
      MockedDiscountsStation.updateDiscountStatus.mockResolvedValue(updated as any);

      const res = await request(app)
        .patch(`/api/v1/gamingCenters/${gamingCenterId}/discounts/${discountId}/status`)
        .set('x-test-role', 'MANAGER')
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });
  });

  describe('DELETE /gamingCenters/:gamingCenterId/discounts/:id', () => {
    it('should delete discount', async () => {
      MockedDiscountsStation.deleteDiscount.mockResolvedValue(sampleDiscount as any);

      const res = await request(app)
        .delete(`/api/v1/gamingCenters/${gamingCenterId}/discounts/${discountId}`)
        .set('x-test-role', 'MANAGER');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(discountId);
    });
  });
});
