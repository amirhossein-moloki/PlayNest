/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import argon2 from 'argon2';

jest.mock('../../../src/config/prisma', () => {
  const mPrisma: any = {
    gameCenterOnboarding: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    phoneOtp: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    gamingCenter: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    address: {
      create: jest.fn(),
    },
    settings: {
      create: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    siteSettings: {
      upsert: jest.fn(),
    },
    session: {
      create: jest.fn(),
    },
  };
  mPrisma.$transaction = jest.fn((cb: any) => cb(mPrisma));
  return { prisma: mPrisma };
});

describe('GameCenter Onboarding Flow API', () => {
  const mockDraft = {
    id: 'onboard_test_123',
    gameCenterName: 'پلی‌زون تجریش',
    managerFullName: 'علی علوی',
    managerPhone: '+989123456789',
    step: 'OTP_PENDING',
    provinceId: null,
    cityId: null,
    address: null,
    latitude: null,
    longitude: null,
    openingTime: null,
    closingTime: null,
    closedDays: [],
    timezone: 'Asia/Tehran',
    logoMediaId: null,
    galleryMediaIds: [],
    gamingCenterId: null,
    managerId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).$transaction = jest.fn((cb: any) => cb(prisma));
  });

  describe('Step 1: POST /api/v1/onboarding/start', () => {
    it('should create initial draft and dispatch OTP', async () => {
      (prisma as any).gameCenterOnboarding.findFirst.mockResolvedValue(null);
      (prisma as any).gameCenterOnboarding.create.mockResolvedValue(mockDraft);
      (prisma as any).phoneOtp.create.mockResolvedValue({ id: 'otp_01' });

      const res = await request(app)
        .post('/api/v1/onboarding/start')
        .send({
          gameCenterName: 'پلی‌زون تجریش',
          managerFullName: 'علی علوی',
          managerPhone: '09123456789',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.onboardingId).toBe(mockDraft.id);
      expect(res.body.data.step).toBe('OTP_PENDING');
      expect((prisma as any).gameCenterOnboarding.create).toHaveBeenCalled();
      expect((prisma as any).phoneOtp.create).toHaveBeenCalled();
    });

    it('should reject invalid phone format', async () => {
      const res = await request(app)
        .post('/api/v1/onboarding/start')
        .send({
          gameCenterName: 'پلی‌زون تجریش',
          managerFullName: 'علی علوی',
          managerPhone: '123456',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Step 1(b): POST /api/v1/onboarding/otp/verify', () => {
    it('should verify OTP and progress step to LOCATION_PENDING', async () => {
      const validCode = '123456';
      const codeHash = await argon2.hash(validCode);

      (prisma as any).gameCenterOnboarding.findUnique.mockResolvedValue(mockDraft);
      (prisma as any).phoneOtp.findFirst.mockResolvedValue({
        id: 'otp_01',
        phone: mockDraft.managerPhone,
        codeHash,
      });
      (prisma as any).phoneOtp.update.mockResolvedValue({ id: 'otp_01', consumedAt: new Date() });
      (prisma as any).user.findMany.mockResolvedValue([]);
      (prisma as any).gameCenterOnboarding.update.mockResolvedValue({
        ...mockDraft,
        step: 'LOCATION_PENDING',
      });

      const res = await request(app)
        .post('/api/v1/onboarding/otp/verify')
        .send({
          onboardingId: mockDraft.id,
          code: validCode,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verified).toBe(true);
      expect(res.body.data.step).toBe('LOCATION_PENDING');
    });
  });

  describe('Step 2: PUT /api/v1/onboarding/:id/location', () => {
    it('should update location details and progress to WORKING_HOURS_PENDING', async () => {
      (prisma as any).gameCenterOnboarding.findUnique.mockResolvedValue(mockDraft);
      (prisma as any).gameCenterOnboarding.update.mockResolvedValue({
        ...mockDraft,
        provinceId: 'province_tehran',
        cityId: 'city_tehran',
        address: 'تجریش، خیابان شهرداری، پلاک ۱۰',
        latitude: 35.805,
        longitude: 51.431,
        step: 'WORKING_HOURS_PENDING',
      });

      const res = await request(app)
        .put(`/api/v1/onboarding/${mockDraft.id}/location`)
        .send({
          provinceId: 'province_tehran',
          cityId: 'city_tehran',
          address: 'تجریش، خیابان شهرداری، پلاک ۱۰',
          latitude: 35.805,
          longitude: 51.431,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.step).toBe('WORKING_HOURS_PENDING');
      expect(res.body.data.location.province_id).toBe('province_tehran');
      expect(res.body.data.location.city_id).toBe('city_tehran');
    });
  });

  describe('Step 3: PUT /api/v1/onboarding/:id/working-hours', () => {
    it('should update working hours supporting midnight cross and closed days', async () => {
      (prisma as any).gameCenterOnboarding.findUnique.mockResolvedValue(mockDraft);
      (prisma as any).gameCenterOnboarding.update.mockResolvedValue({
        ...mockDraft,
        openingTime: '10:00',
        closingTime: '02:00',
        closedDays: [5],
        timezone: 'Asia/Tehran',
        step: 'MEDIA_PENDING',
      });

      const res = await request(app)
        .put(`/api/v1/onboarding/${mockDraft.id}/working-hours`)
        .send({
          openingTime: '10:00',
          closingTime: '02:00',
          closedDays: [5],
          timezone: 'Asia/Tehran',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.step).toBe('MEDIA_PENDING');
      expect(res.body.data.working_hours.opening_time).toBe('10:00');
      expect(res.body.data.working_hours.closing_time).toBe('02:00');
      expect(res.body.data.working_hours.closed_days).toEqual([5]);
    });
  });

  describe('Step 4: PUT /api/v1/onboarding/:id/media', () => {
    it('should update optional media and progress to PREVIEW', async () => {
      (prisma as any).gameCenterOnboarding.findUnique.mockResolvedValue(mockDraft);
      (prisma as any).gameCenterOnboarding.update.mockResolvedValue({
        ...mockDraft,
        logoMediaId: 'media_logo_1',
        galleryMediaIds: ['media_gal_1', 'media_gal_2'],
        step: 'PREVIEW',
      });

      const res = await request(app)
        .put(`/api/v1/onboarding/${mockDraft.id}/media`)
        .send({
          logoMediaId: 'media_logo_1',
          galleryMediaIds: ['media_gal_1', 'media_gal_2'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.step).toBe('PREVIEW');
      expect(res.body.data.media.logo_media_id).toBe('media_logo_1');
      expect(res.body.data.media.gallery_media_ids).toEqual(['media_gal_1', 'media_gal_2']);
    });
  });

  describe('Step 5: GET /api/v1/onboarding/:id/preview', () => {
    it('should return complete preview data of the entered information', async () => {
      (prisma as any).gameCenterOnboarding.findUnique.mockResolvedValue({
        ...mockDraft,
        provinceId: 'province_tehran',
        cityId: 'city_tehran',
        address: 'تجریش، پلاک ۱۰',
        openingTime: '10:00',
        closingTime: '02:00',
        closedDays: [5],
        step: 'PREVIEW',
      });

      const res = await request(app).get(`/api/v1/onboarding/${mockDraft.id}/preview`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.onboarding_id).toBe(mockDraft.id);
      expect(res.body.data.game_center.name).toBe(mockDraft.gameCenterName);
      expect(res.body.data.location.address).toBe('تجریش، پلاک ۱۰');
      expect(res.body.data.working_hours.closing_time).toBe('02:00');
    });
  });

  describe('Step 6: POST /api/v1/onboarding/:id/complete', () => {
    it('should execute transaction, create GameCenter and Manager, and return redirect', async () => {
      const fullDraft = {
        ...mockDraft,
        provinceId: 'province_tehran',
        cityId: 'city_tehran',
        address: 'تجریش، پلاک ۱۰',
        openingTime: '10:00',
        closingTime: '02:00',
        step: 'PREVIEW',
      };

      (prisma as any).gameCenterOnboarding.findUnique.mockResolvedValue(fullDraft);
      (prisma as any).gamingCenter.create = jest.fn().mockResolvedValue({
        id: 'gc_new_100',
        name: fullDraft.gameCenterName,
        slug: 'play-zone-tajrish',
        isActive: true,
      });
      (prisma as any).address = { create: jest.fn().mockResolvedValue({ id: 'addr_1' }) };
      (prisma as any).settings = { create: jest.fn().mockResolvedValue({ id: 'sett_1' }) };
      (prisma as any).user.findFirst.mockResolvedValue(null);
      (prisma as any).user.create.mockResolvedValue({
        id: 'user_manager_1',
        fullName: fullDraft.managerFullName,
        phone: fullDraft.managerPhone,
        role: 'MANAGER',
      });
      (prisma as any).session.create.mockResolvedValue({ id: 'sess_123' });
      (prisma as any).gameCenterOnboarding.update.mockResolvedValue({
        ...fullDraft,
        step: 'COMPLETED',
        gamingCenterId: 'gc_new_100',
      });

      const res = await request(app)
        .post(`/api/v1/onboarding/${mockDraft.id}/complete`)
        .send({ confirmation: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.game_center_id).toBe('gc_new_100');
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.redirect).toBe('/manager/dashboard');
      expect(res.body.data.tokens).toBeDefined();
    });
  });
});
