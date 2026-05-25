
import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/prisma';
import {
  createTestSalon,
  createTestUser,
  createTestBooking,
  createTestService,
  generateToken,
} from '../../common/utils/test-utils';
import { ReservationStatus, UserRole } from '@prisma/client';

describe('Audit Logging E2E', () => {
  let gamingCenter: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let manager: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let managerToken: string;
  let staff: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let staffToken: string;

  beforeAll(async () => {
    gamingCenter = await createTestSalon({ name: 'Audit GamingCenter', slug: 'audit-gamingCenter' });
    manager = await createTestUser({ gamingCenterId: gamingCenter.id, role: UserRole.MANAGER });
    managerToken = generateToken({ actorId: manager.id, actorType: 'USER', sessionId: 'test-session-id' });

    staff = await createTestUser({ gamingCenterId: gamingCenter.id, role: UserRole.STAFF });
    staffToken = generateToken({ actorId: staff.id, actorType: 'USER', sessionId: 'test-session-id' });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { gamingCenterId: gamingCenter.id } });
    await prisma.reservation.deleteMany({ where: { gamingCenterId: gamingCenter.id } });
    await prisma.user.deleteMany({ where: { gamingCenterId: gamingCenter.id } });
    await prisma.gamingCenter.delete({ where: { id: gamingCenter.id } });
  });

  it('should generate an audit log when a reservation is canceled', async () => {
    const station = await createTestService({ gamingCenterId: gamingCenter.id });
    const reservation = await createTestBooking({
      gamingCenterId: gamingCenter.id,
      stationId: station.id,
      staffId: staff.id,
    });

    // Cancel the reservation
    const response = await request(app)
      .post(`/api/v1/gamingCenters/${gamingCenter.id}/reservations/${reservation.id}/cancel`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Client requested' });

    expect(response.status).toBe(200);

    // Verify audit log exists
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        gamingCenterId: gamingCenter.id,
        action: 'BOOKING_CANCEL',
        entityId: reservation.id,
      },
    });

    expect(auditLog).toBeDefined();
    expect(auditLog?.actorId).toBe(manager.id);
    expect((auditLog?.newData as any).status).toBe(ReservationStatus.CANCELED); // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  it('should allow manager to retrieve audit logs', async () => {
    const response = await request(app)
      .get(`/api/v1/gamingCenters/${gamingCenter.id}/audit-logs`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0].action).toBe('BOOKING_CANCEL');
  });

  it('should deny staff from retrieving audit logs', async () => {
    const response = await request(app)
      .get(`/api/v1/gamingCenters/${gamingCenter.id}/audit-logs`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(response.status).toBe(403);
  });

  it('should generate an audit log when a user is updated', async () => {
    const response = await request(app)
      .patch(`/api/v1/gamingCenters/${gamingCenter.id}/staff/${staff.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ fullName: 'Updated Staff Name' });

    expect(response.status).toBe(200);

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        gamingCenterId: gamingCenter.id,
        action: 'USER_UPDATE',
        entityId: staff.id,
      },
    });

    expect(auditLog).toBeDefined();
    expect((auditLog?.newData as any).fullName).toBe('Updated Staff Name'); // eslint-disable-line @typescript-eslint/no-explicit-any
  });
});
