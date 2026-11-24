import { NextFunction, Request, Response } from 'express';
import * as CatalogStation from './catalog.station';
import * as uploadStation from '../../common/stations/upload.station';
import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import {
  buildSortedCacheKey,
  invalidateAllPublicDiscoveryCaches,
  setPublicCacheHeaders,
  withPublicCache,
} from '../../common/utils/publicCache';
import {
  CreateDeviceTypeInput,
  UpdateDeviceTypeInput,
  listDeviceTypeSchema,
  CreateDeviceCatalogInput,
  UpdateDeviceCatalogInput,
  CreateGameCatalogInput,
  UpdateGameCatalogInput,
  listDeviceCatalogSchema,
  listGameCatalogSchema,
  ReplaceGameAliasesInput,
  MergeGamesInput,
} from './catalog.validator';

// ==========================================
// Device Type Controllers (Dynamic Device Types)
// ==========================================

export async function createDeviceType(
  req: Request<unknown, unknown, CreateDeviceTypeInput>,
  res: Response,
  next: NextFunction
) {
  try {
    const deviceType = await CatalogStation.createDeviceType(req.body);
    void invalidateAllPublicDiscoveryCaches();
    res.created(deviceType);
  } catch (error) {
    next(error);
  }
}

export async function getDeviceTypes(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listDeviceTypeSchema.parse(req.query);
    if (!req.originalUrl?.includes('/platform-admin')) {
      const cacheKey = buildSortedCacheKey(
        'public:catalog:device-types',
        query as unknown as Record<string, unknown>
      );
      const result = await withPublicCache(cacheKey, 300, () =>
        CatalogStation.getDeviceTypes(query)
      );
      setPublicCacheHeaders(res, 300, 600, 600);
      res.ok(result);
      return;
    }
    const result = await CatalogStation.getDeviceTypes(query);
    res.ok(result);
  } catch (error) {
    next(error);
  }
}

export async function getDeviceTypeById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.originalUrl?.includes('/platform-admin')) {
      const deviceType = await withPublicCache(`public:catalog:device-type:${req.params.id}`, 300, () =>
        CatalogStation.getDeviceTypeById(req.params.id)
      );
      setPublicCacheHeaders(res, 300, 600, 600);
      res.ok(deviceType);
      return;
    }
    const deviceType = await CatalogStation.getDeviceTypeById(req.params.id);
    res.ok(deviceType);
  } catch (error) {
    next(error);
  }
}

export async function updateDeviceType(
  req: Request<{ id: string }, unknown, UpdateDeviceTypeInput>,
  res: Response,
  next: NextFunction
) {
  try {
    const updated = await CatalogStation.updateDeviceType(req.params.id, req.body);
    void invalidateAllPublicDiscoveryCaches();
    res.ok(updated);
  } catch (error) {
    next(error);
  }
}

export async function deleteDeviceType(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    await CatalogStation.deleteDeviceType(req.params.id);
    void invalidateAllPublicDiscoveryCaches();
    res.noContent();
  } catch (error) {
    next(error);
  }
}

// ==========================================
// Device Catalog Controllers
// ==========================================

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
    void invalidateAllPublicDiscoveryCaches();
    res.created(device);
  } catch (error) {
    next(error);
  }
}

export async function getDevices(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listDeviceCatalogSchema.parse(req.query);
    if (!req.originalUrl?.includes('/platform-admin')) {
      const cacheKey = buildSortedCacheKey(
        'public:catalog:devices',
        query as unknown as Record<string, unknown>
      );
      const result = await withPublicCache(cacheKey, 300, () =>
        CatalogStation.getDevices(query)
      );
      setPublicCacheHeaders(res, 300, 600, 600);
      res.ok(result);
      return;
    }
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
    if (!req.originalUrl?.includes('/platform-admin')) {
      const device = await withPublicCache(`public:catalog:device:${req.params.id}`, 300, () =>
        CatalogStation.getDeviceById(req.params.id)
      );
      setPublicCacheHeaders(res, 300, 600, 600);
      res.ok(device);
      return;
    }
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
    void invalidateAllPublicDiscoveryCaches();
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
    void invalidateAllPublicDiscoveryCaches();
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
    void invalidateAllPublicDiscoveryCaches();
    res.created(game);
  } catch (error) {
    next(error);
  }
}

export async function getGames(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listGameCatalogSchema.parse(req.query);
    if (!req.originalUrl?.includes('/platform-admin')) {
      const cacheKey = buildSortedCacheKey(
        'public:catalog:games',
        query as unknown as Record<string, unknown>
      );
      const result = await withPublicCache(cacheKey, 300, () =>
        CatalogStation.getGames(query)
      );
      setPublicCacheHeaders(res, 300, 600, 600);
      res.ok(result);
      return;
    }
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
    if (!req.originalUrl?.includes('/platform-admin')) {
      const game = await withPublicCache(`public:catalog:game:${req.params.id}`, 300, () =>
        CatalogStation.getGameById(req.params.id)
      );
      setPublicCacheHeaders(res, 300, 600, 600);
      res.ok(game);
      return;
    }
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
    void invalidateAllPublicDiscoveryCaches();
    res.ok(updated);
  } catch (error) {
    next(error);
  }
}

export async function replaceGameAliases(
  req: Request<{ id: string }, unknown, ReplaceGameAliasesInput>,
  res: Response,
  next: NextFunction
) {
  try {
    const updated = await CatalogStation.replaceGameAliases(req.params.id, req.body.aliases);
    void invalidateAllPublicDiscoveryCaches();
    res.ok(updated);
  } catch (error) {
    next(error);
  }
}

export async function getDuplicateGames(_req: Request, res: Response, next: NextFunction) {
  try {
    const duplicates = await CatalogStation.findDuplicateGames();
    res.ok(duplicates);
  } catch (error) {
    next(error);
  }
}

export async function mergeGames(
  req: Request<unknown, unknown, MergeGamesInput>,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await CatalogStation.mergeGames(req.body);
    void invalidateAllPublicDiscoveryCaches();
    res.ok(result);
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
    void invalidateAllPublicDiscoveryCaches();
    res.noContent();
  } catch (error) {
    next(error);
  }
}
