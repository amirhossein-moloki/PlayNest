# ۶. ممیزی وضعیت فعلی Analytics
## دامنه و سطح اطمینان
مخزن `amirhossein-moloki/PlayNest` در شاخه پیش‌فرض `main` بررسی شد؛ بخشی از کدها و schema با GitHub connector خوانده شدند. پایگاه داده، سرور اجراشده، تنظیمات تولید و اجرای تست از این محیط قابل دسترسی نبودند. اسناد تاریخی Analytics ادعاهای قابل‌راهنمایی هستند، اما جایگزین شواهد کد نمی‌شوند.

## یافته‌های تأییدشده در کد/مدل
| حوزه | شواهد | وضعیت |
|---|---|---|
| مدل کسب‌وکار پایه | `README.md`; `GamingCenter`, `GameStation`, `Reservation`, `GamingSession`, `Payment`, `Refund`, `LedgerEntry`, `CustomerAccount`, `StaffShift` در `sayra/prisma/schema.prisma` | `IMPLEMENTED_AND_VERIFIED` برای مدل |
| APIهای Analytics | `sayra/src/modules/analytics/analytics.routes.ts` شامل summary، reservations، financials، waitlist، notifications، staff، stations، revenue-chart، ingestion-status، customer analytics، reconciliation، benchmarks و growth-insights | `IMPLEMENTED_AND_VERIFIED` برای ثبت route |
| کنترل tenant و نقش | `analytics.routes.ts` از `authMiddleware`, `tenantGuard`, `requireRole([MANAGER, ADMIN])` استفاده می‌کند | `IMPLEMENTED_AND_VERIFIED` برای middleware در route |
| منطق controller | `sayra/src/modules/analytics/analytics.controller.ts` گزارش‌ها را به `AnalyticsStation` هدایت می‌کند و tenant id را از `req.tenant` می‌گیرد | `IMPLEMENTED_AND_VERIFIED` |
| ingestion | `sayra/src/modules/analytics/analyticsIngestionService.ts`، upsert مدل‌های تحلیلی، lookback پیش‌فرض ۱۲۰ دقیقه و batch پیش‌فرض ۵۰۰؛ worker در `sayra/src/jobs/workers/index.ts` import/ثبت شده | `IMPLEMENTED_AND_VERIFIED` برای کد، اجرای واقعی زمان‌بندی `NOT_VERIFIABLE` |
| تعریف شاخص مالی | `docs/analytics/final-metric-and-business-definitions.md`؛ فرمول‌های revenue، cash، completion، average booking و reconciliation | `PARTIALLY_IMPLEMENTED`؛ معنای «revenue» و واحد باید بازبینی شود |
| مشتری و سگمنت | مسیرهای customer summary/activity/retention/segmentation/top-spenders در routes؛ مستند تعریف‌های New/Repeat/VIP/At-Risk | `IMPLEMENTED_AND_VERIFIED` برای مسیر/تعریف مستند، نه runtime |
| قیف وب | جست‌وجوی frontend برای `page_view`, `gtag`, `Google Analytics`, `booking_started` نتیجه‌ای نداد | `DATA_COLLECTION_MISSING` بر اساس کد جست‌وجوشده؛ integration بیرونی `NOT_VERIFIABLE` |
| هزینه و سود | در schema بررسی‌شده مدل جامع هزینه عملیاتی، هزینه پردازش یا دارایی ثابت قابل تشخیص نبود | `DATA_COLLECTION_MISSING` برای محاسبه کامل سود؛ سایر سامانه‌ها `NOT_VERIFIABLE` |
| تاریخچه availability ایستگاه | `GameStation.isActive` و نرخ وجود دارد؛ شواهد کافی برای intervalهای تعمیر/availability تاریخی پیدا نشد | `PARTIALLY_IMPLEMENTED` |
| پشتیبانی و رضایت | `Ticket`, `Rating`, `Comment` و notification models وجود دارند | `PARTIALLY_IMPLEMENTED`؛ completeness زمان پاسخ/حل و دلایل نیازمند تأیید |
| benchmark | مسیر `/benchmarks` و `/growth-insights` و مستندات k-anonymity در handoff | `PARTIALLY_IMPLEMENTED` تا تست مستقل privacy/data واقعی |

## مسیرهای کد کلیدی
- `README.md`: معرفی سامانه، معماری دو backend و زیرساخت.
- `sayra/prisma/schema.prisma`: مدل‌های عملیاتی و مدل‌های `Analytics*`.
- `sayra/src/modules/analytics/analytics.routes.ts`: تعریف مسیرها و middleware.
- `sayra/src/modules/analytics/analytics.controller.ts`: ورودی گزارش‌ها و اتصال به service.
- `sayra/src/modules/analytics/analyticsIngestionService.ts`: استخراج incremental و upsert.
- `sayra/src/jobs/workers/index.ts`: ثبت workerهای analytics.
- `sayra/src/common/middleware/tenantGuard.ts`: کنترل مرکز.
- `docs/analytics/final-metric-and-business-definitions.md`: تعریف‌های فعلی ثبت‌شده.
- `docs/analytics/final-api-inventory.md`: inventory قبلی API؛ راهنماست، نه جایگزین بررسی route.
- `docs/analytics/analytics-handoff.md`: ادعاهای فازهای قبلی که در این سند به‌عنوان شواهد مستقل تست تلقی نشده‌اند.

## مغایرت‌ها و ریسک‌های تعریف
1. کاتالوگ قبلی `totalRevenue` را بر اساس `totalPrice` رزروهای COMPLETED تعریف می‌کند؛ این «ارزش رزرو تکمیل‌شده» است، نه الزاماً درآمد شناسایی‌شده حسابداری و نه وجه وصول‌شده.
2. کاتالوگ موجود برای utilization از «تعداد ایستگاه فعال × روز × ۲۴ ساعت» استفاده می‌کند؛ این مخرج برای مرکز با ساعات کاری محدود یا تعمیرات نادرست است. شاخص هدف باید بر ساعات واقعاً قابل‌استفاده بنا شود.
3. مدل اصلی برخی قیمت‌ها را `Float` دارد؛ مستند Analytics می‌گوید مقادیر صحیح در واحدهای پولی. مسیر تبدیل، ارز، گردکردن و سازگاری باید با آزمون بررسی شود.
4. `ReservationSource` (ONLINE/WALK_IN/PHONE) منبع عملیاتی است و جایگزین UTM/referrer/campaign نیست.
5. شاخص «active customer» و «repeat visit» بر رزرو تکمیل‌شده متکی است؛ باید از رزرو ایجادشده/پرداخت‌شده/لغوشده تفکیک شود.
6. وجود `AnalyticsWatermark` و `AnalyticsIngestionRun` قابلیت پایش طراحی‌شده را نشان می‌دهد، اما freshness واقعی بدون runtime قابل اثبات نیست.
7. اسناد handoff ادعای تست‌های موفق دارند؛ در این بررسی تست‌ها اجرا نشده‌اند و نباید نتیجه آنها را به‌عنوان اجرای مستقل اعلام کرد.

## ماتریس وضعیت بر اساس وضعیت‌های الزامی
| قلم | وضعیت |
|---|---|
| مدل‌های تحلیلی و ingestion service | `IMPLEMENTED_AND_VERIFIED` |
| APIهای اصلی داشبورد و مشتری/مالی | `IMPLEMENTED_AND_VERIFIED` برای مسیر و اتصال controller |
| فرمول‌های مالی/مشتری مستندشده | `PARTIALLY_IMPLEMENTED` تا بررسی unit/integration tests و runtime |
| tracking وب و attribution | `DATA_COLLECTION_MISSING` بر اساس جست‌وجوی مخزن |
| داده هزینه و سود واقعی | `DATA_COLLECTION_MISSING` در schema بررسی‌شده |
| تاریخچه ساعات قابل‌استفاده/تعمیر تجهیزات | `PARTIALLY_IMPLEMENTED` |
| ingestion runtime، کیفیت مقادیر و تست اجراشده | `NOT_VERIFIABLE` |
| پیش‌بینی demand/churn | `PLANNED_ONLY`؛ insight توصیفی معادل پیش‌بینی نیست |

## آزمون‌های لازم در مرحله بعد (اجرا نشده‌اند)
- unit tests برای فرمول‌ها با مرزهای تاریخ، صفر denominator، refund جزئی/چندگانه، پرداخت معلق و overpayment.
- integration tests برای tenant isolation در تمام endpointها و جلوگیری از نشت در benchmark.
- source-to-shadow reconciliation، duplicate/retry، late update و حذف منبع.
- تست timezone/DST و مرزهای روز.
- تست consistency بین dashboard، API و گزارش مالی.
- runtime check برای worker cadence، queue failures، freshness و error alert.
