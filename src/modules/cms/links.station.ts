import { SocialLink } from '@prisma/client';
import { LinksRepo } from './links.repo';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export const LinksService = {
  async getLinks(gamingCenterId: string): Promise<SocialLink[]> {
    return LinksRepo.findBySalonId(gamingCenterId);
  },

  async createLink(gamingCenterId: string, data: any): Promise<SocialLink> {
    return LinksRepo.create(gamingCenterId, data);
  },

  async updateLink(gamingCenterId: string, linkId: string, data: any): Promise<SocialLink> {
    const link = await LinksRepo.findById(linkId);
    if (!link || link.gamingCenterId !== gamingCenterId) {
      throw new AppError('Link not found', httpStatus.NOT_FOUND);
    }
    return LinksRepo.update(linkId, data);
  },

  async deleteLink(gamingCenterId: string, linkId: string): Promise<void> {
    const link = await LinksRepo.findById(linkId);
    if (!link || link.gamingCenterId !== gamingCenterId) {
      throw new AppError('Link not found', httpStatus.NOT_FOUND);
    }
    await LinksRepo.delete(linkId);
  },
};
