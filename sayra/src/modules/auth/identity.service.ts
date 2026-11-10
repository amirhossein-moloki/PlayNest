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
    const userAccounts = await prisma.user.findMany({
      where: { phone, isActive: true },
      include: {
        gamingCenter: {
          select: { id: true, name: true },
        },
      },
    });

    const customerAccount = await prisma.customerAccount.findUnique({
      where: { phone },
    });

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
