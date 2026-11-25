import { Prisma, SessionActorType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';

export const AuthRepository = {
  async findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  async findUserByUsername(username: string, excludeUserId?: string) {
    return prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive',
        },
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
      },
    });
  },

  async updateUser(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({
      where: { id },
      data,
    });
  },

  async updateCustomerAccount(id: string, data: Prisma.CustomerAccountUpdateInput) {
    return prisma.customerAccount.update({
      where: { id },
      data,
    });
  },

  async findUserByPhone(phone: string, gamingCenterId: string) {
    return prisma.user.findFirst({ where: { phone, gamingCenterId } });
  },

  async findPlatformAdminByPhone(phone: string) {
    return (prisma as any).platformAdmin.findUnique /* eslint-disable-line @typescript-eslint/no-explicit-any */({ where: { phone } });
  },

  async findPlatformAdminById(id: string) {
    return (prisma as any).platformAdmin.findUnique /* eslint-disable-line @typescript-eslint/no-explicit-any */({ where: { id } });
  },

  async updatePlatformAdminLastLogin(id: string) {
    return (prisma as any).platformAdmin.update /* eslint-disable-line @typescript-eslint/no-explicit-any */({
      where: { id },
      data: { lastLogin: new Date() },
    });
  },

  async findCustomerByPhone(phone: string) {
    return prisma.customerAccount.findFirst({ where: { phone } });
  },

  async findCustomerById(id: string) {
    return prisma.customerAccount.findUnique({ where: { id } });
  },

  async createCustomer(phone: string, phoneVerifiedAt?: Date) {
    return prisma.customerAccount.create({ data: { phone, phoneVerifiedAt } });
  },

  async upsertCustomerAccount(phone: string, phoneVerifiedAt: Date = new Date()) {
    return prisma.customerAccount.upsert({
      where: { phone },
      update: { phoneVerifiedAt },
      create: { phone, phoneVerifiedAt },
    });
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

  async createOtp(data: { phone: string; purpose: any; codeHash: string; expiresAt: Date; targetActorType?: SessionActorType }) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return prisma.phoneOtp.create({ data });
  },

  async findRecentOtp(phone: string, purpose: any, targetActorType?: SessionActorType) { // eslint-disable-line @typescript-eslint/no-explicit-any
    return prisma.phoneOtp.findFirst({
      where: {
        phone,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        ...(targetActorType !== undefined ? { targetActorType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findRecentConsumedOtp(phone: string, purpose: any, window: Date, targetActorType?: SessionActorType) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const maxAttempts = Number(env.OTP_MAX_ATTEMPTS) || 5;
    return prisma.phoneOtp.findFirst({
      where: {
        phone,
        purpose,
        consumedAt: { gte: window },
        attempts: { lt: maxAttempts },
        ...(targetActorType !== undefined ? { targetActorType } : {}),
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

  async deleteConsumedOtp(id: string) {
    return prisma.phoneOtp.deleteMany({
      where: {
        id,
        consumedAt: { not: null },
      },
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

  async findSessionById(sessionId: string) {
    return prisma.session.findUnique({ where: { id: sessionId } });
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

  async rotateSessionToken(sessionId: string, tokenHash: string) {
    return prisma.session.update({
      where: { id: sessionId },
      data: { tokenHash },
    });
  },
};
