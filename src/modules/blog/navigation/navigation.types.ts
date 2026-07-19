import { MenuLocation, MenuItemTargetType, NavigationVisibilityRule } from '@prisma/client';

export interface CreateMenuInput {
  gamingCenterId: string;
  name: string;
  location: MenuLocation;
}

export interface CreateMenuItemInput {
  menuId: string;
  parentId?: string | null;
  label: string;
  url: string;
  order?: number;
  targetBlank?: boolean;
  targetType?: MenuItemTargetType;
  targetId?: string | null;
  visibility?: NavigationVisibilityRule;
}

export interface UpdateMenuItemInput {
  label?: string;
  url?: string;
  order?: number;
  targetBlank?: boolean;
  isActive?: boolean;
  targetType?: MenuItemTargetType;
  targetId?: string | null;
  visibility?: NavigationVisibilityRule;
  parentId?: string | null;
}
