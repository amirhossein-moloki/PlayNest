import { z } from 'zod';
import { GameStationType } from '@prisma/client';
import { baseFilterSchema } from '../../common/validators/query.validators';
import { idSchema } from '../../common/validators/common.validators';

// Device Catalog Schemas
export const createDeviceCatalogSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    deviceType: z.nativeEnum(GameStationType).default(GameStationType.PC),
    deviceTypeId: idSchema('Invalid deviceTypeId format').optional().nullable(),
    coverImageUrl: z.string().url('Cover image URL must be a valid URL').optional(),
    description: z.string().optional(),
    isActive: z.preprocess((val) => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
      }
      return val;
    }, z.boolean().optional().default(true)),
  }),
});

export const updateDeviceCatalogSchema = z.object({
  params: z.object({
    id: idSchema('Invalid device ID format'),
  }),
  body: z.object({
    name: z.string().min(1, 'Name cannot be empty').optional(),
    deviceType: z.nativeEnum(GameStationType).optional(),
    deviceTypeId: idSchema('Invalid deviceTypeId format').optional().nullable(),
    coverImageUrl: z.string().url('Cover image URL must be a valid URL').optional(),
    description: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const listDeviceCatalogSchema = baseFilterSchema.extend({
  deviceType: z.nativeEnum(GameStationType).optional(),
  isActive: z.preprocess((val) => {
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return val;
  }, z.boolean().optional()),
});

// Game Catalog Schemas
export const createGameCatalogSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    coverImageUrl: z.string().url('Cover image URL must be a valid URL').optional(),
    supportedPlatforms: z.preprocess((val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return [val];
        }
      }
      return val;
    }, z
      .array(z.nativeEnum(GameStationType))
      .min(1, 'At least one supported platform is required')
      .default([GameStationType.PC])),
    genre: z.string().optional(),
    description: z.string().optional(),
    isActive: z.preprocess((val) => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
      }
      return val;
    }, z.boolean().optional().default(true)),
  }),
});

export const updateGameCatalogSchema = z.object({
  params: z.object({
    id: idSchema('Invalid game ID format'),
  }),
  body: z.object({
    title: z.string().min(1, 'Title cannot be empty').optional(),
    coverImageUrl: z.string().url('Cover image URL must be a valid URL').optional(),
    supportedPlatforms: z.array(z.nativeEnum(GameStationType)).optional(),
    genre: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const listGameCatalogSchema = baseFilterSchema.extend({
  platform: z.nativeEnum(GameStationType).optional(),
  genre: z.string().optional(),
  isActive: z.preprocess((val) => {
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return val;
  }, z.boolean().optional()),
});

// Device Type Schemas (Dynamic Device Types)
export const createDeviceTypeSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric with hyphens').optional(),
    description: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
    category: z.nativeEnum(GameStationType).default(GameStationType.PC),
    isActive: z.preprocess((val) => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
      }
      return val;
    }, z.boolean().optional().default(true)),
    extraControllerEnabled: z.preprocess((val) => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
      }
      return val;
    }, z.boolean().optional().default(false)),
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
    category: z.nativeEnum(GameStationType).optional(),
    isActive: z.boolean().optional(),
    extraControllerEnabled: z.boolean().optional(),
  }),
});

export const listDeviceTypeSchema = baseFilterSchema.extend({
  category: z.nativeEnum(GameStationType).optional(),
  isActive: z.preprocess((val) => {
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return val;
  }, z.boolean().optional()),
  extraControllerEnabled: z.preprocess((val) => {
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true;
      if (val.toLowerCase() === 'false') return false;
    }
    return val;
  }, z.boolean().optional()),
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
