/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { UserRole, SessionActorType } from '@prisma/client';
import routes from '../../../src/routes';
import * as stationLogic from '../../../src/modules/station/station.station';
import { errorHandler } from '../../../src/common/errors/errorHandler';
import { responseMiddleware } from '../../../src/common/middleware/response';
import AppError from '../../../src/common/errors/AppError';

jest.mock('../../../src/modules/station/station.station');
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

const MockedStationLogic = stationLogic as jest.Mocked<typeof stationLogic>;

const app = express();
app.use(express.json());
app.use(responseMiddleware);
app.use('/api/v1', routes);
app.use(errorHandler);

describe('Station Maintenance API Integration Tests', () => {
  const gamingCenterId = 'clx0000000000000000000000';
  const stationId = 'clx0000000000000000000001';
  const maintenanceId = 'clx0000000000000000000002';

  const sampleMaintenance = {
    id: maintenanceId,
    stationId,
    startTime: '2026-12-01T10:00:00.000Z',
    endTime: '2026-12-01T12:00:00.000Z',
    reason: 'Hardware Repair',
    cost: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /gamingCenters/:gamingCenterId/stations/:stationId/maintenance', () => {
    it('should create station maintenance for MANAGER role', async () => {
      MockedStationLogic.createStationMaintenance.mockResolvedValue(sampleMaintenance as any);

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/stations/${stationId}/maintenance`)
        .set('x-test-role', 'MANAGER')
        .send({
          startTime: '2026-12-01T10:00:00.000Z',
          endTime: '2026-12-01T12:00:00.000Z',
          reason: 'Hardware Repair',
          cost: 100,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(maintenanceId);
    });

    it('should reject STAFF role from creating maintenance (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/stations/${stationId}/maintenance`)
        .set('x-test-role', 'STAFF')
        .send({
          startTime: '2026-12-01T10:00:00.000Z',
          endTime: '2026-12-01T12:00:00.000Z',
          reason: 'Hardware Repair',
        });

      expect(res.status).toBe(403);
    });

    it('should return 409 Conflict if station maintenance overlaps active reservations', async () => {
      MockedStationLogic.createStationMaintenance.mockRejectedValue(
        new AppError('Cannot schedule maintenance: active reservation(s) exist during the requested period.', 409, {
          code: 'MAINTENANCE_CONFLICT_WITH_RESERVATION',
        })
      );

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/stations/${stationId}/maintenance`)
        .set('x-test-role', 'MANAGER')
        .send({
          startTime: '2026-12-01T10:00:00.000Z',
          endTime: '2026-12-01T12:00:00.000Z',
          reason: 'Hardware Repair',
        });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /gamingCenters/:gamingCenterId/stations/:stationId/maintenance', () => {
    it('should list maintenance records for a station', async () => {
      MockedStationLogic.getStationMaintenances.mockResolvedValue([sampleMaintenance as any]);

      const res = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenterId}/stations/${stationId}/maintenance`)
        .set('x-test-role', 'STAFF');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('DELETE /gamingCenters/:gamingCenterId/stations/:stationId/maintenance/:maintenanceId', () => {
    it('should delete station maintenance record', async () => {
      MockedStationLogic.deleteStationMaintenance.mockResolvedValue({
        success: true,
        message: 'Maintenance record removed.',
      } as any);

      const res = await request(app)
        .delete(`/api/v1/gamingCenters/${gamingCenterId}/stations/${stationId}/maintenance/${maintenanceId}`)
        .set('x-test-role', 'MANAGER');

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });
  });
});
