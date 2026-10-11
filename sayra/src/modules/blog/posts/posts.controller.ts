import { Request, Response, NextFunction } from 'express';
import { postsStation } from './posts.station';
import { createPostSchema, updatePostSchema, createSeriesSchema, updateSeriesSchema, listPostsSchema } from './posts.validation';
import { CreatePostInput, CreateSeriesInput } from './posts.types';
import AppError from '../../../common/errors/AppError';
import httpStatus from 'http-status';

export const postsController = {
  // --- Posts ---
  async createPost(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId } = req.params;
      const validatedData = createPostSchema.parse(req.body);
      const post = await postsStation.createPost(
        { ...validatedData, gamingCenterId, authorId: req.actor!.id } as CreatePostInput,
        req.actor!,
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );
      res.created(post);
    } catch (error) {
      next(error);
    }
  },

  async getAllPosts(req: Request, res: Response, next: NextFunction) {
    try {
      const gamingCenterId = req.gamingCenterId || req.params.gamingCenterId;
      const validatedQuery = listPostsSchema.parse(req.query);

      // For public requests, we force page status to be PUBLISHED
      if (!req.actor) {
        validatedQuery.status = 'PUBLISHED';
      }

      const posts = await postsStation.getAllPosts(gamingCenterId, validatedQuery);
      res.ok(posts);
    } catch (error) {
      next(error);
    }
  },

  async getPostById(req: Request, res: Response, next: NextFunction) {
    try {
      const gamingCenterId = req.gamingCenterId || req.params.gamingCenterId;
      const { id } = req.params;
      const post = await postsStation.getPostById(id, gamingCenterId);

      // Public users can only view published posts
      if (!req.actor && post.status !== 'PUBLISHED') {
        throw new AppError('Post not found', httpStatus.NOT_FOUND);
      }

      res.ok(post);
    } catch (error) {
      next(error);
    }
  },

  async updatePost(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId, id } = req.params;
      const validatedData = updatePostSchema.parse(req.body);
      const updated = await postsStation.updatePost(
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

  async deletePost(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId, id } = req.params;
      await postsStation.deletePost(
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

  // --- Series ---
  async createSeries(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId } = req.params;
      const validatedData = createSeriesSchema.parse(req.body);
      const series = await postsStation.createSeries(
        { ...validatedData, gamingCenterId } as CreateSeriesInput,
        req.actor!,
        { ip: req.ip, userAgent: req.headers['user-agent'] }
      );
      res.created(series);
    } catch (error) {
      next(error);
    }
  },

  async getAllSeries(req: Request, res: Response, next: NextFunction) {
    try {
      const gamingCenterId = req.gamingCenterId || req.params.gamingCenterId;
      const series = await postsStation.getAllSeries(gamingCenterId);
      res.ok(series);
    } catch (error) {
      next(error);
    }
  },

  async getSeriesById(req: Request, res: Response, next: NextFunction) {
    try {
      const gamingCenterId = req.gamingCenterId || req.params.gamingCenterId;
      const { id } = req.params;
      const series = await postsStation.getSeriesById(id, gamingCenterId);
      res.ok(series);
    } catch (error) {
      next(error);
    }
  },

  async updateSeries(req: Request, res: Response, next: NextFunction) {
    try {
      const { gamingCenterId, id } = req.params;
      const validatedData = updateSeriesSchema.parse(req.body);
      const updated = await postsStation.updateSeries(
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
};
