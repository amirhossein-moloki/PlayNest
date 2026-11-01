import { PrismaClient, PageType, PageStatus, PageSectionType, RatingStatus, ExpenseCategory, ExpenseStatus } from '@prisma/client';
import { PRNG } from '../prng';
import { SeedCenterDefinition } from './centers';
import { SeededReservationInfo } from './reservations';

export async function seedTournamentsCmsAndRatings(
  prisma: PrismaClient,
  centers: { id: string; definition: SeedCenterDefinition }[],
  reservations: SeededReservationInfo[],
  prng: PRNG
) {
  for (const center of centers) {
    const isPast = prng.chance(0.4);
    const startsAt = isPast
      ? new Date(Date.now() - prng.randInt(5, 20) * 24 * 3600 * 1000)
      : new Date(Date.now() + prng.randInt(3, 12) * 24 * 3600 * 1000);

    const game = prng.pick(center.definition.games);

    await prisma.tournament.create({
      data: {
        gamingCenterId: center.id,
        title: `مسابقات قهرمانی ${game} جام زمستانه`,
        description: `تورنمنت رسمی گیمرهای تبریز در رشته ${game} با جوایز ارزنده نقدی و بن تخفیف بازی.`,
        gameName: game,
        startTime: startsAt,
        endTime: new Date(startsAt.getTime() + 8 * 3600 * 1000),
        prizePool: '۵,۰۰۰,۰۰۰ تومان',
        maxParticipants: 32,
      },
    });

    await prisma.gamingCenterExpense.create({
      data: {
        gamingCenterId: center.id,
        category: ExpenseCategory.INTERNET_COMMUNICATION,
        status: ExpenseStatus.APPROVED,
        amount: 3500000,
        currency: 'IRT',
        expenseDate: new Date(Date.now() - 15 * 24 * 3600 * 1000),
        description: 'اشتراک ماهیانه پهنای باند اختصاصی وایرلس گیمینگ',
      },
    });
    await prisma.gamingCenterExpense.create({
      data: {
        gamingCenterId: center.id,
        category: ExpenseCategory.ELECTRICITY_ENERGY,
        status: ExpenseStatus.APPROVED,
        amount: 2800000,
        currency: 'IRT',
        expenseDate: new Date(Date.now() - 10 * 24 * 3600 * 1000),
        description: 'قبوض برق دوره‌ای سیستم‌های پرمصرف',
      },
    });
  }

  for (const center of centers) {
    await prisma.page.create({
      data: {
        gamingCenterId: center.id,
        slug: 'home',
        fullPath: `/${center.definition.slug}/home`,
        title: `${center.definition.name} | صفحه اصلی و رزرو سیستم`,
        type: PageType.HOME,
        status: PageStatus.PUBLISHED,
        publishedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
        sections: {
          create: [
            {
              type: PageSectionType.HERO,
              dataJson: JSON.stringify({
                title: `بهترین تجربه گیمینگ در ${center.definition.name}`,
                subtitle: `دارای مدرن‌ترین سیستم‌های کامپیوتری و کنسول‌های PS5 در منطقه ${center.definition.district} تبریز`,
                ctaText: 'رزرو آنلاین سیستم',
                ctaLink: '/book',
              }),
              sortOrder: 0,
            },
            {
              type: PageSectionType.HIGHLIGHTS,
              dataJson: JSON.stringify({
                features: [
                  { title: 'اینترنت اختصاصی گیمینگ', desc: 'پینگ تک‌رقمی روی سرورهای داخلی و خاورمیانه' },
                  { title: 'کافی‌شاپ و اسنک‌بار', desc: 'انواع نوشیدنی‌های سرد و گرم و پذیرایی حین بازی' },
                  { title: 'اتاق‌های VIP و خصوصی', desc: 'مناسب برگزاری کلن‌وارها و دورهمی‌های دوستانه' },
                ],
              }),
              sortOrder: 1,
            },
            {
              type: PageSectionType.FAQ,
              dataJson: JSON.stringify({
                questions: [
                  { q: 'آیا برای ورود کارت شناسایی الزامی است؟', a: 'بله، برای اولین مراجعه همراه داشتن کارت ملی معتبر الزامی است.' },
                  { q: 'سیاست کنسلی رزرو به چه صورت است؟', a: 'تا ۲ ساعت پیش از شروع سانس بدون کسر جریمه کل وجه مسترد می‌شود.' },
                ],
              }),
              sortOrder: 2,
            },
          ],
        },
      },
    });
  }

  const completedReservations = reservations.filter((r) => r.status === 'COMPLETED');
  const sampled = prng.shuffle(completedReservations).slice(0, Math.floor(completedReservations.length * 0.45));

  for (const res of sampled) {
    const ratingScore = prng.pick([4, 5, 5, 5, 4, 3]);
    await prisma.rating.create({
      data: {
        gamingCenterId: res.gamingCenterId,
        customerAccountId: res.customerAccountId,
        reservationId: res.id,
        stationId: res.stationId,
        cleanlinessRating: prng.randInt(4, 5),
        equipmentRating: ratingScore,
        staffRating: prng.randInt(4, 5),
        priceValueRating: prng.randInt(3, 5),
        rating: ratingScore,
        comment: prng.pick([
          'سیستم‌ها خیلی تمیز و پرسرعت بودن، مخصوصاً مانیتورهای ۲۴۰ هرتز.',
          'برخورد پرسنل عالی بود و بدون معطلی سر وقت سیستم رو تحویل دادن.',
          'محیط دوستانه و خنک، پینگ روی کانتر عالی بود.',
          'دسته‌های PS5 کاملاً نو و سالم بودن، حتماً باز هم میام.',
          'کیفیت تجهیزات خوب بود، پیشنهاد می‌کنم منوی بوفه تنوع بیشتری داشته باشه.',
        ]),
        status: RatingStatus.PUBLISHED,
      },
    });
  }
}
