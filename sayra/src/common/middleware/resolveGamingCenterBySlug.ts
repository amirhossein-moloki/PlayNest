import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';
import { prisma } from '../../config/prisma';

/**
 * Middleware to resolve a gamingCenter from a public slug and attach its tenant
 * context to the request. This is used for public-facing routes.
 *
 * It attaches a `tenant` object to the request:
 * `req.tenant = { gamingCenterId: string, gamingCenterSlug: string }`
 *
 * @throws {HttpError} 404 - If the gamingCenter with the given slug is not found.
 */
export const resolveGamingCenterBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { gamingCenterSlug } = req.params;

  if (!gamingCenterSlug) {
    // This indicates a routing configuration error.
    return next(new AppError('GamingCenter slug is missing from the request params.', httpStatus.BAD_REQUEST));
  }

  let gamingCenter = await prisma.gamingCenter.findUnique({
    where: { slug: gamingCenterSlug, isActive: true },
  });

  if (!gamingCenter) {
    gamingCenter = await prisma.gamingCenter.findFirst({
      where: {
        OR: [
          { slug: { equals: gamingCenterSlug, mode: 'insensitive' } },
          { id: gamingCenterSlug },
        ],
        isActive: true,
      },
    });
  }

  if (!gamingCenter) {
    return next(new AppError('GamingCenter not found', httpStatus.NOT_FOUND, { code: 'NOT_FOUND' }));
  }

  // Attach a standardized tenant context to the request.
  req.tenant = { gamingCenterId: gamingCenter.id, gamingCenterSlug: gamingCenter.slug };
  req.gamingCenterId = gamingCenter.id;

  next();
};
