import { PrismaClient, CommissionType, RobotsIndex, RobotsFollow, LinkType } from '@prisma/client';
import { SEED_CONFIG } from '../config';

export interface SeedCenterDefinition {
  sourceRecordId: string;
  name: string;
  nameLatin: string;
  slug: string;
  city: string;
  province: string;
  district: string;
  addressLine: string;
  lat: number;
  lng: number;
  publicPhone: string;
  instagram?: string;
  openingTime: string;
  closingTime: string;
  hourlyRate: number;
  vipHourlyRate: number;
  hasFoodService: boolean;
  games: string[];
  archetype: keyof typeof SEED_CONFIG.archetypes;
}

export const RAW_10_CENTERS: SeedCenterDefinition[] = [
  {
    sourceRecordId: 'TBZ-001',
    name: 'گیم نت ریمچ',
    nameLatin: 'Rematch Game Net',
    slug: 'rematch-game-net',
    city: 'تبریز',
    province: 'آذربایجان شرقی',
    district: 'زعفرانیه',
    addressLine: 'تبریز، زعفرانیه، خیابان میرداماد، نبش کوچه یاس',
    lat: 38.0485,
    lng: 46.3321,
    publicPhone: '04133312001',
    instagram: '@rematch_gamenet',
    openingTime: '10:00',
    closingTime: '23:30',
    hourlyRate: 85000,
    vipHourlyRate: 130000,
    hasFoodService: true,
    games: ['Counter-Strike 2', 'FC 25', 'Mortal Kombat 1', 'Valorant'],
    archetype: 'FLAGSHIP',
  },
  {
    sourceRecordId: 'TBZ-002',
    name: 'کافه گیم آدرنالین',
    nameLatin: 'Adrenaline Cafe Game',
    slug: 'adrenaline-cafe-game',
    city: 'تبریز',
    province: 'آذربایجان شرقی',
    district: 'ائل‌گلی',
    addressLine: 'تبریز، ائل‌گلی، بلوار گلستان، پلاک ۴۲',
    lat: 38.0260,
    lng: 46.3685,
    publicPhone: '04133854120',
    instagram: '@adrenaline_cafe_game',
    openingTime: '09:30',
    closingTime: '23:59',
    hourlyRate: 95000,
    vipHourlyRate: 155000,
    hasFoodService: true,
    games: ['FC 25', 'Tekken 8', 'Forza Horizon 5', 'Cyberpunk 2077'],
    archetype: 'VIP_LOUNGE',
  },
  {
    sourceRecordId: 'TBZ-004',
    name: 'مرکز ورزش الکترونیک تایتان',
    nameLatin: 'Titan Esports Arena',
    slug: 'titan-esports-arena',
    city: 'تبریز',
    province: 'آذربایجان شرقی',
    district: 'آبرسان',
    addressLine: 'تبریز، چهارراه آبرسان، پاساژ نگین، طبقه منفی ۱',
    lat: 38.0664,
    lng: 46.3190,
    publicPhone: '04133348899',
    instagram: '@titan_esports_tbz',
    openingTime: '09:00',
    closingTime: '23:00',
    hourlyRate: 80000,
    vipHourlyRate: 120000,
    hasFoodService: true,
    games: ['Dota 2', 'Counter-Strike 2', 'Apex Legends', 'Valorant'],
    archetype: 'ESPORTS',
  },
  {
    sourceRecordId: 'TBZ-006',
    name: 'گیم سنتر نکسوس',
    nameLatin: 'Nexus Gaming Center',
    slug: 'nexus-gaming-center',
    city: 'تبریز',
    province: 'آذربایجان شرقی',
    district: 'ولیعصر',
    addressLine: 'تبریز، کوی ولیعصر، خیابان استانداری، پلاک ۱۵',
    lat: 38.0722,
    lng: 46.3533,
    publicPhone: '04133301144',
    instagram: '@nexus_center_tbz',
    openingTime: '10:00',
    closingTime: '23:00',
    hourlyRate: 90000,
    vipHourlyRate: 140000,
    hasFoodService: true,
    games: ['FC 25', 'Spider-Man 2', 'God of War Ragnarök', 'Mortal Kombat 1'],
    archetype: 'FLAGSHIP',
  },
  {
    sourceRecordId: 'TBZ-009',
    name: 'کلوپ گیم اوریجین',
    nameLatin: 'Origin Game Club',
    slug: 'origin-game-club',
    city: 'تبریز',
    province: 'آذربایجان شرقی',
    district: 'منظریه',
    addressLine: 'تبریز، منظریه، میدان منظریه، ابتدای خیابان شاهد',
    lat: 38.0410,
    lng: 46.3025,
    publicPhone: '04134785210',
    instagram: '@origin_club',
    openingTime: '11:00',
    closingTime: '22:30',
    hourlyRate: 60000,
    vipHourlyRate: 85000,
    hasFoodService: false,
    games: ['Counter-Strike 2', 'FC 25', 'Call of Duty: Warzone'],
    archetype: 'COMMUNITY',
  },
  {
    sourceRecordId: 'TBZ-031',
    name: 'پلی‌روم آرکادیا',
    nameLatin: 'Arcadia Playroom',
    slug: 'arcadia-playroom',
    city: 'تبریز',
    province: 'آذربایجان شرقی',
    district: 'کوچه‌باغ',
    addressLine: 'تبریز، خیابان قره‌آغاج، روبروی مسجد طالقانی',
    lat: 38.0825,
    lng: 46.2730,
    publicPhone: '04132801456',
    instagram: '@arcadia_tbz',
    openingTime: '10:00',
    closingTime: '22:00',
    hourlyRate: 50000,
    vipHourlyRate: 75000,
    hasFoodService: false,
    games: ['FC 25', 'eFootball 2025', 'Mortal Kombat 1'],
    archetype: 'COMMUNITY',
  },
  {
    sourceRecordId: 'TBZ-034',
    name: 'کافه بازی سایبرپانک',
    nameLatin: 'Cyberpunk Game Lounge',
    slug: 'cyberpunk-game-lounge',
    city: 'تبریز',
    province: 'آذربایجان شرقی',
    district: 'شریعتی جنوبی',
    addressLine: 'تبریز، خیابان شریعتی جنوبی (شهناز)، مجتمع کریستال',
    lat: 38.0670,
    lng: 46.2915,
    publicPhone: '04135567890',
    instagram: '@cyberpunk_lounge',
    openingTime: '10:00',
    closingTime: '23:59',
    hourlyRate: 85000,
    vipHourlyRate: 135000,
    hasFoodService: true,
    games: ['Cyberpunk 2077', 'Counter-Strike 2', 'FC 25', 'Elden Ring'],
    archetype: 'STUDENT_HUB',
  },
  {
    sourceRecordId: 'TBZ-043',
    name: 'گیم نت شتاب',
    nameLatin: 'Shetab Game Net',
    slug: 'shetab-game-net',
    city: 'تبریز',
    province: 'آذربایجان شرقی',
    district: 'مرزداران',
    addressLine: 'تبریز، شهرک مرزداران، خیابان ستارخان، نبش نسیم ۲',
    lat: 38.0690,
    lng: 46.3880,
    publicPhone: '04136371234',
    instagram: '@shetab_gaming',
    openingTime: '11:00',
    closingTime: '23:00',
    hourlyRate: 65000,
    vipHourlyRate: 95000,
    hasFoodService: false,
    games: ['Counter-Strike 2', 'Dota 2', 'FC 25'],
    archetype: 'NEWLY_OPENED',
  },
  {
    sourceRecordId: 'TBZ-063',
    name: 'آرنا گیم زون',
    nameLatin: 'Arena Game Zone',
    slug: 'arena-game-zone',
    city: 'تبریز',
    province: 'آذربایجان شرقی',
    district: 'دانشگاه',
    addressLine: 'تبریز، بلوار ۲۹ بهمن، روبروی دانشگاه تبریز',
    lat: 38.0580,
    lng: 46.3390,
    publicPhone: '04133398877',
    instagram: '@arena_zone_tabriz',
    openingTime: '08:30',
    closingTime: '23:00',
    hourlyRate: 70000,
    vipHourlyRate: 105000,
    hasFoodService: true,
    games: ['Dota 2', 'League of Legends', 'Counter-Strike 2', 'FC 25'],
    archetype: 'STUDENT_HUB',
  },
  {
    sourceRecordId: 'TBZ-076',
    name: 'گیم سنتر کهکشان',
    nameLatin: 'Galaxy Gaming Center',
    slug: 'galaxy-gaming-center',
    city: 'تبریز',
    province: 'آذربایجان شرقی',
    district: 'رشدیه',
    addressLine: 'تبریز، شهرک رشدیه، بلوار بهارستان، جنب مرکز تجاری رشدیه',
    lat: 38.0935,
    lng: 46.3570,
    publicPhone: '04136689001',
    instagram: '@galaxy_gaming_tbz',
    openingTime: '10:00',
    closingTime: '23:30',
    hourlyRate: 90000,
    vipHourlyRate: 145000,
    hasFoodService: true,
    games: ['FC 25', 'Forza Horizon 5', 'Tekken 8', 'Grand Theft Auto V'],
    archetype: 'VIP_LOUNGE',
  },
];

export async function seedGamingCenters(prisma: PrismaClient) {
  const createdCenters: { id: string; definition: SeedCenterDefinition }[] = [];

  for (const def of RAW_10_CENTERS) {
    const center = await prisma.gamingCenter.create({
      data: {
        name: def.name,
        slug: def.slug,
        isActive: true,
        description: `مجهزترین و مدرن‌ترین مرکز بازی در منطقه ${def.district} تبریز با سیستم‌های پیشرفته، محیطی حرفه‌ای و اینترنت پرسرعت گیمینگ.`,
        openingTime: def.openingTime,
        closingTime: def.closingTime,
        hourlyRate: def.hourlyRate,
        vipHourlyRate: def.vipHourlyRate,
        pcCount: def.archetype === 'VIP_LOUNGE' ? 3 : 10,
        consoleCount: def.archetype === 'VIP_LOUNGE' ? 5 : 4,
        hasFoodService: def.hasFoodService,
        games: def.games,
        settings: {
          create: {
            preventOverlaps: true,
            allowOnlineBooking: true,
            onlineBookingAutoConfirm: false,
            requireOtpForPublicBooking: true,
            maxAdvanceBookingDays: 14,
            cancellationHours: 2,
            minAdvanceBookingMinutes: 15,
            autoReleaseUnpaidMinutes: 15,
          },
        },
        siteSettings: {
          create: {
            defaultSeoTitle: `${def.name} | رزرو آنلاین سیستم و کنسول گیمینگ`,
            defaultSeoDescription: `رزرو آنلاین سیستم‌های PC و کنسول‌های PS5 در ${def.name} واقع در ${def.district} تبریز`,
            robotsIndex: RobotsIndex.INDEX,
            robotsFollow: RobotsFollow.FOLLOW,
          },
        },
        commissionPolicy: {
          create: {
            type: CommissionType.PERCENT,
            percentBps: 500, // 5% platform commission
            isActive: true,
          },
        },
        addresses: {
          create: {
            city: def.city,
            province: def.province,
            district: def.district,
            addressLine: def.addressLine,
            lat: def.lat,
            lng: def.lng,
            isPrimary: true,
          },
        },
        links: {
          create: [
            ...(def.instagram
              ? [
                {
                  type: LinkType.INSTAGRAM,
                  label: 'اینستاگرام',
                  value: def.instagram,
                },
              ]
              : []),
            {
              type: LinkType.PHONE,
              label: 'تلفن تماس',
              value: def.publicPhone,
            },
          ],
        },
      },
    });

    createdCenters.push({ id: center.id, definition: def });
  }

  return createdCenters;
}
