import request from 'supertest';
import httpStatus from 'http-status';
import app from '../../app';
import { prisma } from '../../config/prisma';
import cuid from 'cuid';
import { GamingCenter, User, UserRole } from '@prisma/client';
import { createTestUser, createTestSalon, generateToken } from '../../common/utils/test-utils';

describe('Customer Routes', () => {
  let gamingCenter: GamingCenter;
  let manager: User;
  let receptionist: User;
  let staff: User;
  let managerToken: string;
  let receptionistToken: string;
  let staffToken: string;

  beforeAll(async () => {
    await prisma.$connect();
    gamingCenter = await createTestSalon();
    manager = await createTestUser({ gamingCenterId: gamingCenter.id, role: UserRole.MANAGER });
    receptionist = await createTestUser({ gamingCenterId: gamingCenter.id, role: UserRole.SUPERVISOR, phone: '09120000001' });
    staff = await createTestUser({ gamingCenterId: gamingCenter.id, role: UserRole.STAFF, phone: '09120000002' });

    managerToken = generateToken({ actorId: manager.id, actorType: 'USER' });
    receptionistToken = generateToken({ actorId: receptionist.id, actorType: 'USER' });
    staffToken = generateToken({ actorId: staff.id, actorType: 'USER' });
  });

  afterAll(async () => {
    await prisma.staffShift.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.gamingCenter.deleteMany({});
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.customerProfile.deleteMany({});
    await prisma.customerAccount.deleteMany({});
  });


  describe('POST /api/v1/gamingCenters/:gamingCenterId/customers', () => {
    it('should create a new customer and return 201', async () => {
      const newCustomer = {
        phone: '09121234567',
        fullName: 'Test Customer',
        displayName: 'Test',
      };

      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenter.id}/customers`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(newCustomer);

      expect(res.status).toBe(httpStatus.CREATED);
      expect(res.body.success).toBe(true);
      expect(res.body.data.displayName).toBe(newCustomer.displayName);
      expect(res.body.data.customerAccount.phone).toBe(newCustomer.phone);
    });

    it('should return 409 if customer phone already exists in the gamingCenter', async () => {
      const newCustomer = {
        phone: '09121234568',
        fullName: 'Existing Customer',
      };
      // Create customer once
      await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenter.id}/customers`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(newCustomer);

      // Try to create again
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenter.id}/customers`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(newCustomer);

      expect(res.status).toBe(httpStatus.CONFLICT);
    });

    it('should return 400 for invalid data', async () => {
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenter.id}/customers`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ fullName: 'Only Name' });

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
    });

    it('should return 403 if user is not a manager or receptionist', async () => {
      const newCustomer = {
        phone: '09121234569',
        fullName: 'Forbidden Customer',
      };
      const res = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenter.id}/customers`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send(newCustomer);

      expect(res.status).toBe(httpStatus.FORBIDDEN);
    });
  });

  describe('GET /api/v1/gamingCenters/:gamingCenterId/customers', () => {
    let customer1: any; // eslint-disable-line @typescript-eslint/no-explicit-any

    beforeEach(async () => {
      const res1 = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenter.id}/customers`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ phone: '09100000001', fullName: 'Alice' });
      customer1 = res1.body.data;

      await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenter.id}/customers`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ phone: '09100000002', fullName: 'Bob' });
    });

    it('should return a list of customers', async () => {
      const res = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenter.id}/customers`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customers).toHaveLength(2);
      expect(res.body.data.total).toBe(2);
    });

    it('should filter customers by search query', async () => {
      const res = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenter.id}/customers?search=Alice`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customers).toHaveLength(1);
      expect(res.body.data.customers[0].id).toBe(customer1.id);
    });
  });

  describe('GET /api/v1/gamingCenters/:gamingCenterId/customers/:customerId', () => {
    it('should get a customer by id', async () => {
      const newCustomer = {
        phone: '09121112233',
        fullName: 'Single Customer',
      };
      const creationRes = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenter.id}/customers`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(newCustomer);
      const customerId = creationRes.body.data.id;

      const res = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenter.id}/customers/${customerId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(customerId);
    });

    it('should return 404 for a non-existent customer', async () => {
      const nonExistentId = cuid();
      const res = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenter.id}/customers/${nonExistentId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(httpStatus.NOT_FOUND);
    });
  });

  describe('PATCH /api/v1/gamingCenters/:gamingCenterId/customers/:customerId', () => {
    it('should update a customer and return 200', async () => {
      const newCustomer = {
        phone: '09351112233',
        fullName: 'Update Me',
      };
      const creationRes = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenter.id}/customers`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(newCustomer);
      const customerId = creationRes.body.data.id;

      const updatePayload = {
        displayName: 'I\'m Updated',
        note: 'This is a note.'
      };

      const res = await request(app)
        .patch(`/api/v1/gamingCenters/${gamingCenter.id}/customers/${customerId}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send(updatePayload);

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.displayName).toBe(updatePayload.displayName);
      expect(res.body.data.note).toBe(updatePayload.note);
    });
  });

  describe('DELETE /api/v1/gamingCenters/:gamingCenterId/customers/:customerId', () => {
    it('should delete a customer and return 204', async () => {
      const newCustomer = {
        phone: '09361112233',
        fullName: 'Delete Me',
      };
      const creationRes = await request(app)
        .post(`/api/v1/gamingCenters/${gamingCenter.id}/customers`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(newCustomer);
      const customerId = creationRes.body.data.id;

      const res = await request(app)
        .delete(`/api/v1/gamingCenters/${gamingCenter.id}/customers/${customerId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(httpStatus.NO_CONTENT);

      // Verify it's gone
      const getRes = await request(app)
        .get(`/api/v1/gamingCenters/${gamingCenter.id}/customers/${customerId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(getRes.status).toBe(httpStatus.NOT_FOUND);
    });
  });

});
