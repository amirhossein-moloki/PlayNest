# راهنمای لایهٔ مشترک، قراردادهای محاسباتی و مرجع فنی Play-Nest Analytics (فاز ۱)

## ۱. خلاصه اجرایی و معماری لایهٔ مشترک

این سند به عنوان مرجع فنی اصلی و قرارداد یکپارچه برای توسعه‌دهندگان و عامل‌های هوشمند در فازهای ۲ تا ۵ تحلیل (Phase 2 to Phase 5) تهیه شده است. هدف اصلی این لایهٔ مشترک، ایجاد قراردادهای ثابت برای محاسبه KPI، فیلترهای استاندارد، مدیریت منطقه زمانی، دقت عددی مالی، رفتار دادهٔ ناقص، کنترل دسترسی تفکیک‌شدهٔ مستأجران (Tenant Isolation) و پایش کیفیت داده است تا فازهای دامنه‌ای بعدی بتوانند بدون بازطراحی یا تکرار کد به‌صورت موازی توسعه یابند.

### معماری پروژه و الگوی Clean Architecture
تمام سرویس‌ها و اندپوئینت‌های تحلیلی در زیرپوشه `sayra/src/modules/analytics/` قرار دارند و از الگوی Clean Architecture (Facade + Station/Repo Pattern) پیروی می‌کنند:
- **`analytics.routes.ts`**: ثبت مسیرها و اعمال میدل‌ورهای احراز هویت، تفکیک مستأجر و نقش‌ها (`authMiddleware`, `tenantGuard`, `requireRole`).
- **`analytics.validators.ts`**: اعتبارسنجی ورودی‌های Zod و تبدیل دقیق زمان/منطقه زمانی در تابع `resolveTimezoneAndBoundaries`.
- **`analytics.controller.ts`**: دریافت درخواست HTTP، فراخوانی Facade لایه دامنه (`AnalyticsStation`) و ارسال پاسخ با `res.ok()`.
- **`AnalyticsStation` (`analytics.station.ts`)**: منطق تجاری تحلیلی، محاسبه KPIها، تجمیع بنچ‌مارک‌ها و فرمول‌های مالی.
- **`AnalyticsRepo` (`analytics.repo.ts`)**: دسترسی مستقیم به داده‌ها از طریق Prisma ORM (شامل جداول اصلی OLTP و جداول Shadow).

---

## ۲. قرارداد مرکزی KPI / Metric Contract Standard

هر شاخص یا KPI جدید که در فازهای آینده اضافه می‌شود، باید الزامات ساختاری زیر را رعایت کند و در کاتالوگ شاخص‌ها مستند گردد:

| ویژگی قرارداد | توضیحات و الزامات |
|---|---|
| **`metricId`** | شناسهٔ یکتای شاخص (مثلاً `M-FIN-001`, `M-RES-002`, `M-STN-001`). |
| **`name`** | نام فارسی و نام فنی شاخص (مثلاً `ارزش رزروهای تکمیل‌شده` / `completed_booking_value`). |
| **`definition`** | تعریف دقیق تجاری شاخص و مرزهای شمول/عدم شمول. |
| **`unit`** | واحد سنجش (مبلغ صحیح Rial/IRT, درصد, تعداد, ساعت, دقیقه). |
| **`sourceTable`** | جدول یا موجودیت منبع داده (مثلاً `AnalyticsReservation`, `Payment`, `GamingSession`). |
| **`calculationFormula`** | فرمول ریاضی یا الگوریتم دقیق محاسبه بدون ابهام. |
| **`allowedFilters`** | فیلترهای مجاز (بازه زمانی, مرکز `gamingCenterId`, وضعیت, نوع ایستگاه, ارز). |
| **`aggregationLevel`** | سطح تجمیع (روزانه, هفتگی, ماهانه, یا کلی دوره). |
| **`timezonePolicy`** | سیاست منطقه زمانی (تبدیل به زمان محلی مرکز قبل از اعمال مرز شبانه‌روز). |
| **`includedStatuses`** | وضعیت‌های شامل/مستثنا شده (مثلاً فقط `COMPLETED` برای فروش، کسر `CANCELED`). |
| **`freshnessTarget`** | هدف تازگی داده (مثلاً زیر ۱۲۰ دقیقه بر اساس Watermark). |
| **`limitations`** | محدودیت‌ها و فرض‌های محاسبه (مثلاً عدم پیش‌بینی هوشمند یا عدم ثبت هزینه). |
| **`validationMethod`** | روش تست و اعتبارسنجی خودکار. |

---

## ۳. سیاست منطقه زمانی (Timezone Resolution & Boundaries)

۱. **ذخیره‌سازی در دیتابیس:** تمام زمان‌ها در دیتابیس PostgreSQL به‌صورت UTC نگهداری می‌شوند.
۲. **تبدیل زمان ورودی به مرز شبانه‌روز مرکز:** تابع `resolveTimezoneAndBoundaries` در `analytics.validators.ts` منطقه زمانی اختصاصی مرکز را از جدول `Settings` استخراج کرده (پیش‌فرض `'UTC'`) و ورودی تاریخ را به ابتدای روز (`00:00:00.000`) و انتهای روز (`23:59:59.999`) آن منطقه زمانی نگاشت می‌کند:

```typescript
export async function resolveTimezoneAndBoundaries(
  gamingCenterId: string,
  startDateInput: Date,
  endDateInput: Date
): Promise<{ timeZone: string; dayStart: Date; dayEnd: Date }> {
  const settings = await prisma.settings.findUnique({
    where: { gamingCenterId },
    select: { timeZone: true },
  });

  const timeZone = settings?.timeZone || 'UTC';

  const startStr = formatInTimeZone(startDateInput, timeZone, 'yyyy-MM-dd');
  const endStr = formatInTimeZone(endDateInput, timeZone, 'yyyy-MM-dd');

  const dayStart = fromZonedTime(`${startStr} 00:00:00`, timeZone);
  const dayEnd = fromZonedTime(`${endStr} 23:59:59.999`, timeZone);

  return { timeZone, dayStart, dayEnd };
}
```

۳. **پشتیبانی از ساعت تابستانی/زمستانی (DST):** استفاده از کتابخانه `date-fns-tz` تغییرات ساعت رسمی و تغییرات FSM/DST را به‌صورت نیتیو مدیریت می‌کند.
۴. **محدودیت بازه زمانی:** تمام طرح‌های اعتبارسنجی Analytics حداقل بازه ۳۰ روزه پیش‌فرض و حداکثر ۳۶۵ روز برای جلوگیری از کوئری‌های سنگین بدون اندیس را اعمال می‌کنند.

---

## ۴. واحد پول، دقت عددی و محاسبات مالی

۱. **ممنوعیت کامل Float برای مبالغ مالی:** هیچ مقدار Float برای نشان دادن مبالغ ریال یا تومان استفاده نمی‌شود.
۲. **واحد صحیح پولی (Minor Integer Units):** تمام محاسبات در واحد ریال (IRR) به عنوان عدد صحیح انجام می‌شوند.
۳. **توابع کمکی مبالغ در `sayra/src/common/utils/money.ts`:**
   - `toMinorUnits(amount)`: گرد کردن ایمن با `Math.round()` جهت جلوگیری از خطاهای اعشاری IEEE 754.
   - `calculateBasePrice(durationHours, hourlyPrice)`: محاسبه ضرب با گرد کردن مجزا.
   - `calculateDiscount(basePrice, value, valueType)`: محاسبه تخفیف درصدی و مقداری با محدودسازی بین ۰ و basePrice.
   - `calculateCommissionFromBps(amount, percentBps)`: محاسبه کمیسیون بر اساس Basis Points ($1\% = 100 \text{ BPS}$).
۴. **تک‌ارزی در کوئری‌های تجمیعی:** تجمیع مبالغ مالی بدون فیلتر ارز یا تبدیل نرخ مبادله ممنوع است.

---

## ۵. رفتار دادهٔ ناقص و حالت‌های داده (Data State Conventions)

برای جلوگیری از تعبیر اشتباه عدم وجود داده به جای عدد صفر، APIها و UI پاسخ‌ها را با حالت‌های صریح مشخص می‌کنند:

- **`FRESH`**: داده‌های تحلیلی به‌روز بوده و فاصله آخرین همگام‌سازی Ingestion کمتر از ۱۲۰ دقیقه است.
- **`STALE` / `LAGGING`**: پردازش افزایشی عقب افتاده یا Watermark بروز نشده است.
- **`NO_DATA`**: در بازهٔ زمانی انتخاب‌شده هیچ رکوردی وجود ندارد (مقادیر null به صفر نمایش داده نمی‌شوند مگر در میانگین‌های مشخص).
- **`INCOMPLETE`**: داده به‌دلیل عدم تکمیل چرخه رزرو یا عدم حضور مشتری هنوز کامل نشده است.
- **`DATA_COLLECTION_MISSING`**: داده‌ای که کلاً در دیتابیس/سخت‌افزار ثبت نمی‌شود (مانند هزینه برق/اجاره یا رویداد کلیک وب) به صراحت با پیغام متناسب مشخص می‌گردد.

---

## ۶. تفکیک مستأجران و امنیت سمت سرور (Server-Side Tenant Isolation)

۱. **اعتماد نکردن به `gamingCenterId` کلاینت:** شناسهٔ مرکز ارسال‌شده در پارامتر یا body کلاینت به‌تنهایی قابل اعتماد نیست.
۲. **اعمال `tenantGuard`:** میدل‌ور `tenantGuard` تطابق `actor.gamingCenterId` با `params.gamingCenterId` را بررسی می‌کند.
۳. **محافظت در برابر Enumeration ID (پاسخ HTTP 404):** در صورت تلاش برای دسترسی به شناسه یک مرکز دیگر، سیستم به جای ۴۰۳ جهت جلوگیری از اسکن شناسه‌ها، پاسخ **HTTP 404 Not Found** برمی‌گرداند.
۴. **نقش‌های مجاز:** مسیرهای تحلیلی فقط برای نقش‌های `MANAGER` و `ADMIN` مجاز است (`requireRole([UserRole.MANAGER, UserRole.ADMIN])`).

---

## ۷. راهنمای اجرای تست استاندارد برای فازهای بعدی

تمامی تغییرات در فازهای ۲ تا ۵ باید با اجرای تست‌های زیر تایید شوند:

```bash
# ۱. اجرای کل تست‌های واحد و یکپارچه‌سازی
cd sayra && npm test

# ۲. اعتبارسنجی OpenAPI قراردادهای REST API
cd sayra && npm run api:validate

# ۳. بررسی Linter بدون خطا
cd sayra && npm run lint
```

---
**ارزیابی وضعیت:** این سند لایه مشترک تحلیلی (فاز ۱) را تثبیت کرده و مرجع کامل فازهای آینده می‌باشد.
