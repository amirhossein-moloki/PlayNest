import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { salonRepository } from './gamingCenter.repository';
import { CreateSalonInput, UpdateSalonInput } from './gamingCenter.types';
import { ListSalonsQuery } from './gamingCenter.validation';

export const salonService = {
  async createSalon(data: CreateSalonInput) {
    const existingSalon = await salonRepository.findBySlug(data.slug);
    if (existingSalon) {
      throw new AppError('A gamingCenter with this slug already exists', httpStatus.CONFLICT);
    }
    return salonRepository.create(data);
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

  async updateSalon(id: string, data: UpdateSalonInput) {
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

    return salonRepository.update(id, data);
  },

  async deleteSalon(id: string) {
    const gamingCenter = await salonRepository.findById(id);
    if (!gamingCenter) {
      throw new AppError('GamingCenter not found', httpStatus.NOT_FOUND);
    }
    return salonRepository.softDelete(id);
  },
};
