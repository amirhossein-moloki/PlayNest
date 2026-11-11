import { Response, NextFunction } from 'express';
import { AppRequest } from '../../types/express';
import { PlatformAdRequestsStation } from './ad-requests.station';
import {
  listPlatformAdRequestsQuerySchema,
  updatePlatformAdRequestStatusSchema,
} from './ad-requests.validators';

export const PlatformAdRequestsController = {
  /**
   * GET /platform-admin/ad-requests
   */
  async listAdRequests(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const query = listPlatformAdRequestsQuerySchema.parse(req.query);
      const result = await PlatformAdRequestsStation.listAdRequests({
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        search: query.search,
        status: query.status,
        gamingCenterId: query.gamingCenterId,
        ownerId: query.ownerId,
        city: query.city,
        startDate: query.startDate,
        endDate: query.endDate,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });

      res.ok(result.items, {
        pagination: {
          page: result.pagination.page,
          pageSize: result.pagination.limit,
          total: result.pagination.total,
          totalItems: result.pagination.total,
          totalPages: result.pagination.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /platform-admin/ad-requests/:id
   */
  async getAdRequestById(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await PlatformAdRequestsStation.getAdRequestById(id);
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /platform-admin/ad-requests/:id/status
   */
  async updateAdRequestStatus(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = updatePlatformAdRequestStatusSchema.parse(req);
      const validated = parsed.body as {
        status: 'APPROVED' | 'REJECTED';
        decisionReason?: string;
        adminNote?: string;
        startDate?: string;
        endDate?: string;
        durationDays?: number;
        priority?: number;
      };

      const result = await PlatformAdRequestsStation.updateAdRequestStatus(
        id,
        validated,
        req.actor as { id: string; actorType?: string },
        { ip: req.ip, userAgent: req.headers['user-agent'] as string }
      );
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /platform-admin/ad-requests/:id
   */
  async deleteAdRequest(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await PlatformAdRequestsStation.deleteAdRequest(
        id,
        req.actor as { id: string; actorType?: string },
        { ip: req.ip, userAgent: req.headers['user-agent'] as string }
      );
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },
};
