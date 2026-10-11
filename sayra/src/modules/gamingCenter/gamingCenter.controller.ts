import { Request, Response, NextFunction } from 'express';
import { gamingCenterStation } from './gamingCenter.station';
import { createGamingCenterSchema, updateGamingCenterSchema, listGamingCentersSchema } from './gamingCenter.validation';

export const gamingCenterController = {
  async createGamingCenter(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = createGamingCenterSchema.parse(req.body);
      const gamingCenter = await gamingCenterStation.createGamingCenter(
        validatedData,
        req.actor!,
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );
      res.created(gamingCenter);
    } catch (error) {
      next(error);
    }
  },

  async getGamingCenterById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const gamingCenter = await gamingCenterStation.getGamingCenterById(id);
      res.ok(gamingCenter);
    } catch (error) {
      next(error);
    }
  },

  async getAllGamingCenters(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedQuery = listGamingCentersSchema.parse(req.query);
      const gamingCenters = await gamingCenterStation.getAllGamingCenters(validatedQuery);
      res.ok(gamingCenters);
    } catch (error) {
      next(error);
    }
  },

  async updateGamingCenter(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validatedData = updateGamingCenterSchema.parse(req.body);
      const updatedGamingCenter = await gamingCenterStation.updateGamingCenter(
        id,
        validatedData,
        req.actor!,
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );
      res.ok(updatedGamingCenter);
    } catch (error) {
      next(error);
    }
  },

  async deleteGamingCenter(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await gamingCenterStation.deleteGamingCenter(
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
