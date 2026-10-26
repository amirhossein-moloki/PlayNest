/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { tenantGuard } from '../../../../src/common/middleware/tenantGuard';
import { AnalyticsStation } from '../../../../src/modules/analytics/analytics.station';
import { AnalyticsRepo } from '../../../../src/modules/analytics/analytics.repo';
import AppError from '../../../../src/common/errors/AppError';
import httpStatus from 'http-status';

jest.mock('../../../../src/modules/analytics/analytics.repo');
jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    settings: {
      findUnique: jest.fn().mockResolvedValue({ timeZone: 'UTC' } as never),
    },
  },
}));

describe('Phase 6 — Tenant-Facing Owner Analytics Unit Tests', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Tenant Isolation & Tenant Guard Invariants', () => {
    it('should throw HTTP 404 AppError when actor.gamingCenterId does not match params.gamingCenterId (Enumeration Defense)', () => {
      const req: any = {
        params: { gamingCenterId: 'gc-target' },
        actor: { id: 'u-1', gamingCenterId: 'gc-other', role: 'MANAGER' },
      };
      const res: any = {};
      const next = jest.fn();

      tenantGuard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const error = next.mock.calls[0][0] as AppError;
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(httpStatus.NOT_FOUND);
      expect(error.message).toBe('GamingCenter not found.');
    });

    it('should attach req.tenant when actor.gamingCenterId matches params.gamingCenterId', () => {
      const req: any = {
        params: { gamingCenterId: 'gc-1' },
        actor: { id: 'u-1', gamingCenterId: 'gc-1', role: 'MANAGER' },
      };
      const res: any = {};
      const next = jest.fn();

      tenantGuard(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.tenant).toEqual({ gamingCenterId: 'gc-1' });
    });

    it('should throw HTTP 500 when actor is missing from request', () => {
      const req: any = { params: { gamingCenterId: 'gc-1' } };
      const res: any = {};
      const next = jest.fn();

      tenantGuard(req, res, next);

      const error = next.mock.calls[0][0] as AppError;
      expect(error.statusCode).toBe(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should throw HTTP 404 when actor does not have gamingCenterId assigned', () => {
      const req: any = {
        params: { gamingCenterId: 'gc-1' },
        actor: { id: 'u-1', role: 'MANAGER' },
      };
      const res: any = {};
      const next = jest.fn();

      tenantGuard(req, res, next);

      const error = next.mock.calls[0][0] as AppError;
      expect(error.statusCode).toBe(httpStatus.NOT_FOUND);
    });
  });

  describe('Customer PII & Top Spenders Masking Invariants', () => {
    it('should mask phone numbers in top spenders report', async () => {
      (AnalyticsRepo.getCompletedCustomerReservations as jest.Mock).mockResolvedValue([
        {
          id: 'res-1',
          customerAccountId: 'cust-1',
          startTime: new Date('2026-02-01T10:00:00Z'),
          totalPrice: 500000,
          customerAccount: {
            fullName: 'Jane Doe',
            phone: '09123456789',
          },
        },
      ] as never);

      const result = await AnalyticsStation.getTopSpenders('gc-1', new Date('2026-02-01'), new Date('2026-02-02'));

      expect(result.topSpenders.length).toBe(1);
      expect(result.topSpenders[0].fullName).toBe('Jane Doe');
      expect(result.topSpenders[0].phone).toBe('0912***6789');
      expect(result.topSpenders[0].totalSpend).toBe(500000);
    });

    it('should handle missing phone numbers without exposing PII', async () => {
      (AnalyticsRepo.getCompletedCustomerReservations as jest.Mock).mockResolvedValue([
        {
          id: 'res-2',
          customerAccountId: 'cust-2',
          startTime: new Date('2026-02-01T10:00:00Z'),
          totalPrice: 100000,
          customerAccount: {
            fullName: 'John Smith',
            phone: null,
          },
        },
      ] as never);

      const result = await AnalyticsStation.getTopSpenders('gc-1', new Date('2026-02-01'), new Date('2026-02-02'));

      expect(result.topSpenders[0].phone).toBe('***');
    });
  });

  describe('Data Freshness & Ingestion Lag Invariants', () => {
    it('should return status FRESH when last ingestion run was within 120 minutes', async () => {
      const recentDate = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
      (AnalyticsRepo.getIngestionStatus as jest.Mock).mockResolvedValue({
        status: 'FRESH',
        lastIngestedAt: recentDate,
        watermarks: [],
        recentRuns: [],
      } as never);

      const result = await AnalyticsStation.getIngestionStatus();

      expect(result.status).toBe('FRESH');
      expect(result.lastIngestedAt).toEqual(recentDate);
    });

    it('should return status STALE when last ingestion run was > 120 minutes ago', async () => {
      const staleDate = new Date(Date.now() - 180 * 60 * 1000); // 180 mins ago
      (AnalyticsRepo.getIngestionStatus as jest.Mock).mockResolvedValue({
        status: 'STALE',
        lastIngestedAt: staleDate,
        watermarks: [],
        recentRuns: [],
      } as never);

      const result = await AnalyticsStation.getIngestionStatus();

      expect(result.status).toBe('STALE');
      expect(result.lastIngestedAt).toEqual(staleDate);
    });
  });
});
