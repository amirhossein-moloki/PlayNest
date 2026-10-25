/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { UserRole, SessionActorType } from '@prisma/client';
import routes from '../../../src/routes';
import { CalendarStation } from '../../../src/modules/calendar/calendar.station';
import { errorHandler } from '../../../src/common/errors/errorHandler';
import { responseMiddleware } from '../../../src/common/middleware/response';

jest.mock('../../../src/modules/calendar/calendar.station');
jest.mock('../../../src/common/middleware/auth', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    const roleHeader = req.headers['x-test-role'] as string;
    const role = roleHeader ? (roleHeader as UserRole) : UserRole.MANAGER;
    (req as any).actor = {
      id: 'clx0000000000000000000001',
      actorType: SessionActorType.USER,
      role,
      gamingCenterId: req.params.gamingCenterId || 'clx0000000000000000000000',
    };
    next();
  },
}));

jest.mock('../../../src/common/middleware/tenantGuard', () => ({
  tenantGuard: (req: Request, _res: Response, next: NextFunction) => {
    (req as any).tenant = { gamingCenterId: req.params.gamingCenterId || 'clx0000000000000000000000' };
    next();
  },
}));

const MockedCalendarStation = CalendarStation as jest.Mocked<typeof CalendarStation>;

const app = express();
app.use(express.json());
app.use(responseMiddleware);
app.use('/api/v1', routes);
app.use(errorHandler);

describe('Admin Calendar API Integration Tests', () => {
  const gamingCenterId = 'clx0000000000000000000000';

  const mockCalendarResponse = {
    site: {
      id: gamingCenterId,
      name: 'Test Center',
      slug: 'test-center',
      timeZone: 'Asia/Tehran',
    },
    range: {
      dateFrom: '2026-12-01',
      dateTo: '2026-12-05',
      rangeStartUtc: '2026-11-30T20:30:00.000Z',
      rangeEndUtc: '2026-12-05T20:29:59.999Z',
      rangeStartLocal: '2026-12-01T00:00:00.000+03:30',
      rangeEndLocal: '2026-12-05T23:59:59.999+03:30',
    },
    workstations: [
      { id: 'st-1', name: 'PC-1', stationType: 'PC', isVip: true, hourlyPrice: 100, isActive: true },
    ],
    maintenances: [],
    reservations: {
      data: [
        {
          id: 'res-1',
          gamingCenterId,
          stationId: 'st-1',
          stationName: 'PC-1',
          stationType: 'PC',
          isVipStation: true,
          customerAccountId: 'cust-1',
          customerName: 'Ali Reza',
          customerPhone: '+989123456789',
          staffId: 'staff-1',
          staffName: 'Staff One',
          status: 'CONFIRMED',
          paymentState: 'PAID',
          totalHours: 2,
          totalPrice: 200,
          discountAmount: 0,
          groupBookingId: null,
          startTimeUtc: '2026-12-01T10:00:00.000Z',
          endTimeUtc: '2026-12-01T12:00:00.000Z',
          startTimeLocal: '2026-12-01T13:30:00.000+03:30',
          endTimeLocal: '2026-12-01T15:30:00.000+03:30',
          note: 'Test note',
          createdAt: '2026-11-30T10:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /gamingCenters/:gamingCenterId/admin/calendar', () => {
    it('should return calendar operational data for MANAGER role', async () => {
      MockedCalendarStation.getAdminCalendar.mockResolvedValue(mockCalendarResponse as any);

      const res = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenterId}/admin/calendar`)
        .set('x-test-role', 'MANAGER')
        .query({
          dateFrom: '2026-12-01',
          dateTo: '2026-12-05',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.site.timeZone).toBe('Asia/Tehran');
      expect(res.body.data.reservations.data).toHaveLength(1);
    });

    it('should allow STAFF role to query calendar data', async () => {
      MockedCalendarStation.getAdminCalendar.mockResolvedValue(mockCalendarResponse as any);

      const res = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenterId}/calendar`)
        .set('x-test-role', 'STAFF')
        .query({
          dateFrom: '2026-12-01',
          dateTo: '2026-12-05',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.site.name).toBe('Test Center');
    });

    it('should reject missing date query parameters (400 Bad Request)', async () => {
      const res = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenterId}/admin/calendar`)
        .set('x-test-role', 'MANAGER');

      expect(res.status).toBe(400);
    });

    it('should reject date ranges exceeding 31 days', async () => {
      const res = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenterId}/admin/calendar`)
        .set('x-test-role', 'MANAGER')
        .query({
          dateFrom: '2026-01-01',
          dateTo: '2026-03-01',
        });

      expect(res.status).toBe(400);
    });
  });
});
