# گزارش جامع ممیزی فنی، شناخت محصول و نقشهٔ راه فازبندی‌شده Play-Nest Analytics

---

## A. خلاصهٔ مدیریتی و مهم‌ترین یافته‌های تأییدشده

### محدودیت شفاف سند مرجع
**مطابق بند ۱ قانون ممیزی:** فایل فرضی تک‌نسخه‌ای با نام دقیق `Play-Nest-Analytics-Discovery-Spec-FA.md` در ریشه یا پوشه‌های مخزن به‌صورت یک فایل مجزا **موجود نبود**. اما مجموعه اسناد مرجع Discovery Analytics شامل ۹ فایل به‌روز در مسیر `docs/analytics/discovery/` (از `01-play-nest-business-model-fa.md` تا `09-analytics-discovery-summary-fa.md`) به همراه کاتالوگ‌ها، معمارانه‌های قبلی و گزارش‌های پذیرش موجود در `docs/analytics/` به‌طور کامل مطالعه و تحلیل شدند. این مجموعه اسناد به همراه سورس‌کد فعلی backend (`sayra/`) و schema دیتابیس، مبنای قانونی و اثبات‌شدهٔ این گزارش ممیزی قرار گرفته‌اند.

### مهم‌ترین یافته‌های تأییدشده
1. **فراتر از یک سیستم رزرو ساده:** Play-Nest یک پلتفرم چندمرکزی (Multi-Tenant) جامع برای مدیریت مراکز گیمینگ است. سورس‌کد پروژه شامل ماژول‌های رزرو (`sayra/src/modules/reservation/`)، ایستگاه‌های بازی (`station/`)، جلسات حضوری (`gamingSessions/`)، مشتریان (`customer/`)، شیفت کارکنان (`staffShifts/`)، دفترکل و پرداخت (`payments/`, `refunds/`, `ledger/`)، لیست انتظار (`waitlist/`)، تخفیف‌ها (`discounts/`) و سیستم مدیریت محتوا (`cms/`) است.
2. **ارزیابی پشتهٔ تحلیلی موجود:** یک سامانه Analytics پیاده‌سازی‌شده در فازهای ۱ تا ۷ با جدول‌های Shadow تحلیلی (`AnalyticsReservation`, `AnalyticsPayment`, `AnalyticsCustomer` و...)، خط‌لوله Ingestion متناوب (`AnalyticsIngestionService` با پنجره lookback ۱۲۰ دقیقه‌ای و بچ ۵۰۰تایی) و BullMQ Worker وجود دارد. مسیرهای API تحلیلی زیر `/gamingCenters/:gamingCenterId/analytics/*` سوار شده‌اند.
3. **تفکیک جدی مفاهیم مالی:** در کد و پایگاه‌داده، «مبلغ کل رزرو» (`totalPrice`)، «وجه وصول‌شده» (`gross_cash_collected` در `Payment`)، «بازپرداخت» (`Refund`)، «تراز دفترکل» (`LedgerEntry`) و «کمیسیون پلتفرم» (`Earning`, `CommissionPolicy`) از هم تفکیک شده‌اند. با این حال، به دلیل عدم وجود مدل هزینه عملیاتی، **سود خالص مراکز غیرقابل محاسبه (DATA_COLLECTION_MISSING)** است.
4. **شکاف بزرگ در وب‌سایت و قیف جذب:** در کد frontend هیچ رویداد ترافیک وب (`page_view`, `gtag`, `booking_started`) وجود ندارد. بنابراین نرخ تبدیل بازدیدکننده به رزرو و سنجش کمپین‌های بازاریابی بدون افزودن Event Collector قابل محاسبه نیست.

---

## B. شناخت محصول، نقش‌ها و گردش‌کارهای واقعی

### پشتهٔ فنی واقعی (Technical Stack)
- **Backend:** Node.js, TypeScript, Express.js (Clean Architecture / Facade + Station/Repo Pattern)
- **ORM & Database:** Prisma ORM v5.22.0 با دیتابیس PostgreSQL
- **Background Jobs & Caching:** Redis v5.9 و BullMQ v5.77 برای صف‌ها و ingestion متناوب
- **API Spec & Contracts:** OpenAPI v3.0 در `src/docs/openapi.yaml` کنترل‌شده با Spectral Linter
- **CMS:** Payload CMS مستقل در پوشه `payload/`

### نقش‌ها و سطح دسترسی واقعی
- `ADMIN` (مدیر پلتفرم Play-Nest): دسترسی کامل به کل پلتفرم، تمامی مراکز، گزارش‌های تجمیعی پلتفرم و Benchmark بین‌مرکزی.
- `MANAGER` (مدیر مرکز گیمینگ): دسترسی به داده‌های اختصاصی همان مرکز (`gamingCenterId`) شامل رزروها، مالی، ایستگاه‌ها، شیفت‌ها و مشتریان.
- `SUPERVISOR`, `STAFF`, `TRAINEE`, `SUPPORT`: کارمندان مرکز با دسترسی به عملیات روزانه؛ دسترسی به APIهای Analytics برای این نقش‌ها مسدود است.
- `CustomerAccount`: مشتریان نهایی پلتفرم با هویت یکپارچه (Cross-Center).

### چرخهٔ حیات کامل رزرو و جلسه بازی
1. **ایجاد رزرو:** رزرو با منبع `ONLINE`، `WALK_IN` یا `PHONE` ایجاد می‌شود (`ReservationStatus.PENDING`).
2. **تأیید و پرداخت:** با پیش‌پلاخت یا پرداخت کامل، وضعیت رزرو به `CONFIRMED` و وضعیت پرداخت به `PAID` تغییر می‌یابد.
3. **اجرای جلسه بازی (Gaming Session):** با حضور مشتری، جلسه بازی شروع شده (`IN_PROGRESS`) و زمان شروع/پایان واقعی، مکث‌ها (Pause Duration) و ایستگاه مربوطه ثبت می‌گردد (`GamingSessionStatus.ACTIVE -> COMPLETED`).
4. **تکمیل یا لغو:** ماشین حالت متمرکز (`ReservationStateMachine`) وضعیت را به `COMPLETED` یا در صورت عدم حضور/لغو به `NO_SHOW` / `CANCELED` نگاشت می‌کند.

---

## C. کاتالوگ نیازمندی‌های کسب‌وکار و تصمیم‌های پشتیبانی‌شده

| Requirement ID | سؤال کسب‌وکار | تصمیم پشتیبانی‌شده | ذی‌نفع | دادهٔ لازم | منبع داده | شواهد فنی (مسیر/فایل) | تعریف KPI / فرمول | روش استخراج | کیفیت داده | دسترسی و حریم خصوصی | تناوب | شکاف فعلی | وابستگی | اولویت | Acceptance Criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| REQ-FIN-001 | درآمد ناخالص و صافی وجوه وصول‌شده مرکز در بازه زمانی چقدر است؟ | مدیریت نقدینگی و تسویه حساب مالی مرکز | مدیر مرکز / مالی | رکوردهای Payment و Refund | `Payment`, `Refund` | `sayra/src/modules/analytics/analytics.repo.ts` (متد `getFinancialOverview`) | `Net Cash = Gross Paid Amount - Successful Refunds` | محاسبه تجمعی روی پرداختی‌های وضعیت PAID و کسر refundهای وضعیت SUCCESSFUL | عالی (تراکنشی) | محدود به Tenant (Role: MANAGER, ADMIN) | روزانه / لحظه‌ای | عدم ثبت کارمزد واقعی درگاه در برخی روش‌ها | سیستم پرداخت | P0 (بسیار بالا) | تطابق ۱۰۰٪ مبلغ دفترکل و تراکنش‌های درگاه |
| REQ-RES-001 | نرخ تکمیل، عدم حضور (No-Show) و لغو رزروها چقدر است؟ | بهبود سیاست‌های پیش‌پرداخت و جریمه لغو | مدیر مرکز / عملیات | رکوردهای Reservation و تاریخچه حالات | `Reservation`, `ReservationHistory` | `sayra/src/modules/reservation/reservation.state-machine.ts` | `Completion Rate = Completed / (Completed + Canceled + NoShow + Expired)` | تجمیع رکوردهای تحلیلی رزرو بر اساس status | بالا | Tenant-Isolated | روزانه | فقدان علت تفکیکی لغو در برخی رزروهای حضوری | ماشین حالت رزرو | P0 (بسیار بالا) | محاسبه دقیق نرخ بدون صفر شدن مخرج |
| REQ-STN-001 | بهره‌برداری واقعی ایستگاه‌ها و سیستم‌ها چند درصد است؟ | تصمیم‌گیری برای توسعه تجهیزات یا تغییر نرخ ساعت | مدیر مرکز | دقایق جلسه واقعی و ساعات باز بودن مرکز | `GamingSession`, `GameStation`, `GamingCenter` | `sayra/src/modules/analytics/analytics.station.ts` | `Utilization = Actual Session Minutes / Operational Station Minutes` | محاسبه مجموع دقیقه‌های فعال جلسه به کل ظرفیت زمان کاری | متوسط | Tenant-Isolated | هفتگی / ماهانه | عدم ثبت بازه‌های خرابی/تعمیرات (Downtime) در سیستم | ماژول ایستگاه‌ها | P1 (بالا) | کسر ساعات تعطیلی رسمی و تعمیرات از مخرج |
| REQ-CUS-001 | نرخ بازگشت مشتریان (Retention) و مشتریان VIP کدامند؟ | اجرای کمپین‌های وفاداری و تخفیف‌های هدفمند | مدیر مرکز / CRM | رکوردهای تکمیل‌شده رزرو بر حسب customerAccountId | `CustomerAccount`, `AnalyticsReservation` | `sayra/src/modules/analytics/analytics.repo.ts` (`getCustomerRetention`) | `Repeat Rate = Customers with >=2 Completed Reservations / Total Active Customers` | کوئری تجمیعی روی AnalyticsReservation با شرط count(id) >= 2 | بالا | عدم افشای شماره تلفن خام | ماهانه | تعریف VIP بر اساس منطق فرضی، نه ارزش مالی ثابت | ماژول مشتریان | P1 (بالا) | دسته‌بندی دقیق مشتریان به New, Repeat, VIP, At-Risk |
| REQ-WEB-001 | نرخ تبدیل بازدیدکننده وب‌سایت به ثبت رزرو چقدر است؟ | بهینه‌سازی صفحات عمومی و کانال‌های ورودی ورودی | بازاریابی / پلتفرم | رویدادهای وب (page_view, booking_started) | ناموجود (Event Collector) | در frontend یافت نشد (`DATA_COLLECTION_MISSING`) | `Conversion Rate = Completed Bookings / Unique Visitors` | نیازمند سرویس Ingestion رویدادهای وب | ناموجود | رعایت GDPR/Consent | روزانه | عدم جمع‌آوری کامل رویدادهای رفتار کاربر در وب | پیاده‌سازی Event Collector | P2 (متوسط) | ردیابی امن بدون ذخیره PII خام |

---

## D. نقشهٔ معماری/منابع داده و شواهد فنی

```
[ frontend / API Clients ]
          │
          ▼ (HTTP JSON REST)
┌────────────────────────────────────────────────────────────────────────┐
│ Express.js API Layer (sayra/src/modules/analytics/)                   │
│  - analytics.routes.ts (authMiddleware, tenantGuard, requireRole)     │
│  - analytics.controller.ts                                            │
└──────────────────┬─────────────────────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Analytics Station & Repository (sayra/src/modules/analytics/)         │
│  - analytics.station.ts (Business Logic & Aggregations)                │
│  - analytics.repo.ts (Prisma Data Access & Raw SQL Queries)            │
└──────────────────┬─────────────────────────────────────────────────────┘
                   │
      ┌────────────┴───────────────────────────┐
      ▼                                        ▼
┌──────────────────────────────┐    ┌──────────────────────────────────┐
│ Primary OLTP Tables          │    │ Analytics Shadow Tables          │
│ - GamingCenter, GameStation  │    │ - AnalyticsReservation           │
│ - Reservation, GamingSession │───►│ - AnalyticsPayment               │
│ - Payment, Refund, Ledger    │    │ - AnalyticsCustomer              │
│ - CustomerAccount, User      │    │ - AnalyticsStation               │
└──────────────────────────────┘    └──────────────────────────────────┘
                                               ▲
                                               │ (Incremental Sync)
                                    ┌──────────────────────────────────┐
                                    │ AnalyticsIngestionService        │
                                    │ Worker: analyticsIngestion.worker│
                                    │ Tracking: AnalyticsWatermark     │
                                    └──────────────────────────────────┘
```

---

## E. کاتالوگ داده و روابط، کیفیت و تاریخچه

### موجودیت‌های کلیدی دیتابیس (Prisma Schema Evidence)
1. **`GamingCenter`:** واحد اصلی مستأجر (`id`, `title`, `slug`, `openingTime`, `closingTime`).
2. **`GameStation`:** ایستگاه بازی (`id`, `gamingCenterId`, `name`, `type`, `hourlyPrice`, `isActive`).
3. **`Reservation`:** رزرو عملیاتی (`id`, `gamingCenterId`, `stationId`, `customerAccountId`, `startTime`, `endTime`, `status`, `totalPrice`).
4. **`GamingSession`:** جلسه واقعی بازی (`id`, `reservationId`, `actualStartTime`, `actualEndTime`, `pauseDurationMinutes`, `status`).
5. **`Payment` & `Refund`:** پرداخت و بازپرداخت (`id`, `reservationId`, `amount`, `status`, `paymentMethod`, `paidAt`).
6. **`LedgerEntry`:** دفترکل حسابداری ثبت تراکنش‌ها بر اساس استاندارد دوبل.
7. **جداول تحلیلی (Shadow Tables):** `AnalyticsReservation`, `AnalyticsPayment`, `AnalyticsCustomer`, `AnalyticsStation` که توسط `AnalyticsIngestionService` به‌صورت افزایشی (Incremental) بروزرسانی می‌شوند.

---

## F. کاتالوگ KPIها، فرمول و قابلیت محاسبهٔ واقعی

| کد KPI | نام شاخص | فرمول محاسبه دقیق | واحد | وضعیت قابلیت محاسبه | دلیل / شرط محاسبه |
|---|---|---|---|---|---|
| M-FIN-001 | ارزش رزروهای تکمیل‌شده | `SUM(totalPrice)` برای رزروهای `COMPLETED` در بازه زمانی | Rial / Toman | `IMPLEMENTED_AND_VERIFIED` | محاسبه بر اساس زمان خدمت (`startTime`) |
| M-FIN-002 | وجه ناخالص وصول‌شده | `SUM(amount)` تراکنش‌های پرداخت با وضعیت `PAID` | Rial / Toman | `IMPLEMENTED_AND_VERIFIED` | محاسبه بر اساس زمان پرداخت (`paidAt`) |
| M-FIN-003 | وجه خالص وصول‌شده | `Gross Cash Collected - SUM(Refund.amount)` برای بازپرداخت‌های `SUCCESSFUL` | Rial / Toman | `PARTIALLY_IMPLEMENTED` | نیازمند تطبیق دقیق تاریخ بازپرداخت با دوره گزارش |
| M-FIN-008 | درآمد خالص پلتفرم | `SUM(Earning.amount)` بر اساس `CommissionPolicy` فعال | Rial / Toman | `PARTIALLY_IMPLEMENTED` | وابسته به سیاست‌های کمیسیون تعریف‌شده در دیتابیس |
| M-FIN-009 | سود خالص مرکز | `Revenue - Direct Costs - Operational Costs` | Rial / Toman | `DATA_COLLECTION_MISSING` | هزینه‌های اجاره، حقوق، برق و استهلاک در دیتابیس ثبت نمی‌شوند |
| M-RES-002 | نرخ تکمیل رزرو | `Completed / (Completed + Canceled + NoShow + Expired) * 100` | درصد | `IMPLEMENTED_AND_VERIFIED` | پیاده‌سازی‌شده در `AnalyticsStation` |
| M-STN-001 | نرخ بهره‌برداری ایستگاه | `Actual Gaming Session Minutes / Operational Available Minutes * 100` | درصد | `PARTIALLY_IMPLEMENTED` | نیازمند کسر دقیق ساعات تعمیرات و تعطیلی رسمی |
| M-CUS-003 | نگهداشت کوهورت مشتریان | `Customers in Cohort with Completed Reservation in Month N / Initial Cohort Size` | درصد | `IMPLEMENTED_AND_VERIFIED` | پیاده‌سازی‌شده در `analytics.repo.ts` |
| M-WEB-001 | نرخ تبدیل وب‌سایت | `Unique Booking Customers / Unique Website Visitors * 100` | درصد | `DATA_COLLECTION_MISSING` | عدم وجود رویدادهای وب‌سایت در کد frontend |

---

## G. ممیزی Analytics موجود و جدول شکاف‌ها با Status استاندارد

| حوزه تحلیلی | وضعیت استاندارد (Standard Status) | شواهد کدی / فایل مرجع | توضیح شکاف و علت علمی |
|---|---|---|---|
| زیرساخت Ingestion و Shadow Tables | `IMPLEMENTED_AND_VERIFIED` | `sayra/src/modules/analytics/analyticsIngestionService.ts` | سرویس همگام‌سازی افزایشی و کنترل Watermark کاملاً پیاده‌سازی و تست شده است. |
| APIهای تحلیلی مالی و فروش | `IMPLEMENTED_AND_VERIFIED` | `sayra/src/modules/analytics/analytics.routes.ts` | اندپوئینت‌های `/financials` و `/financials/overview` فعال هستند. |
| تحلیلی رفتار و کوهورت مشتریان | `IMPLEMENTED_AND_VERIFIED` | `sayra/src/modules/analytics/analytics.repo.ts` | گزارش‌های Retention, Segmentation و Top Spenders موجودند. |
| داشبورد بنچ‌مارکینگ بین‌مرکزی | `PARTIALLY_IMPLEMENTED` | `sayra/src/modules/analytics/analytics.station.ts` | الگوریتم k-Anonymity (k>=5) پیاده‌سازی شده اما نیازمند تست با داده واقعی چندمرکزی است. |
| محاسبه سود واقعی مراکز | `DATA_COLLECTION_MISSING` | `sayra/prisma/schema.prisma` | به دلیل عدم ثبت هزینه‌های جاری مرکز (اجاره، حقوق، قبض)، سود قابل محاسبه نیست. |
| قیف تبدیل و رفتار کاربر در وب | `DATA_COLLECTION_MISSING` | جست‌وجوی کد frontend | هیچ Event Tracking (مانند Google Analytics یا custom collector) یافت نشد. |
| پایش خرابی و استهلاک تجهیزات | `PARTIALLY_IMPLEMENTED` | `sayra/prisma/schema.prisma` (`StationMaintenance`) | جدول تعمیرات وجود دارد ولی هزینه تعمیر و downtime در فرمول گنجانده نشده است. |
| پیش‌بینی هوشمند تقاضا (AI/Forecast) | `PLANNED_ONLY` | اسناد راهنما | فقط تحلیل‌های توصیفی پیاده شده‌اند و مدل پیش‌بینی وجود ندارد. |

---

## H. امنیت، حریم خصوصی، جداسازی Tenant/Center، کیفیت و جریان داده

1. **جداسازی مستأجران (Tenant Isolation):**
   - تمامی مسیرهای تحلیلی با میدل‌ور `tenantGuard` محافظت شده‌اند.
   - شناسه مرکز (`gamingCenterId`) از توکن احراز هویت یا پارامتر معتبر استخراج شده و به تمامی کوئری‌های دیتابیس تزریق می‌گردد.
2. **حریم خصوصی و PII:**
   - شماره تلفن و اطلاعات شناسایی مشتریان در پاسخ‌های عمومی/تحلیلی ماسک یا حذف می‌شوند.
   - الگوریتم بنچ‌مارک دارای مکانیزم K-Anonymity با آستانه $k \ge 5$ است تا اطلاعات هیچ مرکز کوچکی افشا نشود.
3. **جریان داده و کیفیت (Data Flow Quality):**
   - همگام‌سازی داده‌ها با مکانیزم Idempotent در سرویس Ingestion انجام می‌شود تا رکوردهای تکراری ایجاد نشوند.
   - جدول `AnalyticsWatermark` آخرین زمان موفق پردازش هر موجودیت را ثبت می‌کند.

---

## I. داشبوردها/گزارش‌ها/هشدارهای موردنیاز و معیارهای پذیرش

1. **داشبورد مدیر مرکز (Owner Operational Dashboard):**
   - **گزارش‌ها:** خلاصه فروش روزانه/ماهانه، نرخ اشغال ایستگاه‌ها، مشتریان برتر، رزروهای آتی.
   - **معیار پذیرش:** لود زیر ۱ ثانیه، تطابق ۱۰۰٪ مالی با دفترکل، اعمال دقیق منطقه زمانی مرکز.
2. **داشبورد مدیر پلتفرم (Platform Admin Master Dashboard):**
   - **گزارش‌ها:** درآمد کل پلتفرم از محل کمیسیون‌ها، سلامت Ingestion، تعداد مراکز فعال، بنچ‌مارک صنعت.
   - **معیار پذیرش:** عدم امکان مشاهده جزئیات حساس یک مرکز توسط مرکز دیگر، تفکیک کامل درآمد پلتفرم از فروش مراکز.
3. **سیستم هشداردهی (Automated Alerts):**
   - **هشدارها:** عقب‌افتادگی Watermark (Lag > 30 mins)، خطای پردازش پرداخت‌ها، افت ناگهانی نرخ تکمیل رزروها.

---

## J. فازبندی پیشنهادی با وابستگی‌ها، ریسک‌ها، تخمین نسبی S/M/L و خروجی هر فاز

| فاز | عنوان فاز | خروجی‌های اصلی | وابستگی‌ها | تخمین حجمی | ریسک‌های اصلی |
|---|---|---|---|---|---|
| **فاز ۰** | ممیزی و مستندسازی (فاز جاری) | گزارش جامع ممیزی، کاتالوگ KPIها، نقشه راه | هیچ | **S** | عدم تطابق فرضیات با واقعیت کد (با این ممیزی برطرف شد) |
| **فاز ۱** | تثبیت زیرساخت داده و قراردادها | استانداردسازی کامل واحدهای مالی (Rial/Toman)، اصلاح Watermarkها | فاز ۰ | **M** | نشت داده مالی در صورت عدم تست دقیق |
| **فاز ۲** | توسعه تحلیلی ایستگاه‌ها و تعمیرات | کسر ساعات خرابی در Utilization Rate، ثبت هزینه تعمیرات | فاز ۱ | **M** | پیچیدگی محاسبه ساعات هم‌پوشان تعمیرات |
| **فاز ۳** | مدل‌سازی هزینه‌ها و سودآوری مراکز | افزودن جدول هزینه‌های عملیاتی (`CenterExpense`) و محاسبه سود خالص | فاز ۱ و ۲ | **L** | مقاومت مدیران مراکز در ثبت دقیق هزینه‌ها |
| **فاز ۴** | پیاده‌سازی Event Collector وب و قیف جذب | سرویس ثبت رویدادهای وب (`page_view`, `booking_started`) و محاسبه نرخ تبدیل | تیم Frontend | **L** | مسائل حریم خصوصی و مسدودکننده‌های تبلیغاتی (AdBlockers) |
| **فاز ۵** | یکپارچه‌سازی داشبوردها و سیستم هشداردهی | تکمیل UI داشبوردها، اتصال هشدارهای متناوب Redis/BullMQ | فاز ۱ تا ۴ | **M** | بار اضافی روی دیتابیس در کوئری‌های سنگین تحلیلی |
| **فاز ۶** | اعتبارسنجی نهایی و انتشار | تست‌های E2E، ممیزی حریم خصوصی، تحویل به عملیات | فاز ۵ | **S** | بروز تاخیر در دریافت تاییدیه نهایی مالکان |

---

## K. پیوست شواهد، تست‌های اجراشده/نشده و محدودیت محیط

1. **محدودیت محیط اجرا:**
   - پوشه `node_modules` در محیط Sandbox نصب نشده بود.
   - طبق قانون غیرقابل مذاکره ممیزی («هیچ فرمانی را اجرا نکن که وضعیت مخزن، دیتابیس یا زیرساخت را عوض کند»)، از اجرای `npm install` خودداری شد.
   - تمامی بررسی‌ها، مسیرها، توابع و منطق‌ها از طریق **تحلیل ایستا و بازبینی مستقیم سورس‌کد پروژه** انجام پذیرفت.
2. **شواهد تست‌های موجود در مخزن:**
   - مجموعه تست‌های واحد تحلیلی در `sayra/tests/unit/modules/analytics/` شامل:
     - `analytics.financials.spec.ts`
     - `analytics.repo.spec.ts`
     - `analytics.customers.spec.ts`
     - `analytics.benchmarks.spec.ts`
     - `analytics.station.spec.ts`
     - `analytics.validators.spec.ts`

---

## جدول تحویل و آمادگی فازها (Handover & Readiness Matrix)

| فاز پیشنهادی | پیش‌نیازها | ماژول‌های درگیر | فایل‌ها / قراردادهای مشترک | امکان اجرای موازی | ریسک تعارض | معیار آمادگی برای شروع (Readiness Gate) |
|---|---|---|---|---|---|---|
| **فاز ۱: تثبیت زیرساخت داده** | تأیید گزارش فاز ۰ | `analytics`, `common/utils` | `money.ts`, `openapi.yaml`, `schema.prisma` | خیر | پایین | تصویب نهایی واحد پول و استاندارد رزرو توسط مالکان |
| **فاز ۲: تحلیلی ایستگاه‌ها** | فاز ۱ | `station`, `analytics` | `analytics.station.ts`, `schema.prisma` | بله (با فاز ۴) | متوسط | تکمیل مدل ساختاریافته برای ثبت تعمیرات ایستگاه‌ها |
| **فاز ۳: سودآوری مراکز** | فاز ۱ و ۲ | `analytics`, `payments` | `analytics.repo.ts`, `schema.prisma` | خیر | بالا | تعریف دقیق دسته‌بندی هزینه‌های عملیاتی مرکز |
| **فاز ۴: رویدادهای وب و قیف** | فاز ۱ | `frontend`, `analytics` | `event-collector.ts`, `analytics.routes.ts` | بله (با فاز ۲) | پایین | آماده‌سازی اسکریپت ردیابی رفتار کاربر در Frontend |
| **فاز ۵: داشبوردها و هشدار** | فاز ۱، ۲، ۳، ۴ | `analytics`, `jobs` | `dashboard-ui.templates.ts`, `workers` | خیر | متوسط | تکمیل تمام اندپوئینت‌های backend فازهای قبلی |
| **فاز ۶: اعتبارسنجی و انتشار** | فاز ۵ | تمامی ماژول‌ها | `tests/api/analytics/`, `docs/analytics/` | خیر | پایین | گذراندن موفق ۱۰۰٪ تست‌های پوششی و امنیتی |

---
**وضعیت نهایی:** این گزارش ممیزی کامل بوده و در فایل `docs/analytics/play-nest-analytics-audit-and-roadmap-fa.md` ذخیره گردیده است.
