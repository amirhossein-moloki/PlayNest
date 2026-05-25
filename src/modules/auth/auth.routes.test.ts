import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/prisma';
import argon2 from 'argon2';
import { UserRole } from '@prisma/client';

describe('Auth Routes', () => {
  afterEach(async () => {
    await prisma.reservation.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.customerAccount.deleteMany();
    await prisma.gameStation.deleteMany();
    await prisma.gamingCenter.deleteMany();
  });

  describe('POST /auth/login', () => {
    it('should login a user with valid credentials', async () => {
      const gamingCenter = await prisma.gamingCenter.create({ data: { name: 'Test GamingCenter', slug: 'test-gamingCenter' } });
      await prisma.user.create({
        data: {
          phone: '1234567890',
          passwordHash: await argon2.hash('password'),
          fullName: 'Test User',
          role: UserRole.MANAGER,
          gamingCenter: { connect: { id: gamingCenter.id } },
        },
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          phone: '1234567890',
          password: 'password',
          actorType: 'USER',
          gamingCenterId: gamingCenter.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens).toHaveProperty('accessToken');
    });

    it('should not login a user with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          phone: '1234567890',
          password: 'wrong-password',
          actorType: 'USER',
          gamingCenterId: '1',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/user/otp/request', () => {
    it('should request an OTP for an existing user', async () => {
      const gamingCenter = await prisma.gamingCenter.create({ data: { name: 'Test GamingCenter', slug: 'test-gamingCenter' } });
      await prisma.user.create({
        data: {
          phone: '1234567890',
          fullName: 'Test User',
          role: UserRole.MANAGER,
          gamingCenter: { connect: { id: gamingCenter.id } }
        },
      });

      const res = await request(app)
        .post('/api/v1/auth/user/otp/request')
        .send({ phone: '1234567890' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('OTP sent');
    });

    it('should return an error for a non-existing user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/user/otp/request')
        .send({ phone: '1234567890' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /auth/user/otp/verify', () => {
    it('should verify a valid OTP', async () => {
      const phone = '1234567890';
      const code = '123456';
      await prisma.phoneOtp.create({
        data: {
          phone,
          codeHash: await argon2.hash(code),
          purpose: 'LOGIN',
          expiresAt: new Date(Date.now() + 10000),
        },
      });

      const res = await request(app)
        .post('/api/v1/auth/user/otp/verify')
        .send({ phone, code });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return an error for an invalid OTP', async () => {
      const res = await request(app)
        .post('/api/v1/auth/user/otp/verify')
        .send({ phone: '1234567890', code: '123456' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/user/login/otp', () => {
    it('should login a user with a valid OTP', async () => {
      const phone = '1234567890';
      const gamingCenter = await prisma.gamingCenter.create({ data: { name: 'Test GamingCenter', slug: 'test-gamingCenter' } });
      await prisma.user.create({
        data: {
          phone,
          fullName: 'Test User',
          role: UserRole.MANAGER,
          gamingCenter: { connect: { id: gamingCenter.id } }
        }
      });
      await prisma.phoneOtp.create({
        data: {
          phone,
          codeHash: await argon2.hash('123456'),
          purpose: 'LOGIN',
          expiresAt: new Date(Date.now() + 10000),
          consumedAt: new Date(),
        },
      });

      const res = await request(app)
        .post('/api/v1/auth/user/login/otp')
        .send({ phone, gamingCenterId: gamingCenter.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens).toHaveProperty('accessToken');
    });

    it('should not login a user with an unverified OTP', async () => {
      const phone = '1234567890';
      const gamingCenter = await prisma.gamingCenter.create({ data: { name: 'Test GamingCenter', slug: 'test-gamingCenter' } });
      await prisma.user.create({
        data: {
          phone,
          fullName: 'Test User',
          role: UserRole.MANAGER,
          gamingCenter: { connect: { id: gamingCenter.id } }
        }
      });

      const res = await request(app)
        .post('/api/v1/auth/user/login/otp')
        .send({ phone, gamingCenterId: gamingCenter.id });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh the access token', async () => {
      await prisma.customerAccount.create({ data: { phone: '1234567890' } });
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ phone: '1234567890', actorType: 'CUSTOMER' });

      const { refreshToken } = loginRes.body.data.tokens;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
    });
  });

  describe('GET /auth/me', () => {
    it('should return the current user', async () => {
      await prisma.customerAccount.create({ data: { phone: '1234567890' } });
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ phone: '1234567890', actorType: 'CUSTOMER' });

      const { accessToken } = loginRes.body.data.tokens;

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.phone).toBe('1234567890');
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout the user', async () => {
      await prisma.customerAccount.create({ data: { phone: '1234567890' } });
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ phone: '1234567890', actorType: 'CUSTOMER' });

      const { accessToken } = loginRes.body.data.tokens;

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
