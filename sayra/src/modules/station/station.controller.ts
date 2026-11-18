import { NextFunction, Request, Response } from 'express';
import * as stationLogic from './station.station';
import * as extraControllerService from './extra-controller.service';
import {
  CreateStationInput,
  UpdateStationInput,
  CreateStationsFromCatalogInput,
  AddGamesFromCatalogInput,
} from './station.types';
import { listStationsSchema } from './station.validator';
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
  req: Request<{ gamingCenterId: string }, unknown, CreateStationInput>,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId } = req.params;
    const newStation = await stationLogic.createStation(gamingCenterId, req.body);
    res.created(newStation);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle request to create multiple stations from a catalog device.
 */
export async function createStationsFromCatalog(
  req: Request<{ gamingCenterId: string }, unknown, CreateStationsFromCatalogInput>,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId } = req.params;
    const stations = await stationLogic.createStationsFromCatalog(
      gamingCenterId,
      req.body,
      (req as any).actor, // eslint-disable-line @typescript-eslint/no-explicit-any
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.created(stations);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle request to add games from catalog to gaming center.
 */
export async function addGamesFromCatalog(
  req: Request<{ gamingCenterId: string }, unknown, AddGamesFromCatalogInput>,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId } = req.params;
    const result = await stationLogic.addGamesFromCatalog(
      gamingCenterId,
      req.body,
      (req as any).actor, // eslint-disable-line @typescript-eslint/no-explicit-any
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.ok(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle request to get games selected by a gaming center (enriched with catalog metadata).
 */
export async function getGamingCenterGames(
  req: RequestWithGamingCenter,
  res: Response,
  next: NextFunction
) {
  try {
    const targetGamingCenterId =
      req.tenant?.gamingCenterId ||
      req.params.gamingCenterId ||
      req.gamingCenter?.id ||
      req.gamingCenterId;

    if (!targetGamingCenterId) {
      return next(new AppError('GamingCenter ID or slug is required.', httpStatus.BAD_REQUEST));
    }

    const games = await stationLogic.getGamesForGamingCenter(targetGamingCenterId);
    res.ok(games);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle request to remove a game from a gaming center's games list.
 */
export async function removeGameFromGamingCenter(
  req: Request<{ gamingCenterId: string; gameId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId, gameId } = req.params;
    const result = await stationLogic.removeGameFromGamingCenter(
      gamingCenterId,
      gameId,
      (req as any).actor, // eslint-disable-line @typescript-eslint/no-explicit-any
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.ok(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle request to get all stations for a gamingCenter.
 */
export async function getStations(
  req: RequestWithGamingCenter,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId } = req.params;

    const targetGamingCenterId =
      req.tenant?.gamingCenterId ||
      gamingCenterId ||
      req.gamingCenter?.id ||
      req.gamingCenterId;

    if (!targetGamingCenterId) {
      return next(new AppError('GamingCenter ID or slug is required.', httpStatus.BAD_REQUEST));
    }

    const validatedQuery = listStationsSchema.parse(req.query);

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
/**
 * Handle request to get device categories for a gamingCenter.
 */
export async function getDeviceCategories(
  req: RequestWithGamingCenter,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId } = req.params;

    const targetGamingCenterId =
      req.tenant?.gamingCenterId ||
      gamingCenterId ||
      req.gamingCenter?.id ||
      req.gamingCenterId;

    if (!targetGamingCenterId) {
      return next(new AppError('GamingCenter ID or slug is required.', httpStatus.BAD_REQUEST));
    }

    const categories = await stationLogic.getDeviceCategoriesForGamingCenter(
      targetGamingCenterId
    );
    res.ok(categories);
  } catch (error) {
    next(error);
  }
}

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
  req: Request<{ gamingCenterId: string; stationId: string }, unknown, UpdateStationInput>,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId, stationId } = req.params;
    const updatedStation = await stationLogic.updateStation(
      stationId,
      gamingCenterId,
      req.body,
      (req as any).actor, // eslint-disable-line @typescript-eslint/no-explicit-any
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    res.ok(updatedStation);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle request to delete (deactivate) a station.
 */
export async function deleteStation(
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

export async function getExtraControllers(
  req: Request<{ gamingCenterId: string; stationId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId, stationId } = req.params;
    const supported = await extraControllerService.isExtraControllerSupportedForStation(stationId);
    const items = await extraControllerService.getStationExtraControllers(stationId, { gamingCenterId });
    res.ok({ extraControllerEnabled: supported, extraControllers: items });
  } catch (error) {
    next(error);
  }
}

export async function getPublicExtraControllers(
  req: RequestWithGamingCenter,
  res: Response,
  next: NextFunction
) {
  try {
    const { stationId } = req.params;
    const targetGamingCenterId = req.tenant?.gamingCenterId || req.gamingCenter?.id || req.gamingCenterId;
    const startTime = typeof req.query.startTime === 'string' ? new Date(req.query.startTime) : undefined;
    const endTime = typeof req.query.endTime === 'string' ? new Date(req.query.endTime) : undefined;

    const items = await extraControllerService.getStationExtraControllers(stationId, {
      gamingCenterId: targetGamingCenterId,
      startTime,
      endTime,
      activeOnly: true,
    });
    res.ok(items);
  } catch (error) {
    next(error);
  }
}

export async function replaceExtraControllers(
  req: Request<{ gamingCenterId: string; stationId: string }, unknown, { extraControllers: extraControllerService.ExtraControllerConfigInput[] }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId, stationId } = req.params;
    const items = await extraControllerService.replaceStationExtraControllers(
      stationId,
      gamingCenterId,
      req.body.extraControllers
    );
    res.ok(items);
  } catch (error) {
    next(error);
  }
}

export async function addExtraController(
  req: Request<{ gamingCenterId: string; stationId: string }, unknown, extraControllerService.ExtraControllerConfigInput>,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId, stationId } = req.params;
    const created = await extraControllerService.addStationExtraController(stationId, gamingCenterId, req.body);
    res.created(created);
  } catch (error) {
    next(error);
  }
}

export async function updateExtraController(
  req: Request<
    { gamingCenterId: string; stationId: string; extraControllerId: string },
    unknown,
    Partial<extraControllerService.ExtraControllerConfigInput>
  >,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId, stationId, extraControllerId } = req.params;
    const updated = await extraControllerService.updateStationExtraController(
      stationId,
      gamingCenterId,
      extraControllerId,
      req.body
    );
    res.ok(updated);
  } catch (error) {
    next(error);
  }
}

export async function deleteExtraController(
  req: Request<{ gamingCenterId: string; stationId: string; extraControllerId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { gamingCenterId, stationId, extraControllerId } = req.params;
    await extraControllerService.deleteStationExtraController(stationId, gamingCenterId, extraControllerId);
    res.noContent();
  } catch (error) {
    next(error);
  }
}
