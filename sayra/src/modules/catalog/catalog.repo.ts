import { prisma } from '../../config/prisma';
import { Prisma, GamePlayMode, GameStationType } from '@prisma/client';
import httpStatus from 'http-status';
import AppError from '../../common/errors/AppError';
import {
  buildPersianArabicSearchVariants,
  normalizeSearchText,
  slugifyGameTitle,
  toCompactSearchKey,
} from '../../common/utils/searchText';
import {
  CreateDeviceCatalogInput,
  UpdateDeviceCatalogInput,
  ListDeviceCatalogQuery,
  CreateGameCatalogInput,
  UpdateGameCatalogInput,
  ListGameCatalogQuery,
  CreateDeviceTypeInput,
  UpdateDeviceTypeInput,
  ListDeviceTypeQuery,
  GameAliasInput,
} from './catalog.validator';
import { getPaginationParams, formatPaginatedResult } from '../../common/utils/pagination';

// ==========================================
// Device Type Repository (Dynamic Device Types)
// ==========================================

export async function createDeviceType(data: CreateDeviceTypeInput) {
  const generatedSlug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const slug = data.slug || generatedSlug || `device-type-${Date.now()}`;
  return prisma.deviceType.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      icon: data.icon,
      category: data.category,
      isActive: data.isActive ?? true,
      extraControllerEnabled: data.extraControllerEnabled ?? false,
    },
  });
}

export async function findDeviceTypeById(id: string) {
  return prisma.deviceType.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          deviceCatalogs: true,
          stations: true,
        },
      },
    },
  });
}

export async function findDeviceTypes(query: ListDeviceTypeQuery) {
  const { page, limit, search, isActive, sortBy, sortOrder, category, extraControllerEnabled } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where: Prisma.DeviceTypeWhereInput = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (extraControllerEnabled !== undefined) {
    where.extraControllerEnabled = extraControllerEnabled;
  }

  if (category) {
    where.category = category;
  }

  if (search) {
    const variants = buildPersianArabicSearchVariants(search);
    where.OR = variants.flatMap((v) => [
      { name: { contains: v, mode: 'insensitive' } },
      { slug: { contains: v, mode: 'insensitive' } },
      { description: { contains: v, mode: 'insensitive' } },
    ]);
  }

  const [data, total] = await Promise.all([
    prisma.deviceType.findMany({
      where,
      skip,
      take,
      orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            deviceCatalogs: true,
            stations: true,
          },
        },
      },
    }),
    prisma.deviceType.count({ where }),
  ]);

  return formatPaginatedResult(data, total, page, limit);
}

export async function updateDeviceType(id: string, data: UpdateDeviceTypeInput) {
  return prisma.deviceType.update({
    where: { id },
    data,
  });
}

export async function deleteDeviceType(id: string) {
  return prisma.deviceType.delete({
    where: { id },
  });
}

// ==========================================
// Device Catalog Repository
// ==========================================

export async function createDevice(data: CreateDeviceCatalogInput) {
  return prisma.deviceCatalog.create({
    data: {
      name: data.name,
      deviceType: data.deviceType,
      deviceTypeId: data.deviceTypeId,
      coverImageUrl: data.coverImageUrl || '',
      description: data.description,
      isActive: data.isActive ?? true,
    },
    include: {
      deviceTypeRef: true,
    },
  });
}

export async function findDeviceById(id: string) {
  return prisma.deviceCatalog.findUnique({
    where: { id },
    include: {
      deviceTypeRef: true,
    },
  });
}

export async function findDevices(query: ListDeviceCatalogQuery) {
  const { page, limit, search, isActive, sortBy, sortOrder, deviceType } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where: Prisma.DeviceCatalogWhereInput = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (deviceType) {
    where.deviceType = deviceType;
  }

  if (search) {
    const variants = buildPersianArabicSearchVariants(search);
    where.OR = variants.flatMap((v) => [
      { name: { contains: v, mode: 'insensitive' } },
      { description: { contains: v, mode: 'insensitive' } },
    ]);
  }

  const [data, total] = await Promise.all([
    prisma.deviceCatalog.findMany({
      where,
      skip,
      take,
      orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
      include: {
        deviceTypeRef: true,
      },
    }),
    prisma.deviceCatalog.count({ where }),
  ]);

  return formatPaginatedResult(data, total, page, limit);
}

export async function updateDevice(id: string, data: UpdateDeviceCatalogInput) {
  return prisma.deviceCatalog.update({
    where: { id },
    data,
    include: {
      deviceTypeRef: true,
    },
  });
}

export async function deleteDevice(id: string) {
  return prisma.deviceCatalog.delete({
    where: { id },
  });
}

// ==========================================
// Game Catalog Repository
// ==========================================

function collectNormalizedAliases(params: {
  title?: string | null;
  titleFa?: string | null;
  titleEn?: string | null;
  aliases?: GameAliasInput[];
}): Array<{ alias: string; normalized: string; locale: string | null }> {
  const byNorm = new Map<string, { alias: string; normalized: string; locale: string | null }>();

  const add = (rawAlias?: string | null, locale?: 'fa' | 'en' | null) => {
    const clean = rawAlias?.trim();
    if (!clean) return;
    const normalized = normalizeSearchText(clean);
    if (!normalized) return;
    if (!byNorm.has(normalized)) {
      byNorm.set(normalized, { alias: clean, normalized, locale: locale ?? null });
    }
  };

  add(params.title, null);
  add(params.titleEn, 'en');
  add(params.titleFa, 'fa');
  for (const entry of params.aliases || []) {
    add(entry.alias, entry.locale ?? null);
  }

  return Array.from(byNorm.values());
}

async function syncAliasesForGame(
  client: Prisma.TransactionClient | typeof prisma,
  gameCatalogId: string,
  entries: Array<{ alias: string; normalized: string; locale: string | null }>,
  replaceExisting = false
) {
  if (typeof client.gameAlias?.upsert !== 'function') {
    return;
  }

  if (replaceExisting && typeof client.gameAlias?.deleteMany === 'function') {
    const keepNorms = entries.map((e) => e.normalized);
    await client.gameAlias.deleteMany({
      where: {
        gameCatalogId,
        ...(keepNorms.length > 0 ? { normalized: { notIn: keepNorms } } : {}),
      },
    });
  }

  for (const entry of entries) {
    await client.gameAlias.upsert({
      where: {
        gameCatalogId_normalized: {
          gameCatalogId,
          normalized: entry.normalized,
        },
      },
      update: {
        alias: entry.alias,
        ...(entry.locale ? { locale: entry.locale } : {}),
      },
      create: {
        gameCatalogId,
        alias: entry.alias,
        normalized: entry.normalized,
        locale: entry.locale,
      },
    });
  }
}

export async function createGame(data: CreateGameCatalogInput) {
  const effectiveTitleEn = data.titleEn ?? data.title;
  const normalizedKey = toCompactSearchKey(effectiveTitleEn || data.title);
  const resolvedSlug =
    data.slug ||
    slugifyGameTitle(effectiveTitleEn || data.title) ||
    `game-${Date.now()}`;

  if (typeof prisma.gameCatalog?.findFirst === 'function') {
    const duplicate = await prisma.gameCatalog.findFirst({
      where: {
        OR: [
          ...(normalizedKey ? [{ normalizedKey }] : []),
          { slug: resolvedSlug },
          { title: { equals: data.title, mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true, slug: true },
    });

    if (duplicate) {
      throw new AppError(
        `A game matching "${duplicate.title}" already exists in the catalog.`,
        httpStatus.CONFLICT,
        {
          code: 'DUPLICATE_GAME_CATALOG',
          details: { existingGameId: duplicate.id, existingSlug: duplicate.slug },
        }
      );
    }
  }

  const aliasEntries = collectNormalizedAliases({
    title: data.title,
    titleFa: data.titleFa,
    titleEn: effectiveTitleEn,
    aliases: data.aliases,
  });

  const created = await prisma.gameCatalog.create({
    data: {
      title: data.title,
      ...(data.slug !== undefined ? { slug: resolvedSlug } : { slug: resolvedSlug }),
      ...(data.titleFa !== undefined ? { titleFa: data.titleFa } : {}),
      ...(data.titleEn !== undefined ? { titleEn: effectiveTitleEn } : { titleEn: effectiveTitleEn }),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(normalizedKey ? { normalizedKey } : {}),
      ...(data.popularityScore !== undefined ? { popularityScore: data.popularityScore } : {}),
      coverImageUrl: data.coverImageUrl || '',
      supportedPlatforms: data.supportedPlatforms,
      genre: data.genre,
      description: data.description,
      supportsOnline: data.supportsOnline ?? false,
      isActive: data.isActive ?? true,
    },
  });

  await syncAliasesForGame(prisma, created.id, aliasEntries, false);

  if (typeof prisma.gameCatalog?.findUnique === 'function' && typeof prisma.gameAlias?.upsert === 'function') {
    const hydrated = await prisma.gameCatalog.findUnique({
      where: { id: created.id },
      include: { aliases: { orderBy: { createdAt: 'asc' } } },
    });
    if (hydrated) return hydrated;
  }

  return created;
}

export async function findGameById(id: string) {
  if (typeof prisma.gameAlias?.findMany === 'function') {
    return prisma.gameCatalog.findUnique({
      where: { id },
      include: {
        aliases: { orderBy: { createdAt: 'asc' } },
        _count: {
          select: {
            centerGames: true,
            stationGames: true,
          },
        },
      },
    });
  }
  return prisma.gameCatalog.findUnique({
    where: { id },
  });
}

export async function findGames(query: ListGameCatalogQuery) {
  const {
    page,
    limit,
    search,
    isActive,
    sortBy,
    sortOrder,
    platform,
    category,
    genre,
    supportsOnline,
  } = query;
  const { skip, take } = getPaginationParams(page, limit);

  const where: Prisma.GameCatalogWhereInput = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (supportsOnline !== undefined) {
    where.supportsOnline = supportsOnline;
  }

  if (platform) {
    where.supportedPlatforms = {
      has: platform,
    };
  }

  if (category) {
    where.category = category;
  }

  if (genre) {
    where.genre = { contains: genre, mode: 'insensitive' };
  }

  if (search) {
    const variants = buildPersianArabicSearchVariants(search);
    const normalizedQuery = normalizeSearchText(search);
    const hasAliasesRelation = typeof prisma.gameAlias?.findMany === 'function';
    where.OR = [
      ...variants.flatMap((v) => [
        { title: { contains: v, mode: 'insensitive' as const } },
        { titleFa: { contains: v, mode: 'insensitive' as const } },
        { titleEn: { contains: v, mode: 'insensitive' as const } },
        { slug: { contains: v, mode: 'insensitive' as const } },
        { description: { contains: v, mode: 'insensitive' as const } },
        { genre: { contains: v, mode: 'insensitive' as const } },
      ]),
      ...(hasAliasesRelation && normalizedQuery
        ? [
            {
              aliases: {
                some: {
                  OR: variants.map((v) => ({
                    normalized: { contains: normalizeSearchText(v) || v, mode: 'insensitive' as const },
                  })),
                },
              },
            },
          ]
        : []),
    ];
  }

  const includeClause =
    typeof prisma.gameAlias?.findMany === 'function'
      ? {
          aliases: { orderBy: { createdAt: 'asc' as const } },
          _count: {
            select: {
              centerGames: true,
            },
          },
        }
      : undefined;

  const [data, total] = await Promise.all([
    prisma.gameCatalog.findMany({
      where,
      skip,
      take,
      orderBy: sortBy ? { [sortBy]: sortOrder } : [{ popularityScore: 'desc' }, { createdAt: 'desc' }],
      ...(includeClause ? { include: includeClause } : {}),
    }),
    prisma.gameCatalog.count({ where }),
  ]);

  return formatPaginatedResult(data, total, page, limit);
}

export async function updateGame(id: string, data: UpdateGameCatalogInput) {
  const { aliases, ...scalarData } = data;
  const updatePayload: Prisma.GameCatalogUpdateInput = { ...scalarData };

  if (scalarData.title !== undefined || scalarData.titleEn !== undefined) {
    const baseTitle = scalarData.titleEn ?? scalarData.title;
    if (baseTitle) {
      updatePayload.normalizedKey = toCompactSearchKey(baseTitle);
    }
  }

  if (
    typeof prisma.gameCatalog?.findFirst === 'function' &&
    (updatePayload.normalizedKey || scalarData.slug)
  ) {
    const conflict = await prisma.gameCatalog.findFirst({
      where: {
        id: { not: id },
        OR: [
          ...(updatePayload.normalizedKey ? [{ normalizedKey: String(updatePayload.normalizedKey) }] : []),
          ...(scalarData.slug ? [{ slug: scalarData.slug }] : []),
        ],
      },
      select: { id: true, title: true },
    });

    if (conflict) {
      throw new AppError(
        `A conflicting game "${conflict.title}" already exists in the catalog.`,
        httpStatus.CONFLICT,
        { code: 'DUPLICATE_GAME_CATALOG', details: { existingGameId: conflict.id } }
      );
    }
  }

  const runUpdate = async (client: Prisma.TransactionClient | typeof prisma) => {
    const updated = await client.gameCatalog.update({
      where: { id },
      data: updatePayload,
    });

    if (data.supportsOnline === false && typeof client.gamingCenterGame?.updateMany === 'function') {
      await client.gamingCenterGame.updateMany({
        where: {
          gameCatalogId: id,
          playMode: GamePlayMode.ONLINE,
        },
        data: {
          playMode: GamePlayMode.OFFLINE,
        },
      });
    }

    if (aliases !== undefined) {
      const aliasEntries = collectNormalizedAliases({
        title: updated.title,
        titleFa: updated.titleFa,
        titleEn: updated.titleEn,
        aliases,
      });
      await syncAliasesForGame(client, id, aliasEntries, true);
    }

    return updated;
  };

  if (
    (data.supportsOnline === false || aliases !== undefined) &&
    typeof prisma.$transaction === 'function'
  ) {
    return prisma.$transaction((tx) => runUpdate(tx));
  }

  return runUpdate(prisma);
}

export async function replaceGameAliases(id: string, aliases: GameAliasInput[]) {
  const game = await prisma.gameCatalog.findUnique({ where: { id } });
  if (!game) {
    throw new AppError('Game catalog item not found', httpStatus.NOT_FOUND);
  }

  const entries = collectNormalizedAliases({
    title: game.title,
    titleFa: game.titleFa,
    titleEn: game.titleEn,
    aliases,
  });

  await syncAliasesForGame(prisma, id, entries, true);

  return findGameById(id);
}

export async function findDuplicateGames() {
  const games = await prisma.gameCatalog.findMany({
    include:
      typeof prisma.gameAlias?.findMany === 'function'
        ? {
            aliases: true,
            _count: { select: { centerGames: true, stationGames: true } },
          }
        : undefined,
    orderBy: [{ popularityScore: 'desc' }, { createdAt: 'asc' }],
  });

  const groupsByKey = new Map<string, typeof games>();

  for (const g of games) {
    const key = g.normalizedKey || toCompactSearchKey(g.titleEn || g.title);
    if (!key) continue;
    const list = groupsByKey.get(key) ?? [];
    list.push(g);
    groupsByKey.set(key, list);
  }

  // Also detect overlapping alias normalized keys across distinct games
  const gamesByAlias = new Map<string, Set<string>>();
  const gameById = new Map(games.map((g) => [g.id, g]));
  for (const g of games) {
    const aliasList = (g as { aliases?: Array<{ normalized: string }> }).aliases || [];
    for (const a of aliasList) {
      const compact = toCompactSearchKey(a.normalized);
      if (!compact) continue;
      const set = gamesByAlias.get(compact) ?? new Set<string>();
      set.add(g.id);
      gamesByAlias.set(compact, set);
    }
  }

  const emittedPairs = new Set<string>();
  const duplicateGroups: Array<{
    reason: 'NORMALIZED_KEY' | 'SHARED_ALIAS';
    key: string;
    games: typeof games;
  }> = [];

  for (const [key, list] of groupsByKey.entries()) {
    if (list.length > 1) {
      const sig = list.map((x) => x.id).sort().join(',');
      emittedPairs.add(sig);
      duplicateGroups.push({ reason: 'NORMALIZED_KEY', key, games: list });
    }
  }

  for (const [aliasKey, idSet] of gamesByAlias.entries()) {
    if (idSet.size > 1) {
      const sig = Array.from(idSet).sort().join(',');
      if (!emittedPairs.has(sig)) {
        emittedPairs.add(sig);
        duplicateGroups.push({
          reason: 'SHARED_ALIAS',
          key: aliasKey,
          games: Array.from(idSet)
            .map((gid) => gameById.get(gid)!)
            .filter(Boolean),
        });
      }
    }
  }

  return duplicateGroups;
}

export async function mergeGames(
  targetGameId: string,
  sourceGameIds: string[],
  deactivateSources = true
) {
  const uniqueSourceIds = Array.from(new Set(sourceGameIds)).filter((id) => id !== targetGameId);
  if (uniqueSourceIds.length === 0) {
    throw new AppError('At least one source game different from targetGameId is required', httpStatus.BAD_REQUEST);
  }

  const target = await prisma.gameCatalog.findUnique({
    where: { id: targetGameId },
    include: typeof prisma.gameAlias?.findMany === 'function' ? { aliases: true } : undefined,
  });
  if (!target) {
    throw new AppError('Target game not found', httpStatus.NOT_FOUND);
  }

  const sources = await prisma.gameCatalog.findMany({
    where: { id: { in: uniqueSourceIds } },
    include: typeof prisma.gameAlias?.findMany === 'function' ? { aliases: true } : undefined,
  });
  if (sources.length === 0) {
    throw new AppError('No matching source games found', httpStatus.NOT_FOUND);
  }

  return prisma.$transaction(async (tx) => {
    const mergedAliases: GameAliasInput[] = [];
    const mergedPlatforms = new Set<GameStationType>(target.supportedPlatforms);

    for (const src of sources) {
      mergedAliases.push({ alias: src.title });
      if (src.titleFa) mergedAliases.push({ alias: src.titleFa, locale: 'fa' });
      if (src.titleEn) mergedAliases.push({ alias: src.titleEn, locale: 'en' });
      const srcAliases = (src as { aliases?: Array<{ alias: string; locale: string | null }> }).aliases || [];
      for (const a of srcAliases) {
        mergedAliases.push({
          alias: a.alias,
          locale: a.locale === 'fa' || a.locale === 'en' ? a.locale : undefined,
        });
      }
      for (const p of src.supportedPlatforms) {
        mergedPlatforms.add(p);
      }

      // Migrate GamingCenterGame associations
      if (typeof tx.gamingCenterGame?.findMany === 'function') {
        const centerLinks = await tx.gamingCenterGame.findMany({
          where: { gameCatalogId: src.id },
        });
        for (const link of centerLinks) {
          const existingTargetLink = await tx.gamingCenterGame.findUnique({
            where: {
              gamingCenterId_gameCatalogId: {
                gamingCenterId: link.gamingCenterId,
                gameCatalogId: target.id,
              },
            },
          });

          if (existingTargetLink) {
            const combinedPlatforms = Array.from(
              new Set([...(existingTargetLink.platforms || []), ...(link.platforms || [])])
            );
            const resolvedPlayMode =
              target.supportsOnline &&
              (existingTargetLink.playMode === GamePlayMode.ONLINE || link.playMode === GamePlayMode.ONLINE)
                ? GamePlayMode.ONLINE
                : GamePlayMode.OFFLINE;
            await tx.gamingCenterGame.update({
              where: { id: existingTargetLink.id },
              data: {
                playMode: resolvedPlayMode,
                platforms: combinedPlatforms,
              },
            });
            await tx.gamingCenterGame.delete({ where: { id: link.id } });
          } else {
            await tx.gamingCenterGame.update({
              where: { id: link.id },
              data: { gameCatalogId: target.id },
            });
          }
        }
      }

      // Migrate GameStationGame associations
      if (typeof tx.gameStationGame?.findMany === 'function') {
        const stationLinks = await tx.gameStationGame.findMany({
          where: { gameCatalogId: src.id },
        });
        for (const sl of stationLinks) {
          const existingStationLink = await tx.gameStationGame.findUnique({
            where: {
              stationId_gameCatalogId: {
                stationId: sl.stationId,
                gameCatalogId: target.id,
              },
            },
          });

          if (existingStationLink) {
            await tx.gameStationGame.update({
              where: { id: existingStationLink.id },
              data: {
                isActive: existingStationLink.isActive || sl.isActive,
                playMode:
                  target.supportsOnline &&
                  (existingStationLink.playMode === GamePlayMode.ONLINE || sl.playMode === GamePlayMode.ONLINE)
                    ? GamePlayMode.ONLINE
                    : GamePlayMode.OFFLINE,
              },
            });
            await tx.gameStationGame.delete({ where: { id: sl.id } });
          } else {
            await tx.gameStationGame.update({
              where: { id: sl.id },
              data: { gameCatalogId: target.id },
            });
          }
        }
      }

      // Sync legacy GamingCenter.games string array
      if (typeof tx.gamingCenter?.findMany === 'function') {
        const centersWithLegacyTitle = await tx.gamingCenter.findMany({
          where: { games: { has: src.title } },
          select: { id: true, games: true },
        });
        for (const c of centersWithLegacyTitle) {
          const nextGames = Array.from(
            new Set((c.games || []).map((t) => (t === src.title ? target.title : t)))
          );
          await tx.gamingCenter.update({
            where: { id: c.id },
            data: { games: nextGames },
          });
        }
      }

      if (deactivateSources) {
        await tx.gameCatalog.update({
          where: { id: src.id },
          data: { isActive: false },
        });
      } else {
        await tx.gameCatalog.delete({
          where: { id: src.id },
        });
      }
    }

    await tx.gameCatalog.update({
      where: { id: target.id },
      data: {
        supportedPlatforms: Array.from(mergedPlatforms),
      },
    });

    const aliasEntries = collectNormalizedAliases({
      title: target.title,
      titleFa: target.titleFa,
      titleEn: target.titleEn,
      aliases: mergedAliases,
    });
    await syncAliasesForGame(tx, target.id, aliasEntries, false);

    return {
      targetGameId: target.id,
      mergedSourceIds: sources.map((s) => s.id),
      deactivatedSources: deactivateSources,
      addedAliasesCount: aliasEntries.length,
    };
  });
}

export async function deleteGame(id: string) {
  return prisma.gameCatalog.delete({
    where: { id },
  });
}
