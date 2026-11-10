import { prisma } from '../../config/prisma';
import { User, CustomerAccount } from '@prisma/client';

export interface UserWithCenters extends User {
  gamingCenter: {
    id: string;
    name: string;
  };
}

export interface IdentifiedIdentity {
  actorType: 'USER' | 'CUSTOMER';
  primaryActorId: string;
  phone: string;
  userAccounts: UserWithCenters[];
  customerAccount: CustomerAccount | null;
  isNewCustomer: boolean;
}

export const IdentityService = {
  /**
   * Identifies user accounts and customer accounts associated with the phone.
   * If User accounts exist:
   *   Actor type is USER.
   * If no User accounts exist, but Customer exists:
   *   Actor type is CUSTOMER.
   * If neither exists:
   *   Flagged as isNewCustomer = true (to be provisioned).
   */
  async identifyByPhone(phone: string): Promise<IdentifiedIdentity> {
    const { getPhoneVariants, normalizePhone } = await import('../../common/utils/phone');
    const normalizedPhone = normalizePhone(phone);
    const phoneVariants = getPhoneVariants(phone);

    // Look for active Users matching any variant of the phone number
    const userAccounts = await prisma.user.findMany({
      where: {
        phone: { in: phoneVariants },
        isActive: true,
      },
      include: {
        gamingCenter: {
          select: { id: true, name: true },
        },
      },
    });

    let customerAccount = await prisma.customerAccount.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!customerAccount && prisma.customerAccount.findFirst) {
      customerAccount = await prisma.customerAccount.findFirst({
        where: {
          phone: { in: phoneVariants },
        },
      });
    }

    if (userAccounts.length > 0) {
      // Primary actor is USER (takes the primary user ID, e.g. first active one)
      const primaryUser = userAccounts[0];
      return {
        actorType: 'USER',
        primaryActorId: primaryUser.id,
        phone,
        userAccounts,
        customerAccount,
        isNewCustomer: false,
      };
    }

    if (customerAccount) {
      return {
        actorType: 'CUSTOMER',
        primaryActorId: customerAccount.id,
        phone,
        userAccounts: [],
        customerAccount,
        isNewCustomer: false,
      };
    }

    return {
      actorType: 'CUSTOMER',
      primaryActorId: '',
      phone,
      userAccounts: [],
      customerAccount: null,
      isNewCustomer: true,
    };
  },
};
