import { SessionActorType } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const AuthRepository = {
  async findUserByPhone(phone: string, gamingCenterId: string) {
    return prisma.user.findFirst({ where: { phone, gamingCenterId } });
  },

  async findCustomerByPhone(phone: string) {
    return prisma.customerAccount.findFirst({ where: { phone } });
  },

  async createCustomer(phone: string, phoneVerifiedAt?: Date) {
    return prisma.customerAccount.create({ data: { phone, phoneVerifiedAt } });
  },

  async markCustomerPhoneVerified(id: string) {
    return prisma.customerAccount.update({
      where: { id },
      data: { phoneVerifiedAt: new Date() },
    });
  },

  async markUserPhoneVerified(phone: string) {
    return prisma.user.updateMany({
      where: { phone },
      data: { phoneVerifiedAt: new Date() },
    });
  },

  async createOtp(data: { phone: string; purpose: any; codeHash: string; expiresAt: Date }) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return prisma.phoneOtp.create({ data });
  },

  async findRecentOtp(phone: string, purpose: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return prisma.phoneOtp.findFirst({
      where: {
        phone,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findRecentConsumedOtp(phone: string, purpose: any, window: Date) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return prisma.phoneOtp.findFirst({
      where: {
        phone,
        purpose,
        consumedAt: { gte: window },
      },
      orderBy: { consumedAt: 'desc' },
    });
  },

  async consumeOtp(id: string) {
    return prisma.phoneOtp.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  },

  async findUsersWithGamingCenters(phone: string) {
    return prisma.user.findMany({
      where: { phone },
      include: { gamingCenter: true },
    });
  },

  async createSession(actorId: string, actorType: SessionActorType, tokenHash: string, expiresAt: Date) {
    return prisma.session.create({
      data: {
        actorId,
        actorType,
        tokenHash,
        expiresAt,
      },
    });
  },

  async findSessionByToken(tokenHash: string) {
    return prisma.session.findUnique({ where: { tokenHash } });
  },

  async revokeSession(sessionId: string) {
    return prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  },
};
