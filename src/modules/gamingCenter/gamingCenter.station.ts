import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { salonRepository } from './gamingCenter.repository';
import { CreateSalonInput, UpdateSalonInput } from './gamingCenter.types';
import { ListSalonsQuery } from './gamingCenter.validation';
import { SessionActorType } from '@prisma/client';
import { auditService } from '../audit/audit.station';

export const gamingCenterService = {
  async createSalon(data: CreateSalonInput, actor?: { id: string; actorType: SessionActorType }, context?: { ip?: string; userAgent?: string }) {
    const existingSalon = await salonRepository.findBySlug(data.slug);
    if (existingSalon) {
      throw new AppError('A gamingCenter with this slug already exists', httpStatus.CONFLICT);
    }
    const gamingCenter = await salonRepository.create(data);

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

  async getSalonById(id: string) {
    const gamingCenter = await salonRepository.findById(id);
    if (!gamingCenter) {
      throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
    }
    return gamingCenter;
  },

  async getAllSalons(query: ListSalonsQuery) {
    return salonRepository.findAll(query);
  },

  async updateSalon(
    id: string,
    data: UpdateSalonInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const gamingCenter = await salonRepository.findById(id);
    if (!gamingCenter) {
      throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
    }

    if (data.slug && data.slug !== gamingCenter.slug) {
      const existingSalon = await salonRepository.findBySlug(data.slug);
      if (existingSalon) {
        throw new AppError('A gamingCenter with this slug already exists', httpStatus.CONFLICT);
      }
    }

    const updatedSalon = await salonRepository.update(id, data);

    await auditService.log(
      id,
      actor,
      'SALON_UPDATE',
      { name: 'GamingCenter', id },
      { old: gamingCenter, new: updatedSalon },
      context
    );

    return updatedSalon;
  },

  async deleteSalon(
    id: string,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const gamingCenter = await salonRepository.findById(id);
    if (!gamingCenter) {
      throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
    }
    const result = await salonRepository.softDelete(id);

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
