import request from 'supertest';
import { PageSectionType, PageStatus, PrismaClient } from '@prisma/client';
import app from '../../app';

const prisma = new PrismaClient();

describe('GET /api/v1/public/gamingCenters/:salonSlug/pages/:pageSlug', () => {
  let gamingCenter: { id: string; slug: string };
  let page: { id: string; slug: string };
  let draftPage: { id: string; slug: string };

  beforeAll(async () => {
    await prisma.salonPageSlugHistory.deleteMany();
    await prisma.salonPageSection.deleteMany();
    await prisma.page.deleteMany();
    await prisma.gamingCenter.deleteMany();

    gamingCenter = await prisma.gamingCenter.create({
      data: {
        name: 'Public Pages GamingCenter',
        slug: `public-pages-${Date.now()}`,
      },
    });

    page = await prisma.page.create({
      data: {
        gamingCenterId: gamingCenter.id,
        slug: 'about',
        title: 'About',
        status: PageStatus.PUBLISHED,
        publishedAt: new Date(),
        sections: {
          create: [
            {
              type: PageSectionType.RICH_TEXT,
              dataJson: JSON.stringify({
                title: 'Second section',
                blocks: [{ type: 'paragraph', text: 'Hello world' }],
              }),
              sortOrder: 1,
              isEnabled: true,
            },
            {
              type: PageSectionType.RICH_TEXT,
              dataJson: JSON.stringify({
                title: 'First section',
                blocks: [{ type: 'paragraph', text: 'Hello world' }],
              }),
              sortOrder: 0,
              isEnabled: true,
            },
            {
              type: PageSectionType.RICH_TEXT,
              dataJson: JSON.stringify({
                title: 'Third section',
                blocks: [{ type: 'paragraph', text: 'Hello world' }],
              }),
              sortOrder: 2,
              isEnabled: true,
            },
            {
              type: PageSectionType.RICH_TEXT,
              dataJson: JSON.stringify({
                title: 'Hidden section',
                blocks: [{ type: 'paragraph', text: 'Hello world' }],
              }),
              sortOrder: 3,
              isEnabled: false,
            },
          ],
        },
      },
      select: {
        id: true,
        slug: true,
      },
    });

    draftPage = await prisma.page.create({
      data: {
        gamingCenterId: gamingCenter.id,
        slug: 'draft',
        title: 'Draft',
        status: PageStatus.DRAFT,
        sections: {
          create: [
            {
              type: PageSectionType.RICH_TEXT,
              dataJson: JSON.stringify({
                title: 'Draft section',
                blocks: [{ type: 'paragraph', text: 'Draft content' }],
              }),
              sortOrder: 0,
              isEnabled: true,
            },
          ],
        },
      },
      select: {
        id: true,
        slug: true,
      },
    });

    await prisma.salonPageSlugHistory.create({
      data: {
        pageId: page.id,
        oldSlug: 'about-old',
      },
    });

    await prisma.salonPageSlugHistory.create({
      data: {
        pageId: draftPage.id,
        oldSlug: 'draft-old',
      },
    });
  });

  afterAll(async () => {
    await prisma.salonPageSlugHistory.deleteMany();
    await prisma.salonPageSection.deleteMany();
    await prisma.page.deleteMany();
    await prisma.gamingCenter.deleteMany();
    await prisma.$disconnect();
  });

  it('returns the page HTML for the current slug', async () => {
    const response = await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/pages/${page.slug}`)
      .expect(200);

    expect(response.text).toContain('<!doctype html>');
    expect(response.text).toContain('<title>About</title>');
  });

  it('includes caching headers and supports conditional requests', async () => {
    const response = await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/pages/${page.slug}`)
      .expect(200);

    const etag = response.headers.etag;
    const lastModified = response.headers['last-modified'];

    expect(etag).toBeDefined();
    expect(lastModified).toBeDefined();

    await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/pages/${page.slug}`)
      .set('If-None-Match', etag)
      .expect(304);

    await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/pages/${page.slug}`)
      .set('If-Modified-Since', lastModified)
      .expect(304);
  });

  it('busts cache when the page is updated', async () => {
    const initialResponse = await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/pages/${page.slug}`)
      .expect(200);

    const initialEtag = initialResponse.headers.etag;

    await prisma.page.update({
      where: { id: page.id },
      data: { title: 'About Updated' },
    });

    const updatedResponse = await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/pages/${page.slug}`)
      .set('If-None-Match', initialEtag)
      .expect(200);

    expect(updatedResponse.headers.etag).not.toBe(initialEtag);
  });

  it('renders enabled sections in sort order', async () => {
    const response = await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/pages/${page.slug}`)
      .expect(200);

    const html = response.text;
    const firstIndex = html.indexOf('First section');
    const secondIndex = html.indexOf('Second section');
    const thirdIndex = html.indexOf('Third section');

    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(-1);
    expect(thirdIndex).toBeGreaterThan(-1);
    expect(firstIndex).toBeLessThan(secondIndex);
    expect(secondIndex).toBeLessThan(thirdIndex);
    expect(html).not.toContain('Hidden section');
  });

  it('redirects to the current slug when slug history matches', async () => {
    const response = await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/pages/about-old`)
      .expect(301);

    expect(response.headers.location).toBe(
      `/api/v1/public/gamingCenters/${gamingCenter.slug}/pages/${page.slug}`
    );
  });

  it('returns 404 for draft pages and their slug history', async () => {
    await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/pages/${draftPage.slug}`)
      .expect(404);

    await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/pages/draft-old`)
      .expect(404);
  });
});
