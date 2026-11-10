import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { authService } from '../../../../src/modules/auth/auth.station';
import { AuthRepository } from '../../../../src/modules/auth/auth.repository';
import { SessionFactory } from '../../../../tests/factories/user.factory';
import { CustomerAccount } from '@prisma/client';

jest.mock('../../../../src/modules/auth/auth.repository');
jest.mock('../../../../src/config/prisma', () => ({
  prisma: {
    user: { findMany: jest.fn().mockImplementation(() => Promise.resolve([])) },
    customerAccount: { findUnique: jest.fn(), findFirst: jest.fn() },
    session: { create: jest.fn() },
  },
}));

const MockedAuthRepository = AuthRepository as jest.Mocked<typeof AuthRepository>;

describe('Customer Registration/Login Integration (Mocked Repo)', () => {
  const phone = '09123456789';
  const normalizedPhone = '+989123456789';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new customer account if it does not exist', async () => {
    const newCustomer = {
      id: 'cust-123',
      phone: normalizedPhone,
      phoneVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      fullName: null,
      walletBalance: 0
    } as CustomerAccount;

    const session = SessionFactory.create({ actorId: newCustomer.id, actorType: 'CUSTOMER' });

    MockedAuthRepository.findCustomerByPhone.mockResolvedValue(null);
    MockedAuthRepository.createCustomer.mockResolvedValue(newCustomer);
    MockedAuthRepository.createSession.mockResolvedValue(session /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    const result = await authService.loginCustomer(phone);

    expect(result.customer).toEqual(newCustomer);
    expect(MockedAuthRepository.createCustomer).toHaveBeenCalledWith(normalizedPhone, expect.any(Date));
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
    MockedAuthRepository.createSession.mockResolvedValue(session /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    const result = await authService.loginCustomer(phone);

    expect(result.customer).toEqual(verifiedCustomer);
    expect(MockedAuthRepository.markCustomerPhoneVerified).toHaveBeenCalledWith(existingUnverifiedCustomer.id);
    expect(MockedAuthRepository.createSession).toHaveBeenCalled();
  });

  it('concurrency test: concurrent login/registration calls resolve safely with same customer account', async () => {
    const customer = {
      id: 'cust-concurrency-1',
      phone,
      phoneVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      fullName: null,
      walletBalance: 0
    } as CustomerAccount;

    const session = SessionFactory.create({ actorId: customer.id, actorType: 'CUSTOMER' });

    MockedAuthRepository.findCustomerByPhone.mockResolvedValue(null);
    MockedAuthRepository.upsertCustomerAccount.mockResolvedValue(customer);
    MockedAuthRepository.createSession.mockResolvedValue(session /* eslint-disable-line @typescript-eslint/no-explicit-any */ as any);

    const [res1, res2] = await Promise.all([
      authService.loginCustomer(phone),
      authService.loginCustomer(phone),
    ]);

    expect(res1.customer.id).toBe(customer.id);
    expect(res2.customer.id).toBe(customer.id);
    expect(MockedAuthRepository.upsertCustomerAccount).toHaveBeenCalledTimes(2);
  });
});
