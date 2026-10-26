import { prisma } from '../../config/prisma';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { MaintenanceSeverity, MaintenanceStatus } from '@prisma/client';

export interface CreateMaintenanceInput {
  gamingCenterId: string;
  stationId: string;
  startTime: Date;
  endTime?: Date | null;
  reason: string;
  cost?: number | null;
  breakdownType?: string | null;
  severity?: MaintenanceSeverity;
  status?: MaintenanceStatus;
}

export interface UpdateMaintenanceInput {
  startTime?: Date;
  endTime?: Date | null;
  reason?: string;
  cost?: number | null;
  breakdownType?: string | null;
  severity?: MaintenanceSeverity;
  status?: MaintenanceStatus;
  repairedAt?: Date | null;
}

export const MaintenanceService = {
  async createMaintenance(input: CreateMaintenanceInput) {
    // Verify station belongs to gamingCenter
    const station = await prisma.gameStation.findFirst({
      where: { id: input.stationId, gamingCenterId: input.gamingCenterId },
    });

    if (!station) {
      throw new AppError('Station not found or does not belong to this gaming center.', httpStatus.NOT_FOUND);
    }

    if (input.endTime && input.endTime < input.startTime) {
      throw new AppError('Maintenance end time cannot be before start time.', httpStatus.BAD_REQUEST);
    }

    const maintenance = await prisma.stationMaintenance.create({
      data: {
        stationId: input.stationId,
        gamingCenterId: input.gamingCenterId,
        startTime: input.startTime,
        endTime: input.endTime || null,
        reason: input.reason,
        cost: input.cost !== undefined ? input.cost : null,
        breakdownType: input.breakdownType || null,
        severity: input.severity || MaintenanceSeverity.MEDIUM,
        status: input.status || MaintenanceStatus.REPORTED,
        reportedAt: new Date(),
        repairedAt: input.status === MaintenanceStatus.REPAIRED ? input.endTime || new Date() : null,
      },
    });

    return maintenance;
  },

  async getMaintenanceLogs(
    gamingCenterId: string,
    stationId?: string,
    status?: MaintenanceStatus,
    severity?: MaintenanceSeverity,
    startDate?: Date,
    endDate?: Date
  ) {
    const where: any = {
      station: { gamingCenterId },
      ...(stationId ? { stationId } : {}),
      ...(status ? { status } : {}),
      ...(severity ? { severity } : {}),
    };

    if (startDate || endDate) {
      where.startTime = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    return prisma.stationMaintenance.findMany({
      where,
      include: {
        station: {
          select: { id: true, name: true, stationType: true, hourlyPrice: true },
        },
      },
      orderBy: { startTime: 'desc' },
    });
  },

  async getMaintenanceById(gamingCenterId: string, id: string) {
    const record = await prisma.stationMaintenance.findFirst({
      where: { id, station: { gamingCenterId } },
      include: { station: true },
    });

    if (!record) {
      throw new AppError('Maintenance record not found.', httpStatus.NOT_FOUND);
    }

    return record;
  },

  async updateMaintenance(gamingCenterId: string, id: string, input: UpdateMaintenanceInput) {
    const existing = await this.getMaintenanceById(gamingCenterId, id);

    const effectiveStartTime = input.startTime || existing.startTime;
    const effectiveEndTime = input.endTime !== undefined ? input.endTime : existing.endTime;

    if (effectiveEndTime && effectiveEndTime < effectiveStartTime) {
      throw new AppError('Maintenance end time cannot be before start time.', httpStatus.BAD_REQUEST);
    }

    let repairedAt = existing.repairedAt;
    if (input.status === MaintenanceStatus.REPAIRED && !repairedAt) {
      repairedAt = effectiveEndTime || new Date();
    }

    const updated = await prisma.stationMaintenance.update({
      where: { id },
      data: {
        ...(input.startTime ? { startTime: input.startTime } : {}),
        ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.cost !== undefined ? { cost: input.cost } : {}),
        ...(input.breakdownType !== undefined ? { breakdownType: input.breakdownType } : {}),
        ...(input.severity ? { severity: input.severity } : {}),
        ...(input.status ? { status: input.status } : {}),
        repairedAt,
      },
    });

    return updated;
  },
};
