/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import {
  DiscountFundingSource,
  DiscountTargetType,
  DiscountUsageStatus,
  DiscountValueType,
  SessionActorType,
  UserRole,
} from '@prisma/client';
import { discountsRoutes } from '../../src/modules/discounts/discounts.routes';
import { discountsStation } from '../../src/modules/discounts/discounts.station';
import { DiscountsRepo } from '../../src/modules/discounts/discounts.repo';
import { ReservationRepo } from '../../src/modules/reservation/reservation.repo';
import { reservationStation } from '../../src/modules/reservation/reservation.station';
import * as commissionCalculator from '../../src/modules/commissions/commission-calculator';
import { auditService } from '../../src/modules/audit/audit.station';
import { responseMiddleware } from '../../src/common/middleware/response';
import { errorHandler } from '../../src/common/errors/errorHandler';
import { reserveDiscountSchema, createCampaignSchema } from '../../src/modules/discounts/discounts.dto';

jest.mock('../../src/common/middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      const err: any = new Error('Authorization header required');
      err.statusCode = 401;
      err.isOperational = true;
      return next(err);
    }
    if (authHeader === 'Bearer customer-1') {
      req.actor = { id: 'cust-1', actorType: SessionActorType.CUSTOMER };
    } else if (authHeader === 'Bearer customer-2') {
      req.actor = { id: 'cust-2', actorType: SessionActorType.CUSTOMER };
    } else if (authHeader === 'Bearer manager-gc1') {
      req.actor = {
        id: 'user-1',
        actorType: SessionActorType.USER,
        role: UserRole.MANAGER,
        gamingCenterId: 'clx0000000000000000000001',
      };
    } else if (authHeader === 'Bearer manager-gc2') {
      req.actor = {
        id: 'user-2',
        actorType: SessionActorType.USER,
        role: UserRole.MANAGER,
        gamingCenterId: 'clx0000000000000000000002',
      };
    }
    return next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../src/common/middleware/tenantGuard', () => ({
  tenantGuard: (_req: any, _res: any, next: any) => next(),
}));

describe('SEC-007 & SEC-008: Discount Lifecycle Authorization & Tenant Campaign Isolation', () => {
  const gc1 = 'clx0000000000000000000001';
  const gc2 = 'clx0000000000000000000002';

  const app = express();
  app.use(express.json());
  app.use(responseMiddleware);
  app.use('/api/v1/gamingCenters/:gamingCenterId/discounts', discountsRoutes);
  app.use(errorHandler);

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(auditService, 'log').mockResolvedValue(undefined as any);
  });

  describe('SEC-007: Unauthenticated & Cross-Owner Discount Lifecycle Blocking', () => {
    it('rejects unauthenticated requests to /reserve, /release, and /redeem with 401', async () => {
      const reserveRes = await request(app)
        .post(`/api/v1/gamingCenters/${gc1}/discounts/reserve`)
        .send({ stationId: 'st-1', basePrice: 100000 });
      expect(reserveRes.status).toBe(401);

      const releaseRes = await request(app)
        .post(`/api/v1/gamingCenters/${gc1}/discounts/release`)
        .send({ usageId: 'usage-1' });
      expect(releaseRes.status).toBe(401);

      const redeemRes = await request(app)
        .post(`/api/v1/gamingCenters/${gc1}/discounts/redeem`)
        .send({ reservationId: 'res-1' });
      expect(redeemRes.status).toBe(401);
    });

    it('rejects ttlMinutes > 30 in reserveDiscountSchema', async () => {
      const parsedBad = await reserveDiscountSchema.safeParseAsync({
        params: { gamingCenterId: gc1 },
        body: {
          stationId: 'st-1',
          basePrice: 100000,
          ttlMinutes: 1440,
        },
      });
      expect(parsedBad.success).toBe(false);

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gc1}/discounts/reserve`)
        .set('Authorization', 'Bearer customer-1')
        .send({
          stationId: 'st-1',
          basePrice: 100000,
          ttlMinutes: 60,
        });
      expect(res.status).toBe(400);
    });

    it('rejects customer trying to reserve or release another customer discount usage', async () => {
      await expect(
        discountsStation.reserveDiscount(
          gc1,
          { stationId: 'st-1', basePrice: 100000, customerAccountId: 'cust-victim' },
          { id: 'cust-1', actorType: SessionActorType.CUSTOMER } as any
        )
      ).rejects.toMatchObject({ statusCode: 403 });

      jest.spyOn(DiscountsRepo, 'transaction').mockImplementation(async (fn: any) => fn({}));
      jest.spyOn(DiscountsRepo, 'findUsageById').mockResolvedValue({
        id: 'usage-victim',
        customerAccountId: 'cust-victim',
        status: DiscountUsageStatus.RESERVED,
        discountAmount: 10000,
        reservation: { id: 'res-v', gamingCenterId: gc1, customerAccountId: 'cust-victim' },
      } as any);

      const releaseRes = await request(app)
        .post(`/api/v1/gamingCenters/${gc1}/discounts/release`)
        .set('Authorization', 'Bearer customer-1')
        .send({ usageId: 'usage-victim' });
      expect(releaseRes.status).toBe(403);
    });

    it('forbids releasing REDEEMED discount usage via HTTP POST /release (while internal cancellation still releases)', async () => {
      jest.spyOn(DiscountsRepo, 'transaction').mockImplementation(async (fn: any) => fn({}));
      jest.spyOn(DiscountsRepo, 'findUsageById').mockResolvedValue({
        id: 'usage-redeemed-1',
        customerAccountId: 'cust-1',
        campaignId: 'camp-1',
        status: DiscountUsageStatus.REDEEMED,
        discountAmount: 20000,
        reservation: { id: 'res-1', gamingCenterId: gc1, customerAccountId: 'cust-1' },
      } as any);

      const httpRes = await request(app)
        .post(`/api/v1/gamingCenters/${gc1}/discounts/release`)
        .set('Authorization', 'Bearer customer-1')
        .send({ usageId: 'usage-redeemed-1', reason: 'Retry attack' });
      expect(httpRes.status).toBe(409);

      // Verify internal cancellation path still succeeds
      jest.spyOn(DiscountsRepo, 'findActiveUsageForReservation').mockResolvedValue({
        id: 'usage-redeemed-1',
        customerAccountId: 'cust-1',
        campaignId: null,
        status: DiscountUsageStatus.REDEEMED,
        discountAmount: 20000,
      } as any);
      jest.spyOn(DiscountsRepo, 'updateDiscountUsage').mockResolvedValue({
        id: 'usage-redeemed-1',
        status: DiscountUsageStatus.RELEASED,
      } as any);

      const internalResult = await discountsStation.releaseDiscountForReservation('res-1', 'Canceled');
      expect(internalResult?.status).toBe(DiscountUsageStatus.RELEASED);
    });

    it('blocks tenant staff from releasing or redeeming discount usages belonging to another gaming center', async () => {
      jest.spyOn(DiscountsRepo, 'transaction').mockImplementation(async (fn: any) => fn({}));
      jest.spyOn(DiscountsRepo, 'findUsageById').mockResolvedValue({
        id: 'usage-gc2',
        customerAccountId: 'cust-1',
        status: DiscountUsageStatus.RESERVED,
        discountAmount: 15000,
        reservation: { id: 'res-gc2', gamingCenterId: gc2, customerAccountId: 'cust-1' },
      } as any);

      const crossRelease = await request(app)
        .post(`/api/v1/gamingCenters/${gc1}/discounts/release`)
        .set('Authorization', 'Bearer manager-gc1')
        .send({ usageId: 'usage-gc2' });
      expect(crossRelease.status).toBe(403);

      const crossRedeem = await request(app)
        .post(`/api/v1/gamingCenters/${gc1}/discounts/redeem`)
        .set('Authorization', 'Bearer manager-gc1')
        .send({ usageId: 'usage-gc2', reservationId: 'res-gc2' });
      expect(crossRedeem.status).toBe(403);
    });
  });

  describe('SEC-008: Global Platform Campaign Takeover & Funding Source Fraud Prevention', () => {
    it('does not default fundingSource to PLATFORM in createCampaignSchema and forces MERCHANT_FUNDED for tenant managers', async () => {
      const parsed = await createCampaignSchema.safeParseAsync({
        params: { gamingCenterId: gc1 },
        body: {
          name: 'Center Summer Promo',
          valueType: DiscountValueType.PERCENTAGE,
          value: 15,
          startAt: '2026-12-01T00:00:00.000Z',
          endAt: '2026-12-31T23:59:59.000Z',
        },
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.body.fundingSource).toBeUndefined();
      }

      jest.spyOn(DiscountsRepo, 'findCampaignByCode').mockResolvedValue(null);
      jest.spyOn(ReservationRepo, 'findGamingCenterWithSettings').mockResolvedValue({ id: gc1 } as any);
      const createSpy = jest.spyOn(DiscountsRepo, 'createCampaign').mockImplementation(async (data: any) => ({
        id: 'camp-tenant-1',
        ...data,
      }));

      await discountsStation.createCampaign(
        gc1,
        'user-1',
        {
          name: 'Center Promo',
          valueType: DiscountValueType.PERCENTAGE,
          value: 15,
          targetType: DiscountTargetType.GAMING_CENTER,
          targetId: gc1,
          startAt: '2026-12-01T00:00:00.000Z',
          endAt: '2026-12-31T23:59:59.000Z',
        } as any,
        { id: 'user-1', actorType: SessionActorType.USER, gamingCenterId: gc1 } as any
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          gamingCenterId: gc1,
          fundingSource: DiscountFundingSource.MERCHANT_FUNDED,
        })
      );

      await expect(
        discountsStation.createCampaign(
          gc1,
          'user-1',
          {
            name: 'Fraud Promo',
            valueType: DiscountValueType.PERCENTAGE,
            value: 100,
            fundingSource: DiscountFundingSource.PLATFORM,
            startAt: '2026-12-01T00:00:00.000Z',
            endAt: '2026-12-31T23:59:59.000Z',
          } as any,
          { id: 'user-1', actorType: SessionActorType.USER, gamingCenterId: gc1 } as any
        )
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('blocks tenant manager from modifying global platform campaign or switching campaign to PLATFORM funded', async () => {
      jest.spyOn(DiscountsRepo, 'findCampaignById').mockResolvedValue({
        id: 'camp-global',
        gamingCenterId: null,
        name: 'Global Platform Campaign',
        code: 'GLOBAL20',
        fundingSource: DiscountFundingSource.PLATFORM,
      } as any);

      await expect(
        discountsStation.updateCampaign(
          'camp-global',
          gc1,
          { value: 100, totalBudget: 999999999 },
          { id: 'user-1', actorType: SessionActorType.USER, gamingCenterId: gc1 } as any
        )
      ).rejects.toMatchObject({ statusCode: 403 });

      jest.spyOn(DiscountsRepo, 'findCampaignById').mockResolvedValue({
        id: 'camp-gc1',
        gamingCenterId: gc1,
        name: 'Tenant Campaign',
        code: 'GC1PROMO',
        fundingSource: DiscountFundingSource.MERCHANT_FUNDED,
        targetType: DiscountTargetType.GAMING_CENTER,
        targetId: gc1,
      } as any);

      await expect(
        discountsStation.updateCampaign(
          'camp-gc1',
          gc1,
          { fundingSource: DiscountFundingSource.PLATFORM },
          { id: 'user-1', actorType: SessionActorType.USER, gamingCenterId: gc1 } as any
        )
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('charges direct automatic merchant discounts as MERCHANT_FUNDED with platformFundedDiscount = 0', async () => {
      jest.spyOn(ReservationRepo, 'transaction').mockImplementation(async (fn: any) => fn({}));
      jest.spyOn(ReservationRepo, 'lockStationForUpdate').mockResolvedValue([] as any);
      jest.spyOn(ReservationRepo, 'findOverlappingMaintenance').mockResolvedValue([]);
      jest.spyOn(ReservationRepo, 'findOverlappingReservation').mockResolvedValue(null as any);
      jest.spyOn(ReservationRepo, 'findGamingCenterWithSettings').mockResolvedValue({
        id: gc1,
        name: 'Center 1',
        isActive: true,
        settings: {
          workStartTime: '00:00',
          workEndTime: '23:59',
          timeZone: 'Asia/Tehran',
          minAdvanceMinutes: 0,
          maxAdvanceDays: 30,
          allowWalkIn: true,
        },
      } as any);
      jest.spyOn(ReservationRepo, 'findStation').mockResolvedValue({
        id: 'st-1',
        gamingCenterId: gc1,
        isActive: true,
        hourlyPrice: 100000,
        name: 'PS5',
        stationType: 'PS5',
      } as any);
      jest.spyOn(ReservationRepo, 'findStaff').mockResolvedValue({ id: 'user-1', gamingCenterId: gc1 } as any);
      jest.spyOn(ReservationRepo, 'assertActiveReservationLimitNotExceeded').mockResolvedValue(undefined as any);
      jest.spyOn(ReservationRepo, 'createHistory').mockResolvedValue({} as any);
      jest.spyOn(ReservationRepo, 'findCustomerAccountByPhone').mockResolvedValue({ id: 'cust-1', phone: '09120000000' } as any);
      jest.spyOn(ReservationRepo, 'findCustomerProfile').mockResolvedValue({ id: 'prof-1' } as any);
      jest.spyOn(commissionCalculator, 'resolveEffectiveCommissionPolicy').mockResolvedValue(null);

      jest.spyOn(discountsStation, 'calculateApplicableDiscount').mockResolvedValue({
        applicableDiscount: { id: 'disc-direct-1' } as any,
        discountAmount: 25000,
      });

      let createdPayload: any = null;
      jest.spyOn(ReservationRepo, 'createReservation').mockImplementation(async (data: any) => {
        createdPayload = data;
        return { id: 'res-direct-1', ...data };
      });

      const startTime = new Date(Date.now() + 3600_000).toISOString();
      await reservationStation.createReservation({
        gamingCenterId: gc1,
        staffId: 'user-1',
        createdByUserId: 'user-1',
        stationId: 'st-1',
        startTime,
        durationHours: 1,
        customer: { fullName: 'Walkin User', phone: '09120000000' },
      } as any);

      expect(createdPayload).toBeTruthy();
      expect(createdPayload.discountFundingSource).toBe(DiscountFundingSource.MERCHANT_FUNDED);
      expect(createdPayload.platformFundedDiscount).toBe(0);
    });
  });
});
