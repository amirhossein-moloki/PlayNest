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
    const actorTypeHeader = req.headers['x-test-actor-type'] as SessionActorType | undefined;
    const role = roleHeader ? (roleHeader as UserRole) : UserRole.MANAGER;
    const actorType = actorTypeHeader || SessionActorType.USER;
    (req as any).actor = {
      id: actorType === SessionActorType.PLATFORM_ADMIN ? 'pa_admin_1' : 'clx0000000000000000000001',
      actorType,
      role,
      ...(actorType === SessionActorType.PLATFORM_ADMIN ? { isSuperuser: true } : {}),
      gamingCenterId: req.params.gamingCenterId || 'clx0000000000000000000000',
    };
    next();
  },
  optionalAuth: (_req: Request, _res: Response, next: NextFunction) => {
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

  describe('POST /gamingCenters/:gamingCenterId/discounts/campaigns', () => {
    it('should pass createdByUserId=null when actor is PLATFORM_ADMIN', async () => {
      MockedDiscountsStation.createCampaign.mockResolvedValue({
        id: 'camp-1',
        gamingCenterId,
        name: 'Admin Promo',
        code: 'ADMIN10',
        createdByUserId: null,
      } as any);

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/discounts/campaigns`)
        .set('x-test-actor-type', SessionActorType.PLATFORM_ADMIN)
        .send({
          name: 'Admin Promo',
          code: 'ADMIN10',
          valueType: DiscountValueType.PERCENTAGE,
          value: 10,
          startAt: '2026-01-01T00:00:00.000Z',
          endAt: '2026-12-31T23:59:59.000Z',
        });

      expect(res.status).toBe(201);
      expect(MockedDiscountsStation.createCampaign).toHaveBeenCalledWith(
        gamingCenterId,
        null,
        expect.objectContaining({ code: 'ADMIN10' }),
        expect.objectContaining({ id: 'pa_admin_1', actorType: SessionActorType.PLATFORM_ADMIN }),
        expect.anything()
      );
    });
  });

  describe('Snapp-style Customer Discovery & Reservation Endpoints', () => {
    const stationId = 'clx0000000000000000000003';

    it('POST /available - should return available discounts and best recommendation', async () => {
      const mockResult = {
        basePrice: 100000,
        recommendedDiscountId: 'camp-best',
        recommendedDiscountType: 'CAMPAIGN',
        discounts: [
          {
            id: 'camp-best',
            type: 'CAMPAIGN',
            title: 'یلدا',
            code: 'YALDA',
            discountAmount: 20000,
            finalPrice: 80000,
            isApplicable: true,
            isBest: true,
            badge: 'بهترین تخفیف برای شما',
          },
        ],
      };
      MockedDiscountsStation.getAvailableDiscounts.mockResolvedValue(mockResult as any);

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/discounts/available`)
        .send({
          stationId,
          basePrice: 100000,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.recommendedDiscountId).toBe('camp-best');
      expect(res.body.data.discounts).toHaveLength(1);
    });

    it('GET /available - should accept query parameters for fetching available discounts', async () => {
      MockedDiscountsStation.getAvailableDiscounts.mockResolvedValue({
        basePrice: 100000,
        recommendedDiscountId: null,
        recommendedDiscountType: null,
        discounts: [],
      } as any);

      const res = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenterId}/discounts/available?stationId=${stationId}&basePrice=100000`);

      expect(res.status).toBe(200);
      expect(MockedDiscountsStation.getAvailableDiscounts).toHaveBeenCalled();
    });

    it('POST /calculate - should calculate discount selection and inform about better deals', async () => {
      const mockCalc = {
        isValid: true,
        originalAmount: 100000,
        discountAmount: 15000,
        customerPayableAmount: 85000,
        merchantPayoutAmount: 80000,
        platformCommission: 5000,
        appliedDiscount: { id: 'disc-1', title: 'تخفیف استیشن' },
        betterDiscountAvailable: true,
        betterDiscount: { id: 'camp-better', title: 'کمپین یلدا', discountAmount: 20000, savingsDifference: 5000 },
      };
      MockedDiscountsStation.calculateDiscountSelection.mockResolvedValue(mockCalc as any);

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/discounts/calculate`)
        .send({
          stationId,
          basePrice: 100000,
          selectedDiscountId: 'disc-1',
          selectedType: 'DIRECT_DISCOUNT',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.betterDiscountAvailable).toBe(true);
      expect(res.body.data.betterDiscount.savingsDifference).toBe(5000);
    });

    it('POST /reserve - should reserve discount with TTL', async () => {
      MockedDiscountsStation.reserveDiscount.mockResolvedValue({
        id: 'usage-1',
        status: 'RESERVED',
        discountAmount: 20000,
        expiresAt: new Date().toISOString(),
      } as any);

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/discounts/reserve`)
        .send({
          stationId,
          basePrice: 100000,
          customerAccountId: 'cust-1',
          code: 'YALDA',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('RESERVED');
    });

    it('POST /release - should release reserved discount', async () => {
      MockedDiscountsStation.releaseDiscount.mockResolvedValue({
        id: 'usage-1',
        status: 'RELEASED',
        releaseReason: 'Customer canceled',
      } as any);

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/discounts/release`)
        .send({
          usageId: 'usage-1',
          reason: 'Customer canceled',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });

    it('POST /redeem - should transition discount status to REDEEMED', async () => {
      MockedDiscountsStation.redeemDiscount.mockResolvedValue({
        id: 'usage-1',
        status: 'REDEEMED',
        reservationId: 'res-1',
      } as any);

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/discounts/redeem`)
        .send({
          usageId: 'usage-1',
          reservationId: 'res-1',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });
  });
});
