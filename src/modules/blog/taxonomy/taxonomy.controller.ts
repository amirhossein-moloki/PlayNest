import { Request, Response, NextFunction } from 'express';
import { taxonomyStation } from './taxonomy.station';
import { createCategorySchema, updateCategorySchema, createTagSchema, updateTagSchema, listTaxonomySchema } from './taxonomy.validation';
import { CreateCategoryInput, CreateTagInput } from './taxonomy.types';

export const taxonomyController = {
  // --- Categories ---
  async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId } = req.params;
      const validatedData = createCategorySchema.parse(req.body);
      const category = await taxonomyStation.createCategory(
        { ...validatedData, gamingCenterId } as CreateCategoryInput,
        req.actor!,
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );
      res.created(category);
    } catch (error) {
      next(error);
    }
  },

  async getAllCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId } = req.params;
      const validatedQuery = listTaxonomySchema.parse(req.query);
      const categories = await taxonomyStation.getAllCategories(gamingCenterId, validatedQuery);
      res.ok(categories);
    } catch (error) {
      next(error);
    }
  },

  async getCategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId, id } = req.params;
      const category = await taxonomyStation.getCategoryById(id, gamingCenterId);
      res.ok(category);
    } catch (error) {
      next(error);
    }
  },

  async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId, id } = req.params;
      const validatedData = updateCategorySchema.parse(req.body);
      const updated = await taxonomyStation.updateCategory(
        id,
        gamingCenterId,
        validatedData,
        req.actor!,
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );
      res.ok(updated);
    } catch (error) {
      next(error);
    }
  },

  async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId, id } = req.params;
      await taxonomyStation.deleteCategory(
        id,
        gamingCenterId,
        req.actor!,
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );
      res.noContent();
    } catch (error) {
      next(error);
    }
  },

  // --- Tags ---
  async createTag(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId } = req.params;
      const validatedData = createTagSchema.parse(req.body);
      const tag = await taxonomyStation.createTag(
        { ...validatedData, gamingCenterId } as CreateTagInput,
        req.actor!,
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );
      res.created(tag);
    } catch (error) {
      next(error);
    }
  },

  async getAllTags(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId } = req.params;
      const validatedQuery = listTaxonomySchema.parse(req.query);
      const tags = await taxonomyStation.getAllTags(gamingCenterId, validatedQuery);
      res.ok(tags);
    } catch (error) {
      next(error);
    }
  },

  async getTagById(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId, id } = req.params;
      const tag = await taxonomyStation.getTagById(id, gamingCenterId);
      res.ok(tag);
    } catch (error) {
      next(error);
    }
  },

  async updateTag(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId, id } = req.params;
      const validatedData = updateTagSchema.parse(req.body);
      const updated = await taxonomyStation.updateTag(
        id,
        gamingCenterId,
        validatedData,
        req.actor!,
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );
      res.ok(updated);
    } catch (error) {
      next(error);
    }
  },

  async deleteTag(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId, id } = req.params;
      await taxonomyStation.deleteTag(
        id,
        gamingCenterId,
        req.actor!,
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );
      res.noContent();
    } catch (error) {
      next(error);
    }
  },
};
