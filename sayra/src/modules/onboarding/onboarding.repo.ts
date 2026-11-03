/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../../config/prisma';
import { OnboardingStep, Prisma } from '@prisma/client';

export const OnboardingRepo = {
  async createDraft(data: Prisma.GameCenterOnboardingCreateInput) {
    return (prisma as any).gameCenterOnboarding.create({ data });
  },

  async findById(id: string) {
    return (prisma as any).gameCenterOnboarding.findUnique({
      where: { id },
      include: {
        gamingCenter: true,
      },
    });
  },

  async findByManagerPhone(managerPhone: string) {
    return (prisma as any).gameCenterOnboarding.findFirst({
      where: {
        managerPhone,
        step: { not: OnboardingStep.COMPLETED },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async updateDraft(id: string, data: Prisma.GameCenterOnboardingUpdateInput) {
    return (prisma as any).gameCenterOnboarding.update({
      where: { id },
      data,
    });
  },

  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  },
};
