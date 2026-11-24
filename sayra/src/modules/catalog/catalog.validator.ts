import { z } from 'zod';
import { GameStationType } from '@prisma/client';
import { zodGameStationType, zodGameStationTypeOptional } from '../../common/utils/station-type';
import { baseFilterSchema, parseOptionalBoolean } from '../../common/validators/query.validators';
import { idSchema } from '../../common/validators/common.validators';

export const GAME_CATALOG_CATEGORIES = [
  'SPORTS',
  'FPS',
  'BATTLE_ROYALE',
  'OPEN_WORLD',
  'MOBA',
  'RACING',
  'FIGHTING',
  'SANDBOX',
  'STRATEGY',
  'HORROR',
  'RPG',
  'ACTION',
  'ADVENTURE',
  'SIMULATION',
  'OTHER',
] as const;

export type GameCatalogCategory = (typeof GAME_CATALOG_CATEGORIES)[number];

export interface GameAliasInput {
  alias: string;
  locale?: 'fa' | 'en';
}

const parseBoolean = (val: unknown) => {
  if (typeof val === 'string') {
    if (val.toLowerCase() === 'true') return true;
    if (val.toLowerCase() === 'false') return false;
  }
  return val;
};

const parsePlatforms = (val: unknown) => {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return [val];
    }
  }
  return val;
};

const aliasEntrySchema = z.union([
  z
    .string()
    .trim()
    .min(1)
    .max(120)
    .transform((alias): GameAliasInput => ({ alias })),
  z
    .object({
      alias: z.string().trim().min(1).max(120),
      locale: z.enum(['fa', 'en']).optional(),
    })
    .transform((entry): GameAliasInput => ({
      alias: entry.alias,
      ...(entry.locale ? { locale: entry.locale } : {}),
    })),
]);

const parseAliases = (val: unknown): unknown => {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Fallback to comma split
      }
    }
    return trimmed
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return val;
};

const gameSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, 'Slug must be URL-safe without spaces');

// Device Catalog Schemas
export const createDeviceCatalogSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    deviceType: zodGameStationType().default(GameStationType.PC),
    deviceTypeId: idSchema('Invalid deviceTypeId format').optional().nullable(),
    coverImageUrl: z.string().url('Cover image URL must be a valid URL').optional(),
    description: z.string().optional(),
    isActive: z.preprocess(parseBoolean, z.boolean().optional().default(true)),
  }),
});

export const updateDeviceCatalogSchema = z.object({
  params: z.object({
    id: idSchema('Invalid device ID format'),
  }),
  body: z.object({
    name: z.string().min(1, 'Name cannot be empty').optional(),
    deviceType: zodGameStationTypeOptional(),
    deviceTypeId: idSchema('Invalid deviceTypeId format').optional().nullable(),
    coverImageUrl: z.string().url('Cover image URL must be a valid URL').optional(),
    description: z.string().optional().nullable(),
    isActive: z.preprocess(parseBoolean, z.boolean().optional()),
  }),
});

export const listDeviceCatalogSchema = baseFilterSchema.extend({
  deviceType: zodGameStationTypeOptional(),
  isActive: parseOptionalBoolean(),
});

// Game Catalog Schemas
export const createGameCatalogSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'Title is required'),
    slug: gameSlugSchema.optional(),
    titleFa: z.string().trim().min(1).max(200).optional().nullable(),
    titleEn: z.string().trim().min(1).max(200).optional().nullable(),
    category: z.enum(GAME_CATALOG_CATEGORIES).optional().nullable(),
    popularityScore: z.coerce.number().int().min(0).max(100000).optional().default(0),
    aliases: z.preprocess(parseAliases, z.array(aliasEntrySchema).max(50).optional()),
    coverImageUrl: z.string().url('Cover image URL must be a valid URL').optional(),
    supportedPlatforms: z.preprocess(
      parsePlatforms,
      z
        .array(zodGameStationType())
        .min(1, 'At least one supported platform is required')
        .default([GameStationType.PC])
    ),
    genre: z.string().optional(),
    description: z.string().optional(),
    supportsOnline: z.preprocess(parseBoolean, z.boolean().optional().default(false)),
    isActive: z.preprocess(parseBoolean, z.boolean().optional().default(true)),
  }),
});

export const updateGameCatalogSchema = z.object({
  params: z.object({
    id: idSchema('Invalid game ID format'),
  }),
  body: z.object({
    title: z.string().trim().min(1, 'Title cannot be empty').optional(),
    slug: gameSlugSchema.optional(),
    titleFa: z.string().trim().min(1).max(200).optional().nullable(),
    titleEn: z.string().trim().min(1).max(200).optional().nullable(),
    category: z.enum(GAME_CATALOG_CATEGORIES).optional().nullable(),
    popularityScore: z.coerce.number().int().min(0).max(100000).optional(),
    aliases: z.preprocess(parseAliases, z.array(aliasEntrySchema).max(50).optional()),
    coverImageUrl: z.string().url('Cover image URL must be a valid URL').optional(),
    supportedPlatforms: z.preprocess(parsePlatforms, z.array(zodGameStationType()).optional()),
    genre: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    supportsOnline: z.preprocess(parseBoolean, z.boolean().optional()),
    isActive: z.preprocess(parseBoolean, z.boolean().optional()),
  }),
});

export const listGameCatalogSchema = baseFilterSchema.extend({
  platform: zodGameStationTypeOptional(),
  category: z.enum(GAME_CATALOG_CATEGORIES).optional(),
  genre: z.string().optional(),
  supportsOnline: parseOptionalBoolean(),
  isActive: parseOptionalBoolean(),
});

export const replaceGameAliasesSchema = z.object({
  params: z.object({
    id: idSchema('Invalid game ID format'),
  }),
  body: z.object({
    aliases: z.preprocess(
      parseAliases,
      z.array(aliasEntrySchema).max(50, 'Cannot exceed 50 aliases per game')
    ),
  }),
});

export const mergeGamesSchema = z.object({
  body: z.object({
    targetGameId: idSchema('Invalid target game ID format'),
    sourceGameIds: z
      .array(idSchema('Invalid source game ID format'))
      .min(1, 'At least one sourceGameId is required')
      .max(20, 'Cannot merge more than 20 source games at once'),
    deactivateSources: z.boolean().optional().default(true),
  }),
});

// Device Type Schemas (Dynamic Device Types)
export const createDeviceTypeSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric with hyphens').optional(),
    description: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
    category: zodGameStationType().default(GameStationType.PC),
    isActive: z.preprocess(parseBoolean, z.boolean().optional().default(true)),
    extraControllerEnabled: z.preprocess(parseBoolean, z.boolean().optional().default(false)),
  }),
});

export const updateDeviceTypeSchema = z.object({
  params: z.object({
    id: idSchema('Invalid device type ID format'),
  }),
  body: z.object({
    name: z.string().min(1, 'Name cannot be empty').optional(),
    slug: z.string().min(1, 'Slug cannot be empty').regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric with hyphens').optional(),
    description: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
    category: zodGameStationTypeOptional(),
    isActive: z.preprocess(parseBoolean, z.boolean().optional()),
    extraControllerEnabled: z.preprocess(parseBoolean, z.boolean().optional()),
  }),
});

export const listDeviceTypeSchema = baseFilterSchema.extend({
  category: zodGameStationTypeOptional(),
  isActive: parseOptionalBoolean(),
  extraControllerEnabled: parseOptionalBoolean(),
});

export const catalogIdParamSchema = z.object({
  params: z.object({
    id: idSchema('Invalid ID format'),
  }),
});

export type CreateDeviceTypeInput = z.infer<typeof createDeviceTypeSchema>['body'];
export type UpdateDeviceTypeInput = z.infer<typeof updateDeviceTypeSchema>['body'];
export type ListDeviceTypeQuery = z.infer<typeof listDeviceTypeSchema>;

export type CreateDeviceCatalogInput = z.infer<typeof createDeviceCatalogSchema>['body'];
export type UpdateDeviceCatalogInput = z.infer<typeof updateDeviceCatalogSchema>['body'];
export type ListDeviceCatalogQuery = z.infer<typeof listDeviceCatalogSchema>;

export type CreateGameCatalogInput = z.infer<typeof createGameCatalogSchema>['body'];
export type UpdateGameCatalogInput = z.infer<typeof updateGameCatalogSchema>['body'];
export type ListGameCatalogQuery = z.infer<typeof listGameCatalogSchema>;
export type ReplaceGameAliasesInput = z.infer<typeof replaceGameAliasesSchema>['body'];
export type MergeGamesInput = z.infer<typeof mergeGamesSchema>['body'];
