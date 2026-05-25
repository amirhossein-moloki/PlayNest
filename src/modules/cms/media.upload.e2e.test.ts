import request from 'supertest';
import { PrismaClient, UserRole } from '@prisma/client';
import app from '../../app';
import { generateToken } from '../../common/utils/test-utils';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

describe('Media Upload E2E', () => {
  let gamingCenter: { id: string };
  let manager: { id: string };
  let token: string;
  const testImagePath = path.join(__dirname, 'test-image.png');

  beforeAll(async () => {
    // Create a dummy image for testing
    // A 1x1 transparent PNG
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(testImagePath, pngBuffer);

    await prisma.media.deleteMany();
    await prisma.user.deleteMany();
    await prisma.gamingCenter.deleteMany();

    gamingCenter = await prisma.gamingCenter.create({
      data: {
        name: 'Media Test GamingCenter',
        slug: 'media-test-gamingCenter',
      },
    });

    manager = await prisma.user.create({
      data: {
        gamingCenterId: gamingCenter.id,
        fullName: 'Manager User',
        phone: '09123456789',
        role: UserRole.MANAGER,
      },
    });

    token = generateToken({
      userId: manager.id,
      gamingCenterId: gamingCenter.id,
      role: UserRole.MANAGER,
    });
  });

  afterAll(async () => {
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    await prisma.media.deleteMany();
    await prisma.user.deleteMany();
    await prisma.gamingCenter.deleteMany();
    await prisma.$disconnect();
  });

  it('uploads an image and creates a record', async () => {
    const response = await request(app)
      .post(`/api/v1/gamingCenters/${gamingCenter.id}/media/upload`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', testImagePath)
      .field('purpose', 'GALLERY')
      .field('altText', 'Test Image')
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.url).toContain('/uploads/');
    expect(response.body.data.thumbUrl).toContain('/uploads/thumbnails/');
    expect(response.body.data.altText).toBe('Test Image');

    // Verify DB record
    const media = await prisma.media.findUnique({
      where: { id: response.body.data.id },
    });
    expect(media).toBeDefined();
    expect(media?.url).toBe(response.body.data.url);
  });

  it('returns 400 if no file is uploaded', async () => {
    await request(app)
      .post(`/api/v1/gamingCenters/${gamingCenter.id}/media/upload`)
      .set('Authorization', `Bearer ${token}`)
      .field('purpose', 'GALLERY')
      .expect(400);
  });

  it('enforces altText for logo purpose', async () => {
    await request(app)
      .post(`/api/v1/gamingCenters/${gamingCenter.id}/media/upload`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', testImagePath)
      .field('purpose', 'LOGO')
      // missing altText
      .expect(400);
  });
});
