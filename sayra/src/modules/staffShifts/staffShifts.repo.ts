import { prisma } from '../../config/prisma';
import { UpsertShiftsInput } from './staffShifts.validators';

export const findShiftsByUserId = async (gamingCenterId: string, userId: string) => {
  return prisma.staffShift.findMany({
    where: { gamingCenterId, userId },
  });
};

export const upsertShifts = async (gamingCenterId: string, userId: string, staffShifts: UpsertShiftsInput) => {
  // Use a transaction to ensure all or no staffShifts are updated
  const upsertPromises = staffShifts.map(staffShift =>
    prisma.staffShift.upsert({
      where: {
        gamingCenterId_userId_dayOfWeek: {
          gamingCenterId,
          userId,
          dayOfWeek: staffShift.dayOfWeek
        }
      },
      update: {
        startTime: staffShift.startTime,
        endTime: staffShift.endTime,
        isActive: staffShift.isActive,
      },
      create: {
        gamingCenterId,
        userId,
        dayOfWeek: staffShift.dayOfWeek,
        startTime: staffShift.startTime,
        endTime: staffShift.endTime,
        isActive: staffShift.isActive,
      },
    })
  );

  return prisma.$transaction(upsertPromises);
};
