import { v4 as uuidv4 } from 'uuid';
import { GameStationType } from '@prisma/client';

export const GamingCenterFactory = {
  create(overrides = {}) {
    return {
      id: uuidv4(),
      name: 'Test Gaming Center',
      slug: `test-center-${uuidv4()}`,
      isActive: true,
      pcCount: 10,
      consoleCount: 5,
      hourlyRate: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  },
};

export const GameStationFactory = {
  create(overrides = {}) {
    return {
      id: uuidv4(),
      gamingCenterId: uuidv4(),
      name: 'Station 1',
      stationType: GameStationType.PC,
      hourlyPrice: 10,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  },
};
