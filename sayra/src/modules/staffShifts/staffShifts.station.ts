import * as shiftsRepo from './staffShifts.repo';
import { UpsertShiftsInput } from './staffShifts.validators';
import * as userRepo from '../users/users.repo';
import AppError from '../../common/errors/AppError';
import { auditService } from '../audit/audit.station';
import { SessionActorType } from '@prisma/client';

export const upsertShifts = async (
  gamingCenterId: string,
  userId: string,
  staffShifts: UpsertShiftsInput,
  actor: { id: string; actorType: SessionActorType },
  context?: { ip?: string; userAgent?: string }
) => {
  // First, verify that the user exists
  const user = await userRepo.findUserById(gamingCenterId, userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const oldShifts = await shiftsRepo.findShiftsByUserId(gamingCenterId, userId);
  const result = await shiftsRepo.upsertShifts(gamingCenterId, userId, staffShifts);

  await auditService.log(
    gamingCenterId,
    actor,
    'STAFF_SHIFTS_UPDATE',
    { name: 'User', id: userId },
    { old: oldShifts, new: result },
    context
  );

  return result;
};
