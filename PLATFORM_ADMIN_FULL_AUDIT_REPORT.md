# گزارش جامع ممیزی بک‌اند، دیتابیس، APIها و فرانت‌اند پنل مدیریت پلتفرم سایرا (Saira / PlayNest)
**سند ارزیابی فنی، امنیتی، داده‌ای و اتصال ۱۰۰٪ به APIهای واقعی**
**تاریخ گزارش:** نوامبر ۲۰۲۶
**وضعیت پروژه:** بررسی کامل بدون تغییر کد (Audit Only)

---

## ۱. خلاصه‌ی مدیریتی (Executive Summary)

این ممیزی جامع با هدف ارزیابی وضعیت واقعی ۱۰ ماژول کلیدی پنل مدیریت مرکزی پلتفرم سایرا (PlayNest Platform Admin Console)، اتصال به پایگاه داده و APIهای عملیاتی، شناسایی Mock Data، اعتبارسنجی انطباق OpenAPI و تحلیل آسیب‌پذیری‌های امنیتی انجام شده است.

### آمار کلی وضعیت قابلیت‌های بررسی‌شده:
- **تعداد کل ماژول‌ها و دامنه‌های اصلی بررسی‌شده:** ۱۰ ماژول اصلی (Dashboard, Users, Gaming Centers, Reservations, Owner Verification, Advertisements, Campaigns, Settings, Blog, Analytics).
- **تعداد کل قابلیت‌ها و جریان‌های کاری ارزیابی‌شده:** ۵۴ زیرقابلیت / عملیات.
- **تعداد قابلیت‌های کامل و متصل به دیتابیس واقعی (COMPLETE):** ۳۴ قابلیت (۶۳٪).
- **تعداد قابلیت‌های ناقص یا نیازمند گسترش (PARTIAL):** ۱۴ قابلیت (۲۶٪).
- **تعداد قابلیت‌های پیاده‌سازی‌نشده (MISSING):** ۶ قابلیت (۱۱٪).
- **وضعیت Mock Data در کدهای بک‌اند/فرانت‌اند اصلی:** لایه بک‌اند و داشبوردهای عملیاتی SSR و AdminJS از داده‌های زنده دیتابیس استفاده می‌کنند؛ با این وجود، پکیج MSW در مسیر `sayra/src/mocks/` شامل موک‌های تیکت، رزرو و آنالیتیکس برای تست‌های کلاینت یا توسعه اولیه بوده و در داشبورد SSR نیز مواردی از Fallback یا مقادیر Hardcoded در تعاملات کلاینت شناسایی شد.
- **وضعیت تطابق با OpenAPI (`openapi.yaml`):** اندپوینت‌های اختصاصی تبلیغات (`/platform-admin/ad-requests`)، احراز هویت مالکین (`/platform-admin/verifications`) و جزییات کاربر (`/platform-admin/users/:id`) در فایل OpenAPI ثبت نشده‌اند؛ هرچند برخی از آنها در بک‌اند پیاده‌سازی شده و تست پاس کرده‌اند.

---

## ۲. جدول ماتریس وضعیت ماژول‌ها (Status Table)

| Module | Frontend | Backend | Database | OpenAPI | Tests | Mock Data | Final Status |
|---|---|---|---|---|---|---|---|
| **1. Dashboard** | PARTIAL | COMPLETE | COMPLETE | COMPLETE | COMPLETE | PARTIAL (SSR Token Prompt / MSW in repo) | **PARTIAL** |
| **2. Users** | PARTIAL | COMPLETE | COMPLETE | PARTIAL | COMPLETE | NONE in core API | **PARTIAL** |
| **3. Gaming Centers** | PARTIAL | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NONE in core API | **COMPLETE** |
| **4. Reservations** | MISSING (Platform UI) | PARTIAL (Tenant Only) | COMPLETE | PARTIAL | COMPLETE | MOCK in MSW handlers | **PARTIAL** |
| **5. Owner Verification** | MISSING (Dedicated UI) | COMPLETE (`/verifications`) | COMPLETE | MISSING | COMPLETE | NONE in core API | **PARTIAL** |
| **6. Advertisements** | MISSING (Dedicated UI) | COMPLETE (`/ad-requests`) | COMPLETE | MISSING | COMPLETE | NONE in core API | **COMPLETE** (Backend) / **PARTIAL** (Docs) |
| **7. Campaigns** | MISSING (Dedicated UI) | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NONE in core API | **COMPLETE** (Backend) |
| **8. Settings** | MISSING (Dedicated UI) | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NONE in core API | **COMPLETE** (Backend) |
| **9. Blog** | PARTIAL (AdminJS / CMS UI) | PARTIAL (Tenant Scoped) | COMPLETE | COMPLETE | COMPLETE | NONE in core API | **PARTIAL** |
| **10. Analytics** | PARTIAL (SSR / AdminJS) | COMPLETE (`/analytics/reports`) | COMPLETE | COMPLETE | COMPLETE | MOCK in MSW handlers | **COMPLETE** (Backend) |

---

## ۳. بررسی تفصیلی ماژول‌های ده‌گانه (Module Deep Dive)

### ۳.۱. داشبورد (Dashboard)
- **بررسی فرانت‌اند و SSR:**
  - داشبورد AdminJS در مسیر `sayra/src/platform-admin/dashboard/dashboard.component.tsx` پیاده‌سازی شده و مستقیماً متد `DashboardService.getPlatformMetrics()` را صدا می‌زند.
  - قالب HTML اختصاصی داشبورد سوپریوزر در مسیر `sayra/src/modules/platform-admin/platform-admin-ui.templates.ts` پیاده شده که از کلاینت به اندپوینت‌های `/api/v1/platform-admin/operations/overview` و `/financials/overview` و `/gaming-centers` با هدر احراز هویت متصل می‌شود.
- **ارتباط دیتابیس:**
  - سرویس `DashboardService` با کوئری‌های زنده `prisma.gamingCenter.count()`, `prisma.user.count()`, `prisma.reservation.count({ where: { status } })`, `prisma.payment.aggregate()` و `prisma.auditLog.findMany()` داده‌ها را از PostgreSQL استخراج می‌کند. هیچ داده Mock در خروجی این سرویس وجود ندارد.
- **نقایص و موارد ناقص:**
  - در تمپلیت SSR در صورت منقضی بودن یا عدم ارسال توکن، از تابع جاوااسکریپتی کلاینت `prompt('Please enter your PLATFORM_ADMIN Bearer Token:')` استفاده می‌شود که رویکرد استاندارد Session/Cookie یا ریدایرکت فرم لاگین را رعایت نمی‌کند.

### ۳.۲. مدیریت کاربران (Users)
- **مسیرها و اندپوینت‌ها:**
  - `GET /api/v1/platform-admin/users` (پیاده‌سازی‌شده با جستجو بر اساس نام/تلفن، فیلتر `role`، `isActive`، `gamingCenterId` و صفحه‌بندی Pagination).
  - `POST /api/v1/platform-admin/users` (ایجاد کاربر با اعتبارسنجی، هش رمز عبور با Argon2 و ثبت لاگ آودیت).
  - `PATCH /api/v1/platform-admin/users/:id` (ویرایش اطلاعات کاربر با اعتبارسنجی یکتایی ایمیل و شماره تماس).
  - `DELETE /api/v1/platform-admin/users/:id` (حذف هوشمند: در صورت داشتن وابستگی‌های مالی/رزرو، کاربر Soft Delete و غیرفعال می‌شود؛ در غیر این صورت Hard Delete).
  - `PATCH /api/v1/platform-admin/users/:id/status` (تغییر وضعیت فعال/غیرفعال).
  - `POST /api/v1/platform-admin/users/:id/reset-password` (تغییر و ریست پسورد توسط پلتفرم ادمین).
  - `POST /api/v1/platform-admin/users/:id/revoke-sessions` (ابطال سشن‌های کاربر در ردیس و کش توکن).
- **نقایص:**
  - اندپوینت اختصاصی `GET /api/v1/platform-admin/users/:id` برای دریافت جزییات یک کاربر به صورت تک‌منظوره پیاده‌سازی نشده است (جزییات صرفاً از طریق فیلتر لیست یا درون AdminJS در دسترس است).
  - در `openapi.yaml` متدهای `POST /platform-admin/users` و `PATCH /platform-admin/users/{id}` و `DELETE /platform-admin/users/{id}` به طور ناقص یا فاقد جزییات کامل بدنه درخواست تعریف شده‌اند.

### ۳.۳. مدیریت گیمنت‌ها (Gaming Centers)
- **مسیرها و اندپوینت‌ها:**
  - `GET /api/v1/platform-admin/gaming-centers` (دریافت لیست تجمیعی به همراه مالک اصلی و آدرس اولیه، تعداد استیشن‌ها و کاربران).
  - `GET /api/v1/platform-admin/gaming-centers/:id` (دریافت جزئیات کامل مرکز).
  - `PATCH /api/v1/platform-admin/gaming-centers/:id` (ویرایش اطلاعات گیمنت، نام، اسلاگ، بازی‌ها، وضعیت اشتراک).
  - `PATCH /api/v1/platform-admin/gaming-centers/:id/status` (تغییر وضعیت `isActive` و `subscriptionStatus`).
- **تحلیل اتصال به دیتابیس:**
  - مدل `GamingCenter` به طور کامل متصل است و عملیات با روابط `addresses` و `users` کوئری زده می‌شود.
- **نقایص:**
  - در لیست گیمنت‌ها در `platform-admin.station.ts`، امتیاز کاربران (`rating`) و وضعیت اشتراک جزئی (`subscriptionDetails`) تجمیع آماری نشده و صرفاً فیلد `subscriptionStatus` برگشت داده می‌شود.

### ۳.۴. مدیریت رزروهای پلتفرم (Reservations)
- **مسیر مورد انتظار:**
  - `GET /platform-admin/reservations`
- **وضعیت در کد:**
  - **MISSING در سطح Platform Admin API اختصاصی.**
  - در حال حاضر روت‌های رزرو در مسیر `/api/v1/gamingCenters/:gamingCenterId/reservation` مستقر هستند. اگرچه `tenantGuard` به کاربر دارای نقش `PLATFORM_ADMIN` اجازه دسترسی به روت‌های اختصاصی گیمنت را می‌دهد، اما هیچ اندپوینت تجمیعی برای دریافت تمام رزروهای کل گیمنت‌های کشور با فیلتر شهر، گیمنت، مشتری، بازه زمانی و وضعیت رزرو در روت‌های `/platform-admin/...` وجود ندارد.
  - تنها در AdminJS (مدل `Reservation` به صورت Read-Only) امکان مشاهده لیست کلی وجود دارد.

### ۳.۵. احراز هویت مالکین (Owner Verification / KYC)
- **مسیرها و اندپوینت‌ها:**
  - مسیر پیاده‌سازی‌شده در کدهای بک‌اند:
    - `GET /api/v1/platform-admin/verifications`
    - `GET /api/v1/platform-admin/verifications/:id`
    - `POST /api/v1/platform-admin/verifications/:id/approve`
    - `POST /api/v1/platform-admin/verifications/:id/reject`
- **بررسی دیتابیس:**
  - مدل `GamingCenterVerification` و رابطه با `PlatformAdmin` (فیلد `reviewerAdminId`) و فیلدهای `nationalCardUrl`, `idWithSelfieUrl`, `businessLicenseUrl` در مایگریشن `20261215000000_add_onboarding_and_kyc` ثبت و موجود است.
- **تفاوت با صورت مسئله:**
  - در صورت مسئله اندپوینت‌ها به صورت `/platform-admin/owner-verifications` و متد `PATCH .../status` بیان شده بود، در حالی که در کد به صورت `/platform-admin/verifications` با دو متد مجزای `approve` و `reject` طراحی شده است.
  - این اندپوینت‌ها در فایل `openapi.yaml` تعریف نشده‌اند.

### ۳.۶. مدیریت تبلیغات (Advertisements)
- **مسیرها و اندپوینت‌ها:**
  - `GET /api/v1/platform-admin/ad-requests`
  - `GET /api/v1/platform-admin/ad-requests/:id`
  - `PATCH /api/v1/platform-admin/ad-requests/:id/status`
- **بررسی دیتابیس و بیزنس:**
  - مدل `AdvertisementRequest` همراه با Enum وضعیت (`PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`) و روابط کامل با `GamingCenter`, `User (owner)`, `Media`, `PlatformAdmin (reviewedBy)` در مایگریشن `20261216000000_add_advertisement_requests` وجود دارد.
  - منطق انقضای تبلیغات (`EXPIRED` داینامیک در صورت گذشته بودن `endDate`) و ثبت لاگ آودیت در `PlatformAdRequestsStation` به درستی پیاده شده است.
- **نقایص:**
  - این اندپوینت‌ها در `sayra/src/docs/openapi.yaml` ثبت نشده‌اند.

### ۳.۷. مدیریت کمپین‌ها و تخفیف‌های سراسری (Campaigns)
- **مسیرها و اندپوینت‌ها:**
  - `GET /api/v1/platform-admin/campaigns`
  - `POST /api/v1/platform-admin/campaigns`
  - `PATCH /api/v1/platform-admin/campaigns/:id`
  - `DELETE /api/v1/platform-admin/campaigns/:id` (سافت دیلیت با `deletedAt`).
- **بررسی دیتابیس و منطق مصرف:**
  - مدل `DiscountCampaign` با فیلدهای `scopeType` (`GLOBAL`, `SPECIFIC_GAMECENTERS`, `SPECIFIC_DEVICE_TYPES`)، `targetAudience` (`ALL_USERS`, `NEW_USERS`, `LOYAL_USERS`, `SPECIFIC_USERS`)، `totalUsageLimit` و `perUserUsageLimit` در مایگریشن `20261216000000_add_platform_admin_apis` اضافه شده است.
  - در `discounts.station.ts` اعتبارسنجی سقف استفاده کل، سقف هر کاربر، حداقل مبلغ سفارش و بررسی جامعه هدف پیاده شده و مصرف‌ها در جدول `DiscountUsage` ذخیره می‌شود.

### ۳.۸. تنظیمات سراسری پلتفرم (Settings)
- **مسیرها و اندپوینت‌ها:**
  - `GET /api/v1/platform-admin/settings`
  - `PUT /api/v1/platform-admin/settings`
- **بررسی دیتابیس:**
  - جدول مستقل `PlatformSetting` برای جداسازی کامل تنظیمات مرکزی از تنظیمات سالن‌ها ایجاد شده است.
  - فیلدهای عمومی، درصد کمیسیون، قوانین رزرو، قالب‌های پیامک و اعتبارسنجی در دیتابیس ذخیره و بازیابی می‌شوند.
  - علاوه بر تنظیمات، متد `getInfrastructureStatus` وضعیت زیرساخت شامل پیامک (SmsIr)، درگاه پرداخت (Zarinpal/Fake)، نسخه API و آخرین بکاپ موفق را از فایل‌های اسنپ‌شات بکاپ گزارش می‌دهد.

### ۳.۹. مدیریت وبلاگ (Blog)
- **بررسی معماری:**
  - در پروژه سایرا، ماژول وبلاگ در مسیر `sayra/src/modules/blog/` طراحی شده است که بر مبنای چندمستاجره بودن (`/gamingCenters/:gamingCenterId/blog/...`) کار می‌کند.
  - اندپوینت اختصاصی سراسری `/platform-admin/blog` در سایرا وجود ندارد.
  - مدیریت مدل‌های محتوایی مانند `Category`، `Tag` و `SiteSettings` در پنل AdminJS فعال است.
  - سرویس وبلاگ جداگانه‌ای نیز در ریپازیتوری تحت پوشه `Blog/` (بر پایه Django / DRF) وجود دارد که ارتباط هماهنگ آن با پنل ادمین مرکزی سایرا مستلزم یکپارچگی روت‌های پلتفرم است.

### ۳.۱۰. گزارش‌ها و تحلیل‌های تجمیعی (Analytics)
- **مسیرها و اندپوینت‌ها:**
  - `GET /api/v1/platform-admin/analytics/reports`
- **بررسی دیتابیس و محاسبات:**
  - در فایل `sayra/src/modules/platform-admin/analytics.station.ts`، کلیه داده‌های مالی (درآمد کل، پرداختی‌ها، استردادها، تخفیف‌ها، سهم کمیسیون پلتفرم، سهم گیمنت‌ها و میانگین ارزش رزرو) به همراه آمار تفکیکی وضعیت رزروها، ریز آمار کاربران (جدید، فعال، بازگشتی) و توزیع گیمنت‌ها با کوئری‌های زنده از Prisma Aggregate و GroupBy بدون کوچک‌ترین داده Mock محاسبه می‌شوند.
  - امکان فیلتر بر اساس بازه زمانی (`startDate`, `endDate`)، شهر (`city`)، گیمنت (`gamingCenterId`) و مقایسه دوره‌ای (`compare=true`) پشتیبانی می‌شود.

---

## ۴. گزارش شناسایی Mock Data در فرانت‌اند و لایه‌های شبیه‌ساز (Phase 3)

| شماره | مسیر فایل | شماره خطوط | نوع داده / مکانیزم | توضیح و نیازمندی واقعی |
|---|---|---|---|---|
| ۱ | `sayra/src/mocks/handlers/reservations.ts` | ۱-۵۰ | کتابخانه MSW / آرایه‌های درون حافظه | شبیه‌سازی فراخوانی‌های رزرو کلاینت در محیط توسعه، نیازمند اتصال قطعی به APIهای `/gamingCenters/:id/reservation` و `/platform-admin/reservations`. |
| ۲ | `sayra/src/mocks/handlers/analytics.ts` | ۱-۴۰ | کتابخانه MSW / آبجکت‌های ثابت عددی | شبیه‌سازی خلاصه آنالیتیکس و عملکرد پرسنل؛ فرانت‌اند باید به `/platform-admin/analytics/reports` متصل باشد. |
| ۳ | `sayra/src/mocks/handlers/tickets.ts` | ۲۲۴-۲۷۵ | روت‌های MSW `/api/v1/admin/tickets` | داده‌های ساختگی تیکت‌های پشتیبانی ادمین در حافظه لوکال. |
| ۴ | `sayra/src/modules/platform-admin/platform-admin-ui.templates.ts` | خط ۲۱۳ | متد `prompt()` در جاوااسکریپت کلاینت | دریافت دستی Bearer Token به جای لاگین فرم استاندارد یا نشست امن AdminJS. |

*نکته مهم:* هیچ Mock Data هاردکدشده‌ای در پاسخ روت‌های کنترلرهای `PlatformAdminController`, `PlatformCampaignsController`, `PlatformSettingsController`, `PlatformAnalyticsController`, `PlatformAdRequestsController` یا `DashboardService` وجود ندارد و تمامی اطلاعات مستقیماً از PostgreSQL واکشی می‌شوند.

---

## ۵. مقایسه و پوشش OpenAPI (`openapi.yaml` vs Backend) (Phase 4)

| Endpoint | تعریف در OpenAPI | وجود Route در Backend | Controller | Service/Station | اتصال دیتابیس | RBAC / Auth | تست اختصاصی |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `GET /platform-admin/campaigns` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /platform-admin/campaigns` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PATCH /platform-admin/campaigns/{id}` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DELETE /platform-admin/campaigns/{id}` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /platform-admin/settings` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PUT /platform-admin/settings` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /platform-admin/analytics/reports` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /platform-admin/gaming-centers` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /platform-admin/gaming-centers/{id}` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PATCH /platform-admin/gaming-centers/{id}` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PATCH /platform-admin/gaming-centers/{id}/status` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /platform-admin/users` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /platform-admin/users` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /platform-admin/users/{id}` | ❌ | ❌ | ❌ | ❌ | ❌ | - | ❌ |
| `PATCH /platform-admin/users/{id}` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DELETE /platform-admin/users/{id}` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PATCH /platform-admin/users/{id}/status` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /platform-admin/users/{id}/reset-password` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /platform-admin/users/{id}/revoke-sessions` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /platform-admin/reservations` | ❌ | ❌ | ❌ | ❌ | ❌ | - | ❌ |
| `GET /platform-admin/ad-requests` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /platform-admin/ad-requests/{id}` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PATCH /platform-admin/ad-requests/{id}/status` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /platform-admin/verifications` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /platform-admin/verifications/{id}` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /platform-admin/verifications/{id}/approve` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /platform-admin/verifications/{id}/reject` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## ۶. بررسی جامع دیتابیس (Database Audit) (Phase 5)

۱. **مدل‌های موجود و وضعیت جداول:**
   - جدول `PlatformAdmin`: دارای فیلدهای `id`, `fullName`, `phone`, `email`, `passwordHash`, `isActive`, `isSuperuser`, `lastLogin` و ایندکس‌های یکتا.
   - جدول `PlatformSetting`: دارای کلید اصلی `'default'` و تنظیمات مرکزی پلتفرم بدون وابستگی به Tenant.
   - جدول `AdvertisementRequest`: دارای فیلدها و روابط کامل با `GamingCenter`, `User`, `Media` و `PlatformAdmin`.
   - جدول `GamingCenterVerification`: نگهداری فایل‌های هویتی و وضعیت تأیید مراکز با ایندکس‌های لازم.
   - جدول `DiscountCampaign`: پشتیبانی از اسکوپ‌های عمومی، سالن‌های خاص و محدودیت‌های جامعه هدف.
   - جدول `AuditLog`: نگهداری سوابق تغییرات حساس همراه با ارجاع به `platformAdminId`.
۲. **کمبودها و نیازمندی‌های مدل دیتابیس:**
   - **فیلد رتبه‌بندی و تجمیع امتیاز در گیمنت:** فیلد امتیاز میانگین (`averageRating`) و تعداد نظرات به صورت کش‌شده در جدول `GamingCenter` ذخیره نشده و هر بار نیازمند محاسبه بر اساس جدول نظرات است.
   - **تاریخچه اشتراک سالن‌ها:** برای فیلد `subscriptionStatus` جدول تاریخچه و لاگ پرداخت اشتراک ماهانه سالن‌ها در دیتابیس وجود ندارد و صرفاً به یک وضعیت متنی یا Enum محدود است.

---

## ۷. ممیزی امنیت (Security Audit) (Phase 6)

### ۷.۱. موارد امنیتی بررسی‌شده و مثبت:
- **جداسازی کامل نقش PLATFORM_ADMIN:** با میدل‌ویر `requirePlatformAdmin.ts` فقط کاربرانی که `actorType === 'PLATFORM_ADMIN'` یا `isSuperuser === true` دارند به اندپوینت‌های زیرمجموعه `/api/v1/platform-admin` دسترسی خواهند داشت و تلاش کاربران عادی یا مدیران سالن (`MANAGER`) منجر به خطای ۴۰۳ می‌شود.
- **ایزولاسیون چندمستاجره (Tenant Isolation):** میدل‌ویر `tenantGuard.ts` از دسترسی تصادفی یا تعمدی مدیران یک گیمنت به داده‌های گیمنت دیگر با خطای ۴۰۴ جلوگیری می‌کند.
- **هشینگ رمزهای عبور:** رمز عبور مدیران پلتفرم و پرسنل با الگوریتم مستحکم **Argon2** ذخیره می‌شود و در خروجی پاسخ‌ها استریپ و حذف می‌گردد.
- **ابطال نشست‌ها و کشینگ توکن:** با متد `revokeUserSessions` و `invalidateActorCache` کلیدهای کش سشن در Redis پاکسازی می‌شوند.
- **ثبت لاگ حسابرسی (Audit Logging):** تمام عملیات حساس (ایجاد/ویرایش کاربر، تغییر وضعیت گیمنت، تغییر تنظیمات سراسری، تصمیم‌گیری درباره تبلیغات و تأیید مدارک) در جدول `AuditLog` ذخیره می‌گردند.

### ۷.۲. ریسک‌ها و آسیب‌پذیری‌های شناسایی‌شده:
1. **[MEDIUM] ناهماهنگی نام فیلد در آودیت لاگ تأیید مدارک:** در کنترلر `VerificationController` فیلد ارسالی برای ثبت لاگ گاهی به نام کاربر لاگین‌شده ارجاع داده شده در حالی که در پلتفرم ادمین باید مستقیماً در ستون `platformAdminId` ذخیره شود.
2. **[LOW] نبود مکانیزم CSRF Token در فرم‌های SSR Dashboard:** در صفحه داشبورد `platformAdminDashboardTemplate` توکن‌ها به صورت دستی از LocalStorage خوانده می‌شوند که در صورت وجود حملات XSS ریسک سرقت توکن ایجاد می‌کند. برای پنل AdminJS مکانیزم سشن کوکی به درستی لحاظ شده است.

---

## ۸. بررسی یکپارچگی جریان داده (Integration Audit) (Phase 7)

- **زنجیره جریان داده در ماژول‌های فعال:**
  `Route` → `authMiddleware + requirePlatformAdmin` → `Controller (Zod Validation)` → `Station (Business Logic)` → `Repo (Prisma Client)` → `PostgreSQL`
  این زنجیره در ماژول‌های Campaigns, Settings, Analytics, AdRequests و Verifications به طور کامل و بدون انقطاع متصل است.
- **نقاط قطعی زنجیره:**
  - در ماژول **Reservations پلتفرم**، زنجیره در سطح Route قطع است؛ یعنی کلاینت پنل پلتفرم روت سراسری برای دریافت لیست کل رزروها با فیلتر چندگانه ندارد.
  - در ماژول **کاربران**، متد دریافت تک‌کاربر (`GET /platform-admin/users/:id`) در کنترلر و استیشن پیاده نشده و زنجیره تا این سطح ناقص است.
  - در ماژول **وبلاگ**، به دلیل تکیه بر معماری چندمستاجره، روت مدیریت مقالات بدون نیاز به ارسال `gamingCenterId` وجود ندارد.

---

## ۹. فهرست اندپوینت‌های ناقص یا غایب (Missing / Incomplete Endpoints)

### ۱. دریافت رزروهای سراسری پلتفرم
- **HTTP Method:** `GET`
- **Endpoint:** `/api/v1/platform-admin/reservations`
- **هدف:** مشاهده، جستجو و فیلتر تمام رزروهای کل گیمنت‌های کشور توسط مدیر ارشد پلتفرم.
- **پارامترهای Query:** `page`, `limit`, `search`, `status`, `gamingCenterId`, `city`, `startDate`, `endDate`, `customerPhone`
- **Response موردنیاز:** لیست رزروها همراه با جزییات مشتری، سالن بازی، استیشن، وضعیت پرداخت و آبجکت Pagination.
- **علت نیاز:** امکان نظارت، پشتیبانی مشتریان و داوری مالی در سطح کل کشور.

### ۲. دریافت جزئیات یک کاربر پلتفرم
- **HTTP Method:** `GET`
- **Endpoint:** `/api/v1/platform-admin/users/{id}`
- **هدف:** مشاهده مشخصات کامل، تاریخچه دسترسی‌ها و اطلاعات پرسنلی یک کاربر خاص.
- **Response موردنیاز:** آبجکت کاربر به همراه سالن مربوطه، بدون نمایش هش رمز عبور.
- **علت نیاز:** تکمیل عملیات استاندارد مدیریت کاربران در پنل فرانت‌اند.

### ۳. مدیریت مقالات وبلاگ در سطح سراسری پلتفرم
- **HTTP Method:** `GET / POST / PATCH / DELETE`
- **Endpoint:** `/api/v1/platform-admin/blog/posts`
- **هدف:** انتشار و مدیریت مقالات پلتفرم سراسری برای اخبار و مقالات عمومی PlayNest مستقل از یک گیمنت خاص.

---

## ۱۰. نقشه راه توسعه اولویت‌بندی‌شده (Development Roadmap)

```
+-------------------------------------------------------------------------------+
|  P0: مسائل بحرانی و امنیت                                                    |
|  - افزودن روت GET /platform-admin/reservations و اتصال به دیتابیس           |
|  - یکسان‌سازی فرمت لاگین سشن در تمپلیت‌های SSR به جای prompt() دستی         |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
|  P1: تکمیل قابلیت‌های کلیدی و مستندات OpenAPI                                |
|  - افزودن مستندات اندپوینت‌های ad-requests و verifications در openapi.yaml   |
|  - افزودن اندپوینت GET /platform-admin/users/{id}                              |
|  - افزودن روت‌های سراسری مقالات وبلاگ پلتفرم                                  |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
|  P2: اتصال قطعی فرانت‌اند و حذف Mock Data                                    |
|  - قطع کامل هندلرهای MSW در ساختارهای پروداکشن فرانت‌اند                     |
|  - اتصال صفحات فرانت‌اند به روت‌های واقعی analytics/reports و ad-requests     |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
|  P3: بهینه‌سازی کارایی و تست‌ها                                              |
|  - ایجاد ایندکس‌های مرکب بیشتر روی جداول رزرو و تراکنش‌های مالی              |
|  - افزودن تست‌های E2E پوشش‌دهنده سناریوهای سرتاسری Platform Admin            |
+-------------------------------------------------------------------------------+
```

---

## ۱۱. نتیجه‌گیری ممیزی (Audit Conclusion)

بک‌اند پلتفرم سایرا دارای پایگاه کد پیشرفته، مایگریشن‌های ساختاریافته و منطق بیزنس متصل به PostgreSQL در اکثر ماژول‌های حساس (از جمله تنظیمات، کمپین‌ها، تبلیغات، آمار تجمیعی و آودیت لاگ) است. برای رسیدن به وضعیت ۱۰۰٪ عملیاتی و بدون Mock:
1. ایجاد اندپوینت تجمیعی `GET /platform-admin/reservations` بالاترین اولویت توسعه را دارد.
2. همگام‌سازی فایل `openapi.yaml` با روت‌های پیاده‌سازی‌شده تبلیغات و احراز هویت مالکین ضروری است.
3. در لایه فرانت‌اند، اتصال صفحات به کلاینت‌های واقعی API و جایگزینی کامل Mock Data های MSW باید مطابق با نقشه راه پیاده‌سازی شود.
