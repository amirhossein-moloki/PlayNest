import { GamePlayMode, GameStationType } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { normalizeSearchText, slugifyGameTitle, toCompactSearchKey } from '../src/common/utils/searchText';

interface SeedGameEntry {
  slug: string;
  title: string;
  titleFa: string;
  titleEn: string;
  category: string;
  genre: string;
  supportedPlatforms: GameStationType[];
  supportsOnline: boolean;
  popularityScore: number;
  coverImageUrl: string;
  aliases: Array<{ alias: string; locale?: 'fa' | 'en' }>;
}

const CURATED_GAMES: SeedGameEntry[] = [
  {
    slug: 'ea-sports-fc-26',
    title: 'EA Sports FC 26',
    titleFa: 'اف سی ۲۶',
    titleEn: 'EA Sports FC 26',
    category: 'SPORTS',
    genre: 'Sports / Football',
    supportedPlatforms: [GameStationType.PLAYSTATION_5, GameStationType.PLAYSTATION_4, GameStationType.XBOX, GameStationType.PC],
    supportsOnline: true,
    popularityScore: 100,
    coverImageUrl: '/uploads/games/fc26.jpg',
    aliases: [
      { alias: 'FC 26', locale: 'en' },
      { alias: 'FC26', locale: 'en' },
      { alias: 'FIFA 26', locale: 'en' },
      { alias: 'FIFA26', locale: 'en' },
      { alias: 'فیفا 26', locale: 'fa' },
      { alias: 'فیفا ۲۶', locale: 'fa' },
      { alias: 'اف سی 26', locale: 'fa' },
      { alias: 'اف سی ۲۶', locale: 'fa' },
    ],
  },
  {
    slug: 'ea-sports-fc-25',
    title: 'EA Sports FC 25',
    titleFa: 'اف سی ۲۵',
    titleEn: 'EA Sports FC 25',
    category: 'SPORTS',
    genre: 'Sports / Football',
    supportedPlatforms: [GameStationType.PLAYSTATION_5, GameStationType.PLAYSTATION_4, GameStationType.XBOX, GameStationType.PC],
    supportsOnline: true,
    popularityScore: 95,
    coverImageUrl: '/uploads/games/fc25.jpg',
    aliases: [
      { alias: 'FC 25', locale: 'en' },
      { alias: 'FC25', locale: 'en' },
      { alias: 'FIFA 25', locale: 'en' },
      { alias: 'FIFA25', locale: 'en' },
      { alias: 'فیفا 25', locale: 'fa' },
      { alias: 'فیفا ۲۵', locale: 'fa' },
      { alias: 'اف سی 25', locale: 'fa' },
      { alias: 'اف سی ۲۵', locale: 'fa' },
    ],
  },
  {
    slug: 'grand-theft-auto-v',
    title: 'Grand Theft Auto V',
    titleFa: 'جی تی ای ۵',
    titleEn: 'Grand Theft Auto V',
    category: 'OPEN_WORLD',
    genre: 'Action / Open World',
    supportedPlatforms: [GameStationType.PC, GameStationType.PLAYSTATION_5, GameStationType.PLAYSTATION_4, GameStationType.XBOX],
    supportsOnline: true,
    popularityScore: 96,
    coverImageUrl: '/uploads/games/gta-v.jpg',
    aliases: [
      { alias: 'GTA V', locale: 'en' },
      { alias: 'GTA 5', locale: 'en' },
      { alias: 'GTA5', locale: 'en' },
      { alias: 'GTA Online', locale: 'en' },
      { alias: 'جی تی ای 5', locale: 'fa' },
      { alias: 'جی تی ای ۵', locale: 'fa' },
      { alias: 'جی تی ای وی', locale: 'fa' },
    ],
  },
  {
    slug: 'valorant',
    title: 'Valorant',
    titleFa: 'ولورانت',
    titleEn: 'Valorant',
    category: 'FPS',
    genre: 'Tactical Shooter',
    supportedPlatforms: [GameStationType.PC, GameStationType.PLAYSTATION_5, GameStationType.XBOX],
    supportsOnline: true,
    popularityScore: 94,
    coverImageUrl: '/uploads/games/valorant.jpg',
    aliases: [
      { alias: 'VAL', locale: 'en' },
      { alias: 'ولورانت', locale: 'fa' },
      { alias: 'والورانت', locale: 'fa' },
    ],
  },
  {
    slug: 'call-of-duty-warzone',
    title: 'Call of Duty: Warzone',
    titleFa: 'کالاف دیوتی وارزون',
    titleEn: 'Call of Duty: Warzone',
    category: 'FPS',
    genre: 'Battle Royale / Shooter',
    supportedPlatforms: [GameStationType.PC, GameStationType.PLAYSTATION_5, GameStationType.PLAYSTATION_4, GameStationType.XBOX],
    supportsOnline: true,
    popularityScore: 95,
    coverImageUrl: '/uploads/games/cod-warzone.jpg',
    aliases: [
      { alias: 'Call of Duty', locale: 'en' },
      { alias: 'COD', locale: 'en' },
      { alias: 'Warzone', locale: 'en' },
      { alias: 'COD Warzone', locale: 'en' },
      { alias: 'کالاف', locale: 'fa' },
      { alias: 'کال اف دیوتی', locale: 'fa' },
      { alias: 'کالاف دیوتی', locale: 'fa' },
      { alias: 'وارزون', locale: 'fa' },
    ],
  },
  {
    slug: 'call-of-duty-modern-warfare-iii',
    title: 'Call of Duty: Modern Warfare III',
    titleFa: 'کالاف دیوتی مدرن وارفر ۳',
    titleEn: 'Call of Duty: Modern Warfare III',
    category: 'FPS',
    genre: 'First-Person Shooter',
    supportedPlatforms: [GameStationType.PC, GameStationType.PLAYSTATION_5, GameStationType.PLAYSTATION_4, GameStationType.XBOX],
    supportsOnline: true,
    popularityScore: 88,
    coverImageUrl: '/uploads/games/cod-mw3.jpg',
    aliases: [
      { alias: 'MW3', locale: 'en' },
      { alias: 'COD MW3', locale: 'en' },
      { alias: 'مدرن وارفر 3', locale: 'fa' },
      { alias: 'مدرن وارفر ۳', locale: 'fa' },
    ],
  },
  {
    slug: 'fortnite',
    title: 'Fortnite',
    titleFa: 'فورتنایت',
    titleEn: 'Fortnite',
    category: 'BATTLE_ROYALE',
    genre: 'Battle Royale',
    supportedPlatforms: [GameStationType.PC, GameStationType.PLAYSTATION_5, GameStationType.PLAYSTATION_4, GameStationType.XBOX, GameStationType.SWITCH],
    supportsOnline: true,
    popularityScore: 92,
    coverImageUrl: '/uploads/games/fortnite.jpg',
    aliases: [
      { alias: 'FN', locale: 'en' },
      { alias: 'فورتنایت', locale: 'fa' },
      { alias: 'فورت نایت', locale: 'fa' },
    ],
  },
  {
    slug: 'minecraft',
    title: 'Minecraft',
    titleFa: 'ماینکرفت',
    titleEn: 'Minecraft',
    category: 'SANDBOX',
    genre: 'Sandbox / Survival',
    supportedPlatforms: [GameStationType.PC, GameStationType.PLAYSTATION_5, GameStationType.PLAYSTATION_4, GameStationType.XBOX, GameStationType.SWITCH],
    supportsOnline: true,
    popularityScore: 90,
    coverImageUrl: '/uploads/games/minecraft.jpg',
    aliases: [
      { alias: 'MC', locale: 'en' },
      { alias: 'ماینکرفت', locale: 'fa' },
      { alias: 'ماین کرافت', locale: 'fa' },
    ],
  },
  {
    slug: 'pubg-battlegrounds',
    title: 'PUBG: Battlegrounds',
    titleFa: 'پابجی',
    titleEn: 'PUBG: Battlegrounds',
    category: 'BATTLE_ROYALE',
    genre: 'Battle Royale',
    supportedPlatforms: [GameStationType.PC, GameStationType.PLAYSTATION_5, GameStationType.PLAYSTATION_4, GameStationType.XBOX],
    supportsOnline: true,
    popularityScore: 91,
    coverImageUrl: '/uploads/games/pubg.jpg',
    aliases: [
      { alias: 'PUBG', locale: 'en' },
      { alias: 'پابجی', locale: 'fa' },
      { alias: 'پاب جی', locale: 'fa' },
    ],
  },
  {
    slug: 'counter-strike-2',
    title: 'Counter-Strike 2',
    titleFa: 'کانتر استرایک ۲',
    titleEn: 'Counter-Strike 2',
    category: 'FPS',
    genre: 'Tactical Shooter',
    supportedPlatforms: [GameStationType.PC],
    supportsOnline: true,
    popularityScore: 96,
    coverImageUrl: '/uploads/games/cs2.jpg',
    aliases: [
      { alias: 'CS2', locale: 'en' },
      { alias: 'CS:GO', locale: 'en' },
      { alias: 'CSGO', locale: 'en' },
      { alias: 'کانتر', locale: 'fa' },
      { alias: 'کانتر ۲', locale: 'fa' },
      { alias: 'کانتر 2', locale: 'fa' },
    ],
  },
  {
    slug: 'dota-2',
    title: 'Dota 2',
    titleFa: 'دوتا ۲',
    titleEn: 'Dota 2',
    category: 'MOBA',
    genre: 'MOBA',
    supportedPlatforms: [GameStationType.PC],
    supportsOnline: true,
    popularityScore: 90,
    coverImageUrl: '/uploads/games/dota2.jpg',
    aliases: [
      { alias: 'Dota2', locale: 'en' },
      { alias: 'دوتا', locale: 'fa' },
      { alias: 'دوتا 2', locale: 'fa' },
      { alias: 'دوتا ۲', locale: 'fa' },
    ],
  },
  {
    slug: 'efootball-pes',
    title: 'eFootball',
    titleFa: 'پی اس / ای فوتبال',
    titleEn: 'eFootball',
    category: 'SPORTS',
    genre: 'Sports / Football',
    supportedPlatforms: [GameStationType.PLAYSTATION_5, GameStationType.PLAYSTATION_4, GameStationType.XBOX, GameStationType.PC],
    supportsOnline: true,
    popularityScore: 87,
    coverImageUrl: '/uploads/games/efootball.jpg',
    aliases: [
      { alias: 'PES', locale: 'en' },
      { alias: 'PES 2021', locale: 'en' },
      { alias: 'eFootball PES', locale: 'en' },
      { alias: 'پی اس', locale: 'fa' },
      { alias: 'ای فوتبال', locale: 'fa' },
    ],
  },
  {
    slug: 'tekken-8',
    title: 'Tekken 8',
    titleFa: 'تکن ۸',
    titleEn: 'Tekken 8',
    category: 'FIGHTING',
    genre: 'Fighting',
    supportedPlatforms: [GameStationType.PLAYSTATION_5, GameStationType.XBOX, GameStationType.PC],
    supportsOnline: true,
    popularityScore: 84,
    coverImageUrl: '/uploads/games/tekken8.jpg',
    aliases: [
      { alias: 'Tekken', locale: 'en' },
      { alias: 'تکن', locale: 'fa' },
      { alias: 'تکن 8', locale: 'fa' },
      { alias: 'تکن ۸', locale: 'fa' },
    ],
  },
  {
    slug: 'mortal-kombat-1',
    title: 'Mortal Kombat 1',
    titleFa: 'مورتال کامبت ۱',
    titleEn: 'Mortal Kombat 1',
    category: 'FIGHTING',
    genre: 'Fighting',
    supportedPlatforms: [GameStationType.PLAYSTATION_5, GameStationType.XBOX, GameStationType.PC, GameStationType.SWITCH],
    supportsOnline: true,
    popularityScore: 85,
    coverImageUrl: '/uploads/games/mk1.jpg',
    aliases: [
      { alias: 'MK1', locale: 'en' },
      { alias: 'Mortal Kombat', locale: 'en' },
      { alias: 'مورتال کامبت', locale: 'fa' },
      { alias: 'مورتال کمبت', locale: 'fa' },
    ],
  },
  {
    slug: 'red-dead-redemption-2',
    title: 'Red Dead Redemption 2',
    titleFa: 'رد دد ردمپشن ۲',
    titleEn: 'Red Dead Redemption 2',
    category: 'OPEN_WORLD',
    genre: 'Action / Adventure',
    supportedPlatforms: [GameStationType.PC, GameStationType.PLAYSTATION_5, GameStationType.PLAYSTATION_4, GameStationType.XBOX],
    supportsOnline: true,
    popularityScore: 89,
    coverImageUrl: '/uploads/games/rdr2.jpg',
    aliases: [
      { alias: 'RDR2', locale: 'en' },
      { alias: 'Red Dead 2', locale: 'en' },
      { alias: 'رد دد', locale: 'fa' },
      { alias: 'رد دد 2', locale: 'fa' },
      { alias: 'رد دد ۲', locale: 'fa' },
    ],
  },
  {
    slug: 'rocket-league',
    title: 'Rocket League',
    titleFa: 'راکت لیگ',
    titleEn: 'Rocket League',
    category: 'RACING',
    genre: 'Sports / Racing',
    supportedPlatforms: [GameStationType.PC, GameStationType.PLAYSTATION_5, GameStationType.PLAYSTATION_4, GameStationType.XBOX, GameStationType.SWITCH],
    supportsOnline: true,
    popularityScore: 82,
    coverImageUrl: '/uploads/games/rocket-league.jpg',
    aliases: [
      { alias: 'RL', locale: 'en' },
      { alias: 'راکت لیگ', locale: 'fa' },
    ],
  },
  {
    slug: 'rainbow-six-siege',
    title: 'Rainbow Six Siege',
    titleFa: 'رینبو سیکس سیج',
    titleEn: 'Rainbow Six Siege',
    category: 'FPS',
    genre: 'Tactical Shooter',
    supportedPlatforms: [GameStationType.PC, GameStationType.PLAYSTATION_5, GameStationType.PLAYSTATION_4, GameStationType.XBOX],
    supportsOnline: true,
    popularityScore: 86,
    coverImageUrl: '/uploads/games/r6s.jpg',
    aliases: [
      { alias: 'R6', locale: 'en' },
      { alias: 'R6S', locale: 'en' },
      { alias: 'رینبو', locale: 'fa' },
      { alias: 'رینبو سیکس', locale: 'fa' },
    ],
  },
  {
    slug: 'apex-legends',
    title: 'Apex Legends',
    titleFa: 'اپکس لجندز',
    titleEn: 'Apex Legends',
    category: 'BATTLE_ROYALE',
    genre: 'Battle Royale / FPS',
    supportedPlatforms: [GameStationType.PC, GameStationType.PLAYSTATION_5, GameStationType.PLAYSTATION_4, GameStationType.XBOX, GameStationType.SWITCH],
    supportsOnline: true,
    popularityScore: 85,
    coverImageUrl: '/uploads/games/apex.jpg',
    aliases: [
      { alias: 'Apex', locale: 'en' },
      { alias: 'اپکس', locale: 'fa' },
    ],
  },
  {
    slug: 'league-of-legends',
    title: 'League of Legends',
    titleFa: 'لیگ اف لجندز',
    titleEn: 'League of Legends',
    category: 'MOBA',
    genre: 'MOBA',
    supportedPlatforms: [GameStationType.PC],
    supportsOnline: true,
    popularityScore: 88,
    coverImageUrl: '/uploads/games/lol.jpg',
    aliases: [
      { alias: 'LoL', locale: 'en' },
      { alias: 'لیگ اف لجندز', locale: 'fa' },
    ],
  },
];

export async function runGameCatalogBackfill() {
  const catalogAliasMap = new Map<string, { id: string; title: string }>();

  for (const entry of CURATED_GAMES) {
    const normalizedKey = toCompactSearchKey(entry.titleEn);
    const existing = await prisma.gameCatalog.findFirst({
      where: {
        OR: [
          { slug: entry.slug },
          { normalizedKey },
          { title: { equals: entry.title, mode: 'insensitive' } },
        ],
      },
    });

    const record = existing
      ? await prisma.gameCatalog.update({
        where: { id: existing.id },
        data: {
          slug: existing.slug ?? entry.slug,
          titleFa: existing.titleFa ?? entry.titleFa,
          titleEn: existing.titleEn ?? entry.titleEn,
          category: existing.category ?? entry.category,
          genre: existing.genre ?? entry.genre,
          normalizedKey: existing.normalizedKey ?? normalizedKey,
          popularityScore: Math.max(existing.popularityScore ?? 0, entry.popularityScore),
          supportsOnline: existing.supportsOnline || entry.supportsOnline,
        },
      })
      : await prisma.gameCatalog.create({
        data: {
          slug: entry.slug,
          title: entry.title,
          titleFa: entry.titleFa,
          titleEn: entry.titleEn,
          category: entry.category,
          genre: entry.genre,
          normalizedKey,
          popularityScore: entry.popularityScore,
          coverImageUrl: entry.coverImageUrl,
          supportedPlatforms: entry.supportedPlatforms,
          supportsOnline: entry.supportsOnline,
          isActive: true,
        },
      });

    const allAliases: Array<{ alias: string; locale?: string }> = [
      { alias: record.title, locale: 'en' },
      ...(record.titleFa ? [{ alias: record.titleFa, locale: 'fa' }] : []),
      ...(record.titleEn ? [{ alias: record.titleEn, locale: 'en' }] : []),
      ...entry.aliases,
    ];

    for (const a of allAliases) {
      const normalized = normalizeSearchText(a.alias);
      if (!normalized) continue;

      await prisma.gameAlias.upsert({
        where: {
          gameCatalogId_normalized: {
            gameCatalogId: record.id,
            normalized,
          },
        },
        update: {},
        create: {
          gameCatalogId: record.id,
          alias: a.alias,
          normalized,
          locale: a.locale ?? null,
        },
      });

      catalogAliasMap.set(normalized, { id: record.id, title: record.title });
      catalogAliasMap.set(toCompactSearchKey(a.alias), { id: record.id, title: record.title });
    }
  }

  // Also index any existing non-curated GameCatalog rows
  const allCatalogRows = await prisma.gameCatalog.findMany({
    include: { aliases: true },
  });
  for (const row of allCatalogRows) {
    if (!row.slug) {
      const baseSlug = slugifyGameTitle(row.title) || `game-${row.id.slice(0, 8)}`;
      const conflict = await prisma.gameCatalog.findUnique({ where: { slug: baseSlug } });
      await prisma.gameCatalog.update({
        where: { id: row.id },
        data: {
          slug: conflict && conflict.id !== row.id ? `${baseSlug}-${row.id.slice(0, 6)}` : baseSlug,
          titleEn: row.titleEn ?? row.title,
          normalizedKey: row.normalizedKey ?? toCompactSearchKey(row.title),
        },
      });
    }
    const keys = [row.title, row.titleFa, row.titleEn, ...row.aliases.map((a) => a.alias)].filter(
      (v): v is string => Boolean(v)
    );
    for (const k of keys) {
      catalogAliasMap.set(normalizeSearchText(k), { id: row.id, title: row.title });
      catalogAliasMap.set(toCompactSearchKey(k), { id: row.id, title: row.title });
    }
  }

  // Backfill GamingCenter.games string arrays into GamingCenterGame (preserving legacy array)
  const centers = await prisma.gamingCenter.findMany({
    select: { id: true, name: true, games: true },
  });

  let linkedCount = 0;
  const unmatched: Array<{ gamingCenterId: string; title: string }> = [];

  for (const center of centers) {
    for (const rawTitle of center.games || []) {
      const norm = normalizeSearchText(rawTitle);
      const compact = toCompactSearchKey(rawTitle);
      const matched = catalogAliasMap.get(norm) ?? catalogAliasMap.get(compact);
      if (matched) {
        await prisma.gamingCenterGame.upsert({
          where: {
            gamingCenterId_gameCatalogId: {
              gamingCenterId: center.id,
              gameCatalogId: matched.id,
            },
          },
          update: {},
          create: {
            gamingCenterId: center.id,
            gameCatalogId: matched.id,
            playMode: GamePlayMode.OFFLINE,
          },
        });
        linkedCount += 1;
      } else if (rawTitle.trim()) {
        unmatched.push({ gamingCenterId: center.id, title: rawTitle });
      }
    }
  }

  return {
    curatedGamesProcessed: CURATED_GAMES.length,
    totalCatalogGames: allCatalogRows.length,
    centerLinksEnsured: linkedCount,
    unmatchedLegacyTitles: unmatched,
  };
}

if (require.main === module) {
  runGameCatalogBackfill()
    .then((summary) => {
      console.log('Game catalog backfill completed:', JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Game catalog backfill failed:', err);
      process.exit(1);
    });
}
