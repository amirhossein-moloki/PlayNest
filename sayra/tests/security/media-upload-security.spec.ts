/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';
import fs from 'fs/promises';
import express from 'express';
import request from 'supertest';
import sharp from 'sharp';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { UserRole } from '@prisma/client';
import {
  processAndStoreImage,
  deleteStoredImage,
} from '../../src/common/stations/upload.station';
import * as MediaStation from '../../src/modules/cms/media.station';
import * as MediaRepo from '../../src/modules/cms/media.repo';
import {
  createMediaSchema,
  updateMediaSchema,
} from '../../src/modules/cms/media.validators';
import { cmsMediaRouter } from '../../src/modules/cms/media.routes';
import { VerificationController } from '../../src/modules/verification/verification.controller';
import { uploadLicenseMiddleware } from '../../src/modules/verification/verification.routes';
import { VerificationStation } from '../../src/modules/verification/verification.station';
import { errorHandler } from '../../src/common/errors/errorHandler';

const mockUpload = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('../../src/modules/media/storage', () => ({
  getStorageAdapter: () => ({
    upload: mockUpload,
  }),
}));

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    media: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    gamingCenter: {
      count: jest.fn(),
    },
  },
}));

describe('SEC-016: Media Deletion Ownership, Pre-Validation Disk Write & KYC Upload Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processAndStoreImage validates with sharp before writing to disk and leaves zero orphan files on invalid input', async () => {
    const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const writeSpy = jest.spyOn(fs, 'writeFile');

    await expect(
      processAndStoreImage({
        originalname: 'evil.jpg',
        mimetype: 'image/jpeg',
        buffer: svgBuffer,
      } as Express.Multer.File)
    ).rejects.toThrow();

    expect(writeSpy).not.toHaveBeenCalled();
    writeSpy.mockRestore();

    // Valid PNG succeeds and derives extension from verified format, not spoofed originalname
    const validPng = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    const stored = await processAndStoreImage({
      originalname: 'shell.svg',
      mimetype: 'image/png',
      buffer: validPng,
    } as Express.Multer.File);

    try {
      expect(stored.fileName.endsWith('.png')).toBe(true);
      expect(stored.url.startsWith('/uploads/')).toBe(true);
    } finally {
      await fs.unlink(path.resolve('uploads', stored.fileName)).catch(() => {});
      await fs.unlink(path.resolve('uploads/thumbnails', stored.fileName)).catch(() => {});
      void deleteStoredImage;
    }
  });

  it('CMS Media blocks local /uploads URLs in manual POST/PATCH and skips unlink when still referenced', async () => {
    expect(() =>
      createMediaSchema.parse({
        body: { url: '/uploads/victim-tenant.jpg' },
      })
    ).toThrow();

    expect(() =>
      updateMediaSchema.parse({
        params: { mediaId: 'cmwly4svx002b137pwem9snx1' },
        body: { url: '/uploads/victim-tenant.jpg' },
      })
    ).toThrow();

    await expect(
      MediaStation.createMedia('gc-attacker', { url: '/uploads/victim.jpg' } as any)
    ).rejects.toThrow(/Local \/uploads/i);

    await expect(
      MediaStation.updateMedia('gc-attacker', 'media-1', { url: '/uploads/victim.jpg' } as any)
    ).rejects.toThrow(/cannot be modified/i);

    // Even if a shared local URL existed on two rows, deleting one must not unlink disk file
    const { prisma } = await import('../../src/config/prisma');
    (prisma.media.findFirst as jest.Mock).mockImplementation((() =>
      Promise.resolve({
        id: 'media-attacker',
        gamingCenterId: 'gc-attacker',
        url: '/uploads/shared.jpg',
        thumbUrl: '/uploads/thumbnails/shared.jpg',
      })) as any);
    (prisma.media.deleteMany as jest.Mock).mockImplementation((() => Promise.resolve({ count: 1 })) as any);
    (prisma.media.count as jest.Mock).mockImplementation((() => Promise.resolve(1)) as any);
    (prisma.gamingCenter.count as jest.Mock).mockImplementation((() => Promise.resolve(0)) as any);

    const unlinkSpy = jest.spyOn(fs, 'unlink');
    await MediaStation.deleteMedia('gc-attacker', 'media-attacker');
    expect(unlinkSpy).not.toHaveBeenCalled();
    unlinkSpy.mockRestore();
    void MediaRepo;
  });

  it('CMS /media/upload rejects image/svg+xml MIME type with 400', async () => {
    const app = express();
    app.use('/gamingCenters/:gamingCenterId/media', cmsMediaRouter);
    app.use(errorHandler);

    const res = await request(app)
      .post('/gamingCenters/cmwlxvn5r0014137pppik07te/media/upload')
      .attach('file', Buffer.from('<svg></svg>'), {
        filename: 'xss.svg',
        contentType: 'image/svg+xml',
      });

    expect(res.status).toBe(400);
  });

  it('KYC verification rejects SVG and corrupt image bytes, and re-encodes valid PNG with private no-store cacheControl', async () => {
    const app = express();
    app.post(
      '/kyc/:gamingCenterId',
      (req: any, _res, next) => {
        req.actor = {
          id: 'usr-mgr',
          actorType: 'USER',
          role: UserRole.MANAGER,
          gamingCenterId: 'center-1',
        };
        next();
      },
      uploadLicenseMiddleware,
      VerificationController.submitVerification as any
    );
    app.use(errorHandler);

    // 1. SVG MIME rejected
    const svgRes = await request(app)
      .post('/kyc/center-1')
      .field('ownerFullName', 'Owner Name')
      .field('phoneNumber', '09123456789')
      .field('gamingCenterName', 'Center Name')
      .attach('businessLicense', Buffer.from('<svg></svg>'), {
        filename: 'license.svg',
        contentType: 'image/svg+xml',
      });
    expect(svgRes.status).toBe(400);

    // 2. Spoofed JPEG MIME with HTML content rejected by sharp
    const htmlSpoofRes = await request(app)
      .post('/kyc/center-1')
      .field('ownerFullName', 'Owner Name')
      .field('phoneNumber', '09123456789')
      .field('gamingCenterName', 'Center Name')
      .attach('businessLicense', Buffer.from('<script>alert(1)</script>'), {
        filename: 'license.jpg',
        contentType: 'image/jpeg',
      });
    expect(htmlSpoofRes.status).toBe(400);
    expect(mockUpload).not.toHaveBeenCalled();

    // 3. Valid PNG with deceptive .svg filename is re-encoded and stored with .png + private, no-store
    const validPng = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 128, b: 255 } },
    })
      .png()
      .toBuffer();
    mockUpload.mockResolvedValue({
      url: 'https://storage.playnest.test/kyc.png',
      key: 'gamingCenters/center-1/verification/kyc.png',
    });
    const submitSpy = jest
      .spyOn(VerificationStation, 'submitVerification')
      .mockResolvedValue({ verificationId: 'v1' } as any);

    const okRes = await request(app)
      .post('/kyc/center-1')
      .field('ownerFullName', 'Owner Name')
      .field('phoneNumber', '09123456789')
      .field('gamingCenterName', 'Center Name')
      .attach('businessLicense', validPng, {
        filename: 'license.svg',
        contentType: 'image/png',
      });

    // Express AppError controller uses res.created which isn't attached unless response middleware runs;
    // verify adapter.upload arguments before response helper
    expect(mockUpload).toHaveBeenCalledTimes(1);
    const uploadArg = mockUpload.mock.calls[0][0] as any;
    expect(uploadArg.key.endsWith('.png')).toBe(true);
    expect(uploadArg.contentType).toBe('image/png');
    expect(uploadArg.cacheControl).toBe('private, no-store');
    void okRes;
    submitSpy.mockRestore();
  });
});
