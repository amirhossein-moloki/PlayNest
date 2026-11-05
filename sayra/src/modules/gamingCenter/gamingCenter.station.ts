import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { gamingCenterRepository } from './gamingCenter.repository';
import { CreateGamingCenterInput, UpdateGamingCenterInput } from './gamingCenter.types';
import { ListGamingCentersQuery, GetGamingCenterDetailsQuery } from './gamingCenter.validation';
import { SessionActorType, UserRole } from '@prisma/client';
import { auditService } from '../audit/audit.station';
import { invalidateActorCache } from '../../common/middleware/auth';

export interface OwnerInfo {
  id: string;
  fullName: string;
  role: string;
  type: 'USER' | 'PLATFORM_ADMIN';
}

export const gamingCenterStation = {
  async createGamingCenter(
    data: CreateGamingCenterInput,
    actor?: { id: string; actorType: SessionActorType; isSuperuser?: boolean; role?: UserRole },
    context?: { ip?: string; userAgent?: string }
  ) {
    const existingGamingCenter = await gamingCenterRepository.findBySlug(data.slug);
    if (existingGamingCenter) {
      throw new AppError('A gamingCenter with this slug already exists', httpStatus.CONFLICT);
    }

    // Determine ownership source: User or PlatformAdmin
    const userRecord = await gamingCenterRepository.findUserById(data.ownerId);
    let platformAdminRecord = null;
    if (!userRecord) {
      platformAdminRecord = await gamingCenterRepository.findPlatformAdminById(data.ownerId);
    }

    if (!userRecord && !platformAdminRecord) {
      throw new AppError('Owner ID does not reference an existing User or PlatformAdmin', httpStatus.NOT_FOUND);
    }

    let resolvedOwner: OwnerInfo;

    const gamingCenter = await gamingCenterRepository.transaction(async (tx) => {
      // 1. Create the GamingCenter record without the invalid ownerId scalar
      const createdCenter = await gamingCenterRepository.create(data, tx);

      if (userRecord) {
        // Validation & Reassignment check
        // Check if user already belongs to another GamingCenter
        const isAssignedToOtherCenter = Boolean(userRecord.gamingCenterId && userRecord.gamingCenterId !== createdCenter.id);
        if (isAssignedToOtherCenter) {
          // Reassignment requires explicit authorization (Actor must be PLATFORM_ADMIN or superuser)
          const isAuthorizedActor = actor && (actor.actorType === 'PLATFORM_ADMIN' || actor.isSuperuser);
          if (!isAuthorizedActor) {
            throw new AppError(
              'User already belongs to another GamingCenter. Explicit administrative authorization required for reassignment.',
              httpStatus.FORBIDDEN
            );
          }
        }

        // Do not silently change an ADMIN role to MANAGER
        const targetRole = userRecord.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.MANAGER;

        await gamingCenterRepository.updateUserGamingCenter(
          userRecord.id,
          createdCenter.id,
          {
            role: targetRole,
            isActive: true,
          },
          tx
        );

        resolvedOwner = {
          id: userRecord.id,
          fullName: userRecord.fullName,
          role: targetRole,
          type: 'USER',
        };
      } else {
        // PlatformAdmin ownership path:
        // PlatformAdmin is a system-level identity and is NOT converted into a regular user.
        // Associate or provision a dedicated MANAGER User for the new GamingCenter if not already existing.
        const admin = platformAdminRecord!;

        const existingCenterManager = await tx.user.findFirst({
          where: {
            gamingCenterId: createdCenter.id,
            phone: admin.phone,
          },
        });

        if (!existingCenterManager) {
          await gamingCenterRepository.createUser(
            {
              gamingCenterId: createdCenter.id,
              fullName: admin.fullName,
              phone: admin.phone,
              email: admin.email || null,
              passwordHash: admin.passwordHash,
              role: UserRole.MANAGER,
              isActive: true,
              isStaff: true,
              isSuperuser: false,
            },
            tx
          );
        }

        resolvedOwner = {
          id: admin.id,
          fullName: admin.fullName,
          role: 'PLATFORM_ADMIN',
          type: 'PLATFORM_ADMIN',
        };
      }

      return createdCenter;
    });

    // Invalidate actor cache if user was updated/reassigned
    if (userRecord) {
      await invalidateActorCache(userRecord.id, 'USER');
    }

    if (actor) {
      await auditService.log(
        gamingCenter.id,
        actor,
        'SALON_CREATE',
        { name: 'GamingCenter', id: gamingCenter.id },
        {
          old: null,
          new: {
            ...gamingCenter,
            owner: resolvedOwner!,
          },
        },
        context
      );
    }

    return {
      ...gamingCenter,
      owner: resolvedOwner!,
    };
  },

  async getGamingCenterById(id: string, options?: GetGamingCenterDetailsQuery) {
    const gamingCenter = await gamingCenterRepository.findById(id, options);
    if (!gamingCenter) {
      throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
    }
    return gamingCenter;
  },

  async getAllGamingCenters(query: ListGamingCentersQuery) {
    return gamingCenterRepository.findAll(query);
  },

  async updateGamingCenter(
    id: string,
    data: UpdateGamingCenterInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const gamingCenter = await gamingCenterRepository.findById(id);
    if (!gamingCenter) {
      throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
    }

    if (data.slug && data.slug !== gamingCenter.slug) {
      const existingGamingCenter = await gamingCenterRepository.findBySlug(data.slug);
      if (existingGamingCenter) {
        throw new AppError('A gamingCenter with this slug already exists', httpStatus.CONFLICT);
      }
    }

    const updatedGamingCenter = await gamingCenterRepository.update(id, data);

    await auditService.log(
      id,
      actor,
      'SALON_UPDATE',
      { name: 'GamingCenter', id },
      { old: gamingCenter, new: updatedGamingCenter },
      context
    );

    return updatedGamingCenter;
  },

  async deleteGamingCenter(
    id: string,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const gamingCenter = await gamingCenterRepository.findById(id);
    if (!gamingCenter) {
      throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
    }
    const result = await gamingCenterRepository.softDelete(id);

    await auditService.log(
      id,
      actor,
      'SALON_DELETE',
      { name: 'GamingCenter', id },
      { old: gamingCenter, new: result },
      context
    );

    return result;
  },
};
