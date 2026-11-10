import { prisma } from '../../config/prisma';
import { CustomerAccount } from '@prisma/client';
import logger from '../../config/logger';

export const UserProvisioningService = {
  /**
   * Concurrency-safe creation or retrieval of CustomerAccount.
   * If multiple concurrent requests arrive with a new phone number,
   * Prisma upsert / retry-on-unique-violation ensures exactly one record is created.
   */
  async provisionCustomer(phone: string): Promise<CustomerAccount> {
    try {
      const customer = await prisma.customerAccount.upsert({
        where: { phone },
        update: {
          phoneVerifiedAt: new Date(),
        },
        create: {
          phone,
          phoneVerifiedAt: new Date(),
          walletBalance: 0,
        },
      });
      return customer;
    } catch (err: unknown) {
      logger.warn({ err, phone }, 'Customer provisioning collision, attempting fallback find');
      // If unique constraint race happened on create, find the existing customer
      const existing = await prisma.customerAccount.findUnique({
        where: { phone },
      });
      if (existing) {
        return existing;
      }
      throw err;
    }
  },
};
