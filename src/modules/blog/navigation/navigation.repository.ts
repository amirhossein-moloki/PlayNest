import { prisma } from '../../../config/prisma';
import { CreateMenuInput, CreateMenuItemInput, UpdateMenuItemInput } from './navigation.types';
import { MenuLocation } from '@prisma/client';

export const navigationRepository = {
  async createMenu(data: CreateMenuInput) {
    return prisma.menu.create({
      data,
    });
  },

  async findMenuByLocation(location: MenuLocation, gamingCenterId: string) {
    return prisma.menu.findUnique({
      where: {
        gamingCenterId_location: {
          gamingCenterId,
          location,
        },
      },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
    });
  },

  async findMenuById(id: string, gamingCenterId: string) {
    return prisma.menu.findFirst({
      where: { id, gamingCenterId, isActive: true },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
    });
  },

  async createMenuItem(data: CreateMenuItemInput) {
    return prisma.menuItem.create({
      data,
    });
  },

  async updateMenuItem(id: string, data: UpdateMenuItemInput) {
    return prisma.menuItem.update({
      where: { id },
      data,
    });
  },

  async deleteMenuItem(id: string) {
    return prisma.menuItem.update({
      where: { id },
      data: { isActive: false },
    });
  },
};
