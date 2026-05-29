import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';

export const validate =
  (schema: ZodSchema<any>) => // eslint-disable-line @typescript-eslint/no-explicit-any
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });

        if (parsed.body) req.body = parsed.body;
        if (parsed.query) req.query = parsed.query;
        if (parsed.params) req.params = parsed.params;

        return next();
      } catch (error) {
        if (error instanceof ZodError) {
          return next(error);
        }
        return next(new AppError('Internal server error', httpStatus.INTERNAL_SERVER_ERROR));
      }
    };
