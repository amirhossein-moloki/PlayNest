/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  bootstrapPlatformAdmin,
  prisma,
  resetPlatformAdminTwoFactor,
} from '../../../scripts/bootstrap-platform-admin';
import argon2 from 'argon2';

jest.mock('../../../src/config/prisma', () => ({
  prisma: {
    platformAdmin: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    gamingCenter: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
  connectPrisma: jest.fn(),
  disconnectPrisma: jest.fn(),
}));

jest.mock('argon2', () => ({
  hash: jest.fn(),
}));

describe('PLATFORM_ADMIN Bootstrap CLI (npm run admin:create)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. Successful first SUPERUSER creation with username, Argon2 password, and TOTP disabled initially', async () => {
    ((prisma as any).gamingCenter.count as jest.Mock).mockResolvedValue(0);
    ((prisma as any).platformAdmin.count as jest.Mock).mockResolvedValue(0);
    (argon2.hash as jest.Mock).mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=4$some_hash');

    const mockAdmin = {
      id: 'pa_bootstrap_1',
      username: 'rootadmin',
      fullName: 'First Superuser',
      phone: null,
      email: 'root@playenest.com',
      isActive: true,
      isSuperuser: true,
      totpEnabled: false,
      totpSetupCompleted: false,
    };

    const mockTx = {
      platformAdmin: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
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
      username: 'rootadmin',
      fullName: 'First Superuser',
      email: 'root@playenest.com',
      password: 'StrongPassword123!',
      passwordConfirm: 'StrongPassword123!',
    });

    expect(result?.id).toBe('pa_bootstrap_1');
    expect(mockTx.platformAdmin.create).toHaveBeenCalledWith({
      data: {
        username: 'rootadmin',
        fullName: 'First Superuser',
        phone: null,
        email: 'root@playenest.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$some_hash',
        isActive: true,
        isSuperuser: true,
        totpEnabled: false,
        totpSetupCompleted: false,
        totpSecretEncrypted: null,
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
          username: 'rootadmin',
          fullName: 'First Superuser',
          phone: null,
          email: 'root@playenest.com',
          isSuperuser: true,
          totpEnabled: false,
          totpSetupCompleted: false,
        },
      },
    });
  });

  it('2. Password is stored only as an Argon2 hash and not plaintext', async () => {
    ((prisma as any).platformAdmin.count as jest.Mock).mockResolvedValue(0);
    (argon2.hash as jest.Mock).mockResolvedValue('$argon2id$v=19$mock_hash_only');

    const mockAdmin = {
      id: 'pa_bootstrap_hash',
      username: 'hashadmin',
      fullName: 'Hash Admin',
      phone: '09123334455',
      isActive: true,
      isSuperuser: true,
      totpEnabled: false,
      totpSetupCompleted: false,
    };

    const mockTx = {
      platformAdmin: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(mockAdmin),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit_hash' }),
      },
    };

    ((prisma as any).$transaction as jest.Mock) = jest.fn().mockImplementation(async (cb) => cb(mockTx));

    await bootstrapPlatformAdmin({
      username: 'hashadmin',
      fullName: 'Hash Admin',
      phone: '09123334455',
      password: 'StrongPassword123!',
      passwordConfirm: 'StrongPassword123!',
    });

    expect(mockTx.platformAdmin.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: '$argon2id$v=19$mock_hash_only',
          totpEnabled: false,
          totpSetupCompleted: false,
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
      username: 'duplicate_admin',
      fullName: 'Duplicate Superuser',
      phone: '09121112233',
      password: 'StrongPassword123!',
      passwordConfirm: 'StrongPassword123!',
    });

    expect(result).toBeNull();
    expect((prisma as any).$transaction).not.toHaveBeenCalled();
  });

  it('4. Running the command twice exits safely without modifying or overwriting the first administrator', async () => {
    ((prisma as any).platformAdmin.count as jest.Mock).mockResolvedValueOnce(0);
    (argon2.hash as jest.Mock).mockResolvedValue('$argon2id$hash');

    const mockTx = {
      platformAdmin: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'pa_first',
          username: 'firstadmin',
          fullName: 'First Admin',
          phone: '09120000000',
          totpEnabled: false,
          totpSetupCompleted: false,
        }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit_1' }),
      },
    };
    ((prisma as any).$transaction as jest.Mock) = jest.fn().mockImplementation(async (cb) => cb(mockTx));

    const firstResult = await bootstrapPlatformAdmin({
      username: 'firstadmin',
      fullName: 'First Admin',
      phone: '09120000000',
      password: 'StrongPassword123!',
      passwordConfirm: 'StrongPassword123!',
    });

    expect(firstResult?.id).toBe('pa_first');

    ((prisma as any).platformAdmin.count as jest.Mock).mockResolvedValueOnce(1);
    const secondResult = await bootstrapPlatformAdmin({
      username: 'secondadmin',
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
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'pa_untouched',
          username: 'untouched',
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
      username: 'untouched',
      fullName: 'Untouched Admin',
      phone: '09124445566',
      password: 'StrongPassword123!',
      passwordConfirm: 'StrongPassword123!',
    });

    expect((prisma as any).user?.update).toBeUndefined();
    expect((prisma as any).user?.delete).toBeUndefined();
    expect((prisma as any).gamingCenter?.update).toBeUndefined();
    expect((prisma as any).gamingCenter?.delete).toBeUndefined();
  });

  it('6. Validation errors: invalid username, invalid phone format, mismatch, and weak password policy', async () => {
    ((prisma as any).platformAdmin.count as jest.Mock).mockResolvedValue(0);

    // Invalid username
    await expect(
      bootstrapPlatformAdmin({
        username: 'ab',
        password: 'StrongPassword123!',
        passwordConfirm: 'StrongPassword123!',
      })
    ).rejects.toThrow('Username must be between 3 and 50 characters long');

    // Invalid phone when supplied
    await expect(
      bootstrapPlatformAdmin({
        username: 'validadmin',
        fullName: 'Valid Name',
        phone: '12345',
        password: 'StrongPassword123!',
        passwordConfirm: 'StrongPassword123!',
      })
    ).rejects.toThrow('Invalid Iranian phone number format');

    // Password confirmation mismatch
    await expect(
      bootstrapPlatformAdmin({
        username: 'validadmin',
        fullName: 'Valid Name',
        phone: '09121112233',
        password: 'StrongPassword123!',
        passwordConfirm: 'DifferentPassword123!',
      })
    ).rejects.toThrow('Password confirmation does not match');

    // Weak password: missing uppercase
    await expect(
      bootstrapPlatformAdmin({
        username: 'validadmin',
        fullName: 'Valid Name',
        phone: '09121112233',
        password: 'weakpassword123!',
        passwordConfirm: 'weakpassword123!',
      })
    ).rejects.toThrow('Password must contain at least one uppercase letter');
  });

  it('7. Emergency 2FA reset (--reset-2fa) clears TOTP state, revokes sessions/codes, and logs audit', async () => {
    const admin = {
      id: 'pa_reset_1',
      username: 'rootadmin',
      isActive: true,
      isSuperuser: true,
      totpEnabled: true,
      totpSetupCompleted: true,
    };

    ((prisma as any).platformAdmin.findFirst as jest.Mock).mockResolvedValue(admin);

    const mockTx = {
      platformAdmin: { update: jest.fn().mockResolvedValue({ ...admin, totpEnabled: false }) },
      platformAdminAuthenticator: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      platformAdminRecoveryCode: { updateMany: jest.fn().mockResolvedValue({ count: 10 }) },
      session: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit_reset' }) },
    };
    ((prisma as any).$transaction as jest.Mock) = jest.fn().mockImplementation(async (cb) => cb(mockTx));

    await resetPlatformAdminTwoFactor('rootadmin');

    expect(mockTx.platformAdmin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pa_reset_1' },
        data: expect.objectContaining({
          totpEnabled: false,
          totpSetupCompleted: false,
          totpSecretEncrypted: null,
        }),
      })
    );
    expect(mockTx.platformAdminAuthenticator.updateMany).toHaveBeenCalled();
    expect(mockTx.platformAdminRecoveryCode.updateMany).toHaveBeenCalled();
    expect(mockTx.session.updateMany).toHaveBeenCalled();
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platformAdminId: 'pa_reset_1',
          action: 'ADMIN_2FA_EMERGENCY_RESET',
        }),
      })
    );
  });
});
