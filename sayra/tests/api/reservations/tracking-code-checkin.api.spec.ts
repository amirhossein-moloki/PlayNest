import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';
import { ReservationRepo } from '../../../src/modules/reservation/reservation.repo';
import { ReservationStatus, ReservationPaymentState, SessionActorType, UserRole } from '@prisma/client';
import { env } from '../../../src/config/env';

jest.mock('../../../src/modules/reservation/reservation.repo');
jest.mock('../../../src/modules/audit/audit.station');
jest.mock('../../../src/modules/gamingSessions/gamingSessions.station');
jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    gamingCenter: { findUnique: jest.fn() },
    customerAccount: { findUnique: jest.fn() },
    session: { findUnique: jest.fn() },
  },
}));

const MockedReservationRepo = ReservationRepo as jest.Mocked<typeof ReservationRepo>;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Tracking Code & Check-In API Endpoints', () => {
  const gamingCenterId = 'gc-100';
  const staffId = 'staff-100';
  const managerId = 'mgr-100';
  const reservationId = 'res-100';
  const trackingCode = 'K7M9P2R4';

  const staffToken = generateAccessToken({ sessionId: 'sess-staff', actorId: staffId, actorType: SessionActorType.USER });
  const managerToken = generateAccessToken({ sessionId: 'sess-mgr', actorId: managerId, actorType: SessionActorType.USER });

  const mockBaseReservation = {
    id: reservationId,
    gamingCenterId,
    trackingCode,
    status: ReservationStatus.CONFIRMED,
    paymentState: ReservationPaymentState.PAID,
    startTime: new Date('2026-12-15T14:00:00Z'),
    endTime: new Date('2026-12-15T16:00:00Z'),
    checkedInAt: null,
    station: {
      id: 'st-1',
      name: 'PC-VIP-01',
      stationType: 'PC',
    },
    customerAccount: {
      id: 'cust-1',
      fullName: 'Ali Rezaei',
    },
    customerProfile: {
      id: 'prof-1',
      displayName: 'Ali Rezaei',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as any).mockImplementation(async ({ where }: any) => {
      if (where.id === staffId) {
        return { id: staffId, gamingCenterId, role: UserRole.STAFF, isActive: true };
      }
      if (where.id === managerId) {
        return { id: managerId, gamingCenterId, role: UserRole.MANAGER, isActive: true };
      }
      return null;
    });
    MockedReservationRepo.transaction.mockImplementation(async (fn) => fn({} as any));
  });

  describe('POST /gamingCenters/:gamingCenterId/reservation/lookup', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/reservation/lookup`)
        .set('x-api-key', env.STATIC_API_KEY)
        .send({ trackingCode });

      expect(res.status).toBe(401);
    });

    it('should lookup reservation successfully for authenticated staff', async () => {
      MockedReservationRepo.findReservationByTrackingCode.mockResolvedValue(mockBaseReservation as any);
      MockedReservationRepo.findGamingCenterWithSettings.mockResolvedValue({
        id: gamingCenterId,
        settings: { timeZone: 'Asia/Tehran' },
      } as any);

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/reservation/lookup`)
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ trackingCode: 'k7m9-p2r4' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        id: reservationId,
        trackingCode,
        status: ReservationStatus.CONFIRMED,
        isEligibleForCheckIn: true,
        station: {
          id: 'st-1',
          name: 'PC-VIP-01',
        },
        customer: {
          displayName: 'Ali Rezaei',
        },
      });
    });

    it('should return 404 when tracking code is not found or belongs to another site', async () => {
      MockedReservationRepo.findReservationByTrackingCode.mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/reservation/lookup`)
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ trackingCode: 'UNKNOWN9' });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Reservation not found for this tracking code.');
    });
  });

  describe('POST /gamingCenters/:gamingCenterId/reservation/check-in', () => {
    it('should allow MANAGER/SUPERVISOR to perform check-in successfully', async () => {
      MockedReservationRepo.findReservationByTrackingCode.mockResolvedValue(mockBaseReservation as any);
      MockedReservationRepo.updateReservation.mockResolvedValue({
        ...mockBaseReservation,
        status: ReservationStatus.IN_PROGRESS,
        checkedInAt: new Date('2026-12-15T14:00:00Z'),
        checkedInByUserId: managerId,
      } as any);

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/reservation/check-in`)
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ trackingCode });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(ReservationStatus.IN_PROGRESS);
    });

    it('should return 409 Conflict when attempting to check in a CANCELED reservation', async () => {
      const canceledRes = { ...mockBaseReservation, status: ReservationStatus.CANCELED };
      MockedReservationRepo.findReservationByTrackingCode.mockResolvedValue(canceledRes as any);

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenterId}/reservation/check-in`)
        .set('x-api-key', env.STATIC_API_KEY)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ trackingCode });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CHECKIN_INELIGIBLE');
    });
  });
});
