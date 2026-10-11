import { SocialLink } from '@prisma/client';
import { LinksRepo } from './links.repo';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export const LinksStation = {
  async getLinks(gamingCenterId: string): Promise<SocialLink[]> {
    return LinksRepo.findByGamingCenterId(gamingCenterId);
  },

  async createLink(gamingCenterId: string, data: Record<string, unknown>): Promise<SocialLink> {
    return LinksRepo.create(gamingCenterId, data);
  },

  async updateLink(gamingCenterId: string, linkId: string, data: Record<string, unknown>): Promise<SocialLink> {
    const link = await LinksRepo.findById(linkId);
    if (!link || link.gamingCenterId !== gamingCenterId) {
      throw new AppError('Link not found', httpStatus.NOT_FOUND);
    }
    const result = await LinksRepo.update(linkId, gamingCenterId, data);
    if (!result) {
      throw new AppError('Link not found', httpStatus.NOT_FOUND);
    }
    return result;
  },

  async deleteLink(gamingCenterId: string, linkId: string): Promise<void> {
    const success = await LinksRepo.delete(linkId, gamingCenterId);
    if (!success) {
      throw new AppError('Link not found', httpStatus.NOT_FOUND);
    }
  },
};
