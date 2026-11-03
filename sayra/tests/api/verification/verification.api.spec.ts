/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';

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
    nationalCardUrl: 'https://storage.playnest.test/national-id.jpg',
    idWithSelfieUrl: 'https://storage.playnest.test/selfie-with-id.jpg',
    businessLicenseUrl: 'https://storage.playnest.test/license.jpg',
    reviewerAdminId: null,
    rejectionReason: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).$transaction = jest.fn((cb: any) => cb(prisma));
  });

  describe('Manager KYC Submission & Status', () => {
    it('POST /api/v1/gamingCenters/:gamingCenterId/verification submits all 3 required documents', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(managerUser);
      (prisma as any).gamingCenter.findUnique.mockResolvedValue({
        id: 'center_kyc_1',
        name: 'گیم نت شتاب',
        verificationStatus: 'NOT_SUBMITTED',
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
          nationalCardUrl: 'https://storage.playnest.test/national-id.jpg',
          idWithSelfieUrl: 'https://storage.playnest.test/selfie-with-id.jpg',
          businessLicenseUrl: 'https://storage.playnest.test/license.jpg',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verificationId).toBe('verif_100');
      expect(res.body.data.status).toBe('PENDING');
    });

    it('POST /api/v1/gamingCenters/:gamingCenterId/verification validates missing URLs', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(managerUser);

      const res = await request(app)
        .post('/api/v1/gamingCenters/center_kyc_1/verification')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          nationalCardUrl: 'not-a-url',
          idWithSelfieUrl: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/gamingCenters/:gamingCenterId/verification retrieves verification status', async () => {
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
      expect(res.body.data.verificationStatus).toBe('PENDING');
      expect(res.body.data.latestVerification.id).toBe('verif_100');
    });
  });

  describe('Platform Admin Verification Review', () => {
    it('GET /api/v1/platform-admin/verifications lists verification requests', async () => {
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
      expect(res.body.data.rejectionReason).toBe('تصویر پروانه کسب تار و ناخوانا است');
    });
  });
});
