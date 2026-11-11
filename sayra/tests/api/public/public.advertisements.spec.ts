/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';

jest.mock('../../../src/config/prisma', () => {
  return {
    prisma: {
      advertisementRequest: {
        findMany: jest.fn(),
      },
      gamingCenter: {
        findUnique: jest.fn(),
      },
    },
  };
});

describe('Public Advertisement Slider API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const now = new Date();
  const sampleActiveAds = [
    {
      id: 'ad_active_1',
      title: 'Grand Championship 2026',
      description: 'PS5 tournament with huge prize pool',
      bannerUrl: 'https://cdn.example.com/tourney.jpg',
      mediaType: 'IMAGE',
      destinationUrl: 'https://example.com/register',
      priority: 100,
      startDate: new Date(now.getTime() - 86400000), // 1 day ago
      endDate: new Date(now.getTime() + 86400000 * 5), // 5 days left
      status: 'ACTIVE',
      deletedAt: null,
      gamingCenter: {
        id: 'gc_1',
        name: 'Nexus Arena',
        slug: 'nexus-arena',
      },
    },
    {
      id: 'ad_active_2',
      title: 'Weekend VIP Special',
      description: '50% off on all PC stations',
      bannerUrl: 'https://cdn.example.com/vip.jpg',
      mediaType: 'IMAGE',
      destinationUrl: 'https://example.com/book',
      priority: 10,
      startDate: new Date(now.getTime() - 3600000),
      endDate: new Date(now.getTime() + 86400000 * 2),
      status: 'APPROVED',
      deletedAt: null,
      gamingCenter: {
        id: 'gc_2',
        name: 'Cyber Zone',
        slug: 'cyber-zone',
      },
    },
  ];

  it('GET /api/v1/public/advertisements/slider returns unexpired, approved/active ads sorted by priority', async () => {
    ((prisma as any).advertisementRequest.findMany as jest.Mock).mockResolvedValue(sampleActiveAds);

    const res = await request(app).get('/api/v1/public/advertisements/slider');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].id).toBe('ad_active_1');
    expect(res.body.data[0].gamingCenterName).toBe('Nexus Arena');
    expect(res.body.data[0].priority).toBe(100);

    expect((prisma as any).advertisementRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          status: { in: ['APPROVED', 'ACTIVE'] },
        }),
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
      })
    );
  });

  it('GET /api/v1/public/advertisements/slider strictly excludes PENDING and REJECTED advertisements', async () => {
    ((prisma as any).advertisementRequest.findMany as jest.Mock).mockImplementation((args: any) => {
      const statusFilter = args?.where?.status?.in || [];
      expect(statusFilter).toEqual(['APPROVED', 'ACTIVE']);
      expect(statusFilter).not.toContain('PENDING');
      expect(statusFilter).not.toContain('REJECTED');
      return Promise.resolve(sampleActiveAds.filter((ad) => statusFilter.includes(ad.status)));
    });

    const res = await request(app).get('/api/v1/public/advertisements/slider');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    res.body.data.forEach((ad: any) => {
      expect(['ad_active_1', 'ad_active_2']).toContain(ad.id);
    });
  });

  it('GET /api/v1/public/gamingCenters/:gamingCenterSlug/advertisements/slider filters by specific center slug and approved/active status', async () => {
    ((prisma as any).gamingCenter.findUnique as jest.Mock).mockResolvedValue({
      id: 'gc_1',
      name: 'Nexus Arena',
      slug: 'nexus-arena',
      isActive: true,
    });
    ((prisma as any).advertisementRequest.findMany as jest.Mock).mockResolvedValue([sampleActiveAds[0]]);

    const res = await request(app).get('/api/v1/public/gamingCenters/nexus-arena/advertisements/slider');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].gamingCenterSlug).toBe('nexus-arena');

    expect((prisma as any).advertisementRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          status: { in: ['APPROVED', 'ACTIVE'] },
          gamingCenter: {
            slug: 'nexus-arena',
            isActive: true,
          },
        }),
      })
    );
  });
});
