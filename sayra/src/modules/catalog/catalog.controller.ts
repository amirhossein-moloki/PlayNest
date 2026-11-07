import { NextFunction, Request, Response } from 'express';
import * as CatalogStation from './catalog.station';
import {
  CreateDeviceCatalogInput,
  UpdateDeviceCatalogInput,
  CreateGameCatalogInput,
  UpdateGameCatalogInput,
  listDeviceCatalogSchema,
  listGameCatalogSchema,
} from './catalog.validator';

// ==========================================
// Device Catalog Controllers
// ==========================================

import * as uploadStation from '../../common/stations/upload.station';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';

export async function createDevice(
  req: Request<unknown, unknown, CreateDeviceCatalogInput>,
  res: Response,
  next: NextFunction
) {
  try {
    let coverImageUrl = req.body.coverImageUrl;
    if (req.file) {
      const stored = await uploadStation.processAndStoreImage(req.file);
      coverImageUrl = stored.url;
    }

    if (!coverImageUrl) {
      throw new AppError('Cover image is required either as file or coverImageUrl', httpStatus.BAD_REQUEST);
    }

    const device = await CatalogStation.createDevice({
      ...req.body,
      coverImageUrl,
    });
    res.created(device);
  } catch (error) {
    next(error);
  }
}

export async function getDevices(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listDeviceCatalogSchema.parse(req.query);
    const result = await CatalogStation.getDevices(query);
    res.ok(result);
  } catch (error) {
    next(error);
  }
}

export async function getDeviceById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const device = await CatalogStation.getDeviceById(req.params.id);
    res.ok(device);
  } catch (error) {
    next(error);
  }
}

export async function updateDevice(
  req: Request<{ id: string }, unknown, UpdateDeviceCatalogInput>,
  res: Response,
  next: NextFunction
) {
  try {
    let coverImageUrl = req.body.coverImageUrl;
    if (req.file) {
      const stored = await uploadStation.processAndStoreImage(req.file);
      coverImageUrl = stored.url;
    }

    const updated = await CatalogStation.updateDevice(req.params.id, {
      ...req.body,
      ...(coverImageUrl ? { coverImageUrl } : {}),
    });
    res.ok(updated);
  } catch (error) {
    next(error);
  }
}

export async function deleteDevice(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    await CatalogStation.deleteDevice(req.params.id);
    res.noContent();
  } catch (error) {
    next(error);
  }
}

// ==========================================
// Game Catalog Controllers
// ==========================================

export async function createGame(
  req: Request<unknown, unknown, CreateGameCatalogInput>,
  res: Response,
  next: NextFunction
) {
  try {
    let coverImageUrl = req.body.coverImageUrl;
    if (req.file) {
      const stored = await uploadStation.processAndStoreImage(req.file);
      coverImageUrl = stored.url;
    }

    if (!coverImageUrl) {
      throw new AppError('Cover image is required either as file or coverImageUrl', httpStatus.BAD_REQUEST);
    }

    const game = await CatalogStation.createGame({
      ...req.body,
      coverImageUrl,
    });
    res.created(game);
  } catch (error) {
    next(error);
  }
}

export async function getGames(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listGameCatalogSchema.parse(req.query);
    const result = await CatalogStation.getGames(query);
    res.ok(result);
  } catch (error) {
    next(error);
  }
}

export async function getGameById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const game = await CatalogStation.getGameById(req.params.id);
    res.ok(game);
  } catch (error) {
    next(error);
  }
}

export async function updateGame(
  req: Request<{ id: string }, unknown, UpdateGameCatalogInput>,
  res: Response,
  next: NextFunction
) {
  try {
    let coverImageUrl = req.body.coverImageUrl;
    if (req.file) {
      const stored = await uploadStation.processAndStoreImage(req.file);
      coverImageUrl = stored.url;
    }

    const updated = await CatalogStation.updateGame(req.params.id, {
      ...req.body,
      ...(coverImageUrl ? { coverImageUrl } : {}),
    });
    res.ok(updated);
  } catch (error) {
    next(error);
  }
}

export async function deleteGame(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    await CatalogStation.deleteGame(req.params.id);
    res.noContent();
  } catch (error) {
    next(error);
  }
}
