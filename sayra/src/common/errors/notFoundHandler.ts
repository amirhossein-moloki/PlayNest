import type { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import AppError from './AppError';

/**
 * Express catch-all middleware for unmatched routes and unsupported HTTP methods.
 * Forwards a standardized 404 AppError to the global JSON errorHandler.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  const path = (req.originalUrl || req.path || '/').split('?')[0] || '/';

  next(
    new AppError(
      `Route ${req.method} ${path} not found.`,
      httpStatus.NOT_FOUND,
      {
        code: 'ROUTE_NOT_FOUND',
        details: {
          method: req.method,
          path,
        },
      }
    )
  );
}
