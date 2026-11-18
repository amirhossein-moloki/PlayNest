import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { getGamesForGamingCenter, removeGameFromGamingCenter } from '../../../../src/modules/station/station.station';
import { prisma } from '../../../../src/config/prisma';
import AppError from '../../../../src/common/errors/AppError';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    gamingCenter: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    gameCatalog: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('../../../../src/modules/audit/audit.station', () => ({
  auditService: { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) },
}));

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('GamingCenter Selected Games', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return selected games enriched with GameCatalog metadata', async () => {
    (prisma.gamingCenter.findUnique as any).mockResolvedValue({
      id: 'gc-1',
      games: ['FIFA 25', 'Custom Local Game'],
    });
    (prisma.gameCatalog.findMany as any).mockResolvedValue([
      {
        id: 'game-1',
        title: 'FIFA 25',
        coverImageUrl: 'https://example.com/fifa25.jpg',
        supportedPlatforms: ['PLAYSTATION'],
        genre: 'Sports',
        description: 'Football game',
        isActive: true,
      },
    ]);

    const result = await getGamesForGamingCenter('gc-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'game-1',
        title: 'FIFA 25',
        coverImageUrl: 'https://example.com/fifa25.jpg',
      })
    );
    expect(result[1]).toEqual(
      expect.objectContaining({
        id: null,
        title: 'Custom Local Game',
      })
    );
  });

  it('should remove game by GameCatalog id from gaming center', async () => {
    (prisma.gamingCenter.findUnique as any).mockResolvedValue({
      id: 'gc-1',
      games: ['FIFA 25', 'CS2'],
    });
    (prisma.gameCatalog.findUnique as any).mockResolvedValue({
      title: 'FIFA 25',
    });
    (prisma.gamingCenter.update as any).mockResolvedValue({
      id: 'gc-1',
      games: ['CS2'],
    });

    const result = await removeGameFromGamingCenter('gc-1', 'game-1');

    expect(result.removedGame).toBe('FIFA 25');
    expect(result.allGames).toEqual(['CS2']);
  });

  it('should throw NOT_FOUND if gaming center does not exist', async () => {
    (prisma.gamingCenter.findUnique as any).mockResolvedValue(null);
    await expect(getGamesForGamingCenter('missing-gc')).rejects.toThrow(AppError);
  });
});
