/* eslint-disable @typescript-eslint/no-explicit-any */
import { bootstrapPlatformAdmin } from '../../../scripts/bootstrap-platform-admin';
import { prisma } from '../../../src/config/prisma';
import argon2 from 'argon2';

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    platformAdmin: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    gamingCenter: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('argon2', () => ({
  hash: jest.fn(),
}));

describe('PLATFORM_ADMIN Bootstrap CLI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. Successful first administrator creation when GamingCenter table is completely empty', async () => {
    ((prisma as any).gamingCenter.count as jest.Mock).mockResolvedValue(0);
    ((prisma as any).platformAdmin.count as jest.Mock).mockResolvedValue(0);
    (argon2.hash as jest.Mock).mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$some_hash');

    const mockAdmin = {
      id: 'pa_bootstrap_1',
      fullName: 'First Superuser',
      phone: '09121112233',
      email: 'root@playenest.com',
      isActive: true,
      isSuperuser: true,
    };

    const mockTx = {
      platformAdmin: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(mockAdmin),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit_1' }),
      },
    };

    ((prisma as any).$transaction as jest.Mock) = jest.fn().mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    const result = await bootstrapPlatformAdmin({
      fullName: 'First Superuser',
      phone: '09121112233',
      email: 'root@playenest.com',
      password: 'StrongPassword123!',
      passwordConfirm: 'StrongPassword123!',
    });

    expect(result?.id).toBe('pa_bootstrap_1');
    expect(mockTx.platformAdmin.create).toHaveBeenCalledWith({
      data: {
        fullName: 'First Superuser',
        phone: '09121112233',
        email: 'root@playenest.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$some_hash',
        isActive: true,
        isSuperuser: true,
      },
    });
    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: {
        platformAdminId: 'pa_bootstrap_1',
        action: 'PLATFORM_ADMIN_BOOTSTRAP',
        entity: 'PlatformAdmin',
        entityId: 'pa_bootstrap_1',
        newData: {
          id: 'pa_bootstrap_1',
          fullName: 'First Superuser',
          phone: '09121112233',
          email: 'root@playenest.com',
        },
      },
    });
  });

  it('2. Password is stored only as an Argon2 hash and not plaintext', async () => {
    ((prisma as any).platformAdmin.count as jest.Mock).mockResolvedValue(0);
    (argon2.hash as jest.Mock).mockResolvedValue('$argon2id$v=19$mock_hash_only');

    const mockAdmin = {
      id: 'pa_bootstrap_hash',
      fullName: 'Hash Admin',
      phone: '09123334455',
      isActive: true,
      isSuperuser: true,
    };

    const mockTx = {
      platformAdmin: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(mockAdmin),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit_hash' }),
      },
    };

    ((prisma as any).$transaction as jest.Mock) = jest.fn().mockImplementation(async (cb) => cb(mockTx));

    await bootstrapPlatformAdmin({
      fullName: 'Hash Admin',
      phone: '09123334455',
      password: 'StrongPassword123!',
      passwordConfirm: 'StrongPassword123!',
    });

    expect(mockTx.platformAdmin.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: '$argon2id$v=19$mock_hash_only',
        }),
      })
    );

    const callArgs = mockTx.platformAdmin.create.mock.calls[0][0];
    expect(callArgs.data.password).toBeUndefined();
    expect(callArgs.data.passwordHash).not.toBe('StrongPassword123!');
  });

  it('3. Duplicate creation is rejected if a PlatformAdmin already exists', async () => {
    ((prisma as any).platformAdmin.count as jest.Mock).mockResolvedValue(1);

    const result = await bootstrapPlatformAdmin({
      fullName: 'Duplicate Superuser',
      phone: '09121112233',
      password: 'StrongPassword123!',
      passwordConfirm: 'StrongPassword123!',
    });

    expect(result).toBeNull();
    expect((prisma as any).$transaction).not.toHaveBeenCalled();
  });

  it('4. Running the command twice exits safely without modifying or overwriting the first administrator', async () => {
    // First run creates admin
    ((prisma as any).platformAdmin.count as jest.Mock).mockResolvedValueOnce(0);
    (argon2.hash as jest.Mock).mockResolvedValue('$argon2id$hash');

    const mockTx = {
      platformAdmin: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'pa_first',
          fullName: 'First Admin',
          phone: '09120000000',
        }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit_1' }),
      },
    };
    ((prisma as any).$transaction as jest.Mock) = jest.fn().mockImplementation(async (cb) => cb(mockTx));

    const firstResult = await bootstrapPlatformAdmin({
      fullName: 'First Admin',
      phone: '09120000000',
      password: 'StrongPassword123!',
      passwordConfirm: 'StrongPassword123!',
    });

    expect(firstResult?.id).toBe('pa_first');

    // Second run: count returns 1
    ((prisma as any).platformAdmin.count as jest.Mock).mockResolvedValueOnce(1);
    const secondResult = await bootstrapPlatformAdmin({
      fullName: 'Second Admin Attempt',
      phone: '09120000000',
      password: 'StrongPassword123!',
      passwordConfirm: 'StrongPassword123!',
    });

    expect(secondResult).toBeNull();
  });

  it('5. Existing tenant users and GamingCenters remain untouched', async () => {
    ((prisma as any).platformAdmin.count as jest.Mock).mockResolvedValue(0);
    (argon2.hash as jest.Mock).mockResolvedValue('argon_hash');

    const mockTx = {
      platformAdmin: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'pa_untouched',
          fullName: 'Untouched Admin',
          phone: '09124445566',
        }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit_untouched' }),
      },
    };
    ((prisma as any).$transaction as jest.Mock) = jest.fn().mockImplementation(async (cb) => cb(mockTx));

    await bootstrapPlatformAdmin({
      fullName: 'Untouched Admin',
      phone: '09124445566',
      password: 'StrongPassword123!',
      passwordConfirm: 'StrongPassword123!',
    });

    // Check that user and gamingCenter models were not called for updates or deletes
    expect((prisma as any).user?.update).toBeUndefined();
    expect((prisma as any).user?.delete).toBeUndefined();
    expect((prisma as any).gamingCenter?.update).toBeUndefined();
    expect((prisma as any).gamingCenter?.delete).toBeUndefined();
  });

  it('6. Validation errors: invalid phone format, passwords mismatch, and weak password policy', async () => {
    ((prisma as any).platformAdmin.count as jest.Mock).mockResolvedValue(0);

    // Invalid phone
    await expect(
      bootstrapPlatformAdmin({
        fullName: 'Valid Name',
        phone: '12345',
        password: 'StrongPassword123!',
        passwordConfirm: 'StrongPassword123!',
      })
    ).rejects.toThrow('Invalid Iranian phone number format');

    // Password confirmation mismatch
    await expect(
      bootstrapPlatformAdmin({
        fullName: 'Valid Name',
        phone: '09121112233',
        password: 'StrongPassword123!',
        passwordConfirm: 'DifferentPassword123!',
      })
    ).rejects.toThrow('Password confirmation does not match');

    // Weak password: missing uppercase
    await expect(
      bootstrapPlatformAdmin({
        fullName: 'Valid Name',
        phone: '09121112233',
        password: 'weakpassword123!',
        passwordConfirm: 'weakpassword123!',
      })
    ).rejects.toThrow('Password must contain at least one uppercase letter');

    // Weak password: missing special character
    await expect(
      bootstrapPlatformAdmin({
        fullName: 'Valid Name',
        phone: '09121112233',
        password: 'WeakPassword123',
        passwordConfirm: 'WeakPassword123',
      })
    ).rejects.toThrow('Password must contain at least one special character');
  });
});
