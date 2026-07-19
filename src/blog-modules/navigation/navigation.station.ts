import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import { navigationRepository } from './navigation.repository';
import { CreateMenuInput, CreateMenuItemInput, UpdateMenuItemInput } from './navigation.types';
import { MenuLocation, NavigationVisibilityRule, SessionActorType, UserRole } from '@prisma/client';
import { auditService } from '../audit/audit.station';
import { eventEmitter } from '../../common/events/event-emitter';

export const navigationStation = {
  async createMenu(
    data: CreateMenuInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const existing = await navigationRepository.findMenuByLocation(data.location, data.gamingCenterId);
    if (existing) {
      throw new AppError(`Menu for location ${data.location} already exists`, httpStatus.CONFLICT);
    }

    const menu = await navigationRepository.createMenu(data);

    await auditService.log(
      data.gamingCenterId,
      actor,
      'CMS_MENU_CREATE',
      { name: 'Menu', id: menu.id },
      { old: null, new: menu },
      context
    );

    eventEmitter.emit('CMS_MENU_CREATED', { menuId: menu.id, gamingCenterId: menu.gamingCenterId });

    return menu;
  },

  async getMenuTree(location: MenuLocation, gamingCenterId: string, user?: { role: UserRole }) {
    const menu = await navigationRepository.findMenuByLocation(location, gamingCenterId);
    if (!menu) return null;

    // Filter by visibility rules
    const filteredItems = menu.items.filter((item) => {
      if (item.visibility === NavigationVisibilityRule.PUBLIC) return true;
      if (!user) return false;
      if (item.visibility === NavigationVisibilityRule.AUTHENTICATED) return true;
      if (item.visibility === NavigationVisibilityRule.STAFF && (user.role === UserRole.STAFF || user.role === UserRole.MANAGER || user.role === UserRole.ADMIN)) return true;
      if (item.visibility === NavigationVisibilityRule.ADMIN && user.role === UserRole.ADMIN) return true;
      return false;
    });

    // Build hierarchy (Avoiding N+1 by using the already fetched items)
    const itemMap = new Map();
    filteredItems.forEach((item) => itemMap.set(item.id, { ...item, children: [] }));

    const rootItems: Record<string, unknown>[] = [];
    filteredItems.forEach((item) => {
      if (item.parentId && itemMap.has(item.parentId)) {
        itemMap.get(item.parentId).children.push(itemMap.get(item.id));
      } else {
        rootItems.push(itemMap.get(item.id));
      }
    });

    return { ...menu, items: rootItems };
  },

  async addMenuItem(
    data: CreateMenuItemInput,
    gamingCenterId: string,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const menu = await navigationRepository.findMenuById(data.menuId, gamingCenterId);
    if (!menu) throw new AppError('Menu not found', httpStatus.NOT_FOUND);

    const item = await navigationRepository.createMenuItem(data);

    await auditService.log(
      gamingCenterId,
      actor,
      'CMS_MENU_ITEM_CREATE',
      { name: 'MenuItem', id: item.id },
      { old: null, new: item },
      context
    );

    eventEmitter.emit('CMS_MENU_UPDATED', { menuId: menu.id, gamingCenterId });

    return item;
  },

  async updateMenuItem(
    id: string,
    menuId: string,
    gamingCenterId: string,
    data: UpdateMenuItemInput,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const menu = await navigationRepository.findMenuById(menuId, gamingCenterId);
    if (!menu) throw new AppError('Menu not found', httpStatus.NOT_FOUND);

    const existingItem = menu.items.find((i) => i.id === id);
    if (!existingItem) throw new AppError('Menu item not found', httpStatus.NOT_FOUND);

    const updated = await navigationRepository.updateMenuItem(id, data);

    await auditService.log(
      gamingCenterId,
      actor,
      'CMS_MENU_ITEM_UPDATE',
      { name: 'MenuItem', id },
      { old: existingItem, new: updated },
      context
    );

    eventEmitter.emit('CMS_MENU_UPDATED', { menuId, gamingCenterId });

    return updated;
  },

  async deleteMenuItem(
    id: string,
    menuId: string,
    gamingCenterId: string,
    actor: { id: string; actorType: SessionActorType },
    context?: { ip?: string; userAgent?: string }
  ) {
    const menu = await navigationRepository.findMenuById(menuId, gamingCenterId);
    if (!menu) throw new AppError('Menu not found', httpStatus.NOT_FOUND);

    const existingItem = menu.items.find((i) => i.id === id);
    if (!existingItem) throw new AppError('Menu item not found', httpStatus.NOT_FOUND);

    await navigationRepository.deleteMenuItem(id);

    await auditService.log(
      gamingCenterId,
      actor,
      'CMS_MENU_ITEM_DELETE',
      { name: 'MenuItem', id },
      { old: existingItem, new: null },
      context
    );

    eventEmitter.emit('CMS_MENU_UPDATED', { menuId, gamingCenterId });
  },
};
