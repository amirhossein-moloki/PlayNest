# PlayNest Platform Super Admin Final Documentation
`PLAYNEST_PLATFORM_SUPER_ADMIN_FINAL_DOCUMENTATION`

## ۱. نمای کلی و معماری سیستم (System Architecture Overview)
پنل Platform Super Admin سیستم PlayNest به عنوان مرکز کنترل سراسری (Cross-Tenant) زیرساخت بازی و رزرو Sayra طراحی شده است. معماری این بخش با تفکیک کامل لایه‌ها و رعایت اصل تک‌مسئولیتی پیاده‌سازی شده است:

```
[ Platform Admin / AdminJS UI ]
               │
               ▼
   [ Route & Session Security ]
  (Redis Store, Argon2, Superuser Revalidation)
               │
               ▼
     [ AdminStationBridge ]
               │
   ┌───────────┼───────────┬──────────────┐
   ▼           ▼           ▼              ▼
[reservation] [payments] [gamingCenter] [verification]
[  Station  ] [Refunds ] [   Station  ] [   Station   ]
   │           │           │              │
   └───────────┼───────────┴──────────────┘
               │
               ▼
     [ Database & Engine ]
(PostgreSQL tstzrange, BullMQ Queues, Redis Caches)
```

### اصول حاکم بر معماری:
1. **عدم انزوای مستأجر (Zero Tenant Isolation for Superadmin):** مدیر ارشد پلتفرم به کلیه شعب، رزروها، درآمدها و کاربران دسترسی بدون فیلتر مستأجر دارد.
2. **اتصال مستقیم به لایه‌های تجاری (Station Delegation):** هیچ رکورد حساسی (رزرو، پرداخت، بازپرداخت) مستقیماً از طریق پایگاه داده ویرایش نمی‌شود. تمامی عملیات از توابع تخصصی `reservationStation`، `RefundsStation` و `ReconciliationStation` عبور می‌کنند تا محدودیت‌های زمانی (`tstzrange`)، ماشین وضعیت و دفترکل دوبل حفظ شوند.
3. **امنیت، سشن و هوک Audit:** تمام رویدادها همراه با پالایش بازگشتی کلیدهای حساس (رمزها، توکن‌ها و کلیدهای Idempotency) در جدول `AuditLog` ثبت می‌شوند.

---

## ۲. ماژول‌های پیاده‌سازی‌شده در فازهای ۱ تا ۴
- **فاز ۱ (زیرساخت، امنیت و ناوبری):**
  - احراز هویت با جدول `PlatformAdmin`، هشینگ Argon2 و سشن Redis با انقضا و بازاعتبارسنجی زنده وضعیت حساب (`isActive` و `isSuperuser`).
  - معماری ناوبری ۱۰‌گانه منطبق بر نیازمندی‌های پنل.
  - داشبورد Real-time مانیتورینگ سلامت دیتابیس، ردیس و صف‌های BullMQ (`sms`, `analytics`, `cmsSyncMedia`, `reminders`).
  - سیستم ثبت Audit Log با پالایش بازگشتی کلمات عبور و توکن‌ها.
- **فاز ۲ (مدیریت عملیاتی):**
  - مدیریت سراسری گیم‌سنترها: ایجاد مرکز، ویرایش اطلاعات، تعیین مدیر و فعال‌سازی/تعلیق.
  - مدیریت مدیران و پرسنل: ایجاد حساب مدیر، انتصاب به مرکز، ریست امن رمزعبور، ابطال فوری کلیه سشن‌های فعال در Redis.
  - مدیریت ایستگاه‌ها و تجهیزات: مدیریت `GameStation` و کاتالوگ سخت‌افزارها و بازی‌ها.
  - مدیریت چرخه حیات رزروها: لغو، تایید، شروع، اتمام و عدم حضور (No-Show) از طریق `AdminStationBridge`.
- **فاز ۳ (مدیریت مالی و تجاری):**
  - استعلام و لیست سراسری پرداخت‌ها با جزئیات کامل و عدم امکان تغییر دستی وضعیت.
  - مدیریت بازپرداخت‌ها (Refunds) با قفل سطری `SELECT FOR UPDATE` و امکان تلاش مجدد (Retry) با Idempotency.
  - مغایرت‌گیری و استعلام وضعیت از درگاه پرداخت با `ReconciliationStation`.
  - عدم امکان ویرایش یا حذف دفترکل (`LedgerEntry`) و کیف‌پول (`WalletTransaction`).
  - گزارش‌های مالی و خروجی استریم CSV تراکنش‌ها (`GET /api/v1/platform-admin/financials/export`).
- **فاز ۴ (گزارش‌گیری تحلیلی، مانیتورینگ و تکمیل نهایی):**
  - داشبورد تحلیلی `/api/v1/platform-admin/analytics/reports` با مقایسه دوره‌ها (Period Comparison) و سری‌های زمانی (Daily/Weekly/Monthly).
  - حذف قطعی ماژول‌های خارج از محدوده (CMS، وبلاگ، مدیا، تیکت‌ها و پیامک‌ها) از پنل اختصاصی سوپراادمین.

---

## ۳. شاخص‌ها و فرمول‌های محاسباتی (KPI Formulas)
1. **Gross Revenue (درآمد ناخالص):**
   $$\text{Gross Revenue} = \sum \text{Payment.amount} \quad [\text{status} = \text{PAID}]$$
2. **Net Revenue (درآمد خالص):**
   $$\text{Net Revenue} = \text{Gross Revenue} - \sum \text{Refund.amount} \quad [\text{status} = \text{SUCCESSFUL}]$$
3. **Platform Commission (سهم کارمزد پلتفرم):**
   $$\text{Commission} = \sum \text{Earning.commissionAmount}$$
4. **Gaming Centers Share (درآمد شعب):**
   $$\text{Centers Share} = \text{Net Revenue} - \text{Platform Commission}$$
5. **Reservation Cancellation Rate (نرخ لغو):**
   $$\text{Cancellation Rate} = \left( \frac{\text{Canceled Reservations}}{\text{Total Reservations}} \right) \times 100$$
6. **Average Reservation Duration (میانگین مدت رزرو):**
   $$\text{Avg Duration} = \frac{\sum \text{Reservation.totalHours}}{\text{Total Reservations}}$$

---

## ۴. فهرست کامل APIهای Platform Super Admin
تمامی مسیرها زیر پیشوند `/api/v1/platform-admin` قرار دارند و نیازمند توکن معتبر و نقش `PLATFORM_ADMIN` هستند:
- **احراز هویت و امنیت:**
  - `POST /api/v1/auth/platform-admin/login`: ورود با نام کاربری/تلفن و رمز عبور (Argon2).
- **گیم‌سنترها:**
  - `GET /gaming-centers`: فهرست جامع مراکز با فیلتر جست‌وجو و صفحه‌بندی.
  - `POST /gaming-centers`: ایجاد مرکز جدید و انتصاب مدیر.
  - `GET /gaming-centers/:id`: جزئیات مرکز همراه آدرس و آمار.
  - `PATCH /gaming-centers/:id`: ویرایش نام، اسلاگ و تنظیمات.
  - `PATCH /gaming-centers/:id/status`: فعال‌سازی یا غیرفعال‌سازی مرکز.
- **مدیران و پرسنل:**
  - `GET /users`: لیست کاربران و مدیران با فیلتر نقش و وضعیت.
  - `POST /users`: ایجاد مدیر یا کاربر جدید با هشینگ پسورد.
  - `PATCH /users/:id`: ویرایش اطلاعات فردی.
  - `PATCH /users/:id/status`: تغییر وضعیت فعال/مسدود.
  - `POST /users/:id/reset-password`: تغییر رمز عبور و ابطال سشن‌های کاربر.
  - `POST /users/:id/revoke-sessions`: ابطال تمام سشن‌های فعال کاربر در Redis.
- **رزروها:**
  - `GET /reservations`: جست‌وجو و فیلتر پیشرفته رزروها.
  - `POST /reservations/:id/cancel`: لغو رزرو با ثبت دلیل و تغییر وضعیت از طریق استیشن.
  - `POST /reservations/:id/confirm`: تایید رزرو.
  - `POST /reservations/:id/start`: شروع بازی (وضعیت IN_PROGRESS).
  - `POST /reservations/:id/complete`: پایان بازی (وضعیت COMPLETED).
  - `POST /reservations/:id/no-show`: ثبت عدم حضور کاربر.
- **امور مالی و خروجی:**
  - `GET /financials/overview`: شاخص‌های کلیدی مالی پلتفرم.
  - `GET /financials/payments`: لیست کامل تراکنش‌های پرداختی.
  - `GET /financials/refunds`: لیست درخواست‌ها و لاگ‌های ریفاند.
  - `POST /financials/refunds/:id/retry`: تلاش مجدد برای بازپرداخت ناموفق با Idempotency.
  - `POST /financials/payments/:id/reconcile`: مغایرت‌گیری و استعلام مستقیم از درگاه.
  - `GET /financials/export`: خروجی استریم CSV تراکنش‌های مالی.
- **گزارش‌ها و تحلیل‌ها:**
  - `GET /analytics/reports`: گزارش‌های تحلیلی، درآمدی، کاربران و روندها.
- **لاگ‌های امنیتی و نظارتی:**
  - `GET /audit-logs`: جست‌وجو در لاگ‌های امنیتی تغییرات.

---

## ۵. مدل‌های داده Prisma و سیاست دسترسی (Prisma Classification)
- **CRUD کامل یا هدایت‌شده:** `GamingCenter`, `User`, `GameStation`, `DeviceCatalog`, `GameCatalog`, `PlatformSetting`.
- **عملیات از طریق Workflow و Bridge (بدون ویرایش مستقیم):** `Reservation`, `Refund`, `Payment`, `GamingCenterVerification`.
- **کاملاً تغییرناپذیر (Strictly Read-Only):** `LedgerEntry`, `WalletTransaction`, `ReservationHistory`, `CommissionPolicy`, `Earning`, `ReconciliationRecord`, `AuditLog`.
- **خارج از محدوده پنل سوپرادمین (حذف‌شده طبق بخش ۱۶):** `Page`, `Post`, `Media`, `Ticket`, `NotificationLog`.

---

## ۶. اقدامات امنیتی و بهینه‌سازی عملکرد
1. **Session Hardening:** استفاده از کوکی‌های `httpOnly: true` و `sameSite: 'lax'` همراه با کنترل مجدد وضعیت کاربر در پایگاه داده در زمان احراز هر ریکوئست.
2. **پیشگیری از افشای اطلاعات:** فیلدهای `passwordHash`, `secret`, `token`, `otp`, `apiKey`, `idempotencyKey` در تمام پاسخ‌ها و نماهای پنل فیلتر و ماسک شده‌اند.
3. **بهینه‌سازی Queryها:** استفاده از متدهای Aggregation و GroupBy پریزما، صفحه‌بندی مبتنی بر Limit/Offset و پیشگیری از رخداد N+1 Query در گزارش‌ها.
4. **پایداری زیرساخت:** پایش دائمی صف‌های BullMQ و سلامت دیتابیس با مکانیزم‌های Fallback خودکار در داشبورد.

---

## ۷. وضعیت نهایی پروژه (Final Project Status Categorization)

### الف) بخش‌های تکمیل‌شده (Completed)
- [x] سیستم احراز هویت، سشن ردیس و امنیت ورود Platform Super Admin
- [x] ساختار ناوبری ۱۰‌گانه و استاندارد AdminJS
- [x] داشبورد مانیتورینگ سلامت زیرساخت (PostgreSQL, Redis, BullMQ) و معیارهای Real-time
- [x] پل ارتباطی عملیات (`AdminStationBridge`) به سرویس‌های دامنه‌ای و رعایت قفل‌های دیتابیس
- [x] مدیریت جامع گیم‌سنترها و شعب (مشاهده، ایجاد، وضعیت، ویرایش، مدیران)
- [x] مدیریت مدیران و پرسنل (ایجاد، ویرایش، مسدودسازی، ریست پسورد، ابطال سشن)
- [x] مدیریت ایستگاه‌های بازی و کاتالوگ سخت‌افزار و بازی‌ها
- [x] مدیریت چرخه حیات رزروها (لغو، تایید، شروع، پایان، عدم حضور) با حفظ تاریخچه
- [x] مدیریت مالی، استعلام درگاه، تلاش مجدد ریفاند، تغییرناپذیری دفترکل و کیف‌پول
- [x] صدور خروجی استاندارد CSV گزارش‌های مالی
- [x] گزارش‌ها و تحلیل‌های آماری پلتفرم با مقایسه دوره‌ای و تایم‌سریز
- [x] جداسازی و حذف بخش‌های خارج از محدوده (CMS، تیکت، پیامک)
- [x] پوشش کامل تست‌های خودکار (۱۱ فایل تست با ۹۷ تست پاس‌شده بدون خطا)

### ب) موارد نیازمند بهبود در آینده (Needs Improvement)
- طراحی نمودارهای گرافیکی تعاملی سمت کاربر با کتابخانه‌هایی نظir Chart.js/Recharts در صورت تمایل کارفرما به توسعه فرانت‌اند کاستوم React فراتر از قالب AdminJS.
- سیستم خودکار هشداردهی (Alerting) به تلگرام یا ایمیل سوپرادمین هنگام افت سلامت صف‌ها یا ثبت مغایرت‌های مالی حاد.

### ج) موارد پیاده‌سازی‌نشده به دلیل خروج از محدوده (Not Implemented - By Design)
- سیستم‌های مدیریت محتوا، وبلاگ، کتابخانه رسانه‌ها، تیکت‌های پشتیبانی و اوت‌باکس پیامک‌ها (بر اساس دستور صریح بند ۱۶ در فاز ۴ از محدوده پنل سوپرادمین حذف شدند).
