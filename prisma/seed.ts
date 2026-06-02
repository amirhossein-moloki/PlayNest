import {
  PrismaClient,
  Prisma,
  // Enums
  UserRole,
  BookingStatus,
  BookingSource,
  PaymentMethod,
  PaymentStatus,
  BookingPaymentState,
  ReviewTarget,
  ReviewStatus,
  CommissionType,
  CommissionStatus,
  CommissionPaymentMethod,
  CommissionPaymentStatus,
  PageStatus,
  PageType,
  PageSectionType,
  MediaType,
  MediaPurpose,
  LinkType,
  RobotsIndex,
  RobotsFollow,
  // NEW
  SessionActorType,
} from '@prisma/client';
import 'dotenv/config';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * -----------------------------
 * CONFIG — به راحتی شخصی‌سازی کن
 * -----------------------------
 */
const CONFIG = {
  gamingCentersCount: 10,
  totalUsers: 131,
  totalCustomers: 50,

  // پیشنهاد حرفه‌ای: هر سالن 20 سرویس داشته باشد (واقعی‌تر)
  servicesPerGamingCenter: true,
  servicesCount: 20,

  // دیتای عملیاتی سایت
  seedSessions: true,
  seedShifts: true,
  seedBookings: true,

  // اگر seedBookings=true:
  bookingsPerGamingCenter: 45, // ~450 booking کل
  maxAttemptsToAvoidOverlap: 25,

  tehranUtcOffsetMinutes: 210, // +03:30
};

type IranCity = {
  province: string;
  city: string;
  citySlug: string;     // برای URL/Slug
  areaCode: string;     // تلفن ثابت
  lat: string;
  lng: string;
  districts: string[];
};

const IRAN_CITIES: IranCity[] = [
  { province: 'تهران', city: 'تهران', citySlug: 'tehran', areaCode: '021', lat: '35.6892', lng: '51.3890', districts: ['ونک', 'پاسداران', 'صادقیه', 'تهرانپارس', 'یوسف‌آباد', 'زعفرانیه', 'جردن', 'نیاوران'] },
  { province: 'اصفهان', city: 'اصفهان', citySlug: 'isfahan', areaCode: '031', lat: '32.6539', lng: '51.6660', districts: ['چهارباغ', 'مرداویج', 'هشت‌بهشت', 'خانه اصفهان', 'نظر', 'جلفا'] },
  { province: 'خراسان رضوی', city: 'مشهد', citySlug: 'mashhad', areaCode: '051', lat: '36.2605', lng: '59.6168', districts: ['سجاد', 'قاسم‌آباد', 'احمدآباد', 'وکیل‌آباد', 'الهیه'] },
  { province: 'فارس', city: 'شیراز', citySlug: 'shiraz', areaCode: '071', lat: '29.5918', lng: '52.5837', districts: ['معالی‌آباد', 'قصرالدشت', 'ستارخان', 'فرهنگ‌شهر', 'چمران'] },
  { province: 'آذربایجان شرقی', city: 'تبریز', citySlug: 'tabriz', areaCode: '041', lat: '38.0962', lng: '46.2738', districts: ['ایل‌گلی', 'آبرسان', 'ولیعصر', 'منظریه'] },
  { province: 'البرز', city: 'کرج', citySlug: 'karaj', areaCode: '026', lat: '35.8400', lng: '50.9391', districts: ['گوهردشت', 'عظیمیه', 'مهرشهر', 'جهانشهر'] },
  { province: 'گیلان', city: 'رشت', citySlug: 'rasht', areaCode: '013', lat: '37.2809', lng: '49.5924', districts: ['گلسار', 'معلم', 'منظریه', 'سبزه‌میدان'] },
  { province: 'مازندران', city: 'ساری', citySlug: 'sari', areaCode: '011', lat: '36.5633', lng: '53.0601', districts: ['بلوار خزر', 'فرح‌آباد', 'کیلومتر ۶', 'سلمان فارسی'] },
  { province: 'کرمانشاه', city: 'کرمانشاه', citySlug: 'kermanshah', areaCode: '083', lat: '34.3142', lng: '47.0650', districts: ['شریعتی', 'فرهنگیان', '22 بهمن', 'مدرس'] },
  { province: 'خوزستان', city: 'اهواز', citySlug: 'ahvaz', areaCode: '061', lat: '31.3183', lng: '48.6706', districts: ['کیانپارس', 'امانیه', 'گلستان', 'زیتون'] },
];

const SALON_NAME_PREFIX = ['نگین', 'پرنیان', 'ماه‌رخ', 'الماس', 'زیبارخ', 'آرتمیس', 'روژان', 'کیمیا', 'سحر', 'نارسیس'];
const SALON_NAME_SUFFIX = ['بیوتی', 'مرکز زیبایی', 'سالن تخصصی', 'آرایشگاه تخصصی', 'اسپا', 'کلینیک زیبایی'];

const FIRST_NAMES_F = ['زهرا','فاطمه','مریم','نرگس','سارا','مینا','الهام','ریحانه','نازنین','سمیه','نگار','حدیث','پریسا','مهسا','رعنا','شیدا','کتایون','الهه','راضیه'];
const FIRST_NAMES_M = ['علی','محمد','رضا','امیر','حسین','مهدی','سعید','پویا','مصطفی','یاسر','حمید','نوید','محسن','حامد','سینا','یوسف','رامین','مسعود'];
const LAST_NAMES = ['محمدی','حسینی','احمدی','رضایی','کریمی','جعفری','قاسمی','موسوی','رحیمی','اکبری','مرادی','سلیمانی','هاشمی','یوسفی','صادقی','زارع','نعمتی','رستمی','نوری'];

const COMMENTS_POS = [
  'خیلی راضی بودم، برخورد پرسنل عالی و نتیجه دقیقاً همونی شد که می‌خواستم.',
  'محیط تمیز و حرفه‌ای بود. حتماً دوباره رزرو می‌کنم.',
  'کیفیت کار عالی، زمان‌بندی دقیق، پیشنهادهای خوب برای مراقبت بعدش هم دادند.',
];
const COMMENTS_MID = [
  'در کل خوب بود، فقط کمی تأخیر داشتند.',
  'کیفیت قابل قبول بود ولی انتظار داشتم کمی دقیق‌تر انجام شود.',
];
const CANCEL_REASONS = [
  'تداخل برنامه',
  'مشکل رفت‌وآمد',
  'تغییر زمان از طرف مشتری',
  'عدم امکان حضور',
];

const SERVICES_IRAN = [
  { name: 'کوتاهی مو زنانه', durationMinutes: 45, price: 250_000 },
  { name: 'براشینگ', durationMinutes: 45, price: 200_000 },
  { name: 'شینیون ساده', durationMinutes: 60, price: 450_000 },
  { name: 'شینیون حرفه‌ای', durationMinutes: 90, price: 900_000 },
  { name: 'رنگ ریشه', durationMinutes: 60, price: 650_000 },
  { name: 'رنگ کامل مو', durationMinutes: 120, price: 1_200_000 },
  { name: 'هایلایت / بالیاژ', durationMinutes: 180, price: 2_800_000 },
  { name: 'دکلره کامل', durationMinutes: 180, price: 3_200_000 },
  { name: 'کراتینه مو', durationMinutes: 180, price: 4_500_000 },
  { name: 'پروتئین‌تراپی مو', durationMinutes: 120, price: 2_200_000 },
  { name: 'پاکسازی پوست (فیشیال)', durationMinutes: 75, price: 750_000 },
  { name: 'میکروبلیدینگ ابرو', durationMinutes: 120, price: 2_900_000 },
  { name: 'لیفت و لمینت مژه', durationMinutes: 90, price: 1_200_000 },
  { name: 'اکستنشن مژه', durationMinutes: 120, price: 1_800_000 },
  { name: 'اصلاح ابرو', durationMinutes: 20, price: 120_000 },
  { name: 'وکس صورت', durationMinutes: 20, price: 150_000 },
  { name: 'مانیکور', durationMinutes: 45, price: 350_000 },
  { name: 'پدیکور', durationMinutes: 60, price: 450_000 },
  { name: 'کاشت ناخن', durationMinutes: 120, price: 1_500_000 },
  { name: 'ترمیم ناخن', durationMinutes: 90, price: 950_000 },
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
function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function slugifyLatin(input: string) {
  return input
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
function randomTokenHash() {
  // فقط برای seed — در محصول واقعی باید امن‌تر/واقعی‌تر باشد
  return crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
}
function passwordHashDummy() {
  // فقط برای seed (در سیستم واقعی bcrypt واقعی بزنید)
  return 'bcrypt$seed_dummy_hash';
}
function makeIranMobileUnique(counter: number) {
  // 09 + 9 رقم
  const prefixes = ['10','11','12','13','14','15','16','17','18','19','20','21','22','30','33','35','36','37','38','39'];
  const p = pick(prefixes);
  const body = String(counter).padStart(7, '0'); // 7 رقم
  return `09${p}${body}`.slice(0, 11);
}
function makeIranLandline(areaCode: string) {
  return `${areaCode}${randInt(10000000, 99999999)}`;
}

function tehranNow() {
  const offsetMs = CONFIG.tehranUtcOffsetMinutes * 60_000;
  return new Date(Date.now() + offsetMs);
}
function toTehranDate(dayOffset: number, hour: number, minute: number) {
  // تاریخ را بر اساس "تهران" تولید می‌کنیم و با offset +03:30 به Date تبدیل می‌کنیم
  const nowT = tehranNow();
  const base = new Date(Date.UTC(nowT.getUTCFullYear(), nowT.getUTCMonth(), nowT.getUTCDate()));
  base.setUTCDate(base.getUTCDate() + dayOffset);

  const yyyy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(base.getUTCDate()).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mi = String(minute).padStart(2, '0');

  const iso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:00+03:30`;
  return new Date(iso);
}
function tehranYMDKey(date: Date) {
  // برای کلید روز در تقویم کاری، تاریخ را با offset تهران می‌خوانیم
  const offsetMs = CONFIG.tehranUtcOffsetMinutes * 60_000;
  const d = new Date(date.getTime() + offsetMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function clearAll() {
  await prisma.phoneOtp.deleteMany();
  await prisma.commissionPayment.deleteMany();
  await prisma.bookingCommission.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();

  await prisma.userService.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.session.deleteMany();

  await prisma.gamingCenterPageSection.deleteMany();
  await prisma.gamingCenterPageSlugHistory.deleteMany();
  await prisma.gamingCenterPage.deleteMany();
  await prisma.gamingCenterMedia.deleteMany();
  await prisma.gamingCenterLink.deleteMany();
  await prisma.gamingCenterAddress.deleteMany();
  await prisma.gamingCenterSlugHistory.deleteMany();
  await prisma.gamingCenterSiteSettings.deleteMany();
  await prisma.gamingCenterCommissionPolicy.deleteMany();
  await prisma.settings.deleteMany();

  await prisma.gamingCenterCustomerProfile.deleteMany();
  await prisma.customerAccount.deleteMany();

  await prisma.user.deleteMany();
  await prisma.service.deleteMany();
  await prisma.gamingCenter.deleteMany();
}

function buildStructuredDataLocalBusiness(gamingCenterName: string, city: IranCity, slug: string) {
  // JSON-LD مناسب SEO / LocalBusiness
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'BeautyGamingCenter',
    name: gamingCenterName,
    areaServed: city.city,
    address: {
      '@type': 'PostalAddress',
      addressRegion: city.province,
      addressLocality: city.city,
      addressCountry: 'IR',
    },
    url: `https://example.com/${slug}`,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: city.lat,
      longitude: city.lng,
    },
  };
  return JSON.stringify(obj);
}

async function main() {
  console.log('🧹 پاکسازی دیتای قبلی...');
  await clearAll();

  /**
   * -----------------
   * 1) SALONS + SITE
   * -----------------
   */
  console.log('🏢 ساخت سالن‌ها + تنظیمات سایت/SEO ...');
  const gamingCenters: {
    id: string;
    name: string;
    slug: string;
    city: IranCity;
    allowOnlineBooking: boolean;
    onlineBookingAutoConfirm: boolean;
    commissionPercentBps: number;
    commissionMinFee: number;
  }[] = [];

  for (let i = 0; i < CONFIG.gamingCentersCount; i++) {
    const city = IRAN_CITIES[i % IRAN_CITIES.length];
    const prefix = SALON_NAME_PREFIX[i % SALON_NAME_PREFIX.length];
    const suffix = SALON_NAME_SUFFIX[i % SALON_NAME_SUFFIX.length];
    const gamingCenterName = `سالن زیبایی ${prefix} ${suffix} ${city.city}`;
    const slug = `gamingCenter-${city.citySlug}-${i + 1}`;

    const allowOnlineBooking = i % 2 === 0;
    const onlineBookingAutoConfirm = i % 3 === 0;

    const commissionPercentBps = 250; // 2.5%
    const commissionMinFee = 10_000;

    const created = await prisma.gamingCenter.create({
      data: {
        name: gamingCenterName,
        slug,
        description: `ارائه خدمات تخصصی مو، پوست و ناخن در ${city.city}.`,
        seoTitle: `${gamingCenterName} | رزرو آنلاین`,
        seoDescription: `رزرو آنلاین و حضوری خدمات زیبایی در ${city.city}.`,

        settings: {
          create: {
            preventOverlaps: true,
            timeZone: 'Asia/Tehran',
            workStartTime: '09:00',
            workEndTime: '20:00',
            allowOnlineBooking,
            onlineBookingAutoConfirm,
          },
        },

        siteSettings: {
          create: {
            logoUrl: `https://picsum.photos/seed/${slug}-logo/400/400`,
            faviconUrl: `https://picsum.photos/seed/${slug}-fav/128/128`,
            defaultSeoTitle: `${gamingCenterName} | وبسایت رسمی`,
            defaultSeoDescription: `خدمات آرایشی و زیبایی در ${city.city}`,
            defaultOgImageUrl: `https://picsum.photos/seed/${slug}-og/1200/630`,
            googleSiteVerification: `ir-${i}-${randInt(10000, 99999)}`,
            analyticsTag: `G-IR${randInt(100000, 999999)}`,
            robotsIndex: RobotsIndex.INDEX,
            robotsFollow: RobotsFollow.FOLLOW,
          },
        },

        commissionPolicy: {
          create: {
            type: CommissionType.PERCENT,
            percentBps: commissionPercentBps,
            applyToOnlineOnly: true,
            minimumFeeAmount: commissionMinFee,
            isActive: true,
          },
        },

        addresses: {
          create: [
            {
              title: 'شعبه اصلی',
              province: city.province,
              city: city.city,
              district: pick(city.districts),
              addressLine: `خیابان ${pick(city.districts)}، پلاک ${randInt(1, 200)}، واحد ${randInt(1, 20)}`,
              postalCode: String(randInt(1000000000, 9999999999)),
              lat: new Prisma.Decimal(city.lat),
              lng: new Prisma.Decimal(city.lng),
              isPrimary: true,
            },
          ],
        },

        links: {
          create: [
            { type: LinkType.INSTAGRAM, label: 'اینستاگرام', value: `https://instagram.com/${slugifyLatin(gamingCenterName.replace(/\s+/g, '_'))}`, isPrimary: true, isActive: true },
            { type: LinkType.WHATSAPP, label: 'واتساپ', value: makeIranMobileUnique(9_000_000 + i), isPrimary: false, isActive: true },
            { type: LinkType.PHONE, label: 'تماس', value: makeIranLandline(city.areaCode), isPrimary: false, isActive: true },
            { type: LinkType.GOOGLE_MAP, label: 'لوکیشن', value: `https://maps.google.com/?q=${city.lat},${city.lng}`, isPrimary: false, isActive: true },
            { type: LinkType.WEBSITE, label: 'وبسایت', value: `https://example.com/${slug}`, isPrimary: false, isActive: true },
          ],
        },

        media: {
          create: [
            { type: MediaType.IMAGE, purpose: MediaPurpose.LOGO, url: `https://picsum.photos/seed/${slug}-logo2/800/800`, altText: `لوگو ${gamingCenterName}`, category: 'سالن', caption: 'لوگو رسمی', sortOrder: 0, isActive: true },
            { type: MediaType.IMAGE, purpose: MediaPurpose.COVER, url: `https://picsum.photos/seed/${slug}-cover/1600/800`, altText: `کاور ${gamingCenterName}`, category: 'سالن', caption: 'تصویر کاور', sortOrder: 1, isActive: true },
            { type: MediaType.IMAGE, purpose: MediaPurpose.GALLERY, url: `https://picsum.photos/seed/${slug}-gal-1/1200/900`, altText: 'محیط سالن', category: 'سالن', caption: 'فضای داخلی', sortOrder: 2, isActive: true },
            { type: MediaType.IMAGE, purpose: MediaPurpose.BEFORE_AFTER, url: `https://picsum.photos/seed/${slug}-ba-1/1200/900`, altText: 'قبل و بعد خدمات مو', category: 'مو', caption: 'نمونه قبل/بعد', sortOrder: 3, isActive: true },
            { type: MediaType.IMAGE, purpose: MediaPurpose.GALLERY, url: `https://picsum.photos/seed/${slug}-gal-2/1200/900`, altText: 'نمونه کار ناخن', category: 'ناخن', caption: 'نمونه طراحی', sortOrder: 4, isActive: true },
          ],
        },
      },
    });

    // Slug history (برای تست 301)
    await prisma.gamingCenterSlugHistory.create({
      data: {
        gamingCenterId: created.id,
        oldSlug: `${created.slug}-old`,
      },
    });

    // صفحات سایت: HOME/ABOUT/SERVICES/GALLERY/TEAM/CONTACT + یک صفحه DRAFT
    const commonSections = {
      hero: (title: string) => ({
        type: PageSectionType.HERO,
        dataJson: JSON.stringify({
          headline: title,
          subheadline: `رزرو آنلاین و حضوری در ${city.city}`,
          primaryCta: { label: 'رزرو نوبت', url: '/booking' },
          secondaryCta: { label: 'دیدن خدمات', url: '/services' },
          backgroundImageUrl: `https://picsum.photos/seed/${slug}-hero/1600/900`,
        }),
        sortOrder: 0,
        isEnabled: true,
      }),
      highlights: () => ({
        type: PageSectionType.HIGHLIGHTS,
        dataJson: JSON.stringify({
          title: 'چرا ما؟',
          items: [
            { title: 'محیط بهداشتی', text: 'ضدعفونی منظم ابزار و رعایت کامل پروتکل‌ها' },
            { title: 'پرسنل حرفه‌ای', text: 'متخصصین با تجربه در مو، پوست و ناخن' },
            { title: 'رزرو آسان', text: 'رزرو آنلاین/حضوری با مدیریت زمان' },
          ],
        }),
        sortOrder: 1,
        isEnabled: true,
      }),
      servicesGrid: () => ({
        type: PageSectionType.SERVICES_GRID,
        dataJson: JSON.stringify({ title: 'خدمات پرطرفدار', showPrices: true, maxItems: 12 }),
        sortOrder: 2,
        isEnabled: true,
      }),
      galleryGrid: () => ({
        type: PageSectionType.GALLERY_GRID,
        dataJson: JSON.stringify({ title: 'گالری نمونه کار', categories: ['مو', 'ناخن', 'پوست', 'سالن'], limit: 12 }),
        sortOrder: 3,
        isEnabled: true,
      }),
      testimonials: () => ({
        type: PageSectionType.TESTIMONIALS,
        dataJson: JSON.stringify({ title: 'نظرات مشتریان', limit: 6 }),
        sortOrder: 4,
        isEnabled: true,
      }),
      faq: () => ({
        type: PageSectionType.FAQ,
        dataJson: JSON.stringify({
          title: 'سوالات پرتکرار',
          items: [
            { q: 'برای رزرو آنلاین نیاز به پرداخت است؟', a: 'بسته به سرویس، ممکن است بیعانه فعال باشد.' },
            { q: 'چطور زمان رزرو را تغییر دهم؟', a: 'از طریق تماس با پذیرش یا پنل رزرو (در صورت فعال بودن) اقدام کنید.' },
          ],
        }),
        sortOrder: 5,
        isEnabled: true,
      }),
      cta: () => ({
        type: PageSectionType.CTA,
        dataJson: JSON.stringify({
          title: 'برای تغییر استایل آماده‌اید؟',
          text: 'همین الان نوبت خود را رزرو کنید.',
          buttonLabel: 'رزرو نوبت',
          buttonUrl: '/booking',
        }),
        sortOrder: 6,
        isEnabled: true,
      }),
      contactCard: () => ({
        type: PageSectionType.CONTACT_CARD,
        dataJson: JSON.stringify({
          title: 'اطلاعات تماس',
          city: city.city,
          workHours: '09:00 تا 20:00',
        }),
        sortOrder: 0,
        isEnabled: true,
      }),
      map: () => ({
        type: PageSectionType.MAP,
        dataJson: JSON.stringify({ lat: city.lat, lng: city.lng, zoom: 14 }),
        sortOrder: 1,
        isEnabled: true,
      }),
      richTextAbout: () => ({
        type: PageSectionType.RICH_TEXT,
        dataJson: JSON.stringify({
          title: 'درباره ما',
          blocks: [
            { type: 'paragraph', text: `ما در ${city.city} با تمرکز بر کیفیت، بهداشت و تجربه مشتری فعالیت می‌کنیم.` },
            { type: 'paragraph', text: 'تیم ما با جدیدترین متدها و مواد باکیفیت آماده ارائه خدمات است.' },
          ],
        }),
        sortOrder: 0,
        isEnabled: true,
      }),
      staffGrid: () => ({
        type: PageSectionType.STAFF_GRID,
        dataJson: JSON.stringify({ title: 'تیم ما', showRoles: true, showBio: true }),
        sortOrder: 0,
        isEnabled: true,
      }),
    };

    const pagesToCreate = [
      {
        slug: 'home',
        title: 'صفحه اصلی',
        type: PageType.HOME,
        status: PageStatus.PUBLISHED,
        publishedAt: new Date(),
        seoTitle: `${gamingCenterName} | صفحه اصلی`,
        seoDescription: `رزرو خدمات زیبایی در ${city.city}`,
        structuredDataJson: buildStructuredDataLocalBusiness(gamingCenterName, city, slug),
        sections: {
          create: [
            commonSections.hero(gamingCenterName),
            commonSections.highlights(),
            commonSections.servicesGrid(),
            commonSections.galleryGrid(),
            commonSections.testimonials(),
            commonSections.cta(),
          ],
        },
      },
      {
        slug: 'about',
        title: 'درباره ما',
        type: PageType.ABOUT,
        status: PageStatus.PUBLISHED,
        publishedAt: new Date(),
        seoTitle: `${gamingCenterName} | درباره ما`,
        sections: { create: [commonSections.richTextAbout(), commonSections.highlights(), commonSections.faq()] },
      },
      {
        slug: 'services',
        title: 'خدمات',
        type: PageType.SERVICES,
        status: PageStatus.PUBLISHED,
        publishedAt: new Date(),
        seoTitle: `${gamingCenterName} | خدمات`,
        sections: { create: [commonSections.servicesGrid(), commonSections.faq(), commonSections.cta()] },
      },
      {
        slug: 'gallery',
        title: 'گالری',
        type: PageType.GALLERY,
        status: PageStatus.PUBLISHED,
        publishedAt: new Date(),
        sections: { create: [commonSections.galleryGrid()] },
      },
      {
        slug: 'team',
        title: 'تیم ما',
        type: PageType.TEAM,
        status: PageStatus.PUBLISHED,
        publishedAt: new Date(),
        sections: { create: [commonSections.staffGrid()] },
      },
      {
        slug: 'contact',
        title: 'تماس با ما',
        type: PageType.CONTACT,
        status: PageStatus.PUBLISHED,
        publishedAt: new Date(),
        sections: { create: [commonSections.contactCard(), commonSections.map()] },
      },
      {
        slug: 'rules',
        title: 'قوانین و مقررات',
        type: PageType.CUSTOM,
        status: PageStatus.DRAFT,
        seoTitle: `${gamingCenterName} | قوانین`,
        robotsIndex: RobotsIndex.NOINDEX,
        robotsFollow: RobotsFollow.NOFOLLOW,
        sections: {
          create: [
            {
              type: PageSectionType.RICH_TEXT,
              dataJson: JSON.stringify({
                title: 'قوانین',
                blocks: [
                  { type: 'paragraph', text: 'لطفاً در صورت لغو نوبت، حداقل ۳ ساعت قبل اطلاع دهید.' },
                  { type: 'paragraph', text: 'در برخی خدمات ممکن است بیعانه دریافت شود.' },
                ],
              }),
              sortOrder: 0,
              isEnabled: true,
            },
          ],
        },
      },
    ];

    for (const p of pagesToCreate) {
      const page = await prisma.gamingCenterPage.create({
        data: {
          gamingCenterId: created.id,
          ...p,
        } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      // page slug history
      await prisma.gamingCenterPageSlugHistory.create({
        data: {
          pageId: page.id,
          oldSlug: `${page.slug}-old`,
        },
      });
    }

    gamingCenters.push({
      id: created.id,
      name: gamingCenterName,
      slug,
      city,
      allowOnlineBooking,
      onlineBookingAutoConfirm,
      commissionPercentBps,
      commissionMinFee,
    });
  }

  /**
   * ----------------
   * 2) SERVICES
   * ----------------
   */
  console.log('🧴 ساخت سرویس‌ها (ایران‌محور) ...');
  if (CONFIG.servicesPerGamingCenter) {
    for (const s of gamingCenters) {
      await prisma.service.createMany({
        data: SERVICES_IRAN.slice(0, CONFIG.servicesCount).map((svc) => ({
          gamingCenterId: s.id,
          name: svc.name,
          durationMinutes: svc.durationMinutes,
          price: svc.price,
          currency: 'IRT', // تومان
          isActive: true,
        })),
      });
    }
  } else {
    for (let i = 0; i < CONFIG.servicesCount; i++) {
      const gamingCenter = gamingCenters[i % gamingCenters.length];
      const svc = SERVICES_IRAN[i];
      await prisma.service.create({
        data: {
          gamingCenterId: gamingCenter.id,
          name: svc.name,
          durationMinutes: svc.durationMinutes,
          price: svc.price,
          currency: 'IRT',
          isActive: true,
        },
      });
    }
  }

  /**
   * ----------------
   * 3) USERS (131)
   * ----------------
   */
  console.log('👤 ساخت کاربران پنل (131) ...');
  const users: {
    id: string;
    gamingCenterId: string;
    role: UserRole;
    isActive: boolean;
  }[] = [];

  // توزیع دقیق و تمیز:
  // هر سالن: 1 مدیر + 2 پذیرش = 30
  // باقی (101) پرسنل -> 10 تا برای هر سالن (100) + 1 اضافه برای سالن اول
  const staffCountsPerGamingCenter = gamingCenters.map((_, idx) => (idx === 0 ? 11 : 10)); // جمع 101

  let phoneCounter = 1_000_000;

  for (let i = 0; i < gamingCenters.length; i++) {
    const gamingCenter = gamingCenters[i];

    // MANAGER
    {
      const fullName = `${pick(FIRST_NAMES_M)} ${pick(LAST_NAMES)}`;
      const manager = await prisma.user.create({
        data: {
          gamingCenterId: gamingCenter.id,
          fullName,
          phone: makeIranMobileUnique(phoneCounter++),
          passwordHash: passwordHashDummy(),
          phoneVerifiedAt: new Date(),
          role: UserRole.MANAGER,
          isActive: true,
          isPublic: true,
          publicName: fullName,
          bio: 'مدیر سالن | هماهنگی تیم و کنترل کیفیت خدمات',
          avatarUrl: `https://picsum.photos/seed/${gamingCenter.slug}-manager/320/320`,
        },
      });
      users.push({ id: manager.id, gamingCenterId: gamingCenter.id, role: manager.role, isActive: manager.isActive });

      if (CONFIG.seedSessions) {
        await prisma.session.create({
          data: {
            actorType: SessionActorType.USER,
            actorId: manager.id,
            tokenHash: randomTokenHash(),
            expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
            revokedAt: null,
          },
        });
      }
    }

    // 2 RECEPTIONIST
    for (let r = 0; r < 2; r++) {
      const fullName = `${pick(FIRST_NAMES_F)} ${pick(LAST_NAMES)}`;
      const receptionist = await prisma.user.create({
        data: {
          gamingCenterId: gamingCenter.id,
          fullName,
          phone: makeIranMobileUnique(phoneCounter++),
          passwordHash: passwordHashDummy(),
          phoneVerifiedAt: new Date(),
          role: UserRole.RECEPTIONIST,
          isActive: true,
          isPublic: false,
        },
      });
      users.push({ id: receptionist.id, gamingCenterId: gamingCenter.id, role: receptionist.role, isActive: receptionist.isActive });

      if (CONFIG.seedSessions && chance(0.7)) {
        await prisma.session.create({
          data: {
            actorType: SessionActorType.USER,
            actorId: receptionist.id,
            tokenHash: randomTokenHash(),
            expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
            revokedAt: chance(0.1) ? new Date() : null,
          },
        });
      }
    }

    // STAFF
    const staffCount = staffCountsPerGamingCenter[i];
    for (let sIdx = 0; sIdx < staffCount; sIdx++) {
      const fullName = `${pick([...FIRST_NAMES_F, ...FIRST_NAMES_M])} ${pick(LAST_NAMES)}`;
      const isActive = chance(0.92);
      const isPublic = isActive && chance(0.65);

      const staff = await prisma.user.create({
        data: {
          gamingCenterId: gamingCenter.id,
          fullName,
          phone: makeIranMobileUnique(phoneCounter++),
          passwordHash: passwordHashDummy(),
          phoneVerifiedAt: new Date(),
          role: UserRole.STAFF,
          isActive,
          isPublic,
          publicName: isPublic ? fullName : null,
          bio: isPublic ? 'متخصص خدمات زیبایی | مشاوره و اجرای خدمات مطابق سلیقه مشتری' : null,
          avatarUrl: isPublic ? `https://picsum.photos/seed/${gamingCenter.slug}-staff-${sIdx}/320/320` : null,
        },
      });

      users.push({ id: staff.id, gamingCenterId: gamingCenter.id, role: staff.role, isActive: staff.isActive });

      if (CONFIG.seedSessions && chance(0.25)) {
        await prisma.session.create({
          data: {
            actorType: SessionActorType.USER,
            actorId: staff.id,
            tokenHash: randomTokenHash(),
            expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
            revokedAt: chance(0.2) ? new Date() : null,
          },
        });
      }
    }
  }

  /**
   * ----------------
   * 4) SHIFTS
   * ----------------
   */
  if (CONFIG.seedShifts) {
    console.log('🗓️ ساخت شیفت‌ها (واقعی و قابل تست زمان‌بندی) ...');
    const activeWorkingUsers = users.filter((u) => u.isActive && (u.role === UserRole.STAFF || u.role === UserRole.RECEPTIONIST));

    // 6 روز کاری (شنبه تا پنجشنبه) — dayOfWeek را 0..5 فرض می‌کنیم
    for (const u of activeWorkingUsers) {
      for (let dayOfWeek = 0; dayOfWeek <= 5; dayOfWeek++) {
        const start = chance(0.2) ? '10:00' : '09:00';
        const end = chance(0.2) ? '19:00' : '20:00';

        await prisma.shift.create({
          data: {
            gamingCenterId: u.gamingCenterId,
            userId: u.id,
            dayOfWeek,
            startTime: start,
            endTime: end,
            isActive: true,
          },
        });
      }
    }
  }

  /**
   * ----------------
   * 5) USER SERVICES
   * ----------------
   */
  console.log('🧩 اتصال مهارت پرسنل به سرویس‌ها (با پوشش کامل هر سرویس) ...');
  for (const gamingCenter of gamingCenters) {
    const gamingCenterServices = await prisma.service.findMany({ where: { gamingCenterId: gamingCenter.id } });
    const gamingCenterStaff = users.filter((u) => u.gamingCenterId === gamingCenter.id && u.role === UserRole.STAFF && u.isActive);

    // اگر سالن خیلی کم staff داشته باشد (نباید اتفاق بیفتد)، رد می‌کنیم
    if (gamingCenterStaff.length === 0) continue;

    const userServicesData: { userId: string; serviceId: string }[] = [];

    // 1) تضمین: هر سرویس حداقل 2 نفر متخصص داشته باشد
    for (const svc of gamingCenterServices) {
      const specialistsCount = Math.min(2 + (chance(0.35) ? 1 : 0), gamingCenterStaff.length);
      const chosen = shuffle(gamingCenterStaff).slice(0, specialistsCount);
      for (const st of chosen) {
        userServicesData.push({ userId: st.id, serviceId: svc.id });
      }
    }

    // 2) برای هر staff چند سرویس اضافه (واقعی‌تر)
    for (const st of gamingCenterStaff) {
      const extraCount = randInt(4, Math.min(10, gamingCenterServices.length));
      const chosen = shuffle(gamingCenterServices).slice(0, extraCount);
      for (const svc of chosen) {
        userServicesData.push({ userId: st.id, serviceId: svc.id });
      }
    }

    await prisma.userService.createMany({
      data: userServicesData,
      skipDuplicates: true,
    });
  }

  /**
   * ----------------
   * 6) CUSTOMERS + PROFILES
   * ----------------
   */
  console.log('👥 ساخت مشتری‌ها (50) + CRM پروفایل‌ها ...');
  const customers: { id: string; phone: string; fullName: string }[] = [];
  const profileMap = new Map<string, string>(); // key: gamingCenterId:customerAccountId -> profileId

  for (let i = 0; i < CONFIG.totalCustomers; i++) {
    const fullName = `${pick([...FIRST_NAMES_F, ...FIRST_NAMES_M])} ${pick(LAST_NAMES)}`;
    const phone = makeIranMobileUnique(7_000_000 + i);

    const ca = await prisma.customerAccount.create({
      data: { phone, fullName, phoneVerifiedAt: new Date() },
    });
    customers.push({ id: ca.id, phone, fullName });

    // 1 تا 3 پروفایل بین سالن‌ها
    const profilesCount = chance(0.7) ? 1 : chance(0.85) ? 2 : 3;
    const chosenGamingCenters = shuffle(gamingCenters).slice(0, profilesCount);

    for (const s of chosenGamingCenters) {
      const prof = await prisma.gamingCenterCustomerProfile.create({
        data: {
          gamingCenterId: s.id,
          customerAccountId: ca.id,
          displayName: fullName,
          note: chance(0.25) ? 'مشتری وفادار | ترجیحاً صبح‌ها' : null,
        },
      });
      profileMap.set(`${s.id}:${ca.id}`, prof.id);
    }
  }

  /**
   * ----------------
   * 7) BOOKINGS + PAYMENTS + REVIEWS + COMMISSION
   * ----------------
   */
  if (CONFIG.seedBookings) {
    console.log('📌 ساخت Booking/Payment/Review/Commission ...');

    // برای جلوگیری از همپوشانی (واقع‌گرایانه‌تر)
    const staffCalendar = new Map<string, { startMs: number; endMs: number }[]>(); // key: staffId:YYYY-MM-DD

    for (const gamingCenter of gamingCenters) {
      const gamingCenterServices = await prisma.service.findMany({ where: { gamingCenterId: gamingCenter.id, isActive: true } });
      const gamingCenterStaff = users.filter((u) => u.gamingCenterId === gamingCenter.id && u.role === UserRole.STAFF && u.isActive);
      const gamingCenterReceptionists = users.filter((u) => u.gamingCenterId === gamingCenter.id && u.role !== UserRole.STAFF && u.isActive);
      const manager = users.find((u) => u.gamingCenterId === gamingCenter.id && u.role === UserRole.MANAGER);

      if (gamingCenterServices.length === 0 || gamingCenterStaff.length === 0 || !manager) continue;

      // Map سرویس -> staffهای قابل اجرا
      const userServices = await prisma.userService.findMany({
        where: { userId: { in: gamingCenterStaff.map((x) => x.id) }, serviceId: { in: gamingCenterServices.map((x) => x.id) } },
      });
      const staffByService = new Map<string, string[]>();
      for (const us of userServices) {
        const arr = staffByService.get(us.serviceId) ?? [];
        arr.push(us.userId);
        staffByService.set(us.serviceId, arr);
      }

      for (let i = 0; i < CONFIG.bookingsPerGamingCenter; i++) {
        // مشتری رندوم
        const customer = pick(customers);

        // اگر پروفایل این مشتری در این سالن وجود نداشت، بساز
        let profileId = profileMap.get(`${gamingCenter.id}:${customer.id}`);
        if (!profileId) {
          const prof = await prisma.gamingCenterCustomerProfile.create({
            data: {
              gamingCenterId: gamingCenter.id,
              customerAccountId: customer.id,
              displayName: customer.fullName,
              note: chance(0.15) ? 'ثبت خودکار پروفایل از اولین رزرو' : null,
            },
          });
          profileId = prof.id;
          profileMap.set(`${gamingCenter.id}:${customer.id}`, prof.id);
        }

        // سرویس
        const service = pick(gamingCenterServices);

        // staff مناسب سرویس
        const possibleStaff = staffByService.get(service.id) ?? [];
        const staffId = (possibleStaff.length > 0 ? pick(possibleStaff) : pick(gamingCenterStaff).id);

        // زمان رزرو (از 90 روز قبل تا 14 روز آینده)
        const dayOffset = randInt(-90, +14);
        let startAt: Date | null = null;

        // انتخاب زمان با تلاش برای جلوگیری از overlap
        for (let attempt = 0; attempt < CONFIG.maxAttemptsToAvoidOverlap; attempt++) {
          const hour = randInt(9, 19);
          const minute = pick([0, 15, 30, 45]);
          const candidate = toTehranDate(dayOffset, hour, minute);

          // تنظیم که سرویس از 20:00 رد نشود
          const endCandidate = new Date(candidate.getTime() + service.durationMinutes * 60_000);
          const tehranKey = tehranYMDKey(candidate);
          const key = `${staffId}:${tehranKey}`;
          const intervals = staffCalendar.get(key) ?? [];

          const overlaps = intervals.some((x) => candidate.getTime() < x.endMs && endCandidate.getTime() > x.startMs);
          if (!overlaps) {
            startAt = candidate;
            intervals.push({ startMs: candidate.getTime(), endMs: endCandidate.getTime() });
            staffCalendar.set(key, intervals);
            break;
          }
        }

        // اگر نتوانستیم بدون overlap پیدا کنیم، همان اولی را می‌گذاریم
        if (!startAt) startAt = toTehranDate(dayOffset, 11, 0);

        const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);

        // تعیین past/future
        const nowT = tehranNow();
        const isPast = endAt.getTime() < nowT.getTime() - 60 * 60_000; // 1 ساعت قبل

        // تعیین source
        const source =
          gamingCenter.allowOnlineBooking && chance(0.35) ? BookingSource.ONLINE : BookingSource.IN_PERSON;

        // تعیین status
        let status: BookingStatus;
        if (isPast) {
          status = chance(0.80) ? BookingStatus.DONE : chance(0.25) ? BookingStatus.CANCELED : BookingStatus.NO_SHOW;
        } else {
          // آینده
          if (source === BookingSource.ONLINE && !gamingCenter.onlineBookingAutoConfirm && chance(0.35)) status = BookingStatus.PENDING;
          else status = BookingStatus.CONFIRMED;
        }

        // createdBy
        const createdByUserId =
          source === BookingSource.ONLINE ? manager.id : pick(gamingCenterReceptionists).id;

        // Snapshot fields
        const amountDue = service.price;

        // Payment plan
        type PayPlan = { amount: number; method: PaymentMethod; status: PaymentStatus; paidAt: Date | null; referenceCode?: string | null };
        const paymentsPlan: PayPlan[] = [];

        let paymentState: BookingPaymentState = BookingPaymentState.UNPAID;

        if (status === BookingStatus.DONE) {
          const method =
            source === BookingSource.ONLINE ? PaymentMethod.ONLINE : chance(0.55) ? PaymentMethod.CARD : PaymentMethod.CASH;

          // 90% کامل پرداخت
          if (chance(0.90)) {
            paymentsPlan.push({
              amount: amountDue,
              method,
              status: PaymentStatus.PAID,
              paidAt: new Date(endAt.getTime() - randInt(0, 20) * 60_000),
              referenceCode: method === PaymentMethod.ONLINE ? `TRX-${randInt(100000, 999999)}` : null,
            });
            paymentState = BookingPaymentState.PAID;
          } else {
            // partial
            const paid = Math.round(amountDue * 0.5);
            paymentsPlan.push({
              amount: paid,
              method,
              status: PaymentStatus.PAID,
              paidAt: new Date(endAt.getTime() - randInt(0, 20) * 60_000),
              referenceCode: null,
            });
            paymentState = BookingPaymentState.PARTIALLY_PAID;
          }

          // خیلی کم overpaid (مثلاً انعام یا اشتباه)
          if (chance(0.02)) {
            paymentsPlan.push({
              amount: 50_000,
              method: PaymentMethod.CASH,
              status: PaymentStatus.PAID,
              paidAt: new Date(endAt.getTime()),
              referenceCode: null,
            });
            paymentState = BookingPaymentState.OVERPAID;
          }
        }

        if (status === BookingStatus.CONFIRMED || status === BookingStatus.PENDING) {
          // آینده: ممکن است بیعانه داشته باشد
          if (source === BookingSource.ONLINE && chance(0.25)) {
            const deposit = Math.round(amountDue * 0.3);
            paymentsPlan.push({
              amount: deposit,
              method: PaymentMethod.ONLINE,
              status: status === BookingStatus.PENDING ? PaymentStatus.PENDING : PaymentStatus.PAID,
              paidAt: status === BookingStatus.PENDING ? null : new Date(startAt.getTime() - 2 * 60 * 60_000),
              referenceCode: `TRX-${randInt(100000, 999999)}`,
            });
            paymentState = status === BookingStatus.PENDING ? BookingPaymentState.UNPAID : BookingPaymentState.PARTIALLY_PAID;
          }
        }

        // canceled / no_show
        let canceledAt: Date | null = null;
        let cancelReason: string | null = null;
        let canceledByUserId: string | null = null;

        let completedAt: Date | null = null;
        let noShowAt: Date | null = null;

        if (status === BookingStatus.CANCELED) {
          canceledAt = new Date(startAt.getTime() - randInt(10, 240) * 60_000);
          cancelReason = pick(CANCEL_REASONS);
          canceledByUserId = pick(gamingCenterReceptionists).id;

          // اگر پرداخت داشتیم، ریفاند هم بسازیم
          if (paymentsPlan.length > 0 && paymentsPlan.some((p) => p.status === PaymentStatus.PAID)) {
            const paidSum = paymentsPlan
              .filter((p) => p.status === PaymentStatus.PAID)
              .reduce((acc, x) => acc + x.amount, 0);

            paymentsPlan.push({
              amount: paidSum,
              method: PaymentMethod.ONLINE,
              status: PaymentStatus.REFUNDED,
              paidAt: new Date(canceledAt.getTime() + randInt(5, 60) * 60_000),
              referenceCode: `RF-${randInt(100000, 999999)}`,
            });
            paymentState = BookingPaymentState.REFUNDED;
          } else {
            paymentState = BookingPaymentState.UNPAID;
          }
        }

        if (status === BookingStatus.DONE) {
          completedAt = new Date(endAt.getTime() + randInt(5, 20) * 60_000);
        }

        if (status === BookingStatus.NO_SHOW) {
          noShowAt = new Date(startAt.getTime() + randInt(5, 20) * 60_000);
          // ممکن است بیعانه سوخت شود
          if (source === BookingSource.ONLINE && chance(0.12)) {
            const deposit = Math.round(amountDue * 0.25);
            paymentsPlan.push({
              amount: deposit,
              method: PaymentMethod.ONLINE,
              status: PaymentStatus.PAID,
              paidAt: new Date(startAt.getTime() - 3 * 60 * 60_000),
              referenceCode: `TRX-${randInt(100000, 999999)}`,
            });
            paymentState = BookingPaymentState.PARTIALLY_PAID;
          }
        }

        const booking = await prisma.booking.create({
          data: {
            gamingCenterId: gamingCenter.id,
            customerProfileId: profileId!,
            customerAccountId: customer.id,
            serviceId: service.id,
            staffId,
            createdByUserId,

            startAt,
            endAt,

            serviceNameSnapshot: service.name,
            serviceDurationSnapshot: service.durationMinutes,
            servicePriceSnapshot: service.price,
            currencySnapshot: service.currency,

            amountDueSnapshot: amountDue,
            paymentState,

            status,
            source,
            note: chance(0.15) ? 'در صورت نیاز به مشاوره، قبل از شروع خدمات اطلاع دهید.' : null,

            canceledAt,
            cancelReason,
            canceledByUserId,

            completedAt,
            noShowAt,
          },
        });

        // payments
        for (const p of paymentsPlan) {
          await prisma.payment.create({
            data: {
              gamingCenterId: gamingCenter.id,
              bookingId: booking.id,
              amount: p.amount,
              currency: 'IRT',
              status: p.status,
              method: p.method,
              paidAt: p.paidAt,
              referenceCode: p.referenceCode ?? null,
            },
          });
        }

        // reviews (برای DONE، با احتمال)
        if (status === BookingStatus.DONE && chance(0.35)) {
          const rating = chance(0.75) ? randInt(4, 5) : randInt(3, 4);
          const comment =
            rating >= 4 ? pick(COMMENTS_POS) : pick(COMMENTS_MID);

          // SALON review (یکی)
          await prisma.review.create({
            data: {
              gamingCenterId: gamingCenter.id,
              customerAccountId: customer.id,
              bookingId: booking.id,
              target: ReviewTarget.SALON,
              serviceId: null,
              rating,
              comment,
              status: ReviewStatus.PUBLISHED,
            },
          });

          // SERVICE review (گاهی)
          if (chance(0.55)) {
            await prisma.review.create({
              data: {
                gamingCenterId: gamingCenter.id,
                customerAccountId: customer.id,
                bookingId: booking.id,
                target: ReviewTarget.SERVICE,
                serviceId: service.id,
                rating: rating,
                comment: chance(0.7) ? 'کیفیت سرویس عالی بود.' : 'در کل خوب بود.',
                status: ReviewStatus.PUBLISHED,
              },
            });
          }
        }

        // commission (فقط آنلاین و طبق policy)
        if (source === BookingSource.ONLINE) {
          // فقط برای DONE یا بعضی CONFIRMED ها (برای تست)
          if (status === BookingStatus.DONE || (status === BookingStatus.CONFIRMED && chance(0.2))) {
            const baseAmount = amountDue;

            // PERCENT: commission = base * bps / 10000
            let commissionAmount = Math.round((baseAmount * gamingCenter.commissionPercentBps) / 10000);
            if (commissionAmount < gamingCenter.commissionMinFee) commissionAmount = gamingCenter.commissionMinFee;

            const commissionStatus =
              status === BookingStatus.DONE
                ? (chance(0.55) ? CommissionStatus.CHARGED : CommissionStatus.ACCRUED)
                : CommissionStatus.PENDING;

            const commission = await prisma.bookingCommission.create({
              data: {
                bookingId: booking.id,
                gamingCenterId: gamingCenter.id,
                status: commissionStatus,
                baseAmount,
                currency: 'IRT',

                type: CommissionType.PERCENT,
                percentBps: gamingCenter.commissionPercentBps,
                fixedAmount: null,

                commissionAmount,
                calculatedAt: new Date(),
                chargedAt: commissionStatus === CommissionStatus.CHARGED ? new Date() : null,
                note: commissionStatus === CommissionStatus.CHARGED ? 'کسر کارمزد بابت رزرو آنلاین' : null,
              },
            });

            // اگر CHARGED بود، پرداخت کارمزد هم ثبت کن
            if (commissionStatus === CommissionStatus.CHARGED) {
              await prisma.commissionPayment.create({
                data: {
                  commissionId: commission.id,
                  amount: commissionAmount,
                  currency: 'IRT',
                  status: CommissionPaymentStatus.PAID,
                  method: CommissionPaymentMethod.TRANSFER,
                  paidAt: new Date(),
                  referenceCode: `CMP-${randInt(100000, 999999)}`,
                },
              });
            }
          }

          // اگر کنسل شد، کارمزد را WAIVED (برای تست وضعیت)
          if (status === BookingStatus.CANCELED && chance(0.4)) {
            const baseAmount = amountDue;
            let commissionAmount = Math.round((baseAmount * gamingCenter.commissionPercentBps) / 10000);
            if (commissionAmount < gamingCenter.commissionMinFee) commissionAmount = gamingCenter.commissionMinFee;

            await prisma.bookingCommission.create({
              data: {
                bookingId: booking.id,
                gamingCenterId: gamingCenter.id,
                status: CommissionStatus.WAIVED,
                baseAmount,
                currency: 'IRT',
                type: CommissionType.PERCENT,
                percentBps: gamingCenter.commissionPercentBps,
                fixedAmount: null,
                commissionAmount,
                calculatedAt: new Date(),
                chargedAt: null,
                note: 'لغو رزرو — کارمزد لحاظ نشد',
              },
            });
          }
        }
      } // end bookings loop
    } // end gamingCenter loop
  }

  console.log('✅ Seed حرفه‌ای و کامل ایران‌محور انجام شد.');
  console.log(`GamingCenters: ${gamingCenters.length}`);
  console.log(`Users: ${users.length}`);
  console.log(`Customers: ${customers.length}`);
  console.log(`Services: ${CONFIG.servicesPerGamingCenter ? gamingCenters.length * CONFIG.servicesCount : CONFIG.servicesCount}`);
  if (CONFIG.seedBookings) console.log(`Bookings: ~${CONFIG.gamingCentersCount * CONFIG.bookingsPerGamingCenter}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
