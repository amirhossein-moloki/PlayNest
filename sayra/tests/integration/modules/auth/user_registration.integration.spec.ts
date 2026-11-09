import { describe, it, expect, jest, beforeEach } from '@jest/globals';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { authService } from '../../../../src/modules/auth/auth.station';
import { AuthRepository } from '../../../../src/modules/auth/auth.repository';
import { UserRole } from '@prisma/client';

jest.mock('../../../../src/modules/auth/auth.repository');
jest.mock('argon2', () => ({
  verify: jest.fn().mockImplementation(() => Promise.resolve(true)),
  hash: jest.fn().mockImplementation((val) => Promise.resolve(`h_${val}`)),
}));

const MockedAuthRepository = AuthRepository as jest.Mocked<typeof AuthRepository>;

describe('User Registration/Login Integration (Mocked Repo)', () => {
  const phone = '09123456789';
  const normalizedPhone = '+989123456789';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('concurrency test: concurrent OTP verification creates only one user', async () => {
    const newUser = {
      id: 'u-conc-1',
      fullName: 'کاربر جدید',
      phone: normalizedPhone,
      role: UserRole.STAFF,
      gamingCenter: { id: 'gc-active', name: 'Active Center' },
    };

    MockedAuthRepository.findRecentOtp.mockResolvedValue({
      id: 'otp-conc',
      codeHash: 'hash',
    } as any);

    MockedAuthRepository.consumeOtp.mockResolvedValue({} as any);
    MockedAuthRepository.markUserPhoneVerified.mockResolvedValue({ count: 1 });
    MockedAuthRepository.findFirstActiveGamingCenter.mockResolvedValue({ id: 'gc-active', name: 'Active Center' } as any);

    // Call 1 succeeds to create user, Call 2 hits unique constraint and catches to find existing user
    MockedAuthRepository.findUsersWithGamingCenters
      .mockResolvedValueOnce([]) // call 1 before create
      .mockResolvedValueOnce([]) // call 2 before create
      .mockResolvedValueOnce([newUser as any]); // call 2 after unique constraint in catch

    MockedAuthRepository.createUserForOtp
      .mockResolvedValueOnce(newUser as any)
      .mockRejectedValueOnce(new Error('Unique constraint failed on the fields: (`gamingCenterId`,`phone`)'));

    const [res1, res2] = await Promise.all([
      authService.verifyUserOtp(phone, '123456'),
      authService.verifyUserOtp(phone, '123456'),
    ]);

    expect(res1.gamingCenters).toEqual([{ id: 'gc-active', name: 'Active Center' }]);
    expect(res2.gamingCenters).toEqual([{ id: 'gc-active', name: 'Active Center' }]);
  });
});
