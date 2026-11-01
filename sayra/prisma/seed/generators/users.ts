import { PrismaClient, UserRole, ShiftRole, SkillLevel } from '@prisma/client';
import argon2 from 'argon2';
import { PRNG } from '../prng';
import { SEED_CONFIG } from '../config';
import { SeedCenterDefinition } from './centers';
import { SeedStationInfo } from './stations';

export const IRAN_FIRST_NAMES = [
  'علی', 'محمد', 'امیر', 'مهدی', 'حسین', 'رضا', 'سروش', 'آرش', 'نیما', 'پارسا',
  'سینا', 'پویا', 'کیان', 'بردیا', 'شایان', 'سامان', 'فرزاد', 'نوید', 'میلاد', 'آرمان',
  'سارا', 'مریم', 'نگار', 'رویا', 'الناز', 'نیلوفر', 'یاسمن', 'پریسا', 'غزل', 'آیدا'
];

export const IRAN_LAST_NAMES = [
  'محمدی', 'احمدی', 'حسینی', 'رضایی', 'صادقی', 'کریمی', 'موسوی', 'جعفری', 'مرادی', 'طاهری',
  'تبریزی', 'ستاری', 'نجفی', 'قاسمی', 'کاظمی', 'ابراهیمی', 'اکبری', 'باقری', 'رستمی', 'شریفی',
  'فرهادی', 'اسدی', 'کاویانی', 'خسروی', 'جلالی', 'امیری', 'صالحی', 'پاشایی', 'نیک‌نژاد', 'امانی'
];

export interface SeededStaffUsers {
  managerIdByCenter: Record<string, string>;
  staffIdsByCenter: Record<string, string[]>;
}

export interface SeededCustomers {
  customerAccountIds: string[];
  profilesByCenter: Record<string, string[]>;
  profileToAccountMap: Record<string, string>;
}

export async function seedUsersAndCustomers(
  prisma: PrismaClient,
  centers: { id: string; definition: SeedCenterDefinition }[],
  stations: SeedStationInfo[],
  prng: PRNG
): Promise<{ staff: SeededStaffUsers; customers: SeededCustomers; platformAdminId: string }> {
  const commonPasswordHash = await argon2.hash(SEED_CONFIG.defaultPassword);

  const admin = await prisma.platformAdmin.create({
    data: {
      fullName: SEED_CONFIG.platformAdmin.fullName,
      phone: SEED_CONFIG.platformAdmin.phone,
      email: SEED_CONFIG.platformAdmin.email,
      passwordHash: commonPasswordHash,
      isActive: true,
      isSuperuser: true,
    },
  });

  const managerIdByCenter: Record<string, string> = {};
  const staffIdsByCenter: Record<string, string[]> = {};

  let phoneCounter = 1000;

  for (const center of centers) {
    staffIdsByCenter[center.id] = [];

    phoneCounter++;
    const manager = await prisma.user.create({
      data: {
        gamingCenterId: center.id,
        fullName: `${prng.pick(IRAN_FIRST_NAMES)} ${prng.pick(IRAN_LAST_NAMES)} (مدیر مرکز)`,
        phone: `0914100${String(phoneCounter).padStart(4, '0')}`,
        role: UserRole.MANAGER,
        isActive: true,
        passwordHash: commonPasswordHash,
      },
    });
    managerIdByCenter[center.id] = manager.id;

    const staffConfigs = [
      { role: ShiftRole.CASHIER, title: 'صندوق‌دار' },
      { role: ShiftRole.TECH_SUPPORT, title: 'پشتیبان فنی شبکه و سیستم‌ها' },
      { role: ShiftRole.HOST, title: 'میزبان و مسئول مشتریان' },
    ];

    for (const conf of staffConfigs) {
      phoneCounter++;
      const staffUser = await prisma.user.create({
        data: {
          gamingCenterId: center.id,
          fullName: `${prng.pick(IRAN_FIRST_NAMES)} ${prng.pick(IRAN_LAST_NAMES)} (${conf.title})`,
          phone: `0914200${String(phoneCounter).padStart(4, '0')}`,
          role: UserRole.STAFF,
          isActive: true,
          passwordHash: commonPasswordHash,
        },
      });
      staffIdsByCenter[center.id].push(staffUser.id);

      for (let day = 0; day < 7; day++) {
        await prisma.staffShift.create({
          data: {
            gamingCenterId: center.id,
            userId: staffUser.id,
            dayOfWeek: day,
            startTime: conf.role === ShiftRole.CASHIER ? '10:00' : '15:00',
            endTime: conf.role === ShiftRole.CASHIER ? '18:00' : '23:30',
            shiftRole: conf.role,
            isActive: true,
          },
        });
      }

      // Connect to a representative station in this center
      const centerStations = stations.filter((s) => s.gamingCenterId === center.id);
      if (centerStations.length > 0) {
        const assignedStation = prng.pick(centerStations);
        await prisma.staffStationSkill.create({
          data: {
            userId: staffUser.id,
            stationId: assignedStation.id,
            skillLevel: conf.role === ShiftRole.TECH_SUPPORT ? SkillLevel.EXPERT : SkillLevel.INTERMEDIATE,
          },
        });
      }
    }
  }

  const customerAccountIds: string[] = [];
  const profilesByCenter: Record<string, string[]> = {};
  const profileToAccountMap: Record<string, string> = {};

  for (const c of centers) {
    profilesByCenter[c.id] = [];
  }

  for (let i = 1; i <= 60; i++) {
    const fullName = `${prng.pick(IRAN_FIRST_NAMES)} ${prng.pick(IRAN_LAST_NAMES)}`;
    const phone = `09991${String(i).padStart(6, '0')}`;
    const walletBalance = prng.pick([0, 0, 50000, 100000, 250000, 500000, 1000000]);

    const account = await prisma.customerAccount.create({
      data: {
        fullName,
        phone,
        walletBalance,
        phoneVerifiedAt: new Date(),
      },
    });
    customerAccountIds.push(account.id);

    if (walletBalance > 0) {
      await prisma.walletTransaction.create({
        data: {
          customerAccountId: account.id,
          amount: walletBalance,
          currency: 'IRT',
          type: 'DEPOSIT',
          note: 'شارژ اولیه حساب آنلاین',
        },
      });
    }

    const assignedCenters = prng.shuffle(centers).slice(0, prng.randInt(1, 3));
    for (const center of assignedCenters) {
      const profile = await prisma.customerProfile.create({
        data: {
          customerAccountId: account.id,
          gamingCenterId: center.id,
          displayName: fullName,
        },
      });
      profilesByCenter[center.id].push(profile.id);
      profileToAccountMap[profile.id] = account.id;
    }
  }

  return {
    staff: {
      managerIdByCenter,
      staffIdsByCenter,
    },
    customers: {
      customerAccountIds,
      profilesByCenter,
      profileToAccountMap,
    },
    platformAdminId: admin.id,
  };
}
