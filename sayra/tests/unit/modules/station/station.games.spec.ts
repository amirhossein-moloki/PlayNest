import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { GamePlayMode } from '@prisma/client';
import {
  addGamesFromCatalog,
  getGamesForGamingCenter,
  removeGameFromGamingCenter,
  updateGamingCenterGameMode,
} from '../../../../src/modules/station/station.station';
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
    gamingCenterGame: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));
jest.mock('../../../../src/modules/audit/audit.station', () => ({
  auditService: { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) },
}));

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('GamingCenter Selected Games', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as any).mockImplementation(async (cb: any) =>
      typeof cb === 'function' ? cb(prisma) : cb
    );
    (prisma.gamingCenterGame.findMany as any).mockResolvedValue([]);
    (prisma.gamingCenterGame.findFirst as any).mockResolvedValue(null);
    (prisma.gameCatalog.findMany as any).mockResolvedValue([]);
  });

  it('should return selected games enriched with GameCatalog metadata, supportsOnline, and playMode', async () => {
    (prisma.gamingCenter.findUnique as any).mockResolvedValue({
      id: 'gc-1',
      games: ['FIFA 25', 'CS2', 'Custom Local Game'],
    });
    (prisma.gamingCenterGame.findMany as any).mockResolvedValue([
      {
        id: 'gcg-1',
        gamingCenterId: 'gc-1',
        gameCatalogId: 'game-1',
        playMode: GamePlayMode.ONLINE,
        gameCatalog: {
          id: 'game-1',
          title: 'FIFA 25',
          coverImageUrl: 'https://example.com/fifa25.jpg',
          supportedPlatforms: ['PLAYSTATION'],
          genre: 'Sports',
          description: 'Football game',
          supportsOnline: true,
          isActive: true,
        },
      },
      {
        id: 'gcg-2',
        gamingCenterId: 'gc-1',
        gameCatalogId: 'game-2',
        playMode: GamePlayMode.ONLINE,
        gameCatalog: {
          id: 'game-2',
          title: 'CS2',
          coverImageUrl: 'https://example.com/cs2.jpg',
          supportedPlatforms: ['PC'],
          genre: 'FPS',
          description: null,
          supportsOnline: false, // Even if stale row said ONLINE, response clamps to OFFLINE
          isActive: true,
        },
      },
    ]);

    const result = await getGamesForGamingCenter('gc-1');

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'game-1',
        title: 'FIFA 25',
        coverImageUrl: 'https://example.com/fifa25.jpg',
        supportsOnline: true,
        playMode: GamePlayMode.ONLINE,
      })
    );
    expect(result[1]).toEqual(
      expect.objectContaining({
        id: 'game-2',
        title: 'CS2',
        supportsOnline: false,
        playMode: GamePlayMode.OFFLINE,
      })
    );
    expect(result[2]).toEqual(
      expect.objectContaining({
        id: null,
        title: 'Custom Local Game',
        supportsOnline: false,
        playMode: GamePlayMode.OFFLINE,
      })
    );

    const onlineFiltered = await getGamesForGamingCenter('gc-1', { playMode: GamePlayMode.ONLINE });
    expect(onlineFiltered).toHaveLength(1);
    expect(onlineFiltered[0].title).toBe('FIFA 25');
  });

  it('should add games with selected playMode and reject ONLINE on offline-only catalog games', async () => {
    (prisma.gameCatalog.findMany as any).mockResolvedValueOnce([
      {
        id: 'game-online',
        title: 'Valorant',
        supportsOnline: true,
        isActive: true,
      },
    ]);
    (prisma.gamingCenter.findUnique as any).mockResolvedValueOnce({
      id: 'gc-1',
      games: [],
    });
    (prisma.gamingCenterGame.upsert as any).mockResolvedValueOnce({
      id: 'gcg-new',
      gamingCenterId: 'gc-1',
      gameCatalogId: 'game-online',
      playMode: GamePlayMode.ONLINE,
    });
    (prisma.gamingCenter.update as any).mockResolvedValueOnce({
      id: 'gc-1',
      games: ['Valorant'],
    });

    const ok = await addGamesFromCatalog('gc-1', {
      games: [{ gameCatalogId: 'game-online', playMode: GamePlayMode.ONLINE }],
    });

    expect(ok.addedGames).toEqual(['Valorant']);
    expect(ok.games[0]).toEqual(
      expect.objectContaining({
        id: 'game-online',
        supportsOnline: true,
        playMode: GamePlayMode.ONLINE,
      })
    );

    (prisma.gameCatalog.findMany as any).mockResolvedValueOnce([
      {
        id: 'game-offline',
        title: 'Cyberpunk 2077',
        supportsOnline: false,
        isActive: true,
      },
    ]);

    await expect(
      addGamesFromCatalog('gc-1', {
        games: [{ gameCatalogId: 'game-offline', playMode: GamePlayMode.ONLINE }],
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'ONLINE_MODE_NOT_SUPPORTED',
    });
  });

  it('should switch playMode via updateGamingCenterGameMode and reject invalid ONLINE mode or missing game', async () => {
    (prisma.gamingCenter.findUnique as any).mockResolvedValue({
      id: 'gc-1',
      games: ['Valorant', 'Cyberpunk 2077'],
    });

    (prisma.gamingCenterGame.findFirst as any).mockResolvedValueOnce({
      id: 'gcg-1',
      gamingCenterId: 'gc-1',
      gameCatalogId: 'game-online',
      playMode: GamePlayMode.OFFLINE,
      gameCatalog: {
        id: 'game-online',
        title: 'Valorant',
        supportsOnline: true,
        supportedPlatforms: ['PC'],
        isActive: true,
      },
    });
    (prisma.gamingCenterGame.upsert as any).mockResolvedValueOnce({
      id: 'gcg-1',
      gamingCenterId: 'gc-1',
      gameCatalogId: 'game-online',
      playMode: GamePlayMode.ONLINE,
    });

    const updated = await updateGamingCenterGameMode('gc-1', 'game-online', GamePlayMode.ONLINE);
    expect(updated.playMode).toBe(GamePlayMode.ONLINE);

    (prisma.gamingCenterGame.findFirst as any).mockResolvedValueOnce({
      id: 'gcg-2',
      gamingCenterId: 'gc-1',
      gameCatalogId: 'game-offline',
      playMode: GamePlayMode.OFFLINE,
      gameCatalog: {
        id: 'game-offline',
        title: 'Cyberpunk 2077',
        supportsOnline: false,
        supportedPlatforms: ['PC'],
        isActive: true,
      },
    });

    await expect(
      updateGamingCenterGameMode('gc-1', 'game-offline', GamePlayMode.ONLINE)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'ONLINE_MODE_NOT_SUPPORTED',
    });

    (prisma.gamingCenterGame.findFirst as any).mockResolvedValueOnce(null);
    (prisma.gameCatalog.findUnique as any).mockResolvedValueOnce(null);

    await expect(
      updateGamingCenterGameMode('gc-1', 'nonexistent-game', GamePlayMode.OFFLINE)
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('should remove game by GameCatalog id from both GamingCenterGame and GamingCenter.games', async () => {
    (prisma.gamingCenter.findUnique as any).mockResolvedValue({
      id: 'gc-1',
      games: ['FIFA 25', 'CS2'],
    });
    (prisma.gameCatalog.findUnique as any).mockResolvedValue({
      id: 'game-1',
      title: 'FIFA 25',
    });
    (prisma.gamingCenterGame.deleteMany as any).mockResolvedValue({ count: 1 });
    (prisma.gamingCenter.update as any).mockResolvedValue({
      id: 'gc-1',
      games: ['CS2'],
    });

    const result = await removeGameFromGamingCenter('gc-1', 'game-1');

    expect(prisma.gamingCenterGame.deleteMany).toHaveBeenCalledWith({
      where: { gamingCenterId: 'gc-1', gameCatalogId: 'game-1' },
    });
    expect(result.removedGame).toBe('FIFA 25');
    expect(result.allGames).toEqual(['CS2']);
  });

  it('should throw NOT_FOUND if gaming center does not exist', async () => {
    (prisma.gamingCenter.findUnique as any).mockResolvedValue(null);
    await expect(getGamesForGamingCenter('missing-gc')).rejects.toThrow(AppError);
  });
});
