import * as userRepo from './users.repo';
import { CreateUserInput, UpdateUserInput, ListUsersQuery } from './users.validators';
import AppError from '../../common/errors/AppError';
import { SessionActorType } from '@prisma/client';
import { auditService } from '../audit/audit.station';

export const createStaffMember = async (
  gamingCenterId: string,
  data: CreateUserInput,
  actor: { id: string; actorType: SessionActorType },
  context?: { ip?: string; userAgent?: string }
) => {
  // The database schema has a unique constraint on (gamingCenterId, phone),
  // so Prisma will throw a specific error if a duplicate is found.
  // We can catch this in the controller to return a 409 Conflict error.
  const newUser = await userRepo.createUser(gamingCenterId, data);

  await auditService.recordLog({
    gamingCenterId,
    userId: actor.id,
    actorType: actor.actorType,
    action: 'USER_CREATE',
    entity: 'User',
    entityId: newUser.id,
    newData: newUser,
    ipAddress: context?.ip,
    userAgent: context?.userAgent,
  });

  return newUser;
};

export const getStaffList = async (gamingCenterId: string, query: ListUsersQuery) => {
  const staff = await userRepo.listUsersByGamingCenter(gamingCenterId, query);
  return staff;
};

export const getStaffMember = async (gamingCenterId: string, userId: string) => {
  const user = await userRepo.findUserById(gamingCenterId, userId);
  if (!user) {
    throw new AppError('Staff member not found', 404);
  }
  return user;
};

export const updateStaffMember = async (
  gamingCenterId: string,
  userId: string,
  data: UpdateUserInput,
  actor: { id: string; actorType: SessionActorType },
  context?: { ip?: string; userAgent?: string }
) => {
  const existingUser = await userRepo.findUserById(gamingCenterId, userId);
  if (!existingUser) {
    throw new AppError('Staff member not found', 404);
  }

  await userRepo.updateUser(gamingCenterId, userId, data);

  // Return the updated user data
  const updatedUser = await userRepo.findUserById(gamingCenterId, userId);

  await auditService.recordLog({
    gamingCenterId,
    userId: actor.id,
    actorType: actor.actorType,
    action: 'USER_UPDATE',
    entity: 'User',
    entityId: userId,
    oldData: existingUser,
    newData: updatedUser,
    ipAddress: context?.ip,
    userAgent: context?.userAgent,
  });

  return updatedUser;
};

export const deleteStaffMember = async (
  gamingCenterId: string,
  userId: string,
  actor: { id: string; actorType: SessionActorType },
  context?: { ip?: string; userAgent?: string }
) => {
  const existingUser = await userRepo.findUserById(gamingCenterId, userId);
  if (!existingUser) {
    throw new AppError('Staff member not found', 404);
  }

  await userRepo.softDeleteUser(gamingCenterId, userId);

  await auditService.recordLog({
    gamingCenterId,
    userId: actor.id,
    actorType: actor.actorType,
    action: 'USER_DELETE',
    entity: 'User',
    entityId: userId,
    oldData: existingUser,
    newData: { isActive: false },
    ipAddress: context?.ip,
    userAgent: context?.userAgent,
  });
};
