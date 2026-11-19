/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';

jest.mock('../../../src/modules/media/storage', () => ({
  getStorageAdapter: () => ({
    upload: jest.fn().mockResolvedValue({
      url: 'https://storage.playnest.test/uploaded-license.jpg',
      key: 'gamingCenters/center_kyc_1/verification/license.jpg',
    }),
  }),
}));

jest.mock('../../../src/config/prisma', () => {
  const mPrisma: any = {
    gamingCenterVerification: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    platformAdmin: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    gamingCenter: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
    },
  };
  mPrisma.$transaction = jest.fn((cb: any) => cb(mPrisma));
  return { prisma: mPrisma };
});

describe('KYC Verification Flow API', () => {
  const managerUser = {
    id: 'user_manager_kyc_1',
    fullName: 'Manager Reza',
    phone: '09129876543',
    role: 'MANAGER',
    gamingCenterId: 'center_kyc_1',
    isActive: true,
  };

  const managerToken = generateAccessToken({
    sessionId: 'session_manager_01',
    actorId: managerUser.id,
    actorType: 'USER',
  });

  const platformAdmin = {
    id: 'admin_kyc_01',
    fullName: 'Super Admin',
    phone: '09121111111',
    role: 'ADMIN',
    isActive: true,
    isSuperuser: true,
  };

  const platformAdminToken = generateAccessToken({
    sessionId: 'session_admin_01',
    actorId: platformAdmin.id,
    actorType: 'PLATFORM_ADMIN',
  });

  const mockVerificationRecord = {
    id: 'verif_100',
    gamingCenterId: 'center_kyc_1',
    status: 'PENDING',
    ownerFullName: 'علی رضایی',
    phoneNumber: '09123456789',
    gamingCenterName: 'گیم نت شتاب',
    nationalCardUrl: 'https://storage.playnest.test/national-id.jpg',
    idWithSelfieUrl: 'https://storage.playnest.test/selfie-with-id.jpg',
    businessLicenseUrl: 'https://storage.playnest.test/license.jpg',
    reviewerAdminId: null,
    rejectionReason: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    gamingCenter: {
      id: 'center_kyc_1',
      name: 'گیم نت شتاب',
      slug: 'shetab-game-net',
      verificationStatus: 'PENDING',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).$transaction = jest.fn((cb: any) => cb(prisma));
  });

  describe('Manager KYC Submission & Status', () => {
    it('POST /api/v1/gamingCenters/:gamingCenterId/verification submits verification with form data & file upload (image <= 5MB)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(managerUser);
      (prisma as any).gamingCenter.findUnique.mockResolvedValue({
        id: 'center_kyc_1',
        name: 'گیم نت شتاب',
        verificationStatus: 'NOT_SUBMITTED',
        users: [managerUser],
      });
      (prisma as any).gamingCenterVerification.create.mockResolvedValue({
        ...mockVerificationRecord,
        businessLicenseUrl: 'https://storage.playnest.test/uploaded-license.jpg',
      });
      (prisma as any).gamingCenter.update.mockResolvedValue({
        id: 'center_kyc_1',
        verificationStatus: 'PENDING',
      });

      const fakeImageBuffer = Buffer.from('fake-image-bytes');

      const res = await request(app)
        .post('/api/v1/gamingCenters/center_kyc_1/verification')
        .set('Authorization', `Bearer ${managerToken}`)
        .field('ownerFullName', 'علی رضایی')
        .field('phoneNumber', '09123456789')
        .field('gamingCenterName', 'گیم نت شتاب')
        .attach('businessLicense', fakeImageBuffer, { filename: 'license.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verificationId).toBe('verif_100');
      expect(res.body.data.gamingCenterId).toBe('center_kyc_1');
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.businessLicenseUrl).toBe('https://storage.playnest.test/uploaded-license.jpg');
    });

    it('POST /api/v1/gamingCenters/:gamingCenterId/verification rejects non-image business license files', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(managerUser);

      const fakePdfBuffer = Buffer.from('fake-pdf-content');

      const res = await request(app)
        .post('/api/v1/gamingCenters/center_kyc_1/verification')
        .set('Authorization', `Bearer ${managerToken}`)
        .field('ownerFullName', 'علی رضایی')
        .field('phoneNumber', '09123456789')
        .field('gamingCenterName', 'گیم نت شتاب')
        .attach('businessLicense', fakePdfBuffer, { filename: 'license.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/v1/gamingCenters/:gamingCenterId/verification submits via JSON body (backward compatibility)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(managerUser);
      (prisma as any).gamingCenter.findUnique.mockResolvedValue({
        id: 'center_kyc_1',
        name: 'گیم نت شتاب',
        verificationStatus: 'NOT_SUBMITTED',
        users: [managerUser],
      });
      (prisma as any).gamingCenterVerification.create.mockResolvedValue(mockVerificationRecord);
      (prisma as any).gamingCenter.update.mockResolvedValue({
        id: 'center_kyc_1',
        verificationStatus: 'PENDING',
      });

      const res = await request(app)
        .post('/api/v1/gamingCenters/center_kyc_1/verification')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          ownerFullName: 'علی رضایی',
          phoneNumber: '09123456789',
          gamingCenterName: 'گیم نت شتاب',
          businessLicenseUrl: 'https://storage.playnest.test/license.jpg',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verificationId).toBe('verif_100');
      expect(res.body.data.gamingCenterId).toBe('center_kyc_1');
      expect(res.body.data.status).toBe('PENDING');
    });

    it('POST /api/v1/gamingCenters/:gamingCenterId/verification validates invalid phone number', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(managerUser);

      const res = await request(app)
        .post('/api/v1/gamingCenters/center_kyc_1/verification')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          ownerFullName: 'علی رضایی',
          phoneNumber: '12345',
          gamingCenterName: 'گیم نت شتاب',
          businessLicenseUrl: 'https://storage.playnest.test/license.jpg',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/v1/gamingCenters/:gamingCenterId/verification validates missing business license', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(managerUser);

      const res = await request(app)
        .post('/api/v1/gamingCenters/center_kyc_1/verification')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          ownerFullName: 'علی رضایی',
          phoneNumber: '09123456789',
          gamingCenterName: 'گیم نت شتاب',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/gamingCenters/:gamingCenterId/verification allows user to view their verification status', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(managerUser);
      (prisma as any).gamingCenter.findUnique.mockResolvedValue({
        id: 'center_kyc_1',
        name: 'گیم نت شتاب',
        verificationStatus: 'PENDING',
        verifiedAt: null,
        rejectionReason: null,
      });
      (prisma as any).gamingCenterVerification.findFirst.mockResolvedValue(mockVerificationRecord);

      const res = await request(app)
        .get('/api/v1/gamingCenters/center_kyc_1/verification')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.gamingCenterId).toBe('center_kyc_1');
      expect(res.body.data.verificationStatus).toBe('PENDING');
      expect(res.body.data.latestVerification.id).toBe('verif_100');
    });

    it('GET /api/v1/gamingCenters/:gamingCenterId/verification displays rejection reason when rejected', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(managerUser);
      (prisma as any).gamingCenter.findUnique.mockResolvedValue({
        id: 'center_kyc_1',
        name: 'گیم نت شتاب',
        verificationStatus: 'REJECTED',
        verifiedAt: null,
        rejectionReason: 'تصویر پروانه کسب تار و ناخوانا است',
      });
      (prisma as any).gamingCenterVerification.findFirst.mockResolvedValue({
        ...mockVerificationRecord,
        status: 'REJECTED',
        rejectionReason: 'تصویر پروانه کسب تار و ناخوانا است',
      });

      const res = await request(app)
        .get('/api/v1/gamingCenters/center_kyc_1/verification')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verificationStatus).toBe('REJECTED');
      expect(res.body.data.rejectionReason).toBe('تصویر پروانه کسب تار و ناخوانا است');
      expect(res.body.data.latestVerification.rejectionReason).toBe('تصویر پروانه کسب تار و ناخوانا است');
    });
  });

  describe('Platform Admin Verification Review & Center ID Visibility', () => {
    it('GET /api/v1/platform-admin/verifications lists verification requests including gamingCenterId', async () => {
      (prisma as any).platformAdmin.findUnique = jest.fn().mockResolvedValue(platformAdmin);
      (prisma as any).gamingCenterVerification.findMany.mockResolvedValue([mockVerificationRecord]);
      (prisma as any).gamingCenterVerification.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/platform-admin/verifications')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe('verif_100');
      // Verify gamingCenterId is clearly visible for admin
      expect(res.body.data[0].gamingCenterId).toBe('center_kyc_1');
      expect(res.body.data[0].gamingCenter.id).toBe('center_kyc_1');
      expect(res.body.data[0].ownerFullName).toBe('علی رضایی');
      expect(res.body.data[0].phoneNumber).toBe('09123456789');
    });

    it('POST /api/v1/platform-admin/verifications/:id/approve approves request and activates center', async () => {
      (prisma as any).platformAdmin.findUnique = jest.fn().mockResolvedValue(platformAdmin);
      (prisma as any).gamingCenterVerification.findUnique.mockResolvedValue(mockVerificationRecord);
      (prisma as any).gamingCenterVerification.update.mockResolvedValue({
        ...mockVerificationRecord,
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewerAdminId: platformAdmin.id,
      });
      (prisma as any).gamingCenter.update.mockResolvedValue({
        id: 'center_kyc_1',
        verificationStatus: 'APPROVED',
      });

      const res = await request(app)
        .post('/api/v1/platform-admin/verifications/verif_100/approve')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.gamingCenterId).toBe('center_kyc_1');
    });

    it('POST /api/v1/platform-admin/verifications/:id/reject rejects request with reason', async () => {
      (prisma as any).platformAdmin.findUnique = jest.fn().mockResolvedValue(platformAdmin);
      (prisma as any).gamingCenterVerification.findUnique.mockResolvedValue(mockVerificationRecord);
      (prisma as any).gamingCenterVerification.update.mockResolvedValue({
        ...mockVerificationRecord,
        status: 'REJECTED',
        rejectionReason: 'تصویر پروانه کسب تار و ناخوانا است',
        reviewedAt: new Date(),
        reviewerAdminId: platformAdmin.id,
      });
      (prisma as any).gamingCenter.update.mockResolvedValue({
        id: 'center_kyc_1',
        verificationStatus: 'REJECTED',
        rejectionReason: 'تصویر پروانه کسب تار و ناخوانا است',
      });

      const res = await request(app)
        .post('/api/v1/platform-admin/verifications/verif_100/reject')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          rejectionReason: 'تصویر پروانه کسب تار و ناخوانا است',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.gamingCenterId).toBe('center_kyc_1');
      expect(res.body.data.rejectionReason).toBe('تصویر پروانه کسب تار و ناخوانا است');
    });

    it('POST /api/v1/platform-admin/verifications/:id/reject validates rejection reason is required', async () => {
      (prisma as any).platformAdmin.findUnique = jest.fn().mockResolvedValue(platformAdmin);

      const res = await request(app)
        .post('/api/v1/platform-admin/verifications/verif_100/reject')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          rejectionReason: '  ',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Public Visibility Enforcement Until Verification Approval', () => {
    it('GET /api/v1/gamingCenters filters by APPROVED status by default', async () => {
      (prisma.gamingCenter.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.gamingCenter.count as jest.Mock).mockResolvedValue(0);

      await request(app).get('/api/v1/gamingCenters');

      expect(prisma.gamingCenter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            verificationStatus: 'APPROVED',
          }),
        })
      );
    });

    it('GET /api/v1/public/gamingCenters/:slug returns 404 when center verification is PENDING, REJECTED or NOT_SUBMITTED', async () => {
      (prisma.gamingCenter.findUnique as jest.Mock).mockResolvedValue({
        id: 'center_unverified',
        slug: 'unverified-center',
        isActive: true,
        verificationStatus: 'PENDING',
      });

      const res = await request(app).get('/api/v1/public/gamingCenters/unverified-center');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
