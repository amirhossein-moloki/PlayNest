/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { SessionActorType } from '@prisma/client';
import { closuresStation } from '../../../../src/modules/closures/closures.station';
import { ClosuresRepo } from '../../../../src/modules/closures/closures.repo';
import { auditService } from '../../../../src/modules/audit/audit.station';
import { prisma } from '../../../../src/config/prisma';
import AppError from '../../../../src/common/errors/AppError';

jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    gamingCenter: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));
jest.mock('../../../../src/modules/closures/closures.repo');
jest.mock('../../../../src/modules/audit/audit.station');

const MockedClosuresRepo = ClosuresRepo as jest.Mocked<typeof ClosuresRepo>;
const MockedAuditService = auditService as jest.Mocked<typeof auditService>;

describe('ClosuresStation - Temporary Booking Closures', () => {
  const gamingCenterId = 'gc-sat-1';
  const gamingCenterSlug = 'saturday-arena';
  const actor = { id: 'mgr-1', actorType: SessionActorType.USER };
  const context = { ip: '127.0.0.1', userAgent: 'jest' };

  beforeEach(() => {
    jest.clearAllMocks();
    MockedClosuresRepo.transaction.mockImplementation(async (fn: any) => fn({}));
    MockedAuditService.log.mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('closeForNextHours', () => {
    it('closes reservations from Saturday 10:00 local (06:30 UTC) for next 9 hours until 19:00 local (15:30 UTC)', async () => {
      jest.useFakeTimers();
      // Saturday 2026-11-14 10:00:00 Asia/Tehran (+03:30) == 06:30:00Z
      const saturday10Tehran = new Date('2026-11-14T06:30:00.000Z');
      jest.setSystemTime(saturday10Tehran);

      (prisma.gamingCenter.findUnique as any).mockResolvedValue({ id: gamingCenterId });
      MockedClosuresRepo.countOverlappingReservations.mockResolvedValue(2);

      const expectedEnd = new Date('2026-11-14T15:30:00.000Z');
      const createdClosure = {
        id: 'closure-9h',
        gamingCenterId,
        title: 'Temporary booking closure',
        reason: 'Private event',
        startDate: saturday10Tehran,
        endDate: expectedEnd,
      };
      MockedClosuresRepo.createClosure.mockResolvedValue(createdClosure as any);

      const result = await closuresStation.closeForNextHours(
        gamingCenterId,
        { hours: 9, reason: 'Private event' },
        actor,
        context
      );

      expect(MockedClosuresRepo.endActiveClosures).not.toHaveBeenCalled();
      expect(MockedClosuresRepo.createClosure).toHaveBeenCalledWith(
        gamingCenterId,
        {
          title: 'Temporary booking closure',
          reason: 'Private event',
          startDate: saturday10Tehran,
          endDate: expectedEnd,
        },
        expect.anything()
      );
      expect(MockedClosuresRepo.countOverlappingReservations).toHaveBeenCalledWith(
        gamingCenterId,
        saturday10Tehran,
        expectedEnd,
        expect.anything()
      );
      expect(result.durationHours).toBe(9);
      expect(result.durationMinutes).toBe(540);
      expect(result.affectedReservationsCount).toBe(2);
      expect(result.replacedActiveClosuresCount).toBe(0);
      expect(MockedAuditService.log).toHaveBeenCalledWith(
        gamingCenterId,
        actor,
        'CLOSURE_TEMPORARY_CREATE',
        { name: 'GamingCenterClosure', id: 'closure-9h' },
        { old: null, new: createdClosure },
        context
      );
    });

    it('ends active closures before creating new closure when replaceActive=true', async () => {
      jest.useFakeTimers();
      const now = new Date('2026-11-14T06:30:00.000Z');
      jest.setSystemTime(now);

      (prisma.gamingCenter.findUnique as any).mockResolvedValue({ id: gamingCenterId });
      const oldClosures = [{ id: 'old-c1', startDate: new Date('2026-11-14T05:00:00.000Z'), endDate: new Date('2026-11-14T08:00:00.000Z') }];
      MockedClosuresRepo.endActiveClosures.mockResolvedValue(oldClosures as any);
      MockedClosuresRepo.countOverlappingReservations.mockResolvedValue(0);
      MockedClosuresRepo.createClosure.mockResolvedValue({
        id: 'closure-new',
        gamingCenterId,
        title: 'Custom title',
        reason: 'Extended closure',
        startDate: now,
        endDate: new Date('2026-11-14T10:30:00.000Z'),
      } as any);

      const result = await closuresStation.closeForNextHours(
        gamingCenterId,
        { hours: 4, title: '  Custom title  ', reason: 'Extended closure', replaceActive: true },
        actor,
        context
      );

      expect(MockedClosuresRepo.endActiveClosures).toHaveBeenCalledWith(gamingCenterId, now, expect.anything());
      expect(result.replacedActiveClosuresCount).toBe(1);
      expect(MockedAuditService.log).toHaveBeenCalledWith(
        gamingCenterId,
        actor,
        'CLOSURE_TEMPORARY_CREATE',
        { name: 'GamingCenterClosure', id: 'closure-new' },
        { old: oldClosures, new: expect.objectContaining({ id: 'closure-new' }) },
        context
      );
    });

    it('throws 404 when gaming center does not exist', async () => {
      (prisma.gamingCenter.findUnique as any).mockResolvedValue(null);

      await expect(
        closuresStation.closeForNextHours('missing-gc', { hours: 3 }, actor, context)
      ).rejects.toThrow(new AppError('Gaming center not found', 404));
    });
  });

  describe('createClosure', () => {
    it('supports explicit startDate and endDate mode', async () => {
      (prisma.gamingCenter.findUnique as any).mockResolvedValue({ id: gamingCenterId });
      MockedClosuresRepo.countOverlappingReservations.mockResolvedValue(1);

      const startIso = '2026-11-15T06:30:00.000Z';
      const endIso = '2026-11-15T12:30:00.000Z';
      MockedClosuresRepo.createClosure.mockResolvedValue({
        id: 'c-explicit',
        gamingCenterId,
        title: 'Renovation',
        reason: 'Floor polish',
        startDate: new Date(startIso),
        endDate: new Date(endIso),
      } as any);

      const result = await closuresStation.createClosure(
        gamingCenterId,
        {
          title: 'Renovation',
          reason: 'Floor polish',
          startDate: startIso,
          endDate: endIso,
        },
        actor,
        context
      );

      expect(result.durationHours).toBe(6);
      expect(result.durationMinutes).toBe(360);
      expect(result.affectedReservationsCount).toBe(1);
    });

    it('supports duration-based creation with hours on POST /closures', async () => {
      jest.useFakeTimers();
      const now = new Date('2026-11-14T06:30:00.000Z');
      jest.setSystemTime(now);

      (prisma.gamingCenter.findUnique as any).mockResolvedValue({ id: gamingCenterId });
      MockedClosuresRepo.countOverlappingReservations.mockResolvedValue(0);
      MockedClosuresRepo.createClosure.mockResolvedValue({
        id: 'c-dur',
        gamingCenterId,
        title: 'Temporary booking closure',
        startDate: now,
        endDate: new Date('2026-11-14T09:30:00.000Z'),
      } as any);

      const result = await closuresStation.createClosure(
        gamingCenterId,
        { hours: 3 },
        actor,
        context
      );

      expect(result.durationHours).toBe(3);
      expect(result.durationMinutes).toBe(180);
      expect(MockedClosuresRepo.createClosure).toHaveBeenCalledWith(gamingCenterId, {
        title: 'Temporary booking closure',
        reason: undefined,
        startDate: now,
        endDate: new Date('2026-11-14T09:30:00.000Z'),
      });
    });
  });

  describe('getActiveClosureStatus & getPublicActiveClosureStatus', () => {
    it('returns active closure details with remainingMinutes for furthest-ending closure', async () => {
      const now = new Date('2026-11-14T06:30:00.000Z');
      const closedUntil = new Date('2026-11-14T08:00:30.000Z'); // 90.5 minutes -> ceil = 91
      const c1 = { id: 'c-1', startDate: new Date('2026-11-14T06:00:00.000Z'), endDate: closedUntil };
      const c2 = { id: 'c-2', startDate: new Date('2026-11-14T06:00:00.000Z'), endDate: new Date('2026-11-14T07:00:00.000Z') };

      (prisma.gamingCenter.findUnique as any).mockResolvedValue({ id: gamingCenterId });
      MockedClosuresRepo.findActiveClosures.mockResolvedValue([c1, c2] as any);

      const status = await closuresStation.getActiveClosureStatus(gamingCenterId, now);

      expect(status.isClosed).toBe(true);
      expect(status.closedUntil).toBe(closedUntil.toISOString());
      expect(status.remainingMinutes).toBe(91);
      expect(status.primaryClosure).toEqual(c1);
      expect(status.activeClosures).toHaveLength(2);
    });

    it('returns isClosed=false when no active closures exist and supports slug lookup', async () => {
      const now = new Date('2026-11-14T06:30:00.000Z');
      (prisma.gamingCenter.findFirst as any).mockResolvedValue({ id: gamingCenterId, slug: gamingCenterSlug });
      (prisma.gamingCenter.findUnique as any).mockResolvedValue({ id: gamingCenterId });
      MockedClosuresRepo.findActiveClosures.mockResolvedValue([]);

      const status = await closuresStation.getPublicActiveClosureStatus(gamingCenterSlug, now);

      expect(status.isClosed).toBe(false);
      expect(status.closedUntil).toBeNull();
      expect(status.remainingMinutes).toBe(0);
      expect(status.primaryClosure).toBeNull();
      expect(status.activeClosures).toEqual([]);
    });
  });

  describe('reopenBookings', () => {
    it('ends active closures immediately and writes audit log when closures exist', async () => {
      jest.useFakeTimers();
      const now = new Date('2026-11-14T08:00:00.000Z');
      jest.setSystemTime(now);

      (prisma.gamingCenter.findUnique as any).mockResolvedValue({ id: gamingCenterId });
      MockedClosuresRepo.endActiveClosures.mockResolvedValue([
        { id: 'c-active-1' },
        { id: 'c-active-2' },
      ] as any);

      const res = await closuresStation.reopenBookings(gamingCenterId, actor, context);

      expect(res).toEqual({
        reopened: true,
        reopenedCount: 2,
        reopenedAt: now.toISOString(),
        endedClosureIds: ['c-active-1', 'c-active-2'],
      });
      expect(MockedAuditService.log).toHaveBeenCalledWith(
        gamingCenterId,
        actor,
        'CLOSURE_REOPEN',
        { name: 'GamingCenterClosure', id: 'c-active-1' },
        { old: expect.any(Array), new: { reopenedAt: now, endedClosureIds: ['c-active-1', 'c-active-2'] } },
        context
      );
    });

    it('returns reopened=false and skips audit log when no active closures exist', async () => {
      jest.useFakeTimers();
      const now = new Date('2026-11-14T08:00:00.000Z');
      jest.setSystemTime(now);

      (prisma.gamingCenter.findUnique as any).mockResolvedValue({ id: gamingCenterId });
      MockedClosuresRepo.endActiveClosures.mockResolvedValue([]);

      const res = await closuresStation.reopenBookings(gamingCenterId, actor, context);

      expect(res).toEqual({
        reopened: false,
        reopenedCount: 0,
        reopenedAt: now.toISOString(),
        endedClosureIds: [],
      });
      expect(MockedAuditService.log).not.toHaveBeenCalled();
    });
  });
});
