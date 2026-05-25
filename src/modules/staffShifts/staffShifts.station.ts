import * as shiftsRepo from './staffShifts.repo';
import { UpsertShiftsInput } from './staffShifts.validators';
import * as userRepo from '../users/users.repo';
import AppError from '../../common/errors/AppError';

export const upsertShifts = async (
  gamingCenterId: string,
  userId: string,
  staffShifts: UpsertShiftsInput
) => {
  // First, verify that the user exists
  const user = await userRepo.findUserById(gamingCenterId, userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const result = await shiftsRepo.upsertShifts(gamingCenterId, userId, staffShifts);
  return result;
};
