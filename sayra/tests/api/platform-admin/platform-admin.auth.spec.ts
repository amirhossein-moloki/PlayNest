/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest';
import app from '../../../src/app';
import { AuthRepository } from '../../../src/modules/auth/auth.repository';
import argon2 from 'argon2';

jest.mock('../../../src/config/redis', () => ({
  get: jest.fn().mockImplementation(() => Promise.resolve(null)),
  set: jest.fn().mockImplementation(() => Promise.resolve('OK')),
  del: jest.fn().mockImplementation(() => Promise.resolve(1)),
}));

jest.mock('../../../src/modules/auth/auth.repository', () => ({
  AuthRepository: {
    findPlatformAdminByPhone: jest.fn(),
    findPlatformAdminById: jest.fn(),
    updatePlatformAdminLastLogin: jest.fn(),
    createSession: jest.fn(),
    findSessionByToken: jest.fn(),
    findSessionById: jest.fn(),
    revokeSession: jest.fn(),
    findUserByPhone: jest.fn(),
  },
}));

jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));

const MockedAuthRepo = AuthRepository as jest.Mocked<typeof AuthRepository>;
const MockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

describe('PLATFORM_ADMIN Authentication API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const phone = '09129998877';
  const password = 'SuperSecretPassword123!';

  it('should login PLATFORM_ADMIN successfully without gamingCenterId', async () => {
    MockedAuthRepo.findPlatformAdminByPhone.mockResolvedValue({
      id: 'pa_123',
      fullName: 'Global Superuser',
      phone,
      email: 'admin@playenest.com',
      passwordHash: 'hashed_pw',
      isActive: true,
      isSuperuser: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
    } as any);
    MockedArgon2.verify.mockResolvedValue(true as any);
    MockedAuthRepo.createSession.mockResolvedValue({ id: 's_platform_1' } as any);

    const res = await request(app)
      .post('/api/v1/auth/platform-admin/login')
      .send({ phone, password });

    expect(res.status).toBe(200);
    expect(res.body.data.tokens).toBeDefined();
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();
    expect(res.body.data.admin.id).toBe('pa_123');
    expect(res.body.data.admin.passwordHash).toBeUndefined();
  });

  it('should reject login if credentials are invalid', async () => {
    MockedAuthRepo.findPlatformAdminByPhone.mockResolvedValue({
      id: 'pa_123',
      fullName: 'Global Superuser',
      phone,
      email: 'admin@playenest.com',
      passwordHash: 'hashed_pw',
      isActive: true,
      isSuperuser: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
    } as any);
    MockedArgon2.verify.mockResolvedValue(false as any);

    const res = await request(app)
      .post('/api/v1/auth/platform-admin/login')
      .send({ phone, password: 'wrong_password' });

    expect(res.status).toBe(401);
  });

  it('should reject login if platform admin account is deactivated', async () => {
    MockedAuthRepo.findPlatformAdminByPhone.mockResolvedValue({
      id: 'pa_123',
      fullName: 'Deactivated Admin',
      phone,
      email: 'admin@playenest.com',
      passwordHash: 'hashed_pw',
      isActive: false,
      isSuperuser: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
    } as any);

    const res = await request(app)
      .post('/api/v1/auth/platform-admin/login')
      .send({ phone, password });

    expect(res.status).toBe(401);
  });

  it('should reject tenant users attempting to authenticate via platform-admin login', async () => {
    MockedAuthRepo.findPlatformAdminByPhone.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/platform-admin/login')
      .send({ phone, password });

    expect(res.status).toBe(401);
  });
});
