/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AuthService } from '../../../../src/modules/auth/auth.station';
import { AuthRepository } from '../../../../src/modules/auth/auth.repository';
import { SessionFactory } from '../../../../tests/factories/user.factory';
import { CustomerAccount } from '@prisma/client';

jest.mock('../../../../src/modules/auth/auth.repository');

const MockedAuthRepository = AuthRepository as jest.Mocked<typeof AuthRepository>;

describe('Customer Registration/Login Integration (Mocked Repo)', () => {
  const phone = '09123456789';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new customer account if it does not exist', async () => {
    const newCustomer = {
      id: 'cust-123',
      phone,
      phoneVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      fullName: null,
      walletBalance: 0
    } as CustomerAccount;

    const session = SessionFactory.create({ actorId: newCustomer.id, actorType: 'CUSTOMER' });

    MockedAuthRepository.findCustomerByPhone.mockResolvedValue(null);
    MockedAuthRepository.createCustomer.mockResolvedValue(newCustomer);
    MockedAuthRepository.createSession.mockResolvedValue(session as any);

    const result = await AuthService.loginCustomer(phone);

    expect(result.customer).toEqual(newCustomer);
    expect(MockedAuthRepository.createCustomer).toHaveBeenCalledWith(phone, expect.any(Date));
    expect(MockedAuthRepository.createSession).toHaveBeenCalledWith(newCustomer.id, 'CUSTOMER', expect.any(String), expect.any(Date));
  });

  it('should login existing customer and ensure phone is verified', async () => {
    const existingUnverifiedCustomer = {
      id: 'cust-123',
      phone,
      phoneVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CustomerAccount;

    const verifiedCustomer = { ...existingUnverifiedCustomer, phoneVerifiedAt: new Date() };
    const session = SessionFactory.create({ actorId: verifiedCustomer.id, actorType: 'CUSTOMER' });

    MockedAuthRepository.findCustomerByPhone.mockResolvedValue(existingUnverifiedCustomer);
    MockedAuthRepository.markCustomerPhoneVerified.mockResolvedValue(verifiedCustomer);
    MockedAuthRepository.createSession.mockResolvedValue(session as any);

    const result = await AuthService.loginCustomer(phone);

    expect(result.customer).toEqual(verifiedCustomer);
    expect(MockedAuthRepository.markCustomerPhoneVerified).toHaveBeenCalledWith(existingUnverifiedCustomer.id);
    expect(MockedAuthRepository.createSession).toHaveBeenCalled();
  });
});
