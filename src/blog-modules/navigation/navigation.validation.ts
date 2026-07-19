import { z } from 'zod';
import { MenuLocation, MenuItemTargetType, NavigationVisibilityRule } from '@prisma/client';

export const createMenuSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    location: z.nativeEnum(MenuLocation),
  }),
});

export const addMenuItemSchema = z.object({
  body: z.object({
    menuId: z.string().cuid(),
    parentId: z.string().cuid().optional().nullable(),
    label: z.string().min(1).max(255),
    url: z.string().min(1),
    order: z.number().int().nonnegative().optional(),
    targetBlank: z.boolean().optional(),
    targetType: z.nativeEnum(MenuItemTargetType).optional(),
    targetId: z.string().optional().nullable(),
    visibility: z.nativeEnum(NavigationVisibilityRule).optional(),
  }),
});

export const updateMenuItemSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z.object({
    menuId: z.string().cuid(),
    parentId: z.string().cuid().optional().nullable(),
    label: z.string().min(1).max(255).optional(),
    url: z.string().min(1).optional(),
    order: z.number().int().nonnegative().optional(),
    targetBlank: z.boolean().optional(),
    isActive: z.boolean().optional(),
    targetType: z.nativeEnum(MenuItemTargetType).optional(),
    targetId: z.string().optional().nullable(),
    visibility: z.nativeEnum(NavigationVisibilityRule).optional(),
  }),
});
