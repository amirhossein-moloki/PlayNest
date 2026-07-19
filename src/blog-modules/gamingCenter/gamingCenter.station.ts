import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { gamingCenterRepository } from './gamingCenter.repository';
import { CreateGamingCenterInput, UpdateGamingCenterInput } from './gamingCenter.types';
import { ListGamingCentersQuery } from './gamingCenter.validation';
import { SessionActorType } from '@prisma/client';
import { auditService } from '../audit/audit.station';

export const gamingCenterStation = {
  async createGamingCenter(data: CreateGamingCenterInput, actor?: { id: string; actorType: SessionActorType }, context?: { ip?: string; userAgent?: string }) {
    const existingGamingCenter = await gamingCenterRepository.findBySlug(data.slug);
    if (existingGamingCenter) {
      throw new AppError('A gamingCenter with this slug already exists', httpStatus.CONFLICT);
    }
    const gamingCenter = await gamingCenterRepository.create(data);

    if (actor) {
      await auditService.log(
        gamingCenter.id,
        actor,
        'SALON_CREATE',
        { name: 'GamingCenter', id: gamingCenter.id },
        { old: null, new: gamingCenter },
        context
      );
    }

    return gamingCenter;
  },

  async getGamingCenterById(id: string) {
    const gamingCenter = await gamingCenterRepository.findById(id);
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
