import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { CustomerFilters, UpdateCustomerInput } from './customers.types';

export async function findManyProfiles(gamingCenterId: string, filters: CustomerFilters) {
  const { search, page = 1, limit = 10 } = filters;
  const skip = (page - 1) * limit;

  const where: Prisma.SalonCustomerProfileWhereInput = {
    gamingCenterId,
  };

  if (search) {
    where.OR = [
      { displayName: { contains: search, mode: 'insensitive' } },
      { customerAccount: { fullName: { contains: search, mode: 'insensitive' } } },
      { customerAccount: { phone: { contains: search } } },
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.customerProfile.findMany({
      where,
      include: {
        customerAccount: true,
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customerProfile.count({ where }),
  ]);

  return { customers, total };
}

export async function findProfileById(gamingCenterId: string, profileId: string) {
  return prisma.customerProfile.findFirst({
    where: {
      id: profileId,
      gamingCenterId,
    },
    include: {
      customerAccount: true,
    },
  });
}

export async function findProfileByAccountId(gamingCenterId: string, customerAccountId: string) {
  return prisma.customerProfile.findUnique({
    where: {
      gamingCenterId_customerAccountId: {
        gamingCenterId,
        customerAccountId,
      },
    },
  });
}

export async function upsertCustomerAccount(phone: string, fullName?: string) {
  return prisma.customerAccount.upsert({
    where: { phone },
    update: fullName ? { fullName } : {},
    create: {
      phone,
      fullName,
    },
  });
}

export async function createProfile(data: {
  gamingCenterId: string;
  customerAccountId: string;
  displayName?: string;
  note?: string;
}) {
  return prisma.customerProfile.create({
    data,
    include: {
      customerAccount: true,
    },
  });
}

export async function updateProfile(
  profileId: string,
  gamingCenterId: string,
  data: UpdateCustomerInput
) {
  return prisma.customerProfile.update({
    where: {
      id: profileId,
      // We don't have a unique constraint on id and gamingCenterId, but it's safe since id is PK.
      // However, to ensure tenant isolation:
    },
    data,
    include: {
      customerAccount: true,
    },
  });
}

export async function deleteProfile(profileId: string, gamingCenterId: string) {
  // Ensuring it belongs to the gamingCenter
  const profile = await prisma.customerProfile.findFirst({
    where: { id: profileId, gamingCenterId }
  });

  if (!profile) return null;

  return prisma.customerProfile.delete({
    where: { id: profileId }
  });
}
