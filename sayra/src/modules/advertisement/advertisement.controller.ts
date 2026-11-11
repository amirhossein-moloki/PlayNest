import { Response, NextFunction } from 'express';
import { AppRequest } from '../../types/express';
import { AdvertisementStation } from './advertisement.station';
import {
  createAdvertisementSchema,
  CreateAdvertisementInput,
  updateAdvertisementSchema,
  listAdvertisementsQuerySchema,
} from './advertisement.validators';
import * as uploadStation from '../../common/stations/upload.station';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export const AdvertisementController = {
  async create(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId } = req.params;
      const ownerId = (req.actor as { id: string })?.id;
      const validated = createAdvertisementSchema.parse(req.body) as CreateAdvertisementInput;

      const result = await AdvertisementStation.createAdvertisement(gamingCenterId, ownerId, validated);
      res.created(result);
    } catch (err) {
      next(err);
    }
  },

  async list(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId } = req.params;
      const query = listAdvertisementsQuerySchema.parse(req.query);

      const result = await AdvertisementStation.listAdvertisements(gamingCenterId, query);
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

  async getById(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId, id } = req.params;
      const result = await AdvertisementStation.getAdvertisementById(id, gamingCenterId);
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async update(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId, id } = req.params;
      const validated = updateAdvertisementSchema.parse(req.body);

      const result = await AdvertisementStation.updateAdvertisement(id, gamingCenterId, validated);
      res.ok(result);
    } catch (err) {
      next(err);
    }
  },

  async delete(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId, id } = req.params;
      await AdvertisementStation.deleteAdvertisement(id, gamingCenterId);
      res.noContent();
    } catch (err) {
      next(err);
    }
  },

  async uploadBanner(req: AppRequest, res: Response, next: NextFunction) {
    try {
      const file = req.file;
      if (!file) {
        throw new AppError('No banner file uploaded', httpStatus.BAD_REQUEST);
      }

      const { url, thumbUrl } = await uploadStation.processAndStoreImage(file);
      res.ok({
        url,
        thumbUrl,
      });
    } catch (err) {
      next(err);
    }
  },
};
