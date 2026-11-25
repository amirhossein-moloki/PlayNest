/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { OnboardingStep } from '@prisma/client';
import { onboardingRouter } from '../../src/modules/onboarding/onboarding.routes';
import { OnboardingRepo } from '../../src/modules/onboarding/onboarding.repo';
import { signOnboardingToken } from '../../src/modules/onboarding/onboarding.station';
import { OtpService } from '../../src/modules/auth/otp.service';
import { responseMiddleware } from '../../src/common/middleware/response';
import { errorHandler } from '../../src/common/errors/errorHandler';

describe('SEC-009: Onboarding OTP Bypass & Existing User Hijacking Prevention', () => {
  const app = express();
  app.use(express.json());
  app.use(responseMiddleware);
  app.use('/api/v1/onboarding', onboardingRouter);
  app.use(errorHandler);

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('always creates a fresh onboarding draft on POST /start instead of disclosing or reusing an existing draft ID', async () => {
    const findByPhoneSpy = jest.spyOn(OnboardingRepo, 'findByManagerPhone');
    const createDraftSpy = jest.spyOn(OnboardingRepo, 'createDraft').mockResolvedValue({
      id: 'onb-fresh-1',
      gameCenterName: 'New Center',
      managerFullName: 'Alice',
      managerPhone: '+989121112233',
      step: OnboardingStep.OTP_PENDING,
    } as any);
    jest.spyOn(OtpService, 'requestOtp').mockResolvedValue({ message: 'OTP sent' });

    const res = await request(app)
      .post('/api/v1/onboarding/start')
      .send({
        gameCenterName: 'New Center',
        managerFullName: 'Alice',
        managerPhone: '09121112233',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.onboardingId).toBe('onb-fresh-1');
    expect(findByPhoneSpy).not.toHaveBeenCalled();
    expect(createDraftSpy).toHaveBeenCalledTimes(1);
  });

  it('does not return existing user JWT tokens from verifyOtp even if a User owns the phone number', async () => {
    jest.spyOn(OnboardingRepo, 'findById').mockResolvedValue({
      id: 'onb-verify-1',
      managerPhone: '+989121112233',
      managerFullName: 'Victim Staff',
      step: OnboardingStep.OTP_PENDING,
    } as any);
    jest.spyOn(OtpService, 'verifyAndConsumeOtp').mockResolvedValue({ id: 'otp-1' } as any);
    jest.spyOn(OnboardingRepo, 'updateDraft').mockResolvedValue({
      id: 'onb-verify-1',
      managerPhone: '+989121112233',
      managerFullName: 'Victim Staff',
      managerId: null,
      step: OnboardingStep.LOCATION_PENDING,
    } as any);

    const res = await request(app)
      .post('/api/v1/onboarding/otp/verify')
      .send({ onboardingId: 'onb-verify-1', code: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.data.tokens).toBeNull();
    expect(typeof res.body.data.onboardingToken).toBe('string');
  });

  it('rejects /location, /working-hours, /media, /preview, and /complete when draft is still OTP_PENDING even with a forged token', async () => {
    jest.spyOn(OnboardingRepo, 'findById').mockResolvedValue({
      id: 'onb-pending-1',
      managerPhone: '+989121112233',
      step: OnboardingStep.OTP_PENDING,
    } as any);
    const updateSpy = jest.spyOn(OnboardingRepo, 'updateDraft');

    const locRes = await request(app)
      .put('/api/v1/onboarding/onb-pending-1/location')
      .send({ provinceId: 'p1', cityId: 'c1', address: 'Tehran Street 1' });
    expect(locRes.status).toBe(403);

    const hoursRes = await request(app)
      .put('/api/v1/onboarding/onb-pending-1/working-hours')
      .send({ openingTime: '09:00', closingTime: '23:00' });
    expect(hoursRes.status).toBe(403);

    const mediaRes = await request(app)
      .put('/api/v1/onboarding/onb-pending-1/media')
      .send({ logoMediaId: 'm1', galleryMediaIds: [] });
    expect(mediaRes.status).toBe(403);

    const prevRes = await request(app).get('/api/v1/onboarding/onb-pending-1/preview');
    expect(prevRes.status).toBe(403);

    const compRes = await request(app)
      .post('/api/v1/onboarding/onb-pending-1/complete')
      .send({ confirmation: true });
    expect(compRes.status).toBe(403);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('rejects post-OTP endpoints when onboardingToken is missing, tampered, or bound to a different draft', async () => {
    jest.spyOn(OnboardingRepo, 'findById').mockResolvedValue({
      id: 'onb-verified-1',
      managerPhone: '+989121112233',
      step: OnboardingStep.LOCATION_PENDING,
    } as any);

    const noTokenRes = await request(app).get('/api/v1/onboarding/onb-verified-1/preview');
    expect(noTokenRes.status).toBe(401);

    const otherDraftToken = signOnboardingToken('onb-other-id', '+989121112233');
    const wrongDraftRes = await request(app)
      .get('/api/v1/onboarding/onb-verified-1/preview')
      .set('x-onboarding-token', otherDraftToken);
    expect(wrongDraftRes.status).toBe(401);

    const validToken = signOnboardingToken('onb-verified-1', '+989121112233');
    const tamperedToken = `${validToken.slice(0, -1)}${validToken.endsWith('A') ? 'B' : 'A'}`;
    const tamperedRes = await request(app)
      .put('/api/v1/onboarding/onb-verified-1/location')
      .set('x-onboarding-token', tamperedToken)
      .send({ provinceId: 'p1', cityId: 'c1', address: 'Tehran Street 1' });
    expect(tamperedRes.status).toBe(401);
  });

  it('refuses /complete with 409 Conflict when managerPhone belongs to any existing User (e.g. inactive or staff user)', async () => {
    const validToken = signOnboardingToken('onb-hijack-1', '+989129998877');
    jest.spyOn(OnboardingRepo, 'findById').mockResolvedValue({
      id: 'onb-hijack-1',
      gameCenterName: 'Attacker Center',
      managerFullName: 'Attacker',
      managerPhone: '+989129998877',
      provinceId: 'p1',
      cityId: 'c1',
      address: 'Tehran Street 1',
      step: OnboardingStep.PREVIEW,
    } as any);

    const userUpdateSpy = jest.fn();
    const gcCreateSpy = jest.fn();
    const txMock: any = {
      user: {
        findFirst: jest.fn(async () => ({ id: 'existing-staff-user', isActive: false, role: 'STAFF' })),
        update: userUpdateSpy,
        create: jest.fn(),
      },
      gamingCenter: { create: gcCreateSpy, update: jest.fn() },
    };

    jest.spyOn(OnboardingRepo, 'transaction').mockImplementation(async (fn: any) => fn(txMock));

    const res = await request(app)
      .post('/api/v1/onboarding/onb-hijack-1/complete')
      .set('x-onboarding-token', validToken)
      .send({ confirmation: true });

    expect(res.status).toBe(409);
    expect(userUpdateSpy).not.toHaveBeenCalled();
    expect(gcCreateSpy).not.toHaveBeenCalled();
  });
});
