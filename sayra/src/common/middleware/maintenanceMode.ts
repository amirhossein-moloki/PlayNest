import { Request, Response, NextFunction } from 'express';
import { PlatformSettingsRepo } from '../../modules/platform-admin/settings.station';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';

export const maintenanceModeMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const path = req.originalUrl || req.url;

    // Allow internal platform admin, health, docs, and authentication routes
    if (
      path.startsWith('/health') ||
      path.startsWith('/openapi') ||
      path.startsWith('/api-docs') ||
      path.startsWith('/swagger') ||
      path.startsWith('/docs') ||
      path.startsWith('/api/v1/health') ||
      path.startsWith('/api/v1/auth/platform-admin') ||
      path.startsWith('/api/v1/platform-admin') ||
      path.startsWith('/platform-admin')
    ) {
      return next();
    }

    // Check if actor is already authenticated as PLATFORM_ADMIN
    const actor = (req as { actor?: { actorType?: string; isSuperuser?: boolean } }).actor;
    if (actor && (actor.actorType === 'PLATFORM_ADMIN' || actor.isSuperuser)) {
      return next();
    }

    const settings = await PlatformSettingsRepo.getSettings();
    if (settings && settings.maintenanceMode) {
      return next(
        new AppError(
          settings.maintenanceMessage || 'Platform is currently undergoing maintenance.',
          httpStatus.SERVICE_UNAVAILABLE,
          { code: 'MAINTENANCE_MODE' }
        )
      );
    }

    return next();
  } catch {
    // If settings check fails or table not yet initialized, don't block request
    return next();
  }
};
