import { UserRole } from '@prisma/client';

export const commentsPolicy = {
  canModerate(role: UserRole) {
    const moderators: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR];
    return moderators.includes(role);
  },

  canPin(role: UserRole) {
    const moderators: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR];
    return moderators.includes(role);
  },
};
