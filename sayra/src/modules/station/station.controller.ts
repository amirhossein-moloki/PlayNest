import { NextFunction, Request, Response } from 'express';
import * as stationLogic from './station.station';
import * as extraControllerService from './extra-controller.service';
import {
  CreateStationInput,
  UpdateStationInput,
  CreateStationsFromCatalogInput,
  AddGamesFromCatalogInput,
  UpdateGamingCenterGameInput,
} from './station.types';
import { listStationsSchema, listGamingCenterGamesQuerySchema } from './station.validator';
import { GamingCenter } from '@prisma/client';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { invalidatePublicCacheByPrefix } from '../../common/utils/publicCache';

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
    const targetGamingCenterId =
      req.params.gamingCenterId ||
      req.tenant?.gamingCenterId ||
      (req as any).gamingCenter?.id ||
      req.gamingCenterId;
    const newStation = await stationLogic.createStation(targetGamingCenterId, req.body);
    void invalidatePublicCacheByPrefix('public:gc:');
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
    const targetGamingCenterId =
      req.params.gamingCenterId ||
      req.tenant?.gamingCenterId ||
      (req as any).gamingCenter?.id ||
      req.gamingCenterId;
    const stations = await stationLogic.createStationsFromCatalog(
      targetGamingCenterId,
      req.body,
      (req as any).actor, // eslint-disable-line @typescript-eslint/no-explicit-any
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    void invalidatePublicCacheByPrefix('public:gc:');
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
    const targetGamingCenterId =
      req.params.gamingCenterId ||
      req.tenant?.gamingCenterId ||
      (req as any).gamingCenter?.id ||
      req.gamingCenterId;
    const result = await stationLogic.addGamesFromCatalog(
      targetGamingCenterId,
      req.body,
      (req as any).actor, // eslint-disable-line @typescript-eslint/no-explicit-any
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    void invalidatePublicCacheByPrefix('public:gc:');
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
      (req as any).gamingCenter?.id ||
      req.gamingCenterId;

    if (!targetGamingCenterId) {
      return next(new AppError('GamingCenter ID or slug is required.', httpStatus.BAD_REQUEST));
    }

    const { playMode } = listGamingCenterGamesQuerySchema.parse(req.query);
    const games = await stationLogic.getGamesForGamingCenter(
      targetGamingCenterId,
      playMode ? { playMode } : undefined
    );
    res.ok(games);
  } catch (error) {
    next(error);
  }
}

/**
 * Handle request to update play mode (OFFLINE / ONLINE) of a game in a gaming center.
 */
export async function updateGamingCenterGameMode(
  req: Request<{ gamingCenterId: string; gameId: string }, unknown, UpdateGamingCenterGameInput>,
  res: Response,
  next: NextFunction
) {
  try {
    const targetGamingCenterId =
      req.params.gamingCenterId ||
      req.tenant?.gamingCenterId ||
      (req as unknown as RequestWithGamingCenter).gamingCenter?.id ||
      req.gamingCenterId;
    const { gameId } = req.params;
    const result = await stationLogic.updateGamingCenterGameMode(
      targetGamingCenterId,
      gameId,
      req.body.playMode,
      (req as any).actor, // eslint-disable-line @typescript-eslint/no-explicit-any
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    void invalidatePublicCacheByPrefix('public:gc:');
    res.ok(result);
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
    const targetGamingCenterId =
      req.params.gamingCenterId ||
      req.tenant?.gamingCenterId ||
      (req as any).gamingCenter?.id ||
      req.gamingCenterId;
    const { gameId } = req.params;
    const result = await stationLogic.removeGameFromGamingCenter(
      targetGamingCenterId,
      gameId,
      (req as any).actor, // eslint-disable-line @typescript-eslint/no-explicit-any
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    void invalidatePublicCacheByPrefix('public:gc:');
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
      (req as any).gamingCenter?.id ||
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
      (req as any).gamingCenter?.id ||
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
    const { stationId } = req.params;
    const targetGamingCenterId =
      req.params.gamingCenterId ||
      req.tenant?.gamingCenterId ||
      (req as any).gamingCenter?.id ||
      req.gamingCenterId;
    const station = await stationLogic.getStationById(stationId, targetGamingCenterId);
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
    const { stationId } = req.params;
    const targetGamingCenterId =
      req.params.gamingCenterId ||
      req.tenant?.gamingCenterId ||
      (req as any).gamingCenter?.id ||
      req.gamingCenterId;
    const updatedStation = await stationLogic.updateStation(
      stationId,
      targetGamingCenterId,
      req.body,
      (req as any).actor, // eslint-disable-line @typescript-eslint/no-explicit-any
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    void invalidatePublicCacheByPrefix('public:gc:');
    void invalidatePublicCacheByPrefix(`public:avail:${targetGamingCenterId}:`);
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
    const { stationId } = req.params;
    const targetGamingCenterId =
      req.params.gamingCenterId ||
      req.tenant?.gamingCenterId ||
      (req as any).gamingCenter?.id ||
      req.gamingCenterId;
    await stationLogic.deactivateStation(
      stationId,
      targetGamingCenterId,
      (req as any).actor, // eslint-disable-line @typescript-eslint/no-explicit-any
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );
    void invalidatePublicCacheByPrefix('public:gc:');
    void invalidatePublicCacheByPrefix(`public:avail:${targetGamingCenterId}:`);
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
    const { stationId } = req.params;
    const targetGamingCenterId =
      req.params.gamingCenterId ||
      req.tenant?.gamingCenterId ||
      (req as any).gamingCenter?.id ||
      req.gamingCenterId;
    const supported = await extraControllerService.isExtraControllerSupportedForStation(stationId);
    const items = await extraControllerService.getStationExtraControllers(stationId, {
      gamingCenterId: targetGamingCenterId,
    });
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
    const { stationId } = req.params;
    const targetGamingCenterId =
      req.params.gamingCenterId ||
      req.tenant?.gamingCenterId ||
      (req as any).gamingCenter?.id ||
      req.gamingCenterId;
    const items = await extraControllerService.replaceStationExtraControllers(
      stationId,
      targetGamingCenterId,
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
    const { stationId } = req.params;
    const targetGamingCenterId =
      req.params.gamingCenterId ||
      req.tenant?.gamingCenterId ||
      (req as any).gamingCenter?.id ||
      req.gamingCenterId;
    const created = await extraControllerService.addStationExtraController(
      stationId,
      targetGamingCenterId,
      req.body
    );
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
    const { stationId, extraControllerId } = req.params;
    const targetGamingCenterId =
      req.params.gamingCenterId ||
      req.tenant?.gamingCenterId ||
      (req as any).gamingCenter?.id ||
      req.gamingCenterId;
    const updated = await extraControllerService.updateStationExtraController(
      stationId,
      targetGamingCenterId,
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
    const { stationId, extraControllerId } = req.params;
    const targetGamingCenterId =
      req.params.gamingCenterId ||
      req.tenant?.gamingCenterId ||
      (req as any).gamingCenter?.id ||
      req.gamingCenterId;
    await extraControllerService.deleteStationExtraController(
      stationId,
      targetGamingCenterId,
      extraControllerId
    );
    res.noContent();
  } catch (error) {
    next(error);
  }
}
