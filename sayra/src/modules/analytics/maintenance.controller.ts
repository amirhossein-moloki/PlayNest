import { Response } from 'express';
import { AppRequest } from '../../types/express';
import { asyncHandler } from '../../common/middleware/asyncHandler';
import { MaintenanceService } from './maintenance.service';
import { AnalyticsStation } from './analytics.station';
import { MaintenanceSeverity, MaintenanceStatus } from '@prisma/client';
import { AnalyticsQuery } from './analytics.validators';

const createMaintenance = asyncHandler(async (req: AppRequest, res: Response) => {
  const { stationId } = req.params;
  const { startTime, endTime, reason, cost, breakdownType, severity, status } = req.body;

  const result = await MaintenanceService.createMaintenance({
    gamingCenterId: req.tenant.gamingCenterId,
    stationId,
    startTime: new Date(startTime),
    endTime: endTime ? new Date(endTime) : null,
    reason,
    cost: cost !== undefined ? Number(cost) : null,
    breakdownType,
    severity,
    status,
  });

  res.created(result);
});

const getMaintenanceLogs = asyncHandler(async (req: AppRequest, res: Response) => {
  const { stationId, status, severity, startDate, endDate } = req.query as {
    stationId?: string;
    status?: MaintenanceStatus;
    severity?: MaintenanceSeverity;
    startDate?: string;
    endDate?: string;
  };

  const result = await MaintenanceService.getMaintenanceLogs(
    req.tenant.gamingCenterId,
    stationId,
    status,
    severity,
    startDate ? new Date(startDate) : undefined,
    endDate ? new Date(endDate) : undefined
  );

  res.ok(result);
});

const getMaintenanceById = asyncHandler(async (req: AppRequest, res: Response) => {
  const { id } = req.params;
  const result = await MaintenanceService.getMaintenanceById(req.tenant.gamingCenterId, id);
  res.ok(result);
});

const updateMaintenance = asyncHandler(async (req: AppRequest, res: Response) => {
  const { id } = req.params;
  const { startTime, endTime, reason, cost, breakdownType, severity, status } = req.body;

  const result = await MaintenanceService.updateMaintenance(req.tenant.gamingCenterId, id, {
    startTime: startTime ? new Date(startTime) : undefined,
    endTime: endTime !== undefined ? (endTime ? new Date(endTime) : null) : undefined,
    reason,
    cost: cost !== undefined ? Number(cost) : undefined,
    breakdownType,
    severity,
    status,
  });

  res.ok(result);
});

const getMaintenanceAnalytics = asyncHandler(async (req: AppRequest, res: Response) => {
  const { startDate, endDate } = req.query as unknown as AnalyticsQuery;
  const result = await AnalyticsStation.getMaintenanceAnalytics(
    req.tenant.gamingCenterId,
    startDate,
    endDate
  );

  res.ok(result);
});

export const MaintenanceController = {
  createMaintenance,
  getMaintenanceLogs,
  getMaintenanceById,
  updateMaintenance,
  getMaintenanceAnalytics,
};
