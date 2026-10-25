/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  createStationMaintenance,
  deleteStationMaintenance,
  getStationMaintenances,
} from '../../../../src/modules/station/station.station';
import * as StationRepo from '../../../../src/modules/station/station.repo';
import { auditService } from '../../../../src/modules/audit/audit.station';
import AppError from '../../../../src/common/errors/AppError';
import { SessionActorType } from '@prisma/client';

jest.mock('../../../../src/modules/station/station.repo');
jest.mock('../../../../src/modules/audit/audit.station');

const MockedStationRepo = StationRepo as jest.Mocked<typeof StationRepo>;
const MockedAuditService = auditService as jest.Mocked<typeof auditService>;

describe('Station Maintenance Unit Tests', () => {
  const gamingCenterId = 'clx0000000000000000000000';
  const stationId = 'clx0000000000000000000001';
  const maintenanceId = 'clx0000000000000000000002';

  const actor = {
    id: 'user-1',
    actorType: SessionActorType.USER,
  };

  const sampleStation = {
    id: stationId,
    gamingCenterId,
    name: 'PC-1',
    stationType: 'PC',
    hourlyPrice: 100,
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createStationMaintenance', () => {
    it('should create maintenance window successfully when no active reservations conflict', async () => {
      MockedStationRepo.findStationById.mockResolvedValue(sampleStation as any);
      MockedStationRepo.findOverlappingReservationsForMaintenance.mockResolvedValue([]);
      MockedStationRepo.createMaintenance.mockResolvedValue({
        id: maintenanceId,
        stationId,
        startTime: new Date('2026-12-01T10:00:00Z'),
        endTime: new Date('2026-12-01T12:00:00Z'),
        reason: 'GPU Replacement',
        cost: 150,
        createdAt: new Date(),
        updatedAt: new Date(),
        station: { id: stationId, name: 'PC-1', stationType: 'PC' },
      } as any);

      const result = await createStationMaintenance(
        gamingCenterId,
        stationId,
        {
          startTime: '2026-12-01T10:00:00Z',
          endTime: '2026-12-01T12:00:00Z',
          reason: 'GPU Replacement',
          cost: 150,
        },
        actor
      );

      expect(result.id).toBe(maintenanceId);
      expect(MockedStationRepo.createMaintenance).toHaveBeenCalled();
      expect(MockedAuditService.log).toHaveBeenCalledWith(
        gamingCenterId,
        actor,
        'STATION_MAINTENANCE_CREATE',
        expect.any(Object),
        expect.any(Object),
        undefined
      );
    });

    it('should reject maintenance creation when active reservations overlap (409 Conflict)', async () => {
      MockedStationRepo.findStationById.mockResolvedValue(sampleStation as any);
      MockedStationRepo.findOverlappingReservationsForMaintenance.mockResolvedValue([
        {
          id: 'res-conflict-1',
          status: 'CONFIRMED',
          startTime: new Date('2026-12-01T10:30:00Z'),
          endTime: new Date('2026-12-01T11:30:00Z'),
          customerAccountId: 'cust-1',
        } as any,
      ]);

      await expect(
        createStationMaintenance(
          gamingCenterId,
          stationId,
          {
            startTime: '2026-12-01T10:00:00Z',
            endTime: '2026-12-01T12:00:00Z',
            reason: 'GPU Replacement',
          },
          actor
        )
      ).rejects.toThrow(AppError);

      expect(MockedStationRepo.createMaintenance).not.toHaveBeenCalled();
    });
  });

  describe('deleteStationMaintenance', () => {
    it('should delete maintenance record and log audit event', async () => {
      MockedStationRepo.findMaintenanceById.mockResolvedValue({
        id: maintenanceId,
        stationId,
        station: { id: stationId, gamingCenterId },
      } as any);

      MockedStationRepo.deleteMaintenance.mockResolvedValue({ id: maintenanceId } as any);

      const result = await deleteStationMaintenance(gamingCenterId, stationId, maintenanceId, actor);

      expect(result.success).toBe(true);
      expect(MockedStationRepo.deleteMaintenance).toHaveBeenCalledWith(maintenanceId);
      expect(MockedAuditService.log).toHaveBeenCalledWith(
        gamingCenterId,
        actor,
        'STATION_MAINTENANCE_DELETE',
        expect.any(Object),
        expect.any(Object),
        undefined
      );
    });

    it('should throw 404 if maintenance record is not found', async () => {
      MockedStationRepo.findMaintenanceById.mockResolvedValue(null);

      await expect(
        deleteStationMaintenance(gamingCenterId, stationId, maintenanceId, actor)
      ).rejects.toThrow(AppError);
    });
  });

  describe('getStationMaintenances', () => {
    it('should return list of maintenance records', async () => {
      MockedStationRepo.findStationById.mockResolvedValue(sampleStation as any);
      MockedStationRepo.findMaintenancesByStationId.mockResolvedValue([
        { id: maintenanceId, reason: 'Cleaning' } as any,
      ]);

      const result = await getStationMaintenances(gamingCenterId, stationId);
      expect(result).toHaveLength(1);
    });
  });
});
