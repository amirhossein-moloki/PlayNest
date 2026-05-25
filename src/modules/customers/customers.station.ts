import AppError from '../../common/errors/AppError';
import httpStatus from 'http-status';
import * as customerRepo from './customers.repo';
import { CreateCustomerInput, UpdateCustomerInput, CustomerFilters } from './customers.types';

export async function listCustomers(gamingCenterId: string, filters: CustomerFilters) {
  return customerRepo.findManyProfiles(gamingCenterId, filters);
}

export async function getCustomerDetail(gamingCenterId: string, customerId: string) {
  const customer = await customerRepo.findProfileById(gamingCenterId, customerId);
  if (!customer) {
    throw new AppError('Customer not found', httpStatus.NOT_FOUND);
  }
  return customer;
}

export async function createCustomer(gamingCenterId: string, input: CreateCustomerInput) {
  // 1. Upsert global customer account
  const account = await customerRepo.upsertCustomerAccount(input.phone, input.fullName);

  // 2. Check if profile already exists for this gamingCenter
  const existingProfile = await customerRepo.findProfileByAccountId(gamingCenterId, account.id);
  if (existingProfile) {
    throw new AppError('Customer already exists in this gamingCenter', httpStatus.CONFLICT);
  }

  // 3. Create gamingCenter-specific profile
  return customerRepo.createProfile({
    gamingCenterId,
    customerAccountId: account.id,
    displayName: input.displayName || input.fullName,
    note: input.note,
  });
}

export async function updateCustomer(
  gamingCenterId: string,
  customerId: string,
  input: UpdateCustomerInput
) {
  // Verify it exists first for better error message
  const existing = await customerRepo.findProfileById(gamingCenterId, customerId);
  if (!existing) {
    throw new AppError('Customer not found', httpStatus.NOT_FOUND);
  }

  return customerRepo.updateProfile(customerId, gamingCenterId, input);
}

export async function deleteCustomer(gamingCenterId: string, customerId: string) {
  const deleted = await customerRepo.deleteProfile(customerId, gamingCenterId);
  if (!deleted) {
    throw new AppError('Customer not found', httpStatus.NOT_FOUND);
  }
  return deleted;
}
