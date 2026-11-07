/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { generateAccessToken } from '../../../src/modules/auth/auth.tokens';
import { AdminStationBridge } from '../../../src/platform-admin/services/admin-station-bridge';
import { gamingCenterStation } from '../../../src/modules/gamingCenter/gamingCenter.station';

jest.mock('../../../src/config/redis', () => ({
  get: jest.fn().mockImplementation(() => Promise.resolve(null)),
  set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
  del: jest.fn().mockImplementation(() => Promise.resolve(1)),
}));

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    platformAdmin: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    platformSetting: {
      findUnique: jest.fn(),
    },
    gamingCenter: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    reservation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    session: {
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    auditLog: {
      create: jest.fn(),
    },
    $extends: jest.fn().mockReturnThis(),
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../src/platform-admin/services/admin-station-bridge', () => ({
  AdminStationBridge: {
    cancelReservation: jest.fn(),
    confirmReservation: jest.fn(),
    startReservation: jest.fn(),
    completeReservation: jest.fn(),
    markNoShow: jest.fn(),
  },
}));

jest.mock('../../../src/modules/gamingCenter/gamingCenter.station', () => ({
  gamingCenterStation: {
    createGamingCenter: jest.fn(),
  },
}));

describe('Platform Super Admin Phase 2 Operations API Tests', () => {
  const platformAdminToken = generateAccessToken({
    sessionId: 'sess_admin_ops',
    actorId: 'pa_super_ops',
    actorType: 'PLATFORM_ADMIN',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_super_ops',
      fullName: 'Super Administrator',
      isActive: true,
      isSuperuser: true,
    });
    ((prisma as any).platformSetting.findUnique as jest.Mock).mockResolvedValue({
      id: 'default',
      maintenanceMode: false,
    });
  });

  describe('Gaming Center Operations', () => {
    it('POST /platform-admin/gaming-centers should create a new gaming center via gamingCenterStation', async () => {
      (gamingCenterStation.createGamingCenter as jest.Mock).mockResolvedValue({
        id: 'gc_new_1',
        name: 'Nexus Gaming Arena',
        slug: 'nexus-gaming-arena',
        isActive: true,
      });

      const res = await request(app)
        .post('/api/v1/platform-admin/gaming-centers')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          name: 'Nexus Gaming Arena',
          slug: 'nexus-gaming-arena',
          ownerId: 'user_owner_1',
          description: 'Top-tier gaming arena with 50 stations',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe('gc_new_1');
      expect(gamingCenterStation.createGamingCenter).toHaveBeenCalled();
    });

    it('PATCH /platform-admin/gaming-centers/:id/status should update center active state', async () => {
      ((prisma as any).gamingCenter.findUnique as jest.Mock).mockResolvedValue({
        id: 'gc_target',
        name: 'Target Arena',
        isActive: true,
      });
      ((prisma as any).gamingCenter.update as jest.Mock).mockResolvedValue({
        id: 'gc_target',
        name: 'Target Arena',
        isActive: false,
      });

      const res = await request(app)
        .patch('/api/v1/platform-admin/gaming-centers/gc_target/status')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          isActive: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });
  });

  describe('Manager & User Operational Management', () => {
    it('POST /platform-admin/users/:id/revoke-sessions should revoke all active user sessions', async () => {
      ((prisma as any).user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user_active_sess',
        gamingCenterId: 'gc_target_1',
        fullName: 'Active User',
      });
      // Session revocation in PlatformAdminStation
      const res = await request(app)
        .post('/api/v1/platform-admin/users/user_active_sess/revoke-sessions')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('Revoked');
    });

    it('PATCH /platform-admin/users/:id/status should suspend/activate a user account', async () => {
      ((prisma as any).user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user_suspend',
        gamingCenterId: 'gc_target_1',
        fullName: 'Suspended Manager',
        isActive: true,
      });
      ((prisma as any).user.update as jest.Mock).mockResolvedValue({
        id: 'user_suspend',
        gamingCenterId: 'gc_target_1',
        fullName: 'Suspended Manager',
        isActive: false,
      });

      const res = await request(app)
        .patch('/api/v1/platform-admin/users/user_suspend/status')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          isActive: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('POST /platform-admin/users/:id/reset-password should reset user password and revoke sessions', async () => {
      ((prisma as any).user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user_pw_reset',
        gamingCenterId: 'gc_target_1',
        fullName: 'User Pw Reset',
      });
      ((prisma as any).user.update as jest.Mock).mockResolvedValue({
        id: 'user_pw_reset',
      });

      const res = await request(app)
        .post('/api/v1/platform-admin/users/user_pw_reset/reset-password')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          newPassword: 'BrandNewSecurePassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('Password reset successfully');
    });
  });

  describe('Reservation Operational Transitions', () => {
    beforeEach(() => {
      ((prisma as any).reservation.findUnique as jest.Mock).mockResolvedValue({
        id: 'res_ops_1',
        gamingCenterId: 'gc_arena_1',
        status: 'PENDING',
      });
    });

    it('POST /platform-admin/reservations/:id/cancel should safely cancel reservation via bridge', async () => {
      (AdminStationBridge.cancelReservation as jest.Mock).mockResolvedValue({
        id: 'res_ops_1',
        status: 'CANCELED',
      });

      const res = await request(app)
        .post('/api/v1/platform-admin/reservations/res_ops_1/cancel')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          reason: 'Customer requested emergency reschedule',
        });

      expect(res.status).toBe(200);
      expect(AdminStationBridge.cancelReservation).toHaveBeenCalledWith(
        'gc_arena_1',
        'res_ops_1',
        'Customer requested emergency reschedule',
        expect.objectContaining({ platformAdminId: 'pa_super_ops' })
      );
    });

    it('POST /platform-admin/reservations/:id/confirm should confirm reservation via bridge', async () => {
      (AdminStationBridge.confirmReservation as jest.Mock).mockResolvedValue({
        id: 'res_ops_1',
        status: 'CONFIRMED',
      });

      const res = await request(app)
        .post('/api/v1/platform-admin/reservations/res_ops_1/confirm')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect(AdminStationBridge.confirmReservation).toHaveBeenCalledWith(
        'gc_arena_1',
        'res_ops_1',
        expect.objectContaining({ platformAdminId: 'pa_super_ops' })
      );
    });

    it('POST /platform-admin/reservations/:id/start should start in-progress session via bridge', async () => {
      (AdminStationBridge.startReservation as jest.Mock).mockResolvedValue({
        id: 'res_ops_1',
        status: 'IN_PROGRESS',
      });

      const res = await request(app)
        .post('/api/v1/platform-admin/reservations/res_ops_1/start')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect(AdminStationBridge.startReservation).toHaveBeenCalledWith(
        'gc_arena_1',
        'res_ops_1',
        expect.objectContaining({ platformAdminId: 'pa_super_ops' })
      );
    });

    it('POST /platform-admin/reservations/:id/complete should mark reservation completed via bridge', async () => {
      (AdminStationBridge.completeReservation as jest.Mock).mockResolvedValue({
        id: 'res_ops_1',
        status: 'COMPLETED',
      });

      const res = await request(app)
        .post('/api/v1/platform-admin/reservations/res_ops_1/complete')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect(AdminStationBridge.completeReservation).toHaveBeenCalledWith(
        'gc_arena_1',
        'res_ops_1',
        expect.objectContaining({ platformAdminId: 'pa_super_ops' })
      );
    });

    it('POST /platform-admin/reservations/:id/no-show should mark reservation as no-show via bridge', async () => {
      (AdminStationBridge.markNoShow as jest.Mock).mockResolvedValue({
        id: 'res_ops_1',
        status: 'NO_SHOW',
      });

      const res = await request(app)
        .post('/api/v1/platform-admin/reservations/res_ops_1/no-show')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect(AdminStationBridge.markNoShow).toHaveBeenCalledWith(
        'gc_arena_1',
        'res_ops_1',
        expect.objectContaining({ platformAdminId: 'pa_super_ops' })
      );
    });
  });
});
