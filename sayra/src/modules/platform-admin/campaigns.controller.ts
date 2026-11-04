import { Response, NextFunction } from 'express';
import { AppRequest } from '../../types/express';
import {
  createPlatformCampaignSchema,
  listPlatformCampaignsQuerySchema,
  updatePlatformCampaignSchema,
} from './campaigns.validators';
import { PlatformCampaignsStation } from './campaigns.station';

export const PlatformCampaignsController = {
  async listCampaigns(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const query = listPlatformCampaignsQuerySchema.parse(req.query);
      const result = await PlatformCampaignsStation.listCampaigns(query);
      res.ok(result.items, {
        pagination: {
          page: result.pagination.page,
          pageSize: result.pagination.limit,
          totalItems: result.pagination.totalItems,
          totalPages: result.pagination.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async createCampaign(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const validated = createPlatformCampaignSchema.parse(req).body;
      const result = await PlatformCampaignsStation.createCampaign(
        validated,
        req.actor,
        { ip: req.ip, userAgent: req.headers['user-agent'] as string }
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async updateCampaign(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = updatePlatformCampaignSchema.parse(req).params;
      const validated = updatePlatformCampaignSchema.parse(req).body;
      const result = await PlatformCampaignsStation.updateCampaign(
        id,
        validated,
        req.actor,
        { ip: req.ip, userAgent: req.headers['user-agent'] as string }
      );
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async deleteCampaign(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await PlatformCampaignsStation.deleteCampaign(
        id,
        req.actor,
        { ip: req.ip, userAgent: req.headers['user-agent'] as string }
      );
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },
};
