import request from 'supertest';
import jwt from 'jsonwebtoken';
import { GamePlayMode, GameStationType, GamingCenterVerificationStatus } from '@prisma/client';
import app from '../../../src/app';
import { env } from '../../../src/config/env';
import { prisma } from '../../../src/config/prisma';

const FORBIDDEN_PRIVATE_KEYS = [
  'owner',
  'ownerId',
  'manager',
  'managerId',
  'phone',
  'email',
  'password',
  'passwordHash',
  'verificationDocuments',
  'reservations',
  'commissionRate',
] as const;

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../src/config/prisma', () => {
  const mockPrisma: any = {
    gamingCenter: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    gameCatalog: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    gameAlias: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    gamingCenterGame: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    gameStation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    gameStationGame: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    gamingCenterSchedule: {
      findMany: jest.fn(),
    },
    rating: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    reservation: {
      findMany: jest.fn(),
    },
    bookingHold: {
      findMany: jest.fn(),
    },
    stationMaintenance: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    platformAdmin: {
      findUnique: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: any) => any) => cb(mockPrisma));
  return { prisma: mockPrisma };
});

describe('PlayNest Unified Search, Catalog Intelligence & Filters API', () => {
  const adminId = 'cladmin000000000000000001';
  const managerUserId = 'cluser0000000000000000001';

  let adminToken: string;
  let managerToken: string;

  const catalogFc26 = {
    id: 'cgamefc260000000000000001',
    slug: 'fc-26',
    title: 'EA Sports FC 26',
    titleFa: 'اف سی ۲۶',
    titleEn: 'EA Sports FC 26',
    category: 'SPORTS',
    genre: 'Sports',
    description: 'Football simulation game',
    coverImageUrl: 'https://cdn.example.com/fc26.jpg',
    supportedPlatforms: [GameStationType.PLAYSTATION_5, GameStationType.PLAYSTATION_4, GameStationType.XBOX],
    supportsOnline: true,
    popularityScore: 1000,
    normalizedKey: 'easportsfc26',
    isActive: true,
    aliases: [
      { alias: 'FC 26', normalized: 'fc 26', locale: 'en' },
      { alias: 'FIFA 26', normalized: 'fifa 26', locale: 'en' },
      { alias: 'فیفا ۲۶', normalized: 'فیفا 26', locale: 'fa' },
      { alias: 'اف‌سی 26', normalized: 'اف سی 26', locale: 'fa' },
    ],
  };

  const catalogValorant = {
    id: 'cgamevalo0000000000000002',
    slug: 'valorant',
    title: 'Valorant',
    titleFa: 'ولورانت',
    titleEn: 'Valorant',
    category: 'FPS',
    genre: 'FPS',
    description: '5v5 tactical shooter',
    coverImageUrl: 'https://cdn.example.com/valorant.jpg',
    supportedPlatforms: [GameStationType.PC],
    supportsOnline: true,
    popularityScore: 900,
    normalizedKey: 'valorant',
    isActive: true,
    aliases: [
      { alias: 'Valorant', normalized: 'valorant', locale: 'en' },
      { alias: 'والورانت', normalized: 'والورانت', locale: 'fa' },
    ],
  };

  const catalogGtaV = {
    id: 'cgamegtav0000000000000003',
    slug: 'gta-v',
    title: 'Grand Theft Auto V',
    titleFa: 'جی تی ای وی',
    titleEn: 'Grand Theft Auto V',
    category: 'OPEN_WORLD',
    genre: 'Action',
    description: 'Open world action game',
    coverImageUrl: 'https://cdn.example.com/gtav.jpg',
    supportedPlatforms: [GameStationType.PC, GameStationType.PLAYSTATION_5],
    supportsOnline: true,
    popularityScore: 950,
    normalizedKey: 'grandtheftautov',
    isActive: true,
    aliases: [
      { alias: 'GTA V', normalized: 'gta v', locale: 'en' },
      { alias: 'GTA 5', normalized: 'gta 5', locale: 'en' },
      { alias: 'جی تی ای 5', normalized: 'جی تی ای 5', locale: 'fa' },
    ],
  };

  const baseNow = new Date();
  const makeCenter = (overrides: Record<string, any> = {}) => {
    const id = overrides.id || 'ccenter000000000000000001';
    return {
      id,
      name: 'گیم‌نت پارس آرنا',
      slug: 'pars-arena',
      description: 'مجهز به سیستم‌های حرفه‌ای',
      isActive: true,
      verificationStatus: GamingCenterVerificationStatus.APPROVED,
      pcCount: 8,
      consoleCount: 6,
      openingTime: '00:00',
      closingTime: '00:00', // 24h open by default for deterministic tests
      closedDays: [],
      timezone: 'Asia/Tehran',
      hourlyRate: 150000,
      vipHourlyRate: 220000,
      hasFoodService: true,
      games: [],
      // Private sensitive fields that MUST NOT leak publicly
      ownerId: 'owner_secret_123',
      phone: '09120000000',
      email: 'secret@center.ir',
      commissionRate: 0.15,
      createdAt: new Date('2026-01-10T00:00:00.000Z'),
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      addresses: [
        {
          province: 'تهران',
          city: 'تهران',
          district: 'ونک',
          addressLine: 'میدان ونک، خیابان ملاصدرا',
          lat: 35.7575,
          lng: 51.4099,
          isPrimary: true,
          createdAt: new Date('2026-01-10T00:00:00.000Z'),
        },
      ],
      stations: [
        {
          id: `${id}_ps5_vip`,
          name: 'PS5 VIP Room 1',
          stationType: GameStationType.PLAYSTATION_5,
          hourlyPrice: 200000,
          isVip: true,
          isActive: true,
          stationGames: [],
        },
        {
          id: `${id}_pc_1`,
          name: 'PC Pro 1',
          stationType: GameStationType.PC,
          hourlyPrice: 120000,
          isVip: false,
          isActive: true,
          stationGames: [],
        },
      ],
      settings: {
        workStartTime: '00:00',
        workEndTime: '00:00',
        timeZone: 'Asia/Tehran',
        allowOnlineBooking: true,
      },
      schedules: [],
      media: [
        {
          url: 'https://cdn.example.com/center-cover.jpg',
          thumbUrl: 'https://cdn.example.com/center-thumb.jpg',
          altText: 'Cover',
          purpose: 'COVER',
          isActive: true,
          sortOrder: 0,
        },
      ],
      discounts: [],
      discountCampaigns: [],
      closures: [],
      centerGames: [
        {
          gameCatalogId: catalogFc26.id,
          playMode: GamePlayMode.ONLINE,
          platforms: [GameStationType.PLAYSTATION_5],
        },
      ],
      stationExtraControllers: [{ id: 'ec_1' }],
      ...overrides,
    };
  };

  let allCenters: any[] = [];
  let allRatings: Array<{ gamingCenterId: string; rating: number; createdAt: Date }> = [];

  beforeAll(() => {
    const SECRET = env.JWT_ACCESS_SECRET || 'test-access-secret';
    adminToken = jwt.sign(
      { sessionId: 'sess_admin', actorId: adminId, actorType: 'PLATFORM_ADMIN', mfaVerified: true },
      SECRET,
      { expiresIn: '1h' }
    );
    managerToken = jwt.sign(
      { sessionId: 'sess_mgr', actorId: managerUserId, actorType: 'USER' },
      SECRET,
      { expiresIn: '1h' }
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: any) => any) => cb(prisma));

    (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: adminId,
      isActive: true,
      isSuperuser: true,
      totpEnabled: true,
      totpSetupCompleted: true,
      role: 'SUPERUSER',
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: managerUserId,
      isActive: true,
      role: 'MANAGER',
      gamingCenterId: 'ccenter000000000000000001',
    });
    (prisma.session.findUnique as jest.Mock).mockImplementation(async ({ where }: any) => {
      if (where?.id === 'sess_admin') {
        return {
          id: 'sess_admin',
          actorId: adminId,
          actorType: 'PLATFORM_ADMIN',
          mfaVerifiedAt: new Date(),
          revokedAt: null,
          expiresAt: new Date(Date.now() + 3600_000),
        };
      }
      if (where?.id === 'sess_mgr') {
        return {
          id: 'sess_mgr',
          actorId: managerUserId,
          actorType: 'USER',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 3600_000),
        };
      }
      return null;
    });

    (prisma.gameCatalog.findMany as jest.Mock).mockResolvedValue([
      catalogFc26,
      catalogValorant,
      catalogGtaV,
    ]);
    (prisma.rating.findMany as jest.Mock).mockImplementation(async () => allRatings);
    (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.bookingHold.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.stationMaintenance.findMany as jest.Mock).mockResolvedValue([]);

    allCenters = [];
    allRatings = [];
    (prisma.gamingCenter.findMany as jest.Mock).mockImplementation(async (args: any) => {
      // Simulate Prisma's mandatory public where constraint in case a center in fixture is inactive/unapproved
      if (args?.where?.isActive === true && args?.where?.verificationStatus === 'APPROVED') {
        return allCenters.filter(
          (c) => c.isActive === true && c.verificationStatus === GamingCenterVerificationStatus.APPROVED
        );
      }
      return allCenters;
    });
  });

  it('1. Searches gaming centers by name across Persian/Arabic characters, ZWNJ, and guarded typos', async () => {
    const center = makeCenter({
      id: 'c1',
      name: 'گیم‌نت پارس آرنا',
      centerGames: [],
    });
    allCenters = [center];

    // Query uses Arabic ي / ك style spacing and no ZWNJ
    const res = await request(app).get(
      `/api/public/search/gamecenters?q=${encodeURIComponent('گيم نت پارس آرنا')}`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data).toHaveLength(1);
    expect(res.body.data.data[0].id).toBe('c1');
    expect(res.body.data.data[0].searchRelevance.textScore).toBeGreaterThan(20);

    // Typo query on center name (>=4 chars): "گیمنت پارس ارن" vs "آرنا" -> wait use explicit English/Latin typo on slug/name
    const typoCenter = makeCenter({ id: 'c2', name: 'CyberPulse Arena', slug: 'cyberpulse-arena', centerGames: [] });
    allCenters = [typoCenter];
    const typoRes = await request(app).get('/api/public/search/gamecenters?q=CyberPuls');
    expect(typoRes.status).toBe(200);
    expect(typoRes.body.data.data).toHaveLength(1);
    expect(typoRes.body.data.data[0].id).toBe('c2');
  });

  it('2. Finds centers strictly by verified catalog/station game links and rejects centers mentioning game only in description', async () => {
    const verifiedCenter = makeCenter({
      id: 'c_verified',
      name: 'Tehran Pro Gaming',
      description: 'بهترین تجهیزات گیمینگ',
      centerGames: [
        { gameCatalogId: catalogFc26.id, playMode: GamePlayMode.ONLINE, platforms: [GameStationType.PLAYSTATION_5] },
      ],
    });
    const descriptionOnlyFakeCenter = makeCenter({
      id: 'c_fake_desc',
      name: 'FC 26 Lounge & Cafe',
      description: 'دارای بازی های روز مثل FC 26 و FIFA 26 و GTA V با محیط دنج',
      centerGames: [], // NO real game link!
      stations: [
        {
          id: 'st_fake_ps5',
          name: 'PS5-1',
          stationType: GameStationType.PLAYSTATION_5,
          hourlyPrice: 150000,
          isVip: false,
          isActive: true,
          stationGames: [],
        },
      ],
    });

    allCenters = [verifiedCenter, descriptionOnlyFakeCenter];

    // Search explicitly by game aliases: FIFA 26 / فیفا ۲۶ / FC 26
    for (const qGame of ['FC 26', 'FIFA 26', 'فیفا ۲۶']) {
      const res = await request(app).get(
        `/api/public/search/gamecenters?game=${encodeURIComponent(qGame)}`
      );
      expect(res.status).toBe(200);
      expect(res.body.data.data.map((c: any) => c.id)).toEqual(['c_verified']);
      expect(res.body.data.data[0].matchedGames[0].availablePlatforms).toEqual(['PLAYSTATION 5']);
      expect(res.body.data.data[0].matchedGames[0].stations.length).toBeGreaterThan(0);
    }

    // Unified q=FIFA 26 resolves to catalog game and still excludes descriptionOnlyFakeCenter because of missing link
    const qRes = await request(app).get('/api/public/search/gamecenters?q=FIFA%2026');
    expect(qRes.status).toBe(200);
    expect(qRes.body.data.data.map((c: any) => c.id)).toEqual(['c_verified']);
  });

  it('3. Respects station-level GameStationGame assignments and excludes inactive/incompatible stations', async () => {
    const stationScopedCenter = makeCenter({
      id: 'c_station_scoped',
      centerGames: [
        { gameCatalogId: catalogValorant.id, playMode: GamePlayMode.ONLINE, platforms: [GameStationType.PC] },
      ],
      stations: [
        {
          id: 'st_pc_active_val',
          name: 'PC Valorant Pro',
          stationType: GameStationType.PC,
          hourlyPrice: 100000,
          isVip: true,
          isActive: true,
          stationGames: [{ gameCatalogId: catalogValorant.id, playMode: GamePlayMode.ONLINE, isActive: true }],
        },
        {
          id: 'st_pc_inactive',
          name: 'PC Broken',
          stationType: GameStationType.PC,
          hourlyPrice: 80000,
          isVip: false,
          isActive: false,
          stationGames: [{ gameCatalogId: catalogValorant.id, playMode: GamePlayMode.ONLINE, isActive: true }],
        },
        {
          id: 'st_ps5_wrong',
          name: 'PS5 Console',
          stationType: GameStationType.PLAYSTATION_5,
          hourlyPrice: 180000,
          isVip: false,
          isActive: true,
          stationGames: [],
        },
      ],
    });
    const inactiveOnlyCenter = makeCenter({
      id: 'c_inactive_st',
      centerGames: [
        { gameCatalogId: catalogValorant.id, playMode: GamePlayMode.ONLINE, platforms: [GameStationType.PC] },
      ],
      stations: [
        {
          id: 'st_down',
          name: 'PC Offline Maintenance',
          stationType: GameStationType.PC,
          hourlyPrice: 90000,
          isVip: false,
          isActive: false, // inactive station cannot satisfy game search!
          stationGames: [{ gameCatalogId: catalogValorant.id, playMode: GamePlayMode.ONLINE, isActive: true }],
        },
      ],
    });

    allCenters = [stationScopedCenter, inactiveOnlyCenter];

    const res = await request(app).get('/api/public/search/gamecenters?game=Valorant');
    expect(res.status).toBe(200);
    expect(res.body.data.data.map((c: any) => c.id)).toEqual(['c_station_scoped']);
    const stations = res.body.data.data[0].matchedGames[0].stations;
    expect(stations).toHaveLength(1);
    expect(stations[0].id).toBe('st_pc_active_val');
  });

  it('4. Combines game, city, PS5 alias, VIP amenity, isOpen, discounted pricing, and minRating', async () => {
    const targetCenter = makeCenter({
      id: 'c_combo_hit',
      addresses: [
        {
          province: 'تهران',
          city: 'تهران',
          district: 'سعادت آباد',
          addressLine: 'بلوار دریا',
          lat: 35.78,
          lng: 51.37,
          isPrimary: true,
          createdAt: baseNow,
        },
      ],
      stations: [
        {
          id: 'c_combo_hit_ps5_vip',
          name: 'PS5 VIP Room 1',
          stationType: GameStationType.PLAYSTATION_5,
          hourlyPrice: 200000, // 25% discount -> 150000 finalPrice
          isVip: true,
          isActive: true,
          stationGames: [],
        },
        {
          id: 'c_combo_hit_pc_1',
          name: 'PC Pro 1',
          stationType: GameStationType.PC,
          hourlyPrice: 200000, // 25% discount -> 150000 finalPrice
          isVip: false,
          isActive: true,
          stationGames: [],
        },
      ],
      discounts: [
        {
          isActive: true,
          targetType: 'GAMING_CENTER',
          targetId: 'c_combo_hit',
          valueType: 'PERCENTAGE',
          value: 25,
          startAt: new Date(Date.now() - 3600_000),
          endAt: new Date(Date.now() + 3600_000),
        },
      ],
    });

    const shirazCenter = makeCenter({
      id: 'c_wrong_city',
      addresses: [
        {
          province: 'فارس',
          city: 'شیراز',
          district: 'معالی آباد',
          addressLine: 'خیابان دوستان',
          lat: 29.6,
          lng: 52.5,
          isPrimary: true,
          createdAt: baseNow,
        },
      ],
    });

    const expensiveClosedCenter = makeCenter({
      id: 'c_expensive_closed',
      closures: [
        {
          id: 'cl_1',
          startDate: new Date(Date.now() - 3600_000),
          endDate: new Date(Date.now() + 3600_000),
        },
      ],
      stations: [
        {
          id: 'st_exp_ps5',
          name: 'PS5 VIP Ultra',
          stationType: GameStationType.PLAYSTATION_5,
          hourlyPrice: 400000,
          isVip: true,
          isActive: true,
          stationGames: [],
        },
      ],
    });

    allCenters = [targetCenter, shirazCenter, expensiveClosedCenter];
    allRatings = [
      { gamingCenterId: 'c_combo_hit', rating: 5, createdAt: baseNow },
      { gamingCenterId: 'c_combo_hit', rating: 4, createdAt: baseNow },
      { gamingCenterId: 'c_wrong_city', rating: 5, createdAt: baseNow },
    ];

    const res = await request(app).get(
      `/api/public/search/gamecenters?game=FC%2026&city=${encodeURIComponent('تهران')}&deviceType=PS5&amenities=vip&isOpen=true&minPrice=100000&maxPrice=170000&minRating=4`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
    expect(res.body.data.data[0].id).toBe('c_combo_hit');
    expect(res.body.data.data[0].matchedGames[0].stations[0].finalPrice).toBe(150000);
  });

  it('5. Checks batched slot availability and excludes stations blocked by reservations, booking holds, or maintenances', async () => {
    const busyStart = new Date('2027-03-10T14:00:00.000Z');
    const centerBusy = makeCenter({
      id: 'c_busy',
      name: 'Center All Busy',
      stations: [
        {
          id: 'st_busy_res',
          name: 'PS5-Reserved',
          stationType: GameStationType.PLAYSTATION_5,
          hourlyPrice: 150000,
          isVip: false,
          isActive: true,
          stationGames: [],
        },
        {
          id: 'st_busy_hold',
          name: 'PS5-Hold',
          stationType: GameStationType.PLAYSTATION_5,
          hourlyPrice: 150000,
          isVip: false,
          isActive: true,
          stationGames: [],
        },
      ],
    });

    const centerAvailable = makeCenter({
      id: 'c_free',
      name: 'Center One Free',
      stations: [
        {
          id: 'st_maint',
          name: 'PS5-Maintenance',
          stationType: GameStationType.PLAYSTATION_5,
          hourlyPrice: 150000,
          isVip: false,
          isActive: true,
          stationGames: [],
        },
        {
          id: 'st_available',
          name: 'PS5-Free',
          stationType: GameStationType.PLAYSTATION_5,
          hourlyPrice: 150000,
          isVip: false,
          isActive: true,
          stationGames: [],
        },
      ],
    });

    allCenters = [centerBusy, centerAvailable];
    (prisma.reservation.findMany as jest.Mock).mockResolvedValue([{ stationId: 'st_busy_res' }]);
    (prisma.bookingHold.findMany as jest.Mock).mockResolvedValue([
      { items: [{ stationId: 'st_busy_hold' }] },
    ]);
    (prisma.stationMaintenance.findMany as jest.Mock).mockResolvedValue([{ stationId: 'st_maint' }]);

    const res = await request(app).get(
      `/api/public/search/gamecenters?game=FC%2026&availableAt=${encodeURIComponent(busyStart.toISOString())}&durationHours=1`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.data.map((c: any) => c.id)).toEqual(['c_free']);
    expect(res.body.data.data[0].availabilitySummary.availableMatchingStations).toBe(1);
    expect(prisma.reservation.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.bookingHold.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.stationMaintenance.findMany).toHaveBeenCalledTimes(1);
  });

  it('6. Enforces valid geographic coordinates, computes Haversine distances, and rejects (0,0) coordinates', async () => {
    const invalidRes = await request(app).get('/api/public/search/gamecenters?lat=0&lng=0&radiusKm=10');
    expect(invalidRes.status).toBe(400);

    const nearCenter = makeCenter({
      id: 'c_near',
      name: 'Vanak Center',
      addresses: [
        { province: 'تهران', city: 'تهران', district: 'ونک', addressLine: 'ونک', lat: 35.758, lng: 51.41, isPrimary: true, createdAt: baseNow },
      ],
    });
    const zeroCoordCenter = makeCenter({
      id: 'c_zero_coords',
      name: 'Broken Zero Coords',
      addresses: [
        { province: 'تهران', city: 'تهران', district: 'نامشخص', addressLine: '0', lat: 0, lng: 0, isPrimary: true, createdAt: baseNow },
      ],
    });
    const farCenter = makeCenter({
      id: 'c_far_karaj',
      name: 'Karaj Center',
      addresses: [
        { province: 'البرز', city: 'کرج', district: 'گوهردشت', addressLine: 'کرج', lat: 35.8327, lng: 50.9915, isPrimary: true, createdAt: baseNow },
      ],
    });

    allCenters = [zeroCoordCenter, farCenter, nearCenter];

    const res = await request(app).get(
      '/api/public/search/gamecenters?lat=35.7575&lng=51.4099&radiusKm=15&sort=distance'
    );
    expect(res.status).toBe(200);
    expect(res.body.data.data.map((c: any) => c.id)).toEqual(['c_near']);
    expect(res.body.data.data[0].distanceKm).toBeLessThan(1);
  });

  it('7. Ranks relevant + established centers fairly without hiding new centers (0 reviews)', async () => {
    const establishedCenter = makeCenter({
      id: 'c_est',
      name: 'گیم‌نت الیت',
      centerGames: [
        { gameCatalogId: catalogFc26.id, playMode: GamePlayMode.ONLINE, platforms: [GameStationType.PLAYSTATION_5] },
      ],
    });
    const brandNewCenter = makeCenter({
      id: 'c_brand_new',
      name: 'گیم‌نت جدید پلاس',
      centerGames: [
        { gameCatalogId: catalogFc26.id, playMode: GamePlayMode.ONLINE, platforms: [GameStationType.PLAYSTATION_5] },
      ],
    });
    const poorRatedCenter = makeCenter({
      id: 'c_poor',
      name: 'گیم‌نت ضعیف',
      settings: { workStartTime: '00:00', workEndTime: '00:00', timeZone: 'Asia/Tehran', allowOnlineBooking: false },
      centerGames: [
        { gameCatalogId: catalogFc26.id, playMode: GamePlayMode.OFFLINE, platforms: [GameStationType.PLAYSTATION_5] },
      ],
    });

    allCenters = [poorRatedCenter, brandNewCenter, establishedCenter];
    allRatings = [
      { gamingCenterId: 'c_est', rating: 4.9, createdAt: baseNow },
      { gamingCenterId: 'c_est', rating: 4.8, createdAt: baseNow },
      { gamingCenterId: 'c_est', rating: 5.0, createdAt: baseNow },
      { gamingCenterId: 'c_poor', rating: 1.5, createdAt: baseNow },
      { gamingCenterId: 'c_poor', rating: 2.0, createdAt: baseNow },
      { gamingCenterId: 'c_poor', rating: 1.8, createdAt: baseNow },
    ];

    const res = await request(app).get('/api/public/search/gamecenters?game=FC%2026&sort=relevance');
    expect(res.status).toBe(200);
    const ids = res.body.data.data.map((c: any) => c.id);
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe('c_est');
    // Brand-new center (0 reviews) still appears and outranks a 1.7-rated center without online booking!
    expect(ids.indexOf('c_brand_new')).toBeLessThan(ids.indexOf('c_poor'));
  });

  it('8. Supports accurate pagination, facets, and zero-result recovery suggestions', async () => {
    allCenters = [
      makeCenter({ id: 'c_p1', name: 'Center Alpha' }),
      makeCenter({ id: 'c_p2', name: 'Center Beta' }),
      makeCenter({ id: 'c_p3', name: 'Center Gamma' }),
    ];

    const page2 = await request(app).get('/api/public/search/gamecenters?game=FC%2026&page=2&limit=2');
    expect(page2.status).toBe(200);
    expect(page2.body.data.data).toHaveLength(1);
    expect(page2.body.data.meta).toEqual({ total: 3, page: 2, limit: 2, totalPages: 2 });
    expect(page2.body.data.facets.cities[0].key).toBe('تهران');
    expect(page2.body.data.facets.openNowCount).toBe(3);

    // Zero results when neighborhood doesn't match -> emits RELAX_FILTER suggestion
    const zeroRes = await request(app).get(
      `/api/public/search/gamecenters?game=FC%2026&city=${encodeURIComponent('تهران')}&neighborhood=${encodeURIComponent('نیاوران')}`
    );
    expect(zeroRes.status).toBe(200);
    expect(zeroRes.body.data.data).toEqual([]);
    expect(zeroRes.body.data.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'RELAX_FILTER', filterKey: 'neighborhood' }),
      ])
    );
  });

  it('9. Enforces public security boundary and strips private/sensitive fields', async () => {
    const publicCenter = makeCenter({ id: 'c_pub', name: 'Public Center' });
    const pendingCenter = makeCenter({
      id: 'c_pending',
      name: 'Pending Center',
      verificationStatus: GamingCenterVerificationStatus.PENDING,
    });
    const inactiveCenter = makeCenter({
      id: 'c_inactive',
      name: 'Inactive Center',
      isActive: false,
    });

    allCenters = [publicCenter, pendingCenter, inactiveCenter];

    const res = await request(app).get('/api/public/search/gamecenters');
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
    expect(res.body.data.data[0].id).toBe('c_pub');

    const serialized = JSON.stringify(res.body.data.data[0]);
    for (const forbidden of FORBIDDEN_PRIVATE_KEYS) {
      expect(serialized).not.toContain(`"${forbidden}"`);
    }
  });

  it('10. Provides grouped autocomplete (/suggest) and game catalog search (/games)', async () => {
    const tehranCenter = makeCenter({ id: 'c_sug', name: 'گیم‌نت فیفا کلاب' });
    allCenters = [tehranCenter];

    const suggestRes = await request(app).get('/api/public/search/suggest?q=fifa&limit=5');
    expect(suggestRes.status).toBe(200);
    expect(suggestRes.body.data.games).toHaveLength(1);
    expect(suggestRes.body.data.games[0].id).toBe(catalogFc26.id);
    expect(suggestRes.body.data.games[0].centerCount).toBe(1);

    const suggestDeviceRes = await request(app).get('/api/public/search/suggest?q=ps5&limit=5');
    expect(suggestDeviceRes.status).toBe(200);
    expect(suggestDeviceRes.body.data.devices).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'PLAYSTATION 5' })])
    );

    const gamesRes = await request(app).get('/api/public/search/games?q=%D9%81%DB%8C%D9%81%D8%A7%2026');
    expect(gamesRes.status).toBe(200);
    expect(gamesRes.body.data.data).toHaveLength(1);
    expect(gamesRes.body.data.data[0].slug).toBe('fc-26');
  });

  it('11. Handles Platform Admin duplicate detection, merge, aliases, and Manager station-game assignment', async () => {
    const dupA = { ...catalogFc26, id: 'cgamefc260000000000000001' };
    const dupB = {
      ...catalogFc26,
      id: 'cgamefc260000000000000009',
      slug: 'fifa-26-dup',
      title: 'FIFA 26',
      normalizedKey: 'easportsfc26',
      aliases: [{ alias: 'FIFA 26', normalized: 'fifa 26', locale: 'en' }],
    };
    (prisma.gameCatalog.findMany as jest.Mock).mockResolvedValue([dupA, dupB]);

    const dupRes = await request(app)
      .get('/api/v1/platform-admin/catalog/games/duplicates')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dupRes.status).toBe(200);
    expect(dupRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(dupRes.body.data[0].reason).toBe('NORMALIZED_KEY');

    // Merge dupB into dupA
    (prisma.gameCatalog.findUnique as jest.Mock).mockResolvedValue(dupA);
    (prisma.gameCatalog.findMany as jest.Mock).mockResolvedValue([dupB]);
    (prisma.gamingCenterGame.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.gameStationGame.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.gameCatalog.update as jest.Mock).mockResolvedValue(dupA);
    (prisma.gameAlias.findMany as jest.Mock).mockResolvedValue([]);

    const mergeRes = await request(app)
      .post('/api/v1/platform-admin/catalog/games/merge')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetGameId: dupA.id,
        sourceGameIds: [dupB.id],
        deactivateSources: true,
      });
    expect(mergeRes.status).toBe(200);
    expect(mergeRes.body.data.mergedSourceIds).toEqual([dupB.id]);

    // Replace aliases
    (prisma.gameCatalog.findUnique as jest.Mock).mockResolvedValue({ ...dupA, aliases: [] });
    const aliasRes = await request(app)
      .put(`/api/v1/platform-admin/catalog/games/${dupA.id}/aliases`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ aliases: ['FC26', { alias: 'اف سی بیست و شش', locale: 'fa' }] });
    expect(aliasRes.status).toBe(200);

    // Station-level game assignment (Manager)
    const centerId = 'ccenter000000000000000001';
    const stationId = 'cstation00000000000000001';
    (prisma.gameStation.findFirst as jest.Mock).mockResolvedValue({
      id: stationId,
      gamingCenterId: centerId,
      name: 'PS5 #1',
      stationType: GameStationType.PLAYSTATION_5,
      isActive: true,
    });
    (prisma.gameCatalog.findMany as jest.Mock).mockResolvedValue([catalogFc26]);
    (prisma.gamingCenterGame.upsert as jest.Mock).mockResolvedValue({});
    (prisma.gameStationGame.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.gameStationGame.createMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.gameStationGame.findMany as jest.Mock).mockResolvedValue([
      {
        stationId,
        gameCatalogId: catalogFc26.id,
        playMode: GamePlayMode.ONLINE,
        isActive: true,
        gameCatalog: catalogFc26,
      },
    ]);

    const putStationGames = await request(app)
      .put(`/api/v1/gamingCenters/${centerId}/stations/${stationId}/games`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ games: [{ gameCatalogId: catalogFc26.id, playMode: 'ONLINE', isActive: true }] });
    expect(putStationGames.status).toBe(200);
    expect(putStationGames.body.data).toHaveLength(1);
    expect(putStationGames.body.data[0].title).toBe(catalogFc26.title);
  });

  it('12. Performs combined search, ranking, and faceting across 1,500 centers + 200 catalog games quickly', async () => {
    const largeCatalog = Array.from({ length: 200 }, (_, i) => ({
      ...catalogFc26,
      id: `cgame_scale_${String(i).padStart(4, '0')}`,
      slug: `scale-game-${i}`,
      title: i === 0 ? 'EA Sports FC 26' : `Scale Game Title ${i}`,
      titleEn: i === 0 ? 'EA Sports FC 26' : `Scale Game Title ${i}`,
      titleFa: i === 0 ? 'اف سی ۲۶' : `بازی تست ${i}`,
      normalizedKey: i === 0 ? 'easportsfc26' : `scalegametitle${i}`,
      popularityScore: 200 - i,
      aliases: i === 0 ? catalogFc26.aliases : [{ alias: `Alias ${i}`, normalized: `alias ${i}`, locale: 'en' }],
    }));
    (prisma.gameCatalog.findMany as jest.Mock).mockResolvedValue(largeCatalog);

    allCenters = Array.from({ length: 1500 }, (_, idx) => {
      const city = idx % 3 === 0 ? 'تهران' : idx % 3 === 1 ? 'شیراز' : 'مشهد';
      return makeCenter({
        id: `c_scale_${idx}`,
        name: `گیم‌نت شماره ${idx}`,
        slug: `center-${idx}`,
        addresses: [
          {
            province: city,
            city,
            district: 'مرکز',
            addressLine: `پلاک ${idx}`,
            lat: 35.7 + (idx % 10) * 0.001,
            lng: 51.4 + (idx % 10) * 0.001,
            isPrimary: true,
            createdAt: baseNow,
          },
        ],
        stations: [
          {
            id: `st_scale_${idx}`,
            name: 'PS5-Main',
            stationType: GameStationType.PLAYSTATION_5,
            hourlyPrice: 100000 + (idx % 5) * 15000,
            isVip: idx % 2 === 0,
            isActive: true,
            stationGames: [],
          },
        ],
        centerGames:
          idx % 2 === 0
            ? [{ gameCatalogId: largeCatalog[0].id, playMode: GamePlayMode.ONLINE, platforms: [GameStationType.PLAYSTATION_5] }]
            : [{ gameCatalogId: largeCatalog[1].id, playMode: GamePlayMode.OFFLINE, platforms: [GameStationType.PLAYSTATION_5] }],
      });
    });

    const start = Date.now();
    const res = await request(app).get(
      `/api/public/search/gamecenters?game=FC%2026&city=${encodeURIComponent('تهران')}&deviceType=PS5&page=1&limit=20`
    );
    const elapsedMs = Date.now() - start;

    expect(res.status).toBe(200);
    // 1500 centers: idx % 3 === 0 (500 Tehran) and idx % 2 === 0 (half with FC 26) => 250 exact matches!
    expect(res.body.data.meta.total).toBe(250);
    expect(res.body.data.data).toHaveLength(20);
    expect(elapsedMs).toBeLessThan(2000);
  });
});
