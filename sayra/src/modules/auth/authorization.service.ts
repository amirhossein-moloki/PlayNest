import { UserRole } from '@prisma/client';
import { UserWithCenters } from './identity.service';

export interface GamingCenterRole {
  id: string;
  name: string;
  role: UserRole;
}

export interface UserAuthorizationContext {
  roles: string[];
  permissions: string[];
  gamingCenters: GamingCenterRole[];
}

export const AuthorizationService = {
  /**
   * Resolves roles, permissions, and gaming center contexts strictly from database records.
   * Client input is never used to determine privileges.
   */
  resolveUserAuthorization(userAccounts: UserWithCenters[]): UserAuthorizationContext {
    const rolesSet = new Set<string>();
    const gamingCenters: GamingCenterRole[] = [];

    for (const user of userAccounts) {
      rolesSet.add(user.role);
      gamingCenters.push({
        id: user.gamingCenter.id,
        name: user.gamingCenter.name,
        role: user.role,
      });
    }

    const roles = Array.from(rolesSet);
    return {
      roles,
      permissions: [],
      gamingCenters,
    };
  },

  resolveCustomerAuthorization(): UserAuthorizationContext {
    return {
      roles: ['CUSTOMER'],
      permissions: [],
      gamingCenters: [],
    };
  },
};
