import { NextFunction, Request, Response } from 'express';
import * as stationLogic from './stations.station';
import { CreateServiceInput, UpdateServiceInput } from './stations.types';
import { listServicesSchema } from './stations.validators';
import { GamingCenter } from '@prisma/client';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

// Local type extension for Request
interface RequestWithGamingCenter extends Request {
  gamingCenter?: GamingCenter;
}

/**
 * Handle request to create a new station.
 */
export async function createStation(
  req: Request<{ gamingCenterId: string }, unknown, CreateServiceInput>,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId } = req.params;
    const newService = await stationLogic.createStation(gamingCenterId, req.body);
    res.created(newService);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle request to get all stations for a gamingCenter.
 */
export async function getServices(
  req: RequestWithGamingCenter,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId } = req.params;

    const targetGamingCenterId = gamingCenterId || req.gamingCenter?.id;
    if (!targetGamingCenterId) {
      return next(new AppError('GamingCenter ID or slug is required.', httpStatus.BAD_REQUEST));
    }

    const validatedQuery = listServicesSchema.parse(req.query);

    const stations = await stationLogic.getStationsForGamingCenter(
      targetGamingCenterId,
      validatedQuery
    );
    res.ok(stations);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle request to get a single station by its ID.
 */
export async function getStationById(
  req: Request<{ gamingCenterId: string; stationId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId, stationId } = req.params;
    const station = await stationLogic.getStationById(stationId, gamingCenterId);
    res.ok(station);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle request to update a station.
 */
export async function updateStation(
  req: Request<{ gamingCenterId: string; stationId: string }, unknown, UpdateServiceInput>,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId, stationId } = req.params;
    const updatedService = await stationLogic.updateStation(
      stationId,
      gamingCenterId,
      req.body,
      (req as any).actor, // eslint-disable-line @typescript-eslint/no-explicit-any
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.ok(updatedService);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle request to delete (deactivate) a station.
 */
export async function deleteService(
  req: Request<{ gamingCenterId: string; stationId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId, stationId } = req.params;
    await stationLogic.deactivateStation(
      stationId,
      gamingCenterId,
      (req as any).actor, // eslint-disable-line @typescript-eslint/no-explicit-any
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.noContent();
  } catch (error) {
    next(error);
  }
}
