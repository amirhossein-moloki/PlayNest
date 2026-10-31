# گزارش تحلیل جامع معماری و نیازمندی‌های ثبت رویدادهای مدیریتی و پایش سلامت سامانه (PlayNest)

**سند فنی و معماری مرجع:** `PROJECT_ASSESSMENT_AUDIT_MONITORING.md`
**نقش:** معمار ارشد نرم‌افزار و مهندس ارشد بک‌اند
**وضعیت ارزیابی:** تحلیل فاز صفر (بدون اعمال تغییرات در کد، بدون جهش دیتابیس یا نصب وابستگی)
**تاریخ گزارش:** اکتبر ۲۰۲۶

---

## ۱. خلاصه مدیریتی (Executive Summary)

این سند گزارش ارزیابی، بازبینی و تحلیل معماری سامانه **پلی‌نست (PlayNest)** برای پیاده‌سازی و ارتقای دو قابلیت بنیادین است:
1. **ثبت رویدادهای مهم مدیریتی (Management Audit Logging)**
2. **پایش سلامت و عملکرد سامانه (System Health & Performance Monitoring)**

بررسی عمیق مخزن نشان می‌دهد که در حال حاضر یک ساختار پایه‌ای برای هر دو قابلیت در هسته بک‌اند رزرویشن (`sayra/`) پیاده شده است:
- **در بخش Audit Logging:** جدول و مدل پریسمایی `AuditLog` در دیتابیس PostgreSQL وجود داشته و سرویس `auditService` در مسیر `sayra/src/modules/audit/audit.station.ts` پیاده شده است. با این حال، ثبت لاگ‌ها به شکل گزینشی، دستی و ناپیوسته در لایه Service/Station فراخوانی می‌شود، بخش بزرگی از رخدادهای حیاتی نظیر احراز هویت (Login/Logout)، شکست‌های امنیتی، عملیات مالی مستقیم (تسویه‌ها و شارژ کیف پول) و اعمال تغییرات ساختاری فاقد لاگ‌گیری هستند. افزون بر این، در حال حاضر هیچ‌گونه ماسک‌سازی خودکار داده‌های محرمانه (PII & Secrets)، مکانیزم تضمین عدم دست‌کاری (Immutability/Hashing) یا سیاست بایگانی و پاک‌سازی اتوماتیک پیاده‌سازی نشده است.
- **در بخش Health Check & Monitoring:** یک اندپوینت ساده `GET /health` وجود دارد که صرفاً استاتوس ثابت `{ status: 'ok' }` برمی‌گرداند و هیچ تست واقعی روی در دسترس بودن دیتابیس، ردیس یا کارایی صف‌ها انجام نمی‌دهد (تفاوت Liveness و Readiness رعایت نشده است). لاگ‌های فنی توسط `pino-http` مدیریت شده و خطاهای کنترل‌نشده توسط `@sentry/node` پشتیبانی می‌شوند؛ همچنین یک مانیتور محلی صف در `sayra/src/jobs/monitoring/queue-monitor.ts` وجود دارد، اما هیچ مکانیزم استانداردی برای جمع‌آوری متریک‌ها (مانند Prometheus)، لاگ‌های متمرکز و مانیتورینگ سیستماتیک کل کانتینرها موجود نیست.

این گزارش، معماری موجود را به‌طور دقیق کالبدشکافی کرده و یک برنامه مهندسی گام‌به‌گام در اولویت‌های P0، P1 و P2 بدون پیچیده‌سازی غیرضروری ارائه می‌دهد.

---

## ۲. معرفی پروژه و هدف آن بر اساس شواهد مخزن (Project Overview & Purpose)

بر اساس فایل‌های مستندات ریشه (`README.md`، `docs/playenest-prd.md`، `docs/architecture.md`، `docs/DISCOVERY_REPORT.md`) و اسکیماهای داده، سامانه **PlayNest (پلی‌نست)** یک پلتفرم جامع SaaS/Multi-tenant برای مدیریت، برنامه‌ریزی نوبت‌ها و رزرواسیون آنلاین و حضوری مراکز بازی و گیم‌نت‌ها (Gaming Centers) است.

### مسائل کلیدی که پلتفرم حل می‌کند:
1. **مدیریت چندشعبه‌ای و چندمستأجره (Multi-tenancy):** تفکیک داده‌ها بر اساس موجودیت `GamingCenter` با اسلاگ‌های اختصاصی.
2. **رزرواسیون هوشمند استیشن‌های بازی (GameStation):** زمان‌بندی و جلوگیری از تداخل نوبت‌ها روی کنسول‌ها (PS5, Xbox, PC, VR) با تعرفه‌های VIP و عادی.
3. **مدیریت کاربران، شیفت‌ها و کارکنان:** اعمال کنترل دسترسی نقش‌محور (RBAC) برای مدیران، سرپرستان، اپراتورها و صندوق‌داران.
4. **تراکنش‌های مالی و کیف پول:** پشتیبانی از پرداخت‌های آنلاین (درگاه زرین‌پال)، کیف پول مشتریان، محاسبه پورسانت‌ها (Commissions) و سیستم تخفیف‌های هدفمند.
5. **ارتباطات و بازاریابی:** اطلاع‌رسانی از طریق پیامک (SMS.ir) و ماژول وبلاگ/محتوا.

### ساختار بک‌اند:
پروژه یک سیستم بک‌اند یکپارچه دوگانه (Dual-Backend System) است:
1. **سرویس رزرو و عملیات هسته (`sayra/`):** ستون فقرات منطق کسب‌وکار، نوشته‌شده با Node.js/Express و Prisma ORM.
2. **سرویس مدیریت محتوا و مقالات سراسری (`payload/`):** یک سرویس مستقل بر پایه Payload CMS (نسخه 3.x) و Next.js که مقالات، رویدادها و صفحات لندینگ شهری را در دیتابیس مستقل مدیریت می‌کند.

---

## ۳. فناوری‌ها و معماری فعلی (Current Technologies & Architecture)

| لایه / بخش | فناوری و نسخه | مستندات و مسیر فایل مرجع در مخزن |
| :--- | :--- | :--- |
| **زبان و محیط اجرا** | Node.js (v20+ / v22)، TypeScript (v5.4.5) | `sayra/package.json`, `README.md` |
| **فریم‌ورک وب هسته** | Express.js (v4.19.2) | `sayra/src/app.ts` |
| **معماری پروژه** | Modular Monolith (ماژولار مونولیت مبتنی بر مدل ایستگاه‌ها/Stations) | `sayra/src/modules/` |
| **دسترسی به داده و ORM** | Prisma ORM (v5.22.0) | `sayra/prisma/schema.prisma`, `sayra/src/config/prisma.ts` |
| **پایگاه داده اصلی** | PostgreSQL 15 (دو دیتابیس مجزای `playenest_prod` و `payload_db`) | `docker-compose.yml`, `docker/postgres/` |
| **صف و کارهای پس‌زمینه** | BullMQ (v5.77.6) متصل به Redis 7 | `sayra/src/jobs/queues.ts`, `sayra/src/config/bullmq.ts` |
| **ردیس / حافظه موقت** | Redis 7 Alpine (پورت 6379) با کلاینت ioredis (v5.9.2) | `sayra/src/config/redis.ts` |
| **سیستم لاگ فنی** | Pino و Pino-HTTP (v10.1.0) همراه با pino-pretty | `sayra/src/common/middleware/logger.ts`, `sayra/src/config/logger.ts` |
| **مدیریت خطای خارجی و APM** | @sentry/node (v10.38.0) و @sentry/profiling-node | `sayra/src/app.ts`, `sayra/src/config/env.ts` |
| **احراز هویت و امنیت** | JWT (jsonwebtoken 9.0.2)، Argon2 (0.44.0)، Helmet (8.1.0) | `sayra/src/modules/auth/`, `sayra/src/common/middleware/auth.ts` |
| **اعتبارسنجی ورودی** | Zod (v3.23.8) | `sayra/src/common/middleware/validate.ts` |
| **سرویس ریورس‌پروکسی** | Nginx Reverse Proxy | `docker/nginx/conf.d/app.conf.template` |

---

## ۴. ساختار پوشه‌ها و ماژول‌های مرتبط (Directory Structure & Responsibilities)

ساختار کد در دایرکتوری `sayra/src/` بر اساس تفکیک دامنه‌ها به صورت Modular Monolith سازمان‌یافته است:

- **`sayra/src/app.ts` و `sayra/src/server.ts`:** نقطه ورود اصلی برنامه، پیکربندی میدلورها، مسیرهای اصلی، ثبت Sentry و مدیریت چرخه حیات سرور.
- **`sayra/src/config/`:** پیکربندی‌های متغیرهای محیطی با Zod (`env.ts`)، نمونه Prisma Client تکین (`prisma.ts`)، کلاینت Redis (`redis.ts`) و لاگر پایه (`logger.ts`).
- **`sayra/src/common/`:** قابلیت‌های چندمنظوره:
  - `middleware/`: احراز هویت (`auth.ts`)، کنترل نقش (`requireRole.ts`)، حفاظت از ایزولاسیون تننت (`tenantGuard.ts`)، لاگر درخواست (`logger.ts`)، محدودسازی نرخ (`rateLimit.ts`)، اعتبارسنجی داده‌ها (`validate.ts`) و مدیریت ساختار کانتکست (`request-context.ts`).
  - `errors/`: خطاهای تجاری ساختاریافته (`AppError.ts`) و کنترل‌کننده مرکزی خطای اکسپرس (`errorHandler.ts`).
  - `metrics/`: کلاسی ساده برای نوشتن لاگ‌های ساختاریافته مربوط به زمان تاخیر (`metrics.ts`).
  - `utils/`: ابزارهای محاسباتی پولی (`money.ts`)، فرمت‌دهی شماره تلفن (`phone.ts`) و ماسک‌سازی لاگ (`sanitizer.ts`).
- **`sayra/src/modules/`:** ماژول‌های کسب‌وکار:
  - `audit/`: ماژول فعلی لاگ ممیزی (`audit.station.ts`, `audit.repo.ts`, `audit.controller.ts`, `audit.routes.ts`).
  - `auth/`: ورود، ثبت‌نام و تولید سشن‌های JWT و OTP (`auth.station.ts`, `auth.controller.ts`).
  - `users/`: مدیریت پرسنل و دسترسی‌ها (`users.station.ts`, `users.controller.ts`).
  - `gamingCenter/`: تنظیمات و موجودیت مرکز بازی (`gamingCenter.station.ts`).
  - `reservation/`: موتور مرکزی رزرو، چرخه حیات نوبت‌ها و استیشن‌ها (`reservation.station.ts`, `reservation.lifecycle.ts`).
  - `payments/`, `wallet/`, `commissions/`, `discounts/`: عملیات مالی، تراکنش‌ها، پورسانت‌ها و کدهای تخفیف.
- **`sayra/src/jobs/`:** زیرساخت صف‌ها و پردازش‌های ناهمگام:
  - `queues.ts`: تعریف صف‌های BullMQ (`smsQueue`, `analyticsQueue`, `reservationExpiryQueue` و غیره).
  - `workers/`: کارگرهای پس‌زمینه (`sms.worker.ts`, `reservationExpiry.worker.ts`, `analyticsIngestion.worker.ts`).
  - `monitoring/`: مانیتورینگ دوره‌ای طول صف‌های BullMQ (`queue-monitor.ts`).

---

## ۵. وضعیت فعلی لاگ‌گیری و مدیریت خطا (Current Logging & Error Handling)

### سیستم لاگ‌گیری فنی (Technical Logging):
- **ابزار لاگ:** از کتابخانه پیشرفته **Pino** و میدلور **pino-http** در فایل `sayra/src/common/middleware/logger.ts` استفاده می‌شود.
- **شناسه هم‌بستگی (Correlation ID & Request ID):** میدلور لاگر شناسه ورودی هدر `x-request-id` یا `x-correlation-id` را خوانده یا با `@paralleldrive/cuid2` یک شناسه یکتا تولید کرده و به هدرهای پاسخ بازمی‌گرداند (`X-Request-Id` و `X-Correlation-Id`).
- **زمینه درخواست (AsyncLocalStorage Context):** از کانتکست ایزوله شده در `sayra/src/common/context/request-context.ts` استفاده می‌شود تا `requestId`, `correlationId`, `actorId` و `gamingCenterId` در سرتاسر جریان اجرای ناهمگام در دسترس باشند.
- **ماسک‌سازی داده‌های لاگ فنی:** تابع `sanitizeLog` در `sayra/src/common/utils/sanitizer.ts` کلیدهای حساسی نظیر `password`, `token`, `authorization`, `cookie`, `secret`, `apiKey` را با `[REDACTED]` جایگزین می‌کند.

### مدیریت خطا (Error Handling):
- **کلاس‌های خطا:** خطاهای تجاری با کلاس `AppError` (`sayra/src/common/errors/AppError.ts`) به عنوان خطاهای قابل پیش‌بینی (Operational) علامت‌گذاری می‌شوند.
- **کنترل‌کننده خطای عمومی:** فایل `sayra/src/common/errors/errorHandler.ts` انواع خطاهای Prisma (مانند P2002 برای یکتایی یا P2025 برای یافت نشدن رکورد)، خطاهای اعتبارسنجی Zod و خطاهای HTTP را نرمال‌سازی می‌کند.
- **یکپارچگی با Sentry:** در فایل `sayra/src/app.ts`، در صورت فعال بودن `SENTRY_ENABLED=true`، خطاهای کنترل‌نشده از طریق `Sentry.setupExpressErrorHandler(app)` و هندلر Sentry ردگیری و به سرور Sentry مخابره می‌شوند.

---

## ۶. وضعیت فعلی ثبت رویدادهای مدیریتی (Current Audit Logging State)

### مدل داده فعلی در Prisma (`sayra/prisma/schema.prisma`):
مدل `AuditLog` به صورت زیر تعریف شده است:
```prisma
model AuditLog {
  id             String           @id @default(cuid())
  gamingCenterId String?
  gamingCenter   GamingCenter?    @relation(fields: [gamingCenterId], references: [id])
  userId         String?
  user           User?            @relation(fields: [userId], references: [id])
  customerId     String?
  customer       CustomerAccount? @relation(fields: [customerId], references: [id])
  action         String           // e.g., "USER_UPDATE", "RESERVATION_CANCEL"
  entity         String           // e.g., "User", "Reservation", "Settings"
  entityId       String
  oldData        Json?
  newData        Json?
  ipAddress      String?
  userAgent      String?
  createdAt      DateTime         @default(now())

  @@index([gamingCenterId, createdAt])
  @@index([entity, entityId])
  @@index([userId])
}
```

### روش ثبت و سرویس مرتبط:
- در فایل `sayra/src/modules/audit/audit.station.ts`، تابع `auditService.log` و `auditService.recordLog` وجود دارند.
- این متد به شکل دستی در ماژول‌های مختلف فراخوانی می‌شود (`users.station.ts`, `settings.station.ts`, `reservation.lifecycle.ts`, `commissions.station.ts`, `discounts.station.ts`, `tickets.station.ts`).

### نقاط ضعف و شکاف‌های فاحش سیستم Audit فعلی:
1. **عدم پوشش رخدادهای ورود و خروج:** در `auth.station.ts`، هیچ رویدادی برای ورود موفق، تلاش‌های ناموفق با رمز عبور اشتباه (Brute-force attempts)، مصرف OTP، یا Logout ثبت نمی‌شود.
2. **عدم ثبت رخدادهای مالی مستقیم:** عملیات شارژ دستی کیف پول توسط مدیر، اصلاح لجر مالی و بازپرداخت‌ها (Refunds) مستقیماً دارای ثبت یکپارچه در `AuditLog` نیستند.
3. **عدم ماسک‌سازی فیلدهای حساس در oldData و newData:** متد `recordLog` آبجکت‌های `oldData` و `newData` را بدون فیلتر کردن فیلدهای حساسی چون `passwordHash` یا مقادیر بانکی مستقیماً در دیتابیس JSON ذخیره می‌کند (مثلاً در `users.station.ts:67` آبجکت کامل `existingUser` و `updatedUser` ثبت می‌شود).
4. **عدم ثبت دلیل تغییر (Reason/Justification):** در حال حاضر هیچ فیلدی برای ذکر دلیل لغو نوبت، تغییر قیمت یا غیرفعال‌سازی کاربر در مدل `AuditLog` وجود ندارد.
5. **نبود مکانیزم ضد دست‌کاری (Tamper-evidence):** داده‌های لاگ فاقد هش زنجیره‌ای یا کلید اعتبارسنجی هستند؛ کاربری با دسترسی به دیتابیس می‌تواند بدون برجا گذاشتن ردپا رکوردهای لاگ را حذف یا ویرایش کند.
6. **عدم پیاده‌سازی مکانیزم بایگانی و چرخه حیات (Retention & Archiving):** هیچ سیاستی برای حذف لاگ‌های قدیمی‌تر از ۶ یا ۱۲ ماه یا انتقال آن‌ها به فضای ذخیره‌سازی سرد وجود ندارد که به مرور موجب کندی ایندکس‌های دیتابیس عملیاتی می‌شود.

---

## ۷. وضعیت فعلی پایش سلامت و عملکرد (Current Health Check & Monitoring)

### وضعیت Health Check:
- در `sayra/src/routes/health.routes.ts`:
  ```typescript
  router.get('/', (req, res) => {
    res.ok({ status: 'ok' });
  });
  ```
- **ارزیابی فنی:** این مسیر فقط بررسی می‌کند که وب‌سرور بالا است یا خیر. اگر ارتباط دیتابیس PostgreSQL قطع شود یا سرور Redis از کار بیفتد، این اندپوینت همچنان کد 200 برمی‌گرداند!
- **عدم تفکیک Liveness و Readiness:** این دو مفهوم استاندارد کانتینری و کوبرنتیز در حال حاضر با یک پاسخ ثابت ادغام شده‌اند و هیچ تست عمیقی از وابستگی‌های زیرساختی انجام نمی‌شود.

### وضعیت پایش متریک‌ها و عملکرد:
- کلاس `Metrics` در `sayra/src/common/metrics/metrics.ts` فقط زمان تاخیر API و عمق صف را در قالب پیام متنی با `logger.info` چاپ می‌کند.
- هیچ اندپوینت استانداردی برای جمع‌آوری متریک‌ها توسط سامانه‌های پرکاربرد مانیتورینگ (مانند Prometheus scrape endpoint نظیر `/metrics`) وجود ندارد.
- در کانتینر Docker و Nginx، هیچ داشبورد یا ابزار داخلی ساده برای مشاهده زمان پاسخ‌گویی، مصرف رم و سی‌پی‌یو و خطاهای 5xx به شکل بلادرنگ در پنل مدیریت تعبیه نشده است.

---

## ۸. نیازمندی‌های ثبت رویدادهای مدیریتی (Audit Logging Requirements)

### الف) عملیات حیاتی مشمول لاگ ممیزی:
1. **احراز هویت و نشست‌ها (Authentication & Sessions):**
   - ورود موفق مدیر/پرسنل (`AUTH_LOGIN_SUCCESS`)
   - تلاش ناموفق برای ورود با رمز عبور اشتباه (`AUTH_LOGIN_FAILED`)
   - خروج از سیستم یا لغو سشن (`AUTH_LOGOUT`, `AUTH_SESSION_REVOKED`)
   - درخواست و اعتبارسنجی کدهای یکبار مصرف مدیران (`AUTH_OTP_ATTEMPT`)
2. **مدیریت کاربران و دسترسی‌ها (RBAC & User Management):**
   - ایجاد پرسنل جدید (`USER_CREATE`)
   - ویرایش مشخصات پرسنل، تغییر سطح دسترسی و نقش (`USER_UPDATE`, `USER_ROLE_CHANGE`)
   - فعال‌سازی، تعلیق و مسدودسازی کاربر (`USER_STATUS_CHANGE`, `USER_DELETE`)
3. **تراکنش‌ها و عملیات حساس مالی (Financial & Ledger Operations):**
   - شارژ دستی کیف پول مشتری توسط پرسنل (`WALLET_MANUAL_ADJUSTMENT`)
   - لغو و استرداد دستی وجه تراکنش (`PAYMENT_REFUND_MANUAL`)
   - اصلاح قوانین پورسانت مرکز یا سقف‌ها (`COMMISSION_POLICY_UPDATE`)
   - ایجاد یا ابطال کمپین‌ها و کدهای تخفیف کلان (`DISCOUNT_CAMPAIGN_UPDATE`)
4. **عملیات رزرواسیون و تغییرات شیفت (Reservations & Operations):**
   - لغو اجباری رزرو توسط مدیریت خارج از بازه مجاز (`RESERVATION_FORCE_CANCEL`)
   - انتقال دستی نوبت رزرو به استیشن دیگر (`RESERVATION_OVERRIDE_STATION`)
   - تغییر دستی وضعیت شیفت‌ها و ساعات کاری گیم‌نت (`STAFF_SHIFT_OVERRIDE`)
5. **تنظیمات و پیکربندی گیم‌نت (Tenant & System Settings):**
   - تغییر قوانین لغو و جرائم (`SETTINGS_POLICY_CHANGE`)
   - تغییر تعرفه‌های پایه‌ای ایستگاه‌ها (`STATION_TARIFF_CHANGE`)
   - اصلاح اطلاعات و مشخصات ثبتی مرکز بازی (`GAMING_CENTER_PROFILE_UPDATE`)

### ب) ساختار داده‌های مورد نیاز برای هر رویداد ممیزی:
هر رکورد ممیزی باید حاوی فیلدهای زیر باشد:
- `id`: شناسه یکتا (CUID)
- `timestamp`: زمان دقیق وقوع به فرمت UTC
- `gamingCenterId`: شناسه مستأجر برای حفظ ایزولاسیون تننت
- `actorType`: نوع انجام‌دهنده (`USER`, `CUSTOMER`, `SYSTEM_WORKER`)
- `actorId`: شناسه انجام‌دهنده عملیات
- `actorPhone`: شماره تماس ماسک‌شده جهت جست‌وجوی سریع بدون افشای PII
- `action`: نوع عملیات با فرمت استاندارد (UPPERCASE_SNAKE_CASE)
- `category`: دسته‌بندی موضوعی (`SECURITY`, `FINANCIAL`, `OPERATION`, `SETTINGS`)
- `entity`: نام موجودیت هدف (`User`, `Reservation`, `Wallet`, `CommissionPolicy`)
- `entityId`: شناسه موجودیت هدف
- `reason`: دلیل ثبت‌شده توسط کاربر (برای عملیات حساسی چون لغو نوبت یا استرداد وجه)
- `oldState`: وضعیت داده قبل از تغییر (ماسک‌شده)
- `newState`: وضعیت داده بعد از تغییر (ماسک‌شده)
- `ipAddress`: آی‌پی کلاینت (با پشتیبانی از Trust Proxy)
- `userAgent`: مشخصات مرورگر/کلاینت
- `correlationId`: شناسه هم‌بستگی درخواست مربوطه برای اتصال به لاگ فنی
- `status`: نتیجه عملیات (`SUCCESS` یا `FAILURE`)

---

## ۹. نیازمندی‌های پایش سلامت و عملکرد (Monitoring Requirements)

### الف) نیازمندی‌های Health Checks:
1. **مسیر Liveness (`GET /health/live` یا `GET /health/liveness`):**
   - هدف: بررسی زنده‌بودن پروسس Node.js
   - بار کاری: به حداقل ممکن (بدون کوئری سنگین دیتابیس)
   - پاسخ: HTTP 200 `{ status: "ok", timestamp: "..." }`
2. **مسیر Readiness (`GET /health/ready` یا `GET /health/readiness`):**
   - هدف: بررسی آمادگی برای پذیرش ترافیک
   - بررسی‌ها:
     - اتصال موفق و پینگ دیتابیس PostgreSQL با اجرای کوئری سبک (`SELECT 1;`) در محدوده تایم‌اوت مشخص (مثلاً ۲ ثانیه).
     - اتصال پینگ به Redis (`redis.ping()`).
     - بررسی وضعیت پاسخ‌دهی پردازش‌های صف BullMQ.
   - وضعیت بازگشتی: در صورت سلامت همه اجزا HTTP 200 و در صورت خرابی اجزای بحرانی HTTP 503 Service Unavailable همراه با جزئیات وضعیت هر کامپوننت.
3. **ملاحظات امنیتی اندپوینت‌های سلامت:**
   - عدم افشای آدرس آی‌پی، نام سرورها، رشته‌های اتصال دیتابیس یا استک تریس در پاسخ عمومی.
   - امکان ارائه اندپوینت مشروح‌تر (`/health/detailed`) با احراز هویت توکن مدیریت برای تیم دون‌پایه یا مانیتورینگ داخلی.

### ب) شاخص‌های کلیدی عملکرد (KPIs & Metrics):
1. **متریک‌های API:** نرخ درخواست در ثانیه (RPS)، توزیع تاخیرها (p50, p95, p99)، درصد خطاهای 4xx و 5xx.
2. **متریک‌های پایگاه داده:** زمان اجرای کوئری‌ها، خطاهای اتصال به دیتابیس و وضعیت کانکشن‌پول پریسمایی.
3. **متریک‌های صفوف پردازش پس‌زمینه (BullMQ):** تعداد پیام‌های در حال انتظار (`waiting`)، فعال (`active`)، تاخیرخورده (`delayed`) و ناموفق (`failed`) در صف‌های پیامک، تسویه‌حساب و انقضای رزرو.
4. **متریک‌های حافظه و سیستم:** میزان مصرف حافظه Heap پروسس Node.js، مصرف CPU و آپ‌تایم فرآیند.

---

## ۱۰. معماری پیشنهادی و دلایل انتخاب (Proposed Architecture & Justification)

برای افزودن قابلیت‌های فوق بدون تحمیل پیچیدگی سنگین، تغییر اساسی در فریم‌ورک و تحمیل هزینه‌های زیرساختی به یک پروژه مونولیت ماژولار، معماری پیشنهادی زیر اتخاذ می‌شود:

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 Client / Web / Admin                   │
                  └───────────────────────────┬────────────────────────────┘
                                              │ HTTP(S) + Headers
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │            Nginx Reverse Proxy & Rate Limiter          │
                  └──────┬────────────────────┬────────────────────┬───────┘
                         │                    │                    │
            /health/live │       /api/v1/...  │   /health/ready    │ /metrics (Protected)
                         ▼                    ▼                    ▼
     ┌─────────────────────────────────────────────────────────────────────────┐
     │                      Sayra Express Application                          │
     │                                                                         │
     │ ┌──────────────────────┐  ┌─────────────────┐  ┌──────────────────────┐ │
     │ │ RequestContext /     │  │ Authentication  │  │ Health Check Service │ │
     │ │ Pino Logger Midlwr   │  │ & Tenant Guard  │  │ (DB Ping, Redis Ping)│ │
     │ └──────────┬───────────┘  └────────┬────────┘  └──────────┬───────────┘ │
     │            │ CorrelationId         │ Actor/Tenant         │             │
     │            ▼                       ▼                      │             │
     │ ┌───────────────────────────────────────────┐             │             │
     │ │ Business Stations (Users, Settings, Res)  │             │             │
     │ └──────────────────┬────────────────────────┘             │             │
     │                    │                                      │             │
     │                    ▼ Emit Domain Audit Event              │             │
     │ ┌───────────────────────────────────────────┐             │             │
     │ │  Audit Module (Sanitizer + Buffer/Queue)  │             │             │
     │ └──────────────────┬────────────────────────┘             │             │
     └────────────────────┼──────────────────────────────────────┼─────────────┘
                          │                                      │
            AuditLog Write│ (Async/Safe)            Health Check │ Ping
                          ▼                                      ▼
     ┌─────────────────────────────────────────────────────────────────────────┐
     │                     Shared Infrastructure Layer                         │
     │                                                                         │
     │    ┌──────────────────────────┐         ┌───────────────────────────┐   │
     │    │   PostgreSQL (AuditLog)  │         │   Redis (Queue / Cache)   │   │
     │    └──────────────────────────┘         └───────────────────────────┘   │
     │                                                                         │
     └─────────────────────────────────────────────────────────────────────────┘
```

### دلایل انتخاب این معماری:
1. **جداسازی دغدغه‌ها (Separation of Concerns):** ثبت لاگ مدیریتی نباید وابستگی سخت به مسیر درخواست کاربر داشته باشد؛ در نتیجه نباید تراکنش تجاری اصلی را در صورت بروز خطای لاگ‌گیری با شکست مواجه کند، مگر در عملیات‌های دارای حساسیت فوق‌العاده بالا که رعایت ممیزی الزامی است.
2. **استفاده از زیرساخت‌های پایدار موجود:** پروژه هم‌اکنون به Redis و BullMQ مجهز است. با انتقال لاگ‌های غیربحرانی به صف یا ثبت غیرهم‌زمان و بافر شده، بار دیتابیس در زمان ترافیک بالا کنترل می‌شود.
3. **سازگاری با ایزولاسیون مستأجران (Multi-tenancy):** کوئری‌های لاگ ممیزی همیشه با پیش‌شرط اجباری `gamingCenterId` فیلتر می‌شوند تا مدیران یک مرکز نتوانند لاگ‌های مرکزی دیگر را رصد کنند.

---

## ۱۱. ساختار داده‌ها و نمونه رویدادهای پیشنهادی (Data Schema & Event Examples)

### ارتقای مدل پریسمایی `AuditLog`:
پیشنهاد می‌شود مدل فعلی `AuditLog` در پریسمای `sayra` بدون ایجاد شکستگی با فیلدهای تکمیلی ارتقا یابد:

```prisma
enum AuditSeverity {
  INFO
  WARNING
  CRITICAL
}

enum AuditCategory {
  AUTHENTICATION
  USER_MANAGEMENT
  FINANCIAL
  OPERATIONAL
  SETTINGS
  SYSTEM
}

model AuditLog {
  id             String           @id @default(cuid())
  gamingCenterId String?
  gamingCenter   GamingCenter?    @relation(fields: [gamingCenterId], references: [id])
  userId         String?
  user           User?            @relation(fields: [userId], references: [id])
  customerId     String?
  customer       CustomerAccount? @relation(fields: [customerId], references: [id])

  action         String           // e.g. "USER_ROLE_CHANGE", "AUTH_LOGIN_FAILED"
  category       String           @default("OPERATIONAL") // Category string/enum
  severity       String           @default("INFO")        // INFO, WARNING, CRITICAL
  entity         String           // e.g. "User", "Reservation", "Wallet"
  entityId       String
  reason         String?          // e.g. "Customer requested reservation cancellation"

  oldData        Json?            // Sanitized previous state
  newData        Json?            // Sanitized new state

  ipAddress      String?
  userAgent      String?
  correlationId  String?          // Connects to technical Pino log
  status         String           @default("SUCCESS")     // SUCCESS, FAILURE

  createdAt      DateTime         @default(now())

  @@index([gamingCenterId, createdAt])
  @@index([entity, entityId])
  @@index([userId])
  @@index([action, createdAt])
  @@index([correlationId])
}
```

### نمونه رویداد ممیزی (نمونه JSON خروجی لاگ تغییر نقش پرسنل):
```json
{
  "id": "cuid_audit_8f93a102b",
  "timestamp": "2026-10-31T14:32:00.120Z",
  "gamingCenterId": "center_tehran_01",
  "actor": {
    "id": "usr_mgr_987",
    "role": "MANAGER",
    "phone": "0912***4567"
  },
  "action": "USER_ROLE_CHANGE",
  "category": "USER_MANAGEMENT",
  "severity": "CRITICAL",
  "entity": "User",
  "entityId": "usr_stf_123",
  "reason": "Promoted to supervisor shift coverage",
  "oldData": {
    "role": "STAFF",
    "isActive": true
  },
  "newData": {
    "role": "SUPERVISOR",
    "isActive": true
  },
  "context": {
    "ipAddress": "192.168.1.105",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "correlationId": "req_ctx_ab12cd34"
  },
  "status": "SUCCESS"
}
```

---

## ۱۲. ابزارها و زیرساخت مورد نیاز (Required Tools & Infrastructure)

| ابزار / قابلیت | وضعیت در مخزن | اقدام لازم و متناسب با ابعاد پروژه |
| :--- | :--- | :--- |
| **Pino & Pino-HTTP** | موجود و پیکربندی‌شده | نیازمند اصلاح جزیی برای اتصال منظم `correlationId` به رخدادهای لاگ ممیزی و متدهای کارهای پس‌زمینه. |
| **Sentry Error Tracking** | وابستگی نصب‌شده و تنظیم‌شده در `app.ts` | نیاز به فعال‌سازی متغیرهای `SENTRY_ENABLED=true` و تنظیم `SENTRY_DSN` در محیط سرور پروداکشن. |
| **اندپوینت‌های Health Check** | فقط اندپوینت ساده `/health` موجود است | پیاده‌سازی مسیرهای تفکیک‌شده `/health/live` و `/health/ready` با کوئری‌های اعتبارسنجی اتصال DB و Redis. |
| **Prometheus / Metrics Exporter** | در حال حاضر موجود نیست | **پیشنهاد مرحله‌ای:** در فاز فعلی بدون نیاز به راه‌اندازی استک سنگین Prometheus/Grafana، می‌توان با توسعه اندپوینت تجمیعی سبک `/api/v1/admin/system/health-summary` در ماژول آنالیتیکس موجود، وضعیت لحظه‌ای را در UI نمایش داد. در صورت نیاز سازمان به مانیتورینگ مرکزی، پکیج استانداردی چون `prom-client` در فاز P2 پیشنهاد می‌شود. |
| **Elasticsearch / Loki** | در حال حاضر موجود نیست | فعلاً لاگ‌های متنی ساختاریافته JSON در داکر/فایل ثبت شده و برای پروژه‌ای در این مقیاس، راه‌اندازی کلاسترهای سنگین ELK ضرورتی ندارد. |

---

## ۱۳. ملاحظات امنیتی، حریم خصوصی و کارایی (Security, Privacy & Performance Considerations)

1. **حذف و پالایش داده‌های حساس (Redaction & PII):**
   - هیچ‌گاه نباید اطلاعات زیر در ستون‌های `oldData` یا `newData` جدول `AuditLog` یا لاگ‌های متنی درج شوند:
     - رمزهای عبور، کد هش رمزها (`passwordHash`).
     - توکن‌های دسترسی (`accessToken`)، رفرش توکن‌ها یا هش آن‌ها.
     - شماره کارت بانکی، CVV2 و توکن‌های پرداخت درگاه بانکی.
   - شماره تلفن‌های همراه پرسنل یا مشتریان باید با الگوی استاندارد ماسک‌گذاری شوند (مانند `0912***4567`).
2. **غیرقابل دست‌کاری بودن (Immutability):**
   - جدول `AuditLog` باید از دید APIهای مدیریتی به صورت **Append-Only** (فقط افزودنی) باشد.
   - هیچ متدی برای `DELETE` یا `UPDATE` در سرویس یا روتر لاگ‌های ممیزی نباید وجود داشته باشد.
   - در سطح دیتابیس PostgreSQL می‌توان در فازهای پیشرفته یک Trigger مانع ویرایش و حذف روی جدول `AuditLog` قرار داد.
3. **کنترل دسترسی دقیق (RBAC):**
   - مشاهده لاگ‌های ممیزی فقط و فقط باید به نقش‌های `MANAGER` (در محدوده گیم‌نت خود با `tenantGuard`) و در صورت تعریف ادمین کل سیستم (`ADMIN`) محدود باشد.
4. **کارایی و کنترل سربار (Performance Overhead):**
   - ثبت لاگ‌های ممیزی نباید به ازای هر درخواست ساده (مانند خواندن یک لیست) انجام شود؛ ممیزی فقط مختص جهش‌های مهم داده‌ای (Mutation) و رویدادهای امنیتی است.
   - کوئری‌های جست‌وجو روی جدول لاگ باید با ایندکس‌های کامپوزیت روی `(gamingCenterId, createdAt)` و `(action, createdAt)` ایمن‌سازی شوند تا سرعت پاسخ‌دهی بالای دیتابیس حفظ شود.

---

## ۱۴. برنامه پیاده‌سازی اولویت‌بندی‌شده (Prioritized Implementation Roadmap)

```
        ┌─────────────────────────────────────────────────────────────┐
        │  فاز P0: الزامات امنیتی و سلامت حیاتی (بازه تقریبی ۱ هفته)   │
        │  - تفکیک اندپوینت‌های /health/live و /health/ready         │
        │  - ماسک‌سازی فیلدهای حساس در oldData/newData مدل AuditLog     │
        │  - پوشش لاگ‌های ممیزی احراز هویت (ورود ناموفق، تغییر نقش)   │
        └──────────────────────────────┬──────────────────────────────┘
                                       │
                                       ▼
        ┌─────────────────────────────────────────────────────────────┐
        │  فاز P1: پایش عملیاتی و داشبورد پایش سلامت (بازه ۲ هفته)     │
        │  - تکمیل ممیزی عملیات مالی، شارژ کیف‌پول و لغو نوبت‌ها     │
        │  - یکپارچه‌سازی هدر X-Correlation-Id در کل چرخه حیات         │
        │  - گزارش وضعیت سلامت در پنل مدیریت (Health Summary API)     │
        └──────────────────────────────┬──────────────────────────────┘
                                       │
                                       ▼
        ┌─────────────────────────────────────────────────────────────┐
        │  فاز P2: مقیاس‌پذیری و ابزارهای مانیتورینگ پیشرفته           │
        │  - صادرات متریک‌ها با فرمت استاندارد Prometheus             │
        │  - فرآیند دوره‌ای بایگانی و فشرده‌سازی لاگ‌های قدیمی          │
        │  - تریگر ضد دست‌کاری (Immutability Trigger) در دیتابیس      │
        └─────────────────────────────────────────────────────────────┘
```

### فاز اول - ضروری (P0 - Critical & Security):
1. **سلامت چندگانه:** اصلاح `health.routes.ts` و پیاده‌سازی تست اتصال دیتابیس و ردیس برای `GET /health/ready` و مسیر مستقل برای `GET /health/live`.
2. **امنیت لاگ ممیزی:** اضافه کردن تابع `sanitizeAuditData` پیش از فراخوانی `AuditRepo.createLog` تا فیلدهای حساس و کلیدهای محرمانه ذخیره نشوند.
3. **لاگ‌های ورود و امنیت:** اضافه کردن ثبت لاگ برای ورود ناموفق، ورود موفق مدیر و تغییر نقش در `auth.station.ts` و `users.station.ts`.

### فاز دوم - مهم (P1 - Operations & Reliability):
1. **پوشش جامع رویدادهای مالی و لغو رزرو:** اتصال `auditService.log` به تغییرات مانده کیف پول و لغو دستی نوبت‌ها با فیلد `reason`.
2. **اتصال لاگ فنی به ممیزی:** ثبت `correlationId` در رکوردهای ممیزی برای امکان پیگیری زنجیره رخدادها در خطاهای سیستمی.
3. **اندپوینت مانیتورینگ سلامت صف‌ها و اتصالات برای پنل مدیریت گیم‌نت:** ارائه خلاصه سلامت در مسیر مدیریتی موجود در `analytics`.

### فاز سوم - تکمیلی (P2 - Scalability & Advanced APM):
1. **یکپارچگی با Prometheus:** ایجاد اندپوینت اختصاصی `GET /metrics` جهت استخراج متریک‌های استاندارد توسط ابزارهای پایش بیرونی در صورت مقیاس‌گیری زیرساخت.
2. **چرخه حیات داده و بایگانی (Archiving Job):** راه‌اندازی کارگر پس‌زمینه برای انتقال لاگ‌های قدیمی‌تر از یک سال به استوریج سرد یا جدول فشرده.

---

## ۱۵. فایل‌ها و بخش‌های احتمالی نیازمند تغییر (Inventory of Impacted Files)

| نام فایل / ماژول | لایه | نوع تغییر مورد انتظار در فاز پیاده‌سازی |
| :--- | :--- | :--- |
| `sayra/src/routes/health.routes.ts` | Routes | افزودن مسیرهای تفکیک‌شده `live` و `ready` با چک کردن اتصال Postgres و Redis. |
| `sayra/src/modules/audit/audit.station.ts` | Service/Station | افزودن متد پاک‌سازی داده‌های حساس (`sanitize`) پیش از درج در دیتابیس و پشتیبانی از `correlationId` و `reason`. |
| `sayra/src/modules/audit/audit.validators.ts` | Validation | افزودن فیلترهای جدید (مانند بازه زمانی، دسته‌بندی و نتیجه عملیات) در لیست‌گیری لاگ‌ها. |
| `sayra/prisma/schema.prisma` | Model | افزودن فیلدهای تکمیلی `category`, `severity`, `reason`, `correlationId`, `status` به مدل `AuditLog`. |
| `sayra/src/modules/auth/auth.station.ts` | Service/Station | فراخوانی `auditService.recordLog` در ورودهای موفق پرسنل، لاگ‌اوت و تلاش‌های ناموفق. |
| `sayra/src/modules/users/users.station.ts` | Service/Station | تصحیح ثبت `oldData` و `newData` به منظور عدم ارسال فیلد `passwordHash`. |
| `docker-compose.yml` | Infrastructure | به‌روزرسانی دستور `healthcheck` سرویس `sayra` برای استفاده از آدرس تفکیک‌شده `/health/live`. |
| `docker/nginx/conf.d/app.conf.template` | Nginx | افزودن قوانین مسیردهی برای اندپوینت‌های سلامت در صورت نیاز به محدودسازی دسترسی عمومی. |

---

## ۱۶. استراتژی تست و معیارهای پذیرش (Test Strategy & Acceptance Criteria)

### معیارهای پذیرش برای Audit Logging:
1. هیچ لاگ ممیزی نباید حاوی پسورد خام، پسورد هش‌شده، توکن‌های JWT یا کارت بانکی باشد (تست با Unit Test بر روی Sanitizer).
2. هر اقدام مدیریتی مهم (ویرایش نقش پرسنل، لغو نوبت، تغییر ساعات کاری) باید بلافاصله یک رکورد با وضعیت `SUCCESS` و شناسه‌های درست ذخیره کند.
3. در صورت شکست اتصال یا کوئری دیتابیس در ثبت لاگ ممیزی، خطای ممیزی نباید تراکنش اصلی کسب‌وکار را لغو کند مگر در مواردی که با پرچم `strictAudit` علامت‌گذاری شده باشد.
4. هیچ کاربری به جز `MANAGER` و `ADMIN` به لاگ‌های ممیزی مرکز دسترسی نداشته باشد و هر مرکز تنها لاگ‌های مربوط به شناسه خود را دریافت کند (Tenant Isolation).

### معیارهای پذیرش برای Health Checks:
1. اندپوینت `/health/live` تحت هر شرایطی که پروسس زنده است در کمتر از ۲۰ میلی‌ثانیه با کد 200 پاسخ دهد.
2. اندپوینت `/health/ready` در صورت قطع اتصال PostgreSQL یا Redis بلافاصله کد 503 با وضعیت دقیق کامپوننت ناسالم بازگرداند.
3. هیچ اطلاعات محرمانه زیرساختی (رشته اتصال، پورت داخلی، رمز) در بدنه پاسخ اندپوینت‌های سلامت به کلاینت‌های احرازهویت‌نشده نمایش داده نشود.

---

## ۱۷. ریسک‌ها، محدودیت‌ها و بده‌بستان‌های فنی (Risks, Trade-offs & Limitations)

1. **ریسک بار دیتابیس ناشی از لاگ‌های ممیزی حجیم:**
   - *ریسک:* ذخیره `oldData` و `newData` برای تغییرات بزرگ رکوردهای پایگاه داده می‌تواند حجم جدول `AuditLog` را به سرعت افزایش دهد.
   - *راهکار:* فقط فیلدهایی که واقعاً مقدار آن‌ها تغییر کرده است (Diff) ثبت شوند و کل آبجکت بدون تغییر در جدول ریخته نشود.
2. **سربار تاخیر در Health Check:**
   - *ریسک:* اجرای کوئری‌های سنگین دیتابیس در هر بار فراخوانی Health Check می‌تواند در مانیتورینگ مکرر بار اضافی بر PostgreSQL تحمیل کند.
   - *راهکار:* استفاده از کوئری سبک `SELECT 1;` و کش کردن وضعیت برای بازه‌های کوتاه چند ثانیه‌ای در لایه مموری.
3. **تداخل هم‌زمانی در خطاهای لاگ‌گیری:**
   - *ریسک:* اگر سیستم ثبت لاگ به شکل هم‌گام درون ترنزکشن اصلی اجرا شود، کندی ذخیره لاگ باعث کندی پاسخ به کاربر می‌شود.
   - *راهکار:* اجرای ثبت لاگ ممیزی خارج از بلاک ترنزکشن داده اصلی (پس از پایان موفقیت‌آمیز تراکنش تجاری) با استفاده از مکانیسم رویداد یا فراخوانی محافظت‌شده با `try/catch`.

---

## ۱۸. ابهامات و سؤال‌های باز برای تیم محصول و رهبر فنی (Open Questions)

1. **سیاست نگهداری لاگ‌ها (Retention Policy):** لاگ‌های ممیزی مدیریتی چه مدت باید در دیتابیس عملیاتی نگهداری شوند؟ (پیشنهاد معماری: ۶ ماه در دیتابیس اصلی، انتقال به استوریج فشرده سرد پس از آن).
2. **الزام ثبت لاگ مشتریان در مقایسه با پرسنل:** آیا نیاز است تغییر مشخصات عادی توسط مشتری در کلاینت وب ثبت Audit شود، یا این ماژول منحصراً به اقدامات پنل مدیریت پرسنل و مدیران اختصاص دارد؟
3. **نیازمندی مانیتورینگ خارجی:** آیا در برنامه زیرساخت شرکت، سرویس مانیتورینگ متمرکز خارجی (مانند ابزارهای کلاود یا Prometheus مستقل سازمانی) برای اسکرپ کردن متریک‌ها قرار دارد، یا پایش درونی بر پایه Sentry و لاگ‌های سرور کافی است؟

---

## ۱۹. جمع‌بندی، جدول تصمیم‌گیری و گام بعدی (Summary, Decision Matrix & Next Steps)

### جدول تصمیم‌گیری معماری:

| ردیف | مؤلفه / قابلیت | تصمیم اتخاذ شده | اولویت پیاده‌سازی | دلیل تصمیم فنی |
| :---: | :--- | :--- | :---: | :--- |
| **۱** | تفکیک مسیرهای Health Check به Liveness و Readiness | بازنویسی و تفکیک مسیرهای `/health` | **P0 (ضروری)** | هماهنگی با استانداردهای کانتینری و تشخیص دقیق قطعی دیتابیس و ردیس |
| **۲** | ماسک‌سازی فیلدهای حساس لاگ ممیزی | توسعه تابع اختصاصی Sanitizer | **P0 (ضروری)** | الزامات امنیتی حریم خصوصی و جلوگیری از نشت رمز و توکن |
| **۳** | ثبت ممیزی برای لاگین ناموفق و تغییر نقش پرسنل | افزودن رویداد در سرویس‌های Auth و Users | **P0 (ضروری)** | شناسایی رفتارهای مشکوک امنیتی و حملات Brute-force |
| **۴** | ثبت ممیزی رویدادهای مالی و لغو رزرو با فیلد Reason | گسترش فراخوانی‌ها در Wallet و Reservation | **P1 (مهم)** | رفع ابهام و پیگیری رخدادهای مالی و اختلافات حسابرسی |
| **۵** | پیوند شناسه هم‌بستگی (Correlation ID) به AuditLog | ذخیره `correlationId` در جدول ممیزی | **P1 (مهم)** | امکان ارتباط‌دهی لاگ خطای فنی سیستم با اقدام مدیر مربوطه |
| **۶** | استقرار ابزار سنگین Prometheus / ELK | تعویق به فاز توسعه مقیاس (عدم اجرا در فاز جاری) | **P2 (تکمیلی)** | تطابق با معماری فعلی و جلوگیری از تحمیل پیچیدگی و مصرف منابع گزاف |

### گام بعدی:
ارائه این گزارش فنی به مدیر محصول و تیم فنی برای تایید راهکار؛ پس از دریافت تاییدیه، فاز پیاده‌سازی گام‌های P0 طبق برنامه زمان‌بندی آغاز خواهد شد.
