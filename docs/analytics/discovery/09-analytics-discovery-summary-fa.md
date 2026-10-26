# ۹. خلاصه اجرایی کشف Analytics
**تاریخ بررسی:** ۲۰۲۶-۱۰-۲۶  
**مخزن اصلی:** `amirhossein-moloki/PlayNest`, شاخه `main`  
**وضعیت:** اسناد کشف و برنامه‌ریزی؛ بدون تغییر کد یا schema.

## نتیجه اصلی
Play-Nest صرفاً یک صفحه رزرو نیست: schema و backend، مدیریت چند مرکز، ایستگاه‌ها، رزرو و جلسه، مشتری، کارکنان و شیفت، پرداخت/بازپرداخت/دفترکل، تخفیف، کیف پول، فهرست انتظار، اعلان و CMS را نشان می‌دهند. یک زیرسامانه Analytics نیز وجود دارد: مدل‌های shadow، ingestion incremental، endpointهای داشبورد، گزارش مشتری، مالی، reconciliation و benchmark در کد دیده می‌شوند.

مدل تجاری محتمل، پلتفرم مدیریت چند مرکز همراه با رزرو عمومی است. با این حال SaaS بودن قرارداد، مالکیت مراکز، مدل دقیق کمیسیون و سهم درآمد پلتفرم از کد به‌تنهایی قابل اثبات نیست.

## بالاترین ارزش‌های تحلیلی
1. **تعریف و تطبیق مالی:** جداسازی ارزش رزرو تکمیل‌شده از وجه وصول‌شده، refund، درآمد شناسایی‌شده و سود.
2. **تقاضا و ظرفیت:** وضعیت‌های رزرو، lead time، no-show، waitlist و بهره‌برداری بر اساس ساعت واقعی قابل استفاده.
3. **کیفیت و تازگی داده:** پایش watermark/run، کنترل source-to-shadow و اختلاف‌های reconciliation.
4. **رفتار مشتری:** retention cohort و بخش‌بندی مبتنی بر رزرو تکمیل‌شده، با تعریف ثابت و نسخه‌دار.
5. **قیف جذب:** سنجش واقعی بازدید تا ثبت‌نام و رزرو؛ این بخش در جست‌وجوی کد frontend شواهد رویداد tracking نداشت.
6. **سودآوری:** هزینه‌های مستقیم، هزینه‌های عملیاتی، کارمزد و سرمایه تجهیزات؛ بدون این داده‌ها سود و ROI قابل اتکا نیست.

## مهم‌ترین شکاف‌ها
- رویدادهای وب/visitor/session و attribution کمپین در frontend جست‌وجوشده یافت نشدند.
- هزینه عملیاتی و کارمزد واقعی پرداخت در schema بررسی‌شده به شکل جامع قابل مشاهده نبود.
- ساعات قابل‌استفاده تاریخی و downtime تجهیزات از `isActive` و تعداد ایستگاه به‌تنهایی قابل محاسبه نیست.
- برخی تعاریف مالی مستندشده ممکن است «درآمد» را با ارزش رزرو تکمیل‌شده مخلوط کنند.
- utilization مبتنی بر ۲۴ ساعت روز، در مراکز با ساعت کاری محدود یا downtime، مخرج نامناسب دارد.
- وجود route/worker و ادعای گزارش قبلی به معنای اثبات سلامت runtime یا اجرای تست در این ممیزی نیست.

## وضعیت کنونی در یک نگاه
| قابلیت | وضعیت |
|---|---|
| مدل‌های عملیاتی و Analytics shadow | `IMPLEMENTED_AND_VERIFIED` برای کد/schema |
| APIهای داشبورد و customer/financial analytics | `IMPLEMENTED_AND_VERIFIED` برای route/controller |
| فرمول‌ها و معنای دقیق KPIها | `PARTIALLY_IMPLEMENTED` تا تطبیق مستقل کد و تست |
| freshness و ingestion runtime | `NOT_VERIFIABLE` بدون اجرای محیط |
| tracking وب و attribution | `DATA_COLLECTION_MISSING` بر اساس جست‌وجوی مخزن |
| هزینه کامل و سود | `DATA_COLLECTION_MISSING` در schema بررسی‌شده |
| availability/downtime تجهیزات | `PARTIALLY_IMPLEMENTED` |
| پیش‌بینی churn/demand | `PLANNED_ONLY` |

## توصیه نخست
**فاز A را با قرارداد داده و کنترل کیفیت آغاز کنید، نه با افزودن داشبوردهای بیشتر.** ابتدا واژه‌نامه مالی و رزرو را تصویب کنید؛ سپس آزمون‌های source-to-shadow، مرز زمانی، retry/duplicate و tenant isolation را اجرا کنید. بعد از این دروازه، داشبورد موجود قابل اعتمادتر می‌شود و می‌توان در فاز B ظرفیت و سلامت عملیات را بهبود داد. tracking وب و ثبت هزینه باید به‌عنوان جریان‌های داده مستقل با تأیید حریم خصوصی و مالی طراحی شوند.

## اسناد ایجادشده
- `01-play-nest-business-model-fa.md`
- `02-business-analytics-opportunities-fa.md`
- `03-metric-catalog-fa.md`
- `04-data-requirements-inventory-fa.md`
- `05-event-tracking-specification-fa.md`
- `06-current-state-audit-fa.md`
- `07-analytics-prioritized-roadmap-fa.md`
- `08-open-business-questions-fa.md`
- `09-analytics-discovery-summary-fa.md`

## محدودیت
کد و مستندات مخزن بررسی شده‌اند، اما اتصال به DB، اجرای تست، مشاهده داده تولیدی و runtime integrationها انجام نشده است. هیچ داده شخصی یا مالی تولیدی در اسناد درج نشده است.
