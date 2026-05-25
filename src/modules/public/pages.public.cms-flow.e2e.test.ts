import request from 'supertest';
import { PageSectionType, PageStatus, PageType, UserRole } from '@prisma/client';
import app from '../../app';
import { createTestSalon, createTestUser, generateToken } from '../../common/utils/test-utils';
import { prisma } from '../../config/prisma';

describe('CMS page lifecycle -> public pages', () => {
  const buildRichTextSection = () => ({
    type: PageSectionType.RICH_TEXT,
    dataJson: JSON.stringify({
      title: 'Intro section',
      blocks: [{ type: 'paragraph', text: 'Welcome to our stations.' }],
    }),
    sortOrder: 0,
    isEnabled: true,
  });

  let gamingCenter: { id: string; slug: string };
  let managerToken: string;
  let publishedPageId: string;
  const publishedSlug = 'stations';

  beforeAll(async () => {
    await prisma.salonPageSlugHistory.deleteMany();
    await prisma.salonPageSection.deleteMany();
    await prisma.page.deleteMany();
    await prisma.user.deleteMany();
    await prisma.gamingCenter.deleteMany();

    gamingCenter = await createTestSalon({
      name: 'CMS Public Flow GamingCenter',
      slug: `cms-public-flow-${Date.now()}`,
    });

    const manager = await createTestUser({
      gamingCenterId: gamingCenter.id,
      role: UserRole.MANAGER,
      phone: `0912${Date.now()}`.slice(0, 11),
    });

    managerToken = generateToken({
      actorId: manager.id,
      actorType: 'USER',
      gamingCenterId: gamingCenter.id,
      role: manager.role,
    });
  });

  afterAll(async () => {
    await prisma.salonPageSlugHistory.deleteMany();
    await prisma.salonPageSection.deleteMany();
    await prisma.page.deleteMany();
    await prisma.user.deleteMany();
    await prisma.gamingCenter.deleteMany();
    await prisma.$disconnect();
  });

  it('creates and publishes a page via CMS endpoints', async () => {
    const createResponse = await request(app)
      .post(`/api/v1/gamingCenters/${gamingCenter.id}/pages`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        slug: publishedSlug,
        title: 'Services',
        type: PageType.SERVICES,
        status: PageStatus.DRAFT,
        sections: [buildRichTextSection()],
      })
      .expect(201);

    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.status).toBe(PageStatus.DRAFT);
    expect(createResponse.body.data.publishedAt).toBeNull();
    publishedPageId = createResponse.body.data.id;

    const publishResponse = await request(app)
      .patch(`/api/v1/gamingCenters/${gamingCenter.id}/pages/${publishedPageId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: PageStatus.PUBLISHED })
      .expect(200);

    expect(publishResponse.body.success).toBe(true);
    expect(publishResponse.body.data.status).toBe(PageStatus.PUBLISHED);
    expect(publishResponse.body.data.publishedAt).toBeTruthy();

    const publicResponse = await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/pages/${publishedSlug}`)
      .expect(200);

    expect(publicResponse.text).toContain('<title>Services</title>');
  });

  it('returns only published pages and redirects after slug changes', async () => {
    await request(app)
      .post(`/api/v1/gamingCenters/${gamingCenter.id}/pages`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        slug: 'draft-page',
        title: 'Draft Page',
        type: PageType.CUSTOM,
        status: PageStatus.DRAFT,
        sections: [buildRichTextSection()],
      })
      .expect(201);

    await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/pages/draft-page`)
      .expect(404);

    const updatedSlug = 'stations-updated';
    await request(app)
      .patch(`/api/v1/gamingCenters/${gamingCenter.id}/pages/${publishedPageId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ slug: updatedSlug })
      .expect(200);

    const redirectResponse = await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/pages/${publishedSlug}`)
      .expect(301);

    expect(redirectResponse.headers.location).toBe(
      `/api/v1/public/gamingCenters/${gamingCenter.slug}/pages/${updatedSlug}`
    );

    await request(app)
      .get(`/api/v1/public/gamingCenters/${gamingCenter.slug}/pages/${updatedSlug}`)
      .expect(200);
  });
});
