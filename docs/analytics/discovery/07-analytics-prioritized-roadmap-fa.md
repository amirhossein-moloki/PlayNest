# ۷. نقشه راه اولویت‌بندی‌شده Analytics
ترتیب زیر با توجه به وجود analytics فعلی، ریسک تعریف مالی و فقدان tracking/cost پیشنهاد می‌شود. این سند برنامه است؛ هیچ تغییری در کد اجرا نشده است.

## فاز A — بنیان داده
### A1. قرارداد رسمی شاخص‌ها و واحد پول
- **خروجی:** فرهنگ لغت فروش/درآمد/وجه وصول‌شده/refund/کمیسیون؛ قرارداد timezone و cohort.
- **وضعیت:** مدل و کاتالوگ وجود دارد؛ تعاریف در `docs/analytics/final-metric-and-business-definitions.md` نیازمند تطبیق با منطق کد.
- **تغییر لازم:** تأیید تعریف حسابداری، ارز، واحد، زمان شناسایی، وضعیت‌های مشمول.
- **وابستگی:** مدیر مالی و مالک محصول.
- **پذیرش:** هر KPI دارای مالک، فرمول، denominator، timezone و وضعیت‌های حذف‌شده باشد.
- **آزمون صحت:** fixture ساختگی با refund جزئی، پرداخت ناموفق، لغو و رزرو تکمیل‌شده؛ تطبیق محاسبه SQL/service.
- **ریسک:** تعبیر اشتباه totalPrice به‌عنوان درآمد.

### A2. ممیزی lineage و کیفیت ingestion
- **خروجی:** داشبورد freshness و گزارش اختلاف تعداد source/shadow برای هر entity.
- **وضعیت:** `AnalyticsIngestionService`, `AnalyticsWatermark`, `AnalyticsIngestionRun` و worker وجود دارند.
- **تغییر لازم:** آستانه SLA، alert شکست/lag، کنترل orphan/duplicate، تست late update/delete و ثبت lineage.
- **وابستگی:** مهندسی داده/Backend، observability.
- **پذیرش:** آخرین موفقیت هر entity و lag قابل مشاهده؛ شکست run هشدار تولید کند؛ retry دوباره‌شماری نکند.
- **آزمون:** تزریق خطای تستی و تغییر رکورد با timestamp قدیمی/جدید؛ مقایسه منبع و shadow.
- **ریسک:** watermark جلوتر از داده نرود؛ تست runtime هنوز در این ممیزی اجرا نشده است.

### A3. امنیت و حریم خصوصی تحلیلی
- **خروجی:** ماتریس نقش×endpoint×فیلد و سیاست retention.
- **وضعیت:** middlewareهای auth/tenant و masking در اسناد/کد معرفی شده‌اند.
- **تغییر لازم:** تست tenant isolation، محدودسازی PII، log redaction و policy حذف.
- **پذیرش:** کاربر مرکز A نتواند داده مرکز B را بخواند؛ خروجی عمومی شماره تلفن کامل نداشته باشد.
- **آزمون:** negative authorization tests و بررسی snapshot خروجی.
- **ریسک:** benchmark می‌تواند حتی بدون شناسه مستقیم اطلاعات مرکز کوچک را افشا کند.

## فاز B — داشبوردهای اصلی
### B1. داشبورد رزرو و تقاضا
- **خروجی:** created/confirmed/completed/canceled/no-show/expired، lead time، waitlist conversion و روند ساعتی.
- **وضعیت:** routeهای `/summary`, `/reservations`, `/operations/waitlist` وجود دارند.
- **تغییر لازم:** cohort بر اساس createdAt در برابر service time؛ علت لغو و وضعیت نهایی.
- **پذیرش:** مجموع وضعیت‌ها با source records در پنجره یکسان برابر باشد؛ رزرو آینده no-show شمرده نشود.
- **آزمون:** داده ساختگی شامل هر status و timezone boundary.
- **وابستگی:** A1/A2.

### B2. داشبورد وجه و تطبیق
- **خروجی:** gross collected، net collected، outstanding، payment failure، refund، reconciliation.
- **وضعیت:** `/financials`, `/financials/overview`, `/financials/reconciliation` و run route وجود دارند.
- **تغییر لازم:** برچسب‌گذاری مجدد revenue مبهم، join و تخصیص پرداخت/بازپرداخت، توضیح اختلاف‌ها.
- **پذیرش:** جمع پرداخت‌های موفق با دفترکل و گزارش provider قابل تطبیق؛ refund دوبار کسر نشود.
- **آزمون:** پرداخت جزئی، چند پرداخت برای یک رزرو، refund جزئی و ambiguous.
- **وابستگی:** A1، دسترسی به provider settlement.

### B3. بهره‌برداری ایستگاه
- **خروجی:** session hours، scheduled availability، utilization و downtime.
- **وضعیت:** `/stations`, `GamingSession`, `GameStation` موجودند.
- **تغییر لازم:** ثبت availability تاریخ‌دار، ساعات کاری بر اساس روز و maintenance intervals.
- **پذیرش:** utilization هیچ‌گاه از ۱۰۰٪ فراتر نرود مگر دلیل هم‌پوشانی ثبت و گزارش شود؛ مخرج قابل توضیح باشد.
- **آزمون:** بازه تعطیلی، تعمیر و session نیمه‌شب.
- **وابستگی:** عملیات مرکز و A1.

### B4. سلامت عملیات Analytics
- **خروجی:** freshness، run failure، API error، notification delivery و payment processing status.
- **وضعیت:** ingestion status و notification report در API وجود دارند.
- **تغییر لازم:** SLA، alerting و correlation IDs.
- **پذیرش:** رخداد شکست قابل ردیابی از درخواست تا رزرو/پرداخت؛ رویدادهای فنی از KPIهای کسب‌وکار جدا باشند.
- **آزمون:** خطای provider/worker در محیط تست.

## فاز C — رشد
### C1. قیف وب حداقلی
- **خروجی:** page_view → center_viewed → registration → booking_started → booking_created.
- **وضعیت:** شواهد tracking در frontend پیدا نشد.
- **تغییر لازم:** collector/SDK با consent، anonymous/session IDs، UTM allowlist و schema version.
- **پذیرش:** event coverage و duplicate rate گزارش شود؛ رزروهای backend با eventها دوباره‌شماری نشوند.
- **آزمون:** سناریوی ناشناس تا ورود، consent denied، ad-blocker و retry.
- **وابستگی:** سیاست حریم خصوصی و تصمیم محصول.

### C2. Retention و بخش‌بندی عملیاتی
- **خروجی:** cohort retention، RFM و segment transition.
- **وضعیت:** summary/retention/segmentation موجود؛ RFM استاندارد و نسخه‌بندی نیازمند بررسی است.
- **تغییر لازم:** مرز segmentها، دوره مشاهده و تعریف مشتری فعال.
- **پذیرش:** یک مشتری فقط در یک segment نسخه‌دار قرار گیرد یا چندبرچسبی بودن صریح باشد.
- **آزمون:** مشتری جدید، تکراری، VIP، غیرفعال و داده ناقص.

### C3. attribution و هزینه کمپین
- **خروجی:** CAC و campaign-attributed booking/revenue.
- **وضعیت:** `Discount` موجود؛ campaign spend و web attribution تأیید نشد.
- **تغییر لازم:** اتصال هزینه کانال، campaign IDs، attribution window و control design.
- **پذیرش:** پوشش attribution و سهم unknown کنار KPI نشان داده شود؛ هزینه کامل باشد.
- **آزمون:** کمپین مصنوعی با conversion چندمرحله‌ای و مشتری تکراری.
- **ریسک:** نسبت دادن علیت بدون گروه کنترل.

## فاز D — سودآوری و بهینه‌سازی
### D1. هزینه و سود مرکز
- **خروجی:** درآمد شناسایی‌شده، direct cost، operating expense، gross/operating margin.
- **وضعیت:** مدل هزینه کامل در schema بررسی‌شده پیدا نشد.
- **تغییر لازم:** منبع هزینه یا integration حسابداری؛ مرکز، دوره، دسته هزینه و allocation rule.
- **پذیرش:** سود با درآمد و هزینه reconciliation شود؛ هزینه نامعلوم هرگز صفر فرض نشود.
- **آزمون:** صورت‌حساب ساختگی، هزینه تخصیصی و تعدیل/برگشت.
- **وابستگی:** مالی و سیاست حسابداری.

### D2. ظرفیت و اقتصاد تخفیف
- **خروجی:** revenue per available station-hour، contribution margin، utilization-adjusted pricing.
- **وضعیت:** قیمت و تخفیف موجود، هزینه و availability تاریخ‌دار جزئی.
- **تغییر لازم:** قیمت تاریخ‌دار، هزینه مستقیم، زمان‌های خارج از سرویس.
- **پذیرش:** مقایسه قیمت فقط با کنترل نوع ایستگاه، ساعات و mix تقاضا.
- **آزمون:** سناریوهای peak/off-peak با داده مصنوعی.
- **ریسک:** توصیه قیمت بدون آزمایش ممکن است تقاضا یا عدالت قیمت را آسیب بزند.

## فاز E — هوشمندی پیشرفته
### E1. پیش‌بینی تقاضا و شیفت
- **خروجی:** پیش‌بینی ساعتی/روزانه و خطای مدل در برابر baseline.
- **وضعیت:** پیش‌بینی معتبر تأیید نشده؛ growth insights توصیفی است.
- **تغییر لازم:** تاریخچه کافی، تقویم تعطیلات، داده لغو/ظرفیت و pipeline ارزیابی.
- **پذیرش:** backtest زمان‌محور، MAE/WAPE، مقایسه baseline و پایش drift.
- **ریسک:** فصل‌پذیری و تغییر قیمت/رویدادها.

### E2. churn risk و anomaly detection
- **خروجی:** ریسک مشتری و هشدار تراکنش/رزرو غیرعادی.
- **وضعیت:** `PLANNED_ONLY`.
- **تغییر لازم:** outcome و پنجره برچسب، کنترل false positives، فرآیند اقدام انسانی.
- **پذیرش:** مدل با داده آینده‌نگر ارزیابی شود؛ precision/recall و هزینه خطا ثبت گردد.
- **ریسک:** تصمیم خودکار ناعادلانه یا استفاده نامناسب از داده شخصی.

### E3. benchmark چندمرکزی
- **خروجی:** peer medians/percentiles و normalized metrics.
- **وضعیت:** مسیر و سیاست k-anonymity در مستندات وجود دارد.
- **تغییر لازم:** بررسی واقعی حداقل اندازه گروه، self-exclusion، تفاوت ساعات/نوع مرکز و کنترل استنتاج.
- **پذیرش:** گروه زیر آستانه نمایش داده نشود؛ هیچ مرکز نتواند مقدار مرکز دیگر را استنتاج کند.
- **ریسک:** تجمیع کوچک، افشای غیرمستقیم.

## دروازه خروج از هر فاز
هر فاز فقط پس از تأیید تعریف کسب‌وکار، دسترسی tenant، کیفیت داده، آزمون مرزها و owner عملیاتی به فاز بعدی برود. این roadmap مجوز اجرای تغییرات نیست.
