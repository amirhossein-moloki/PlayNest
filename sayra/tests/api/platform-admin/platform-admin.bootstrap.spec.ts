import { bootstrapPlatformAdmin } from '../../../scripts/bootstrap-platform-admin';
import { prisma } from '../../../src/config/prisma';
import argon2 from 'argon2';

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    platformAdmin: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    gamingCenter: {
      count: jest.fn(),
    },
  },
}));

jest.mock('argon2', () => ({
  hash: jest.fn(),
}));

describe('PLATFORM_ADMIN Bootstrap CLI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create PLATFORM_ADMIN when GamingCenter table is completely empty', async () => {
    ((prisma as any).gamingCenter.count as jest.Mock).mockResolvedValue(0);
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue(null);
    (argon2.hash as jest.Mock).mockResolvedValue('hashed_pw');
    ((prisma as any).platformAdmin.create as jest.Mock).mockResolvedValue({
      id: 'pa_bootstrap_1',
      fullName: 'First Superuser',
      phone: '09121112233',
      email: 'root@playenest.com',
      isActive: true,
      isSuperuser: true,
    });

    const result = await bootstrapPlatformAdmin({
      fullName: 'First Superuser',
      phone: '09121112233',
      email: 'root@playenest.com',
      password: 'StrongPassword123!',
    });

    expect(result.id).toBe('pa_bootstrap_1');
    expect((prisma as any).platformAdmin.create).toHaveBeenCalledWith({
      data: {
        fullName: 'First Superuser',
        phone: '09121112233',
        email: 'root@playenest.com',
        passwordHash: 'hashed_pw',
        isActive: true,
        isSuperuser: true,
      },
    });
  });

  it('should refuse to overwrite existing platform admin with duplicate phone', async () => {
    ((prisma as any).platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: 'pa_existing',
      phone: '09121112233',
    });

    const result = await bootstrapPlatformAdmin({
      fullName: 'Duplicate Superuser',
      phone: '09121112233',
      password: 'StrongPassword123!',
    });

    expect(result.id).toBe('pa_existing');
    expect((prisma as any).platformAdmin.create).not.toHaveBeenCalled();
  });

  it('should throw validation error on invalid phone format', async () => {
    await expect(
      bootstrapPlatformAdmin({
        fullName: 'Invalid Phone',
        phone: '12345',
        password: 'StrongPassword123!',
      })
    ).rejects.toThrow('Invalid Iranian phone number format');
  });
});
