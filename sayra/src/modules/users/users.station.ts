import * as userRepo from './users.repo';
import { CreateUserInput, UpdateUserInput, ListUsersQuery } from './users.validators';
import AppError from '../../common/errors/AppError';
import { SessionActorType } from '@prisma/client';
import { auditService } from '../audit/audit.station';

import httpStatus from 'http-status';

export const createStaffMember = async (
  gamingCenterId: string,
  data: CreateUserInput,
  actor: { id: string; actorType: SessionActorType },
  context?: { ip?: string; userAgent?: string }
) => {
  // If role is MANAGER, enforce 1-to-1 manager constraint
  if (data.role === 'MANAGER') {
    // 1. Check if the gaming center already has a manager assigned
    const currentCenter = await userRepo.findGamingCenterManager(gamingCenterId);
    if (currentCenter?.managerId) {
      throw new AppError('This gaming center already has a manager. Each gaming center can only have one manager.', httpStatus.CONFLICT);
    }

    const existingCenterManager = await userRepo.findActiveManagerInCenter(gamingCenterId);
    if (existingCenterManager) {
      throw new AppError('This gaming center already has an active manager. Each gaming center can only have one manager.', httpStatus.CONFLICT);
    }

    // 2. Check if a manager with this phone number already manages any gaming center
    const existingManagerPhone = await userRepo.findManagerByPhone(data.phone);
    if (existingManagerPhone) {
      throw new AppError('This user is already a manager of another gaming center. A manager can only manage one gaming center.', httpStatus.CONFLICT);
    }
  }

  // The database schema has a unique constraint on (gamingCenterId, phone),
  // so Prisma will throw a specific error if a duplicate is found.
  // We can catch this in the controller to return a 409 Conflict error.
  const newUser = await userRepo.createUser(gamingCenterId, data);

  // If role is MANAGER, set managerId on gamingCenter
  if (data.role === 'MANAGER') {
    await userRepo.setGamingCenterManager(gamingCenterId, newUser.id);
  }

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

  // If updating role to MANAGER or reactivating a MANAGER
  if (data.role === 'MANAGER' && existingUser.role !== 'MANAGER') {
    // 1. Check if the gaming center already has another manager
    const currentCenter = await userRepo.findGamingCenterManager(gamingCenterId);
    if (currentCenter?.managerId && currentCenter.managerId !== userId) {
      throw new AppError('This gaming center already has a manager. Each gaming center can only have one manager.', httpStatus.CONFLICT);
    }

    const otherManager = await userRepo.findActiveManagerInCenter(gamingCenterId, userId);
    if (otherManager) {
      throw new AppError('This gaming center already has an active manager. Each gaming center can only have one manager.', httpStatus.CONFLICT);
    }

    // 2. Check if this user already manages another center
    const managesOtherCenter = await userRepo.findOtherCenterManagedByUser(userId, gamingCenterId);
    if (managesOtherCenter) {
      throw new AppError('This user already manages another gaming center. A manager can only manage one gaming center.', httpStatus.CONFLICT);
    }
  }

  await userRepo.updateUser(gamingCenterId, userId, data);

  // Maintain gamingCenter.managerId synchronization
  if (data.role === 'MANAGER') {
    await userRepo.setGamingCenterManager(gamingCenterId, userId);
  } else if (data.role !== undefined && (data.role as string) !== 'MANAGER' && existingUser.role === 'MANAGER') {
    // Demoted from MANAGER - remove as managerId from gamingCenter
    await userRepo.clearGamingCenterManager(gamingCenterId, userId);
  }

  // Invalidate cached auth state on user update
  const { invalidateActorCache } = await import('../../common/middleware/auth');
  await invalidateActorCache(userId, 'USER');

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

  // If deleted user was manager, clear managerId on gamingCenter
  if (existingUser.role === 'MANAGER') {
    await userRepo.clearGamingCenterManager(gamingCenterId, userId);
  }

  // Invalidate cached auth state on user deletion/deactivation
  const { invalidateActorCache } = await import('../../common/middleware/auth');
  await invalidateActorCache(userId, 'USER');

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
