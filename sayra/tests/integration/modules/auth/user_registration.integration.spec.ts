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

  it('should return existing user gaming centers if present', async () => {
    const existingUser = {
      id: 'u-1',
      fullName: 'کارمند سالن',
      phone: normalizedPhone,
      role: UserRole.STAFF,
      gamingCenter: { id: 'gc-active', name: 'Active Center' },
    };

    MockedAuthRepository.findRecentOtp.mockResolvedValue({
      id: 'otp-1',
      codeHash: 'hash',
    } as any);

    MockedAuthRepository.consumeOtp.mockResolvedValue({} as any);
    MockedAuthRepository.markUserPhoneVerified.mockResolvedValue({ count: 1 });
    MockedAuthRepository.findUsersWithGamingCenters.mockResolvedValue([existingUser as any]);

    const res = await authService.verifyUserOtp(phone, '123456');

    expect(res.gamingCenters).toEqual([{ id: 'gc-active', name: 'Active Center' }]);
  });

  it('should return empty gaming centers if no user exists and never auto-create gaming center', async () => {
    MockedAuthRepository.findRecentOtp.mockResolvedValue({
      id: 'otp-2',
      codeHash: 'hash',
    } as any);

    MockedAuthRepository.consumeOtp.mockResolvedValue({} as any);
    MockedAuthRepository.markUserPhoneVerified.mockResolvedValue({ count: 0 });
    MockedAuthRepository.findUsersWithGamingCenters.mockResolvedValue([]);

    const res = await authService.verifyUserOtp(phone, '123456');

    expect(res.gamingCenters).toEqual([]);
  });
});
