import request from 'supertest';
import { LinkType, MediaPurpose, MediaType, PrismaClient } from '@prisma/client';
import app from '../../app';

const prisma = new PrismaClient();

describe('Public Media, Links, and Addresses API', () => {
  let gamingCenter: { id: string; slug: string };
  let otherSalon: { id: string; slug: string };

  beforeAll(async () => {
    await prisma.media.deleteMany();
    await prisma.socialLink.deleteMany();
    await prisma.address.deleteMany();
    await prisma.gamingCenter.deleteMany();

    gamingCenter = await prisma.gamingCenter.create({
      data: {
        name: 'Public CMS GamingCenter',
        slug: `public-cms-${Date.now()}`,
      },
      select: { id: true, slug: true },
    });

    otherSalon = await prisma.gamingCenter.create({
      data: {
        name: 'Other Public CMS GamingCenter',
        slug: `public-cms-other-${Date.now()}`,
      },
      select: { id: true, slug: true },
    });

    await prisma.media.createMany({
      data: [
        {
          gamingCenterId: gamingCenter.id,
          type: MediaType.IMAGE,
          purpose: MediaPurpose.GALLERY,
          url: 'https://example.com/media-active-2.png',
          sortOrder: 2,
          isActive: true,
        },
        {
          gamingCenterId: gamingCenter.id,
          type: MediaType.IMAGE,
          purpose: MediaPurpose.GALLERY,
          url: 'https://example.com/media-active-1.png',
          sortOrder: 1,
          isActive: true,
        },
        {
          gamingCenterId: gamingCenter.id,
          type: MediaType.IMAGE,
          purpose: MediaPurpose.GALLERY,
          url: 'https://example.com/media-inactive.png',
          sortOrder: 0,
          isActive: false,
        },
        {
          gamingCenterId: otherSalon.id,
          type: MediaType.IMAGE,
          purpose: MediaPurpose.GALLERY,
          url: 'https://example.com/media-other.png',
          sortOrder: 0,
          isActive: true,
        },
      ],
    });

    await prisma.socialLink.createMany({
      data: [
        {
          gamingCenterId: gamingCenter.id,
          type: LinkType.INSTAGRAM,
          label: 'Instagram',
          value: 'https://instagram.com/gamingCenter',
          isPrimary: true,
          isActive: true,
        },
        {
          gamingCenterId: gamingCenter.id,
          type: LinkType.WHATSAPP,
          label: 'WhatsApp',
          value: '+989121111111',
          isPrimary: false,
          isActive: true,
        },
        {
          gamingCenterId: gamingCenter.id,
          type: LinkType.TELEGRAM,
          label: 'Telegram',
          value: 'https://t.me/gamingCenter',
          isPrimary: false,
          isActive: false,
        },
        {
          gamingCenterId: otherSalon.id,
          type: LinkType.WEBSITE,
          label: 'Website',
          value: 'https://example.com',
          isPrimary: false,
          isActive: true,
        },
      ],
    });

    await prisma.address.createMany({
      data: [
        {
          gamingCenterId: gamingCenter.id,
          title: 'Main',
          city: 'Tehran',
          addressLine: '123 Main Street',
          isPrimary: true,
        },
        {
          gamingCenterId: gamingCenter.id,
          title: 'Branch',
          city: 'Shiraz',
          addressLine: '456 Side Street',
          isPrimary: false,
        },
        {
          gamingCenterId: otherSalon.id,
          title: 'Other',
          city: 'Tabriz',
          addressLine: '789 Another Street',
          isPrimary: true,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.media.deleteMany();
    await prisma.socialLink.deleteMany();
    await prisma.address.deleteMany();
    await prisma.gamingCenter.deleteMany();
    await prisma.$disconnect();
  });

  it('returns active media ordered by sortOrder', async () => {
    const response = await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/media`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0].sortOrder).toBe(1);
    expect(response.body.data[1].sortOrder).toBe(2);
    expect(response.body.data.every((item: { isActive: boolean }) => item.isActive)).toBe(true);
  });

  it('returns active links including isPrimary', async () => {
    const response = await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/links`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toHaveProperty('isPrimary');
    expect(response.body.data[1]).toHaveProperty('isPrimary');
  });

  it('returns addresses for the gamingCenter slug', async () => {
    const response = await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/addresses`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);
    const cities = response.body.data.map((address: { city: string }) => address.city);
    expect(cities).toEqual(expect.arrayContaining(['Tehran', 'Shiraz']));
  });
});
