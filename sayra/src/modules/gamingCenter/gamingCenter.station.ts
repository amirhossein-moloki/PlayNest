import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { prisma } from '../../config/prisma';
import { gamingCenterRepository } from './gamingCenter.repository';
import { CreateGamingCenterInput, UpdateGamingCenterInput } from './gamingCenter.types';
import { ListGamingCentersQuery, GetGamingCenterDetailsQuery } from './gamingCenter.validation';
import { SessionActorType, UserRole, NotificationType } from '@prisma/client';
import { auditService } from '../audit/audit.station';
import { invalidateActorCache } from '../../common/middleware/auth';
import { NotificationStation } from '../notifications/notifications.station';
import { invalidateTenantCache } from '../../common/utils/tenantCache';
import { CommissionsRepo } from '../commissions/commissions.repo';
import { recordGamingCenterChangeEvent } from '../integrations/outbox.service';

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

      // 1b. Provision default CommissionPolicy based on PlatformSetting.platformCommissionPercent
      if (typeof CommissionsRepo?.ensureDefaultPolicyForGamingCenter === 'function') {
        await CommissionsRepo.ensureDefaultPolicyForGamingCenter(createdCenter.id, tx);
      }

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

        // Strict 1-to-1 manager check: ensure this user does not manage any other gaming center
        const existingManagedCenter = await tx.gamingCenter.findUnique({
          where: { managerId: userRecord.id },
        });
        if (existingManagedCenter && existingManagedCenter.id !== createdCenter.id) {
          throw new AppError(
            'This manager is already assigned to another GamingCenter. A manager can only manage one gaming center.',
            httpStatus.CONFLICT
          );
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

        // Link manager to the newly created gaming center (1-to-1 relation)
        await tx.gamingCenter.update({
          where: { id: createdCenter.id },
          data: { managerId: userRecord.id },
        });

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

        let managerUser = await tx.user.findFirst({
          where: {
            gamingCenterId: createdCenter.id,
            phone: admin.phone,
          },
        });

        if (!managerUser) {
          // Check if a user with this phone is already managing another center
          const existingManagerWithPhone = await tx.user.findFirst({
            where: {
              phone: admin.phone,
              managedGamingCenter: { isNot: null },
            },
          });
          if (existingManagerWithPhone) {
            throw new AppError(
              'A manager with this phone number is already managing another GamingCenter.',
              httpStatus.CONFLICT
            );
          }

          managerUser = await gamingCenterRepository.createUser(
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

        // Link manager to the gaming center
        await tx.gamingCenter.update({
          where: { id: createdCenter.id },
          data: { managerId: managerUser.id },
        });

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

    // Notify managers of new GameCenter registration (In-App only)
    NotificationStation.notifyManagers({
      type: NotificationType.NEW_GAME_CENTER_REGISTRATION,
      templateKey: 'NEW_GAME_CENTER_REGISTRATION',
      templateParams: {
        gameCenterName: gamingCenter.name,
      },
      entityType: 'GamingCenter',
      entityId: gamingCenter.id,
    }).catch(console.error);

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

    const currentSlug = typeof gamingCenter.slug === 'string' ? gamingCenter.slug : String(gamingCenter.slug || '');
    if (data.slug && currentSlug && data.slug !== currentSlug) {
      const existingGamingCenter = await gamingCenterRepository.findBySlug(data.slug);
      if (existingGamingCenter) {
        throw new AppError('A gamingCenter with this slug already exists', httpStatus.CONFLICT);
      }
      // Record old slug into history for 308 redirect continuity
      if (typeof prisma.gamingCenterSlugHistory?.upsert === 'function') {
        await Promise.resolve(
          prisma.gamingCenterSlugHistory.upsert({
            where: { slug: currentSlug },
            update: {},
            create: {
              gamingCenterId: id,
              slug: currentSlug,
            },
          })
        ).catch(() => null);
      }
    }

    const updatedGamingCenter = await gamingCenterRepository.update(id, data);

    void invalidateTenantCache(
      id,
      typeof gamingCenter.slug === 'string' ? gamingCenter.slug : undefined,
      updatedGamingCenter.slug
    );

    const changedFields = Object.keys(data);
    void recordGamingCenterChangeEvent({
      gamingCenterId: id,
      gamingCenterSlug: updatedGamingCenter.slug,
      eventType:
        data.isActive !== undefined
          ? 'GAMING_CENTER_STATUS_CHANGED'
          : 'GAMING_CENTER_UPDATED',
      changedFields,
    });

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

    void invalidateTenantCache(
      id,
      typeof gamingCenter.slug === 'string' ? gamingCenter.slug : undefined
    );

    void recordGamingCenterChangeEvent({
      gamingCenterId: id,
      gamingCenterSlug: typeof gamingCenter.slug === 'string' ? gamingCenter.slug : undefined,
      eventType: 'GAMING_CENTER_STATUS_CHANGED',
      changedFields: ['isActive'],
    });

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
