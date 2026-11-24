import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    gamingCenter: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    gameStation: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    rating: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    platformAdmin: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Gaming Centers Advanced Filters & Station Custom Selection API', () => {
  const mockCenter1 = {
    id: 'center_10',
    name: 'کافی گیم نت آرشا',
    slug: 'arsha-cafe-game-net',
    isActive: true,
    description: 'مرکز نمونه',
    pcCount: 10,
    consoleCount: 4,
    hourlyRate: 70000,
    hasFoodService: true,
    openingTime: '10:00',
    closingTime: '23:00',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    addresses: [
      {
        id: 'addr_10',
        gamingCenterId: 'center_10',
        province: 'آذربایجان شرقی',
        city: 'تبریز',
        district: 'باغمیشه',
        addressLine: 'خیابان امیرکبیر',
        isPrimary: true,
      },
    ],
    ratings: [
      { rating: 5, comment: 'عالی', status: 'PUBLISHED' },
    ],
    settings: null,
  };

  const mockStations = [
    {
      id: 'st_1',
      gamingCenterId: 'center_10',
      name: 'PC-VIP-1',
      stationType: 'PC',
      hourlyPrice: 80000,
      isVip: true,
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      id: 'st_2',
      gamingCenterId: 'center_10',
      name: 'PS5-Console-1',
      stationType: 'PLAYSTATION_5',
      hourlyPrice: 120000,
      isVip: false,
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      id: 'st_3',
      gamingCenterId: 'center_10',
      name: 'Xbox-Series-X',
      stationType: 'XBOX',
      hourlyPrice: 110000,
      isVip: false,
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Selective Gaming Center Details (include & fields)', () => {
    it('should query specific scalar fields and relations when requested', async () => {
      (prisma.gamingCenter.findFirst as jest.Mock).mockResolvedValue({
        id: 'center_10',
        name: 'کافی گیم نت آرشا',
        hourlyRate: 70000,
        addresses: [mockCenter1.addresses[0]],
      });

      const res = await request(app)
        .get('/api/v1/gamingCenters/center_10?fields=id,name,hourlyRate&include=addresses');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('center_10');
      expect(res.body.data.name).toBe('کافی گیم نت آرشا');
      expect(res.body.data.hourlyRate).toBe(70000);
      expect(res.body.data.addresses).toBeDefined();

      expect(prisma.gamingCenter.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            name: true,
            hourlyRate: true,
            addresses: true,
          },
        })
      );
    });

    it('should reject invalid include relations with 400', async () => {
      const res = await request(app)
        .get('/api/v1/gamingCenters/center_10?include=passwords,nonexistent');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid scalar fields with 400', async () => {
      const res = await request(app)
        .get('/api/v1/gamingCenters/center_10?fields=unauthorizedField');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Selective Game Stations API (ids, stationType, fields)', () => {
    it('should filter stations by IDs and stationType in database query', async () => {
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue(mockCenter1);
      (prisma.gameStation.findMany as jest.Mock).mockResolvedValue([mockStations[0]]);
      (prisma.gameStation.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/gamingCenters/center_10/stations?ids=st_1,st_2&stationType=PC');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data.length).toBe(1);

      expect(prisma.gameStation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            gamingCenterId: 'center_10',
            stationType: 'PC',
            id: { in: ['st_1', 'st_2'] },
          }),
        })
      );
    });

    it('should project only specified fields when fields query is provided', async () => {
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue(mockCenter1);
      (prisma.gameStation.findMany as jest.Mock).mockResolvedValue([
        { id: 'st_1', name: 'PC-VIP-1', hourlyPrice: 80000 },
      ]);
      (prisma.gameStation.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/gamingCenters/center_10/stations?fields=id,name,hourlyPrice');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      expect(prisma.gameStation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            name: true,
            hourlyPrice: true,
          },
        })
      );
    });

    it('should parse isVip=false accurately as boolean false instead of coercing non-empty string to true', async () => {
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue(mockCenter1);
      (prisma.gameStation.findMany as jest.Mock).mockResolvedValue([mockStations[1]]);
      (prisma.gameStation.count as jest.Mock).mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/gamingCenters/center_10/stations?isVip=false');

      expect(res.status).toBe(200);
      expect(prisma.gameStation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            gamingCenterId: 'center_10',
            isVip: false,
          }),
        })
      );
    });
  });

  describe('3. Optimized Gaming Center List API (Device Aggregation & Advanced Filters)', () => {
    it('should aggregate device counts via groupBy and return structured device counts and lowest station hourlyRate', async () => {
      (prisma.gamingCenter.findMany as jest.Mock).mockResolvedValue([mockCenter1]);
      (prisma.gamingCenter.count as jest.Mock).mockResolvedValue(1);
      (prisma.gameStation.groupBy as jest.Mock).mockResolvedValue([
        { gamingCenterId: 'center_10', stationType: 'PC', _count: { _all: 8 }, _min: { hourlyPrice: 55000 } },
        { gamingCenterId: 'center_10', stationType: 'PLAYSTATION_5', _count: { _all: 5 }, _min: { hourlyPrice: 75000 } },
        { gamingCenterId: 'center_10', stationType: 'XBOX', _count: { _all: 3 }, _min: { hourlyPrice: 60000 } },
      ]);

      const res = await request(app).get('/api/v1/gamingCenters');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data.length).toBe(1);

      const center = res.body.data.data[0];
      expect(center.deviceCounts).toEqual({
        PC: 8,
        'PLAYSTATION 4': 0,
        'PLAYSTATION 5': 5,
        XBOX: 3,
        SWITCH: 0,
        VR: 0,
      });
      // Lowest active station price is 55000 (from PC stations)
      expect(center.hourlyRate).toBe(55000);
      // Verification that individual stations are NOT exposed in list response
      expect(center.stations).toBeUndefined();
    });

    it('should lock public list to APPROVED & isActive=true even if query tries to override them, and apply location/stationType filters with Persian/Arabic variants', async () => {
      (prisma.gamingCenter.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.gamingCenter.count as jest.Mock).mockResolvedValue(0);

      const res = await request(app).get(
        '/api/v1/gamingCenters?verificationStatus=PENDING&isActive=false&city=تبریز&province=آذربایجان شرقی&district=باغمیشه&hasFoodService=true&stationType=PLAYSTATION%205&sortBy=hourlyRate&sortOrder=asc'
      );

      expect(res.status).toBe(200);
      expect(prisma.gamingCenter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            verificationStatus: 'APPROVED',
            hasFoodService: true,
            addresses: {
              some: {
                AND: [
                  {
                    OR: expect.arrayContaining([
                      { city: { contains: 'تبریز', mode: 'insensitive' } },
                      { city: { contains: 'تبريز', mode: 'insensitive' } },
                    ]),
                  },
                  {
                    OR: expect.arrayContaining([
                      { province: { contains: 'آذربایجان شرقی', mode: 'insensitive' } },
                    ]),
                  },
                  {
                    OR: expect.arrayContaining([
                      { district: { contains: 'باغمیشه', mode: 'insensitive' } },
                    ]),
                  },
                ],
              },
            },
            stations: {
              some: {
                stationType: 'PLAYSTATION_5',
                isActive: true,
              },
            },
          }),
          orderBy: { hourlyRate: 'asc' },
        })
      );
    });

    it('should filter by real average rating and discounted effective station price with accurate post-filter pagination', async () => {
      const highAvgLowDiscountCenter = {
        ...mockCenter1,
        id: 'center_high',
        slug: 'center-high',
        ratings: undefined,
        hourlyRate: 200000, // Scalar differs from actual discounted station price!
        openingTime: '00:00',
        closingTime: '00:00',
        stations: [
          { id: 'st_h1', stationType: 'PLAYSTATION_5', hourlyPrice: 150000, isVip: true, isActive: true },
          { id: 'st_h2', stationType: 'PLAYSTATION_5', hourlyPrice: 150000, isVip: false, isActive: true },
        ],
        discounts: [
          {
            isActive: true,
            targetType: 'GAMING_CENTER',
            targetId: 'center_high',
            valueType: 'PERCENTAGE',
            value: 20, // Effective station price: 150000 * 0.8 = 120000
            startAt: new Date(Date.now() - 3600_000),
            endAt: new Date(Date.now() + 3600_000),
          },
        ],
        discountCampaigns: [],
        closures: [],
        media: [],
      };

      const lowAvgCenter = {
        ...mockCenter1,
        id: 'center_low',
        slug: 'center-low',
        ratings: undefined,
        hourlyRate: 120000,
        openingTime: '00:00',
        closingTime: '00:00',
        stations: [
          { id: 'st_l1', stationType: 'PLAYSTATION_5', hourlyPrice: 120000, isVip: false, isActive: true },
          { id: 'st_l2', stationType: 'PLAYSTATION_5', hourlyPrice: 120000, isVip: false, isActive: true },
        ],
        discounts: [],
        discountCampaigns: [],
        closures: [],
        media: [],
      };

      const closedOrUnderCountCenter = {
        ...mockCenter1,
        id: 'center_closed',
        slug: 'center-closed',
        ratings: undefined,
        openingTime: '09:00',
        closingTime: '10:00',
        closures: [
          {
            id: 'cl_now',
            startDate: new Date(Date.now() - 3600_000),
            endDate: new Date(Date.now() + 3600_000),
          },
        ],
        stations: [
          { id: 'st_c1', stationType: 'PLAYSTATION_5', hourlyPrice: 100000, isVip: false, isActive: true },
        ],
        discounts: [],
        discountCampaigns: [],
        media: [],
      };

      (prisma.gamingCenter.findMany as jest.Mock).mockResolvedValue([
        highAvgLowDiscountCenter,
        lowAvgCenter,
        closedOrUnderCountCenter,
      ]);
      (prisma.gameStation.groupBy as jest.Mock).mockResolvedValue([
        { gamingCenterId: 'center_high', stationType: 'PLAYSTATION_5', _count: { _all: 3 }, _min: { hourlyPrice: 150000 } },
        { gamingCenterId: 'center_low', stationType: 'PLAYSTATION_5', _count: { _all: 3 }, _min: { hourlyPrice: 120000 } },
        { gamingCenterId: 'center_closed', stationType: 'PLAYSTATION_5', _count: { _all: 3 }, _min: { hourlyPrice: 100000 } },
      ]);
      (prisma.rating.groupBy as jest.Mock).mockResolvedValue([
        // Average = 4.6 -> passes minRating=4
        { gamingCenterId: 'center_high', _avg: { rating: 4.6 }, _count: { _all: 5, comment: 2 } },
        // Average = 3.0 -> MUST fail minRating=4 even though it may have had one 5-star review!
        { gamingCenterId: 'center_low', _avg: { rating: 3.0 }, _count: { _all: 2, comment: 1 } },
        { gamingCenterId: 'center_closed', _avg: { rating: 4.8 }, _count: { _all: 4, comment: 1 } },
      ]);

      const res = await request(app).get(
        '/api/v1/gamingCenters?minRating=4&minHourlyRate=110000&maxHourlyRate=130000&isOpen=true&minStationCount=2&page=1&limit=10'
      );

      expect(res.status).toBe(200);
      expect(res.body.data.data).toHaveLength(1);
      expect(res.body.data.data[0].id).toBe('center_high');
      expect(res.body.data.meta.total).toBe(1);
      expect(res.body.data.meta.totalPages).toBe(1);
    });
  });
});
