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
    const { normalizePhone, getPhoneVariants } = await import('../../common/utils/phone');
    const normalizedPhone = normalizePhone(phone);
    const variants = getPhoneVariants(phone);

    // Guard: Under no circumstances create a CustomerAccount if an active User/Manager exists
    const activeStaff = await prisma.user.findFirst({
      where: {
        phone: { in: variants },
        isActive: true,
      },
    });

    if (activeStaff) {
      throw new Error(`Cannot provision customer account: active ${activeStaff.role} account already exists for this phone number`);
    }

    try {
      const customer = await prisma.customerAccount.upsert({
        where: { phone: normalizedPhone },
        update: {
          phoneVerifiedAt: new Date(),
        },
        create: {
          phone: normalizedPhone,
          phoneVerifiedAt: new Date(),
          walletBalance: 0,
        },
      });
      return customer;
    } catch (err: unknown) {
      logger.warn({ err, phone }, 'Customer provisioning collision, attempting fallback find');
      // If unique constraint race happened on create, find the existing customer
      const existing = await prisma.customerAccount.findUnique({
        where: { phone: normalizedPhone },
      });
      if (existing) {
        return existing;
      }
      throw err;
    }
  },
};
