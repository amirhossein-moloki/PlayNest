import {
  PrismaClient,
  UserRole,
  ShiftRole,
  ReservationStatus,
  ReservationSource,
  PaymentMethod,
  PaymentStatus,
  ReservationPaymentState,
  PageStatus,
  PageType,
  PageSectionType,
  LinkType,
  RobotsIndex,
  RobotsFollow,
  CommissionType,
  CommissionStatus,
  GameStationType,
  GamingSessionStatus,
} from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

/**
 * -----------------------------
 * CONFIG — Professional Gaming Center Setup
 * -----------------------------
 */
const CONFIG = {
  gamingCentersCount: 10,
  totalCustomers: 60,
  stationsPerCenter: 12,
  reservationsPerCenter: 25,
};

type IranCity = {
  province: string;
  city: string;
  citySlug: string;
  areaCode: string;
  lat: string;
  lng: string;
  districts: string[];
};

const IRAN_CITIES: IranCity[] = [
  { province: 'آذربایجان شرقی', city: 'تبریز', citySlug: 'tabriz', areaCode: '041', lat: '38.0800', lng: '46.2900', districts: ['کوچه‌باغ', 'خیابان امام', 'زعفرانیه', 'ائل‌گلی', 'ساری‌زمین', 'شریعتی', 'شمس', 'بیلان‌کوه', 'نیمه‌راه', 'قره‌آغاج'] },
  { province: 'تهران', city: 'تهران', citySlug: 'tehran', areaCode: '021', lat: '35.6892', lng: '51.3890', districts: ['ونک', 'پاسداران', 'صادقیه', 'تهرانپارس', 'سعادت‌آباد', 'فرشته', 'نارمک'] },
  { province: 'اصفهان', city: 'اصفهان', citySlug: 'isfahan', areaCode: '031', lat: '32.6539', lng: '51.6660', districts: ['چهارباغ', 'مرداویج', 'شیخ صدوق', 'خانه اصفهان'] },
];

const TABRIZ_CENTERS = [
  {
    name: 'Kingsland Game Net',
    slug: 'kingsland-game-net',
    district: 'کوچه‌باغ',
    address: 'تبریز، کوچه‌باغ',
    lat: 38.0810,
    lng: 46.2890,
    phone: '0417660896',
    openingTime: '10:00',
    closingTime: '23:59',
    hourlyRate: 60000,
    vipHourlyRate: 90000,
    hasFoodService: true,
    games: ['CS2', 'Valorant', 'Dota2', 'FIFA 24', 'PUBG', 'Fortnite']
  },
  {
    name: 'KIYAN Game Palace',
    slug: 'kiyan-game-palace',
    district: 'خیابان امام',
    address: 'تبریز، خیابان امام خمینی',
    phone: '0419725707',
    lat: 38.0732,
    lng: 46.2971,
    hourlyRate: 65000,
    vipHourlyRate: 95000,
    hasFoodService: false,
    games: ['CS2', 'Valorant', 'Warzone', 'Tekken 8', 'FIFA 24']
  },
  {
    name: 'Game Net Puzzle',
    slug: 'game-net-puzzle',
    district: 'زعفرانیه',
    address: 'تبریز، زعفرانیه',
    phone: '04133309846',
    lat: 38.0581,
    lng: 46.2832,
    hourlyRate: 55000,
    vipHourlyRate: 85000,
    hasFoodService: false,
    games: ['LoL', 'CS2', 'Valorant', 'PUBG', 'Apex Legends']
  },
  {
    name: 'AtariiClub',
    slug: 'atariiclub',
    district: 'ائل‌گلی',
    address: 'تبریز، ائل‌گلی',
    phone: '0412044240',
    lat: 38.0945,
    lng: 46.3201,
    hourlyRate: 70000,
    vipHourlyRate: 100000,
    hasFoodService: false,
    games: ['FIFA 24', 'eFootball', 'Tekken 8', 'MK1']
  },
  {
    name: 'Tunnel Game Net',
    slug: 'tunnel-game-net',
    district: 'ساری‌زمین',
    address: 'تبریز، ساری‌زمین',
    phone: '04133374298',
    lat: 38.0602,
    lng: 46.2711,
    hourlyRate: 50000,
    vipHourlyRate: 80000,
    hasFoodService: false,
    games: ['CS2', 'Valorant', 'PUBG', 'GTA V']
  },
  {
    name: 'Mr Game',
    slug: 'mr-game',
    district: 'شریعتی',
    address: 'تبریز، خیابان شریعتی',
    phone: '0413300000',
    lat: 38.0722,
    lng: 46.3110,
    hourlyRate: 60000,
    vipHourlyRate: 90000,
    hasFoodService: false,
    games: ['CS2', 'Warzone', 'Fortnite', 'LoL']
  },
  {
    name: 'Game Net Paradise',
    slug: 'game-net-paradise',
    district: 'شمس',
    address: 'تبریز، شمس تبریزی',
    phone: '0413301111',
    lat: 38.0833,
    lng: 46.3002,
    hourlyRate: 62000,
    vipHourlyRate: 92000,
    hasFoodService: false,
    games: ['Valorant', 'CS2', 'FIFA 24', 'PUBG']
  },
  {
    name: 'Game Net Pardis',
    slug: 'game-net-pardis',
    district: 'بیلان‌کوه',
    address: 'تبریز، بیلان‌کوه',
    phone: '0413302222',
    lat: 38.0677,
    lng: 46.2951,
    hourlyRate: 58000,
    vipHourlyRate: 88000,
    hasFoodService: false,
    games: ['CS2', 'Dota2', 'Apex Legends', 'Valorant']
  },
  {
    name: 'Game Net Modern',
    slug: 'game-net-modern',
    district: 'نیمه‌راه',
    address: 'تبریز، نیمه‌راه',
    phone: '0413303333',
    lat: 38.0709,
    lng: 46.2798,
    hourlyRate: 60000,
    vipHourlyRate: 90000,
    hasFoodService: false,
    games: ['CS2', 'FIFA 24', 'PUBG', 'Warzone']
  },
  {
    name: 'Hero Game Net',
    slug: 'hero-game-net',
    district: 'قره‌آغاج',
    address: 'تبریز، قره‌آغاج',
    phone: '0413304444',
    lat: 38.0559,
    lng: 46.2664,
    hourlyRate: 65000,
    vipHourlyRate: 95000,
    hasFoodService: false,
    games: ['CS2', 'Valorant', 'MK1', 'Fortnite']
  }
];

const FIRST_NAMES_M = ['امیر', 'محمد', 'علی', 'رضا', 'مهدی', 'حسین', 'آرمان', 'سامان', 'پوریا', 'نیما', 'ارشیا', 'سپهر'];
const FIRST_NAMES_F = ['سارا', 'نسترن', 'مریم', 'الناز', 'تینا', 'غزل', 'نیلوفر', 'ساغر', 'رویا', 'بهار'];
const LAST_NAMES = ['حسینی', 'رضایی', 'محمدی', 'احمدی', 'کریمی', 'جعفری', 'مرادی', 'نوری', 'صادقی', 'زارع', 'قاسمی'];

const POPULAR_GAMES = [
  'Dota 2', 'Counter-Strike 2', 'League of Legends', 'FC 24', 'Call of Duty: Warzone',
  'Valorant', 'Rainbow Six Siege', 'PUBG', 'God of War Ragnarok', 'Spider-Man 2',
  'Elden Ring', 'Tekken 8', 'Mortal Kombat 1', 'Fortnite'
];

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function chance(p: number) {
  return Math.random() < p;
}
function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-آ-ی]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function clearAll() {
  if (process.env.NODE_ENV === 'production' && process.env.FORCE_SEED !== 'true') {
    console.warn('⚠️ Skipping clearAll() in production. Use FORCE_SEED=true to override.');
    return;
  }

  console.log('🧹 Clearing existing data...');
  // Delete in reverse order of dependencies
  await prisma.auditLog.deleteMany();
  await prisma.gamingSession.deleteMany();
  await prisma.stationMaintenance.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.earningPayment.deleteMany();
  await prisma.earning.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.staffStationSkill.deleteMany();
  await prisma.staffShift.deleteMany();
  await prisma.user.deleteMany();
  await prisma.gameStation.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.customerAccount.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.pageSection.deleteMany();
  await prisma.pageSlugHistory.deleteMany();
  await prisma.page.deleteMany();
  await prisma.media.deleteMany();
  await prisma.socialLink.deleteMany();
  await prisma.address.deleteMany();
  await prisma.siteSettings.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.commissionPolicy.deleteMany();

  // Analytics
  await prisma.gamingCenterAnalytics.deleteMany();
  await prisma.staffAnalytics.deleteMany();
  await prisma.stationAnalytics.deleteMany();

  await prisma.gamingCenter.deleteMany();
  await prisma.session.deleteMany();
  await prisma.phoneOtp.deleteMany();
}

async function main() {
  await clearAll();

  console.log('🏢 Seeding Gaming Centers...');
  const centerIds: string[] = [];
  const tabriz = IRAN_CITIES[0];

  for (let i = 0; i < TABRIZ_CENTERS.length; i++) {
    const data = TABRIZ_CENTERS[i];
    const center = await prisma.gamingCenter.create({
      data: {
        name: data.name,
        slug: data.slug,
        isActive: true,
        description: `بزرگترین و مجهزترین مرکز بازی در ${tabriz.city} با سیستم‌های بروز و محیطی دوستانه.`,
        pcCount: 8,
        consoleCount: 4,
        openingTime: data.openingTime || '10:00',
        closingTime: data.closingTime || '23:59',
        hourlyRate: data.hourlyRate,
        vipHourlyRate: data.vipHourlyRate,
        hasFoodService: data.hasFoodService,
        games: data.games,
        settings: {
          create: {
            preventOverlaps: true,
            allowOnlineBooking: true,
            onlineBookingAutoConfirm: false,
            requireOtpForPublicBooking: true,
            maxAdvanceBookingDays: 7,
          }
        },
        siteSettings: {
          create: {
            defaultSeoTitle: `${data.name} | رزرو آنلاین سیستم`,
            defaultSeoDescription: `رزرو آنلاین سیستم‌های گیمینگ و کنسول در ${data.name}`,
            robotsIndex: RobotsIndex.INDEX,
            robotsFollow: RobotsFollow.FOLLOW,
          }
        },
        commissionPolicy: {
          create: {
            type: CommissionType.PERCENT,
            percentBps: 500, // 5%
            isActive: true,
          }
        },
        addresses: {
          create: {
            city: tabriz.city,
            province: tabriz.province,
            district: data.district,
            addressLine: data.address,
            lat: data.lat,
            lng: data.lng,
            isPrimary: true,
          }
        },
        links: {
          create: [
            { type: LinkType.INSTAGRAM, label: 'اینستاگرام', value: `@${slugify(data.name)}` },
            { type: LinkType.PHONE, label: 'تلفن', value: data.phone },
          ]
        }
      }
    });
    centerIds.push(center.id);
  }

  console.log('👤 Seeding Staff Users...');
  const userIdsByCenter: Record<string, string[]> = {};
  const managerIdByCenter: Record<string, string> = {};

  for (const centerId of centerIds) {
    userIdsByCenter[centerId] = [];
    // 1 Manager
    const manager = await prisma.user.create({
      data: {
        gamingCenterId: centerId,
        fullName: `${pick(FIRST_NAMES_M)} ${pick(LAST_NAMES)}`,
        phone: `0912${randInt(1000000, 1999999)}`,
        role: UserRole.MANAGER,
        isActive: true,
        passwordHash: 'dummy_hash',
      }
    });
    managerIdByCenter[centerId] = manager.id;

    // 3 Staff
    const shiftRoles = [ShiftRole.CASHIER, ShiftRole.HOST, ShiftRole.TECH_SUPPORT];
    for (let j = 0; j < 3; j++) {
      const staff = await prisma.user.create({
        data: {
          gamingCenterId: centerId,
          fullName: `${pick(FIRST_NAMES_M)} ${pick(LAST_NAMES)}`,
          phone: `0912${randInt(2000000, 3999999)}`,
          role: UserRole.STAFF,
          isActive: true,
          passwordHash: 'dummy_hash',
        }
      });
      userIdsByCenter[centerId].push(staff.id);

      // Shifts for staff
      for (let day = 0; day < 7; day++) {
        await prisma.staffShift.create({
          data: {
            gamingCenterId: centerId,
            userId: staff.id,
            dayOfWeek: day,
            startTime: '10:00',
            endTime: '22:00',
            shiftRole: shiftRoles[j],
            isActive: true,
          }
        });
      }
    }
  }

  console.log('🖥️ Seeding Game Stations...');
  const stationsByCenter: Record<string, {id: string, hourlyPrice: number, name: string}[]> = {};
  for (const centerId of centerIds) {
    stationsByCenter[centerId] = [];
    const center = await prisma.gamingCenter.findUnique({ where: { id: centerId } });
    if (!center) continue;

    // Total 12 stations: 8 PC, 4 PS5
    for (let i = 0; i < 12; i++) {
      const isPc = i < 8;
      const stationIndex = isPc ? i + 1 : i - 7;
      const name = isPc ? `PC-${stationIndex}` : `PS5-${stationIndex}`;

      // 20% chance for VIP or specific indices to ensure ~20%
      const isVip = (i === 0 || i === 8); // PC-1 and PS5-1 as VIP

      const basePrice = center.hourlyRate;
      const vipPrice = center.vipHourlyRate || (basePrice * 1.3);

      const station = await prisma.gameStation.create({
        data: {
          gamingCenterId: centerId,
          name,
          stationType: isPc ? GameStationType.PC : GameStationType.PLAYSTATION,
          isVip,
          hourlyPrice: isVip ? vipPrice : basePrice,
          isActive: true,
        }
      });
      stationsByCenter[centerId].push({ id: station.id, hourlyPrice: station.hourlyPrice, name: station.name });
    }
  }

  console.log('👥 Seeding Customers...');
  const customerAccountIds: string[] = [];
  for (let i = 0; i < CONFIG.totalCustomers; i++) {
    const account = await prisma.customerAccount.create({
      data: {
        fullName: `${pick([...FIRST_NAMES_M, ...FIRST_NAMES_F])} ${pick(LAST_NAMES)}`,
        phone: `0912${randInt(7000000, 8999999)}`,
        walletBalance: randInt(0, 300000),
      }
    });
    customerAccountIds.push(account.id);

    // Profile in random center
    const centerId = pick(centerIds);
    await prisma.customerProfile.create({
      data: {
        gamingCenterId: centerId,
        customerAccountId: account.id,
        displayName: account.fullName,
      }
    });
  }

  console.log('📅 Seeding Reservations & Payments...');
  for (const centerId of centerIds) {
    const centerStations = stationsByCenter[centerId];
    const centerStaff = userIdsByCenter[centerId];
    const managerId = managerIdByCenter[centerId];
    const profiles = await prisma.customerProfile.findMany({ where: { gamingCenterId: centerId } });

    if (profiles.length === 0) continue;

    for (let i = 0; i < CONFIG.reservationsPerCenter; i++) {
      const profile = pick(profiles);
      const station = pick(centerStations);
      const staffId = pick(centerStaff);

      const startTime = new Date();
      startTime.setHours(randInt(10, 20), pick([0, 30]), 0, 0);
      startTime.setDate(startTime.getDate() + randInt(-7, 7));

      const hours = randInt(1, 3);
      const endTime = new Date(startTime.getTime() + hours * 3600000);
      const totalPrice = station.hourlyPrice * hours;

      const isPast = startTime < new Date();
      const status = isPast ? ReservationStatus.COMPLETED : ReservationStatus.CONFIRMED;

      const reservation = await prisma.reservation.create({
        data: {
          gamingCenterId: centerId,
          customerProfileId: profile.id,
          customerAccountId: profile.customerAccountId,
          stationId: station.id,
          staffId,
          createdByUserId: managerId,
          startTime,
          endTime,
          totalHours: hours,
          totalPrice,
          status,
          source: pick([ReservationSource.ONLINE, ReservationSource.WALK_IN]),
          stationSnapshot: { name: station.name, price: station.hourlyPrice },
          paymentState: isPast ? ReservationPaymentState.PAID : ReservationPaymentState.PENDING,
          completedAt: isPast ? endTime : null,
        }
      });

      if (isPast) {
        await prisma.gamingSession.create({
          data: {
            reservationId: reservation.id,
            stationId: station.id,
            startTime,
            endTime,
            actualHours: hours,
            status: GamingSessionStatus.COMPLETED,
          }
        });

        await prisma.payment.create({
          data: {
            gamingCenterId: centerId,
            reservationId: reservation.id,
            amount: Math.round(totalPrice),
            currency: 'IRT',
            method: PaymentMethod.CASH,
            status: PaymentStatus.PAID,
            paidAt: startTime,
          }
        });

        // Add a rating
        if (chance(0.5)) {
          await prisma.rating.create({
            data: {
              gamingCenterId: centerId,
              customerAccountId: profile.customerAccountId,
              reservationId: reservation.id,
              stationId: station.id,
              rating: randInt(4, 5),
              comment: 'سیستم‌ها عالی بودن',
            }
          });
        }

        // Earning for center
        const commissionAmount = Math.round(totalPrice * 0.05);
        await prisma.earning.create({
          data: {
            reservationId: reservation.id,
            gamingCenterId: centerId,
            baseAmount: Math.round(totalPrice),
            currency: 'IRT',
            type: CommissionType.PERCENT,
            percentBps: 500,
            commissionAmount,
            status: CommissionStatus.ACCRUED,
          }
        });
      }
    }
  }

  console.log('🏆 Seeding Tournaments...');
  for (const centerId of centerIds) {
    await prisma.tournament.create({
      data: {
        gamingCenterId: centerId,
        title: `مسابقات ${pick(POPULAR_GAMES)}`,
        gameName: pick(POPULAR_GAMES),
        startTime: new Date(Date.now() + 7 * 24 * 3600000),
        description: 'جایزه نفر اول: ۱ میلیون تومان اعتبار بازی',
        prizePool: '۵ میلیون تومان',
        maxParticipants: 32,
      }
    });
  }

  console.log('📄 Seeding Pages...');
  for (const centerId of centerIds) {
    await prisma.page.create({
      data: {
        gamingCenterId: centerId,
        slug: 'home',
        title: 'صفحه اصلی',
        type: PageType.HOME,
        status: PageStatus.PUBLISHED,
        sections: {
          create: [
            {
              type: PageSectionType.HERO,
              dataJson: JSON.stringify({ title: 'بهترین گیم‌سنتر تبریز', subtitle: 'رزرو آنلاین سیستم‌های گیمینگ' }),
              sortOrder: 0,
            },
            {
              type: PageSectionType.FAQ,
              dataJson: JSON.stringify({ questions: [{ q: 'رزرو آنلاین اجباری است؟', a: 'خیر، اختیاری است' }] }),
              sortOrder: 1,
            }
          ]
        }
      }
    });
  }

  console.log('✅ Professional Seed Updated & Completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
