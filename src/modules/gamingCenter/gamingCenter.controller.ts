import { Request, Response, NextFunction } from 'express';
import { gamingCenterService } from './gamingCenter.station';
import { createSalonSchema, updateSalonSchema, listSalonsSchema } from './gamingCenter.validation';

export const salonController = {
  async createSalon(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = createSalonSchema.parse(req.body);
      const gamingCenter = await gamingCenterService.createSalon(
        validatedData,
        req.actor!,
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );
      res.created(gamingCenter);
    } catch (error) {
      next(error);
    }
  },

  async getSalonById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const gamingCenter = await gamingCenterService.getSalonById(id);
      res.ok(gamingCenter);
    } catch (error) {
      next(error);
    }
  },

  async getAllSalons(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedQuery = listSalonsSchema.parse(req.query);
      const gamingCenters = await gamingCenterService.getAllSalons(validatedQuery);
      res.ok(gamingCenters);
    } catch (error) {
      next(error);
    }
  },

  async updateSalon(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validatedData = updateSalonSchema.parse(req.body);
      const updatedSalon = await gamingCenterService.updateSalon(
        id,
        validatedData,
        req.actor!,
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );
      res.ok(updatedSalon);
    } catch (error) {
      next(error);
    }
  },

  async deleteSalon(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await gamingCenterService.deleteSalon(
        id,
        req.actor!,
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );
      res.noContent();
    } catch (error) {
      next(error);
    }
  },
};
