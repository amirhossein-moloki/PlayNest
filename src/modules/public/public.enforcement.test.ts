import request from 'supertest';
import { PageStatus, PrismaClient } from '@prisma/client';
import app from '../../app';

const prisma = new PrismaClient();

describe('Public Routes Enforcement', () => {
  let activeSalon: { id: string; slug: string };
  let inactiveSalon: { id: string; slug: string };
  let page: { id: string; slug: string };

  beforeAll(async () => {
    // Cleanup
    await prisma.page.deleteMany();
    await prisma.gamingCenter.deleteMany();

    activeSalon = await prisma.gamingCenter.create({
      data: {
        name: 'Active GamingCenter',
        slug: 'active-gamingCenter',
        isActive: true,
      },
    });

    inactiveSalon = await prisma.gamingCenter.create({
      data: {
        name: 'Inactive GamingCenter',
        slug: 'inactive-gamingCenter',
        isActive: false,
      },
    });

    page = await prisma.page.create({
      data: {
        gamingCenterId: activeSalon.id,
        slug: 'test-page',
        title: 'Test Page',
        status: PageStatus.PUBLISHED,
        seoTitle: 'SEO Title',
        seoDescription: 'SEO Description',
      },
    });

    await prisma.page.create({
      data: {
        gamingCenterId: activeSalon.id,
        slug: 'home',
        title: 'Home',
        type: 'HOME',
        status: PageStatus.PUBLISHED,
        seoTitle: 'Home SEO Title',
      },
    });
  });

  afterAll(async () => {
    await prisma.page.deleteMany();
    await prisma.gamingCenter.deleteMany();
    await prisma.$disconnect();
  });

  describe('resolveSalonBySlug middleware', () => {
    it('returns 200 for an active gamingCenter', async () => {
      await request(app)
        .get(`/api/v1/public/gamingCenters/${activeSalon.slug}/pages/${page.slug}`)
        .expect(200);
    });

    it('returns 404 for an inactive gamingCenter', async () => {
      await request(app)
        .get(`/api/v1/public/gamingCenters/${inactiveSalon.slug}/pages/some-page`)
        .expect(404);
    });

    it('returns 404 for a non-existent gamingCenter slug', async () => {
      await request(app)
        .get('/api/v1/public/gamingCenters/non-existent/pages/some-page')
        .expect(404);
    });
  });

  describe('Availability route enforcement', () => {
    it('returns 404 for availability on an inactive gamingCenter', async () => {
      // Even if the station exists, the gamingCenter is inactive
      await request(app)
        .get(`/api/v1/public/gamingCenters/${inactiveSalon.slug}/availability/slots`)
        .expect(404);
    });

    it('returns 400 or 404 for availability with missing stationId (validation check)', async () => {
      // Just checking that it goes through resolveSalonBySlug first
      const response = await request(app)
        .get(`/api/v1/public/gamingCenters/${activeSalon.slug}/availability/slots`);

      // It should reach validation if gamingCenter is found
      expect(response.status).not.toBe(404);
    });
  });

  describe('GamingCenter root and Home page', () => {
    it('returns the HOME page for the gamingCenter root route', async () => {
      const response = await request(app)
        .get(`/api/v1/public/gamingCenters/${activeSalon.slug}`)
        .expect(200);

      expect(response.text).toContain('<title>Home SEO Title</title>');
    });

    it('returns 404 for gamingCenter root if no HOME page exists', async () => {
      const salonNoHome = await prisma.gamingCenter.create({
        data: {
          name: 'No Home GamingCenter',
          slug: 'no-home-gamingCenter',
        }
      });

      await request(app)
        .get(`/api/v1/public/gamingCenters/${salonNoHome.slug}`)
        .expect(404);
    });
  });

  describe('SEO Metadata in getPublicPage', () => {
    it('serves correct SEO tags in the HTML', async () => {
      const response = await request(app)
        .get(`/api/v1/public/gamingCenters/${activeSalon.slug}/pages/${page.slug}`)
        .expect(200);

      expect(response.text).toContain('<title>SEO Title</title>');
      expect(response.text).toContain('<meta name="description" content="SEO Description" />');
    });

    it('falls back to site settings for SEO if page fields are missing', async () => {
      await prisma.siteSettings.upsert({
        where: { gamingCenterId: activeSalon.id },
        create: {
          gamingCenterId: activeSalon.id,
          defaultSeoTitle: 'Default GamingCenter SEO',
        },
        update: {
          defaultSeoTitle: 'Default GamingCenter SEO',
        }
      });

      const pageNoSeo = await prisma.page.create({
        data: {
          gamingCenterId: activeSalon.id,
          slug: 'fallback-seo',
          title: 'Fallback Page',
          status: PageStatus.PUBLISHED,
        },
      });

      const response = await request(app)
        .get(`/api/v1/public/gamingCenters/${activeSalon.slug}/pages/${pageNoSeo.slug}`)
        .expect(200);

      expect(response.text).toContain('<title>Default GamingCenter SEO</title>');
    });

    it('falls back to page title if both seoTitle and site settings are missing', async () => {
      const otherSalon = await prisma.gamingCenter.create({
        data: { name: 'Other GamingCenter', slug: 'other-gamingCenter' }
      });
      const pageNoSeo = await prisma.page.create({
        data: {
          gamingCenterId: otherSalon.id,
          slug: 'no-seo',
          title: 'Just Title',
          status: PageStatus.PUBLISHED,
        },
      });

      const response = await request(app)
        .get(`/api/v1/public/gamingCenters/${otherSalon.slug}/pages/${pageNoSeo.slug}`)
        .expect(200);

      expect(response.text).toContain('<title>Just Title</title>');
    });
  });
});
