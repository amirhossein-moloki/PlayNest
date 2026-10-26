# گزارش جامع تکمیل فاز ۰ تحلیل‌های دامنهٔ رزرو، مرکز، تجهیزات و ظرفیت (Play-Nest Analytics)

**تاریخ گزارش:** ۲۶ اکتبر ۲۰۲۶
**نویسنده:** مهندس ارشد محصول و Analytics
**دامنه:** چرخهٔ رزرو، عملکرد مراکز، وضعیت و بهره‌برداری تجهیزات و ظرفیت
**وضعیت پیاده‌سازی:** کامل و تأییدشده با تست‌های خودکار

---

## A. ماتریس Requirement ID → قابلیت → وضعیت قبل/بعد

| Requirement ID | نام قابلیت / شاخص | وضعیت قبل از فاز ۰ | وضعیت بعد از فاز ۰ | جزئیات تغییرات |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-RES-001** | تعداد درخواست/رزروهای ایجادشده به تفکیک status | ناقص (فاقد محاسبهٔ زمان پیش‌رزرو و تفکیک انومالی) | **تکمیل‌شده** | افزودن محاسبهٔ Lead Time (میانه و میانگین)، تفکیک رزروهای CANCELED دارای پرداخت موفق، و اصلاح مخرج نرخ‌ها. |
| **REQ-RES-002** | نرخ تکمیل رزرو (Completion Rate) | ناقص (استفاده از مخرج عمومی ناایمن) | **تکمیل‌شده** | مخرج صریح: `COMPLETED / (COMPLETED + CANCELED + NO_SHOW + EXPIRED)` با ایمنی صفرمخرج. |
| **REQ-RES-003** | نرخ لغو رزرو (Cancellation Rate) | موجود | **تکمیل‌شده** | مخرج صریح: `CANCELED / totalCreated` با ایمنی صفرمخرج. |
| **REQ-RES-004** | نرخ عدم حضور (No-Show Rate) | موجود | **تکمیل‌شده** | مخرج صریح: `NO_SHOW / (COMPLETED + CANCELED + NO_SHOW)` با ایمنی صفرمخرج. |
| **REQ-RES-005** | زمان پیش‌رزرو (Booking Lead Time) | ناموجود | **تکمیل‌شده** | محاسبهٔ میانگین و میانه‌ٔ فاصلهٔ زمانی ایجاد تا شروع برنامه‌ریزی‌شده (`startTime - createdAt`) به دقیقه. |
| **REQ-STN-001** | نرخ اشغال و بهره‌برداری ایستگاه‌ها | غیردقیق (فرض ساده‌انگارانهٔ ۲۴ ساعت شبانه‌روز) | **تکمیل‌شده** | لحاظ ساعات کاری واقعی مرکز (`openingTime` / `closingTime`) و کسر بازه‌های تعمیرات (`StationMaintenance`). |
| **REQ-STN-002** | تفکیک زمان برنامه‌ریزی‌شده و مدت جلسهٔ واقعی | ناموجود (گزارش planned به‌جای actual) | **تکمیل‌شده** | تفکیک صریح `plannedHoursBooked` از `actualSessionHours` و ارائهٔ هم‌زمان `bookingRate` و `utilizationRate`. |
| **REQ-STN-003** | ساعات توقف تجهیزات (Equipment Downtime) | ناموجود | **تکمیل‌شده** | محاسبهٔ مجموع ساعات خارج از سرویس بودن ایستگاه‌ها از رکوردهای `StationMaintenance`. |
| **REQ-FIN-001** | درآمد عملیاتی به ازای ایستگاه-ساعت در دسترس | ناموجود | **تکمیل‌شده** | `Revenue / Available Operational Station Hours` برای سنجش بهره‌وری واقعی مالی تجهیزات. |
| **REQ-OPS-001** | تقاضای ازدست‌رفته / ظرفیت محدود | ادعای فرضی | **تکمیل‌شده (مستند)** | محاسبهٔ دقیق بر اساس ورودی‌ها و پیشنهادهای منقضی/ردشدهٔ Waitlist. عدم انتساب ریزش‌های ثبت‌نشده به کمبود ظرفیت بدون شواهد. |
| **REQ-WEB-001** | نرخ تبدیل بازدیدکننده وب به رزرو | `DATA_COLLECTION_MISSING` | **شکاف ثبت‌شده** | نیازمند سرویس Ingestion رویدادهای عمومی وب. ادعای دادهٔ فرضی صورت نگرفت. |

---

## B. تعریف دقیق و فرمول هر KPI پیاده‌سازی‌شده

### ۱. نرخ‌های چرخهٔ رزرو (Reservation Lifecycle Rates)
* **نرخ تکمیل (Completion Rate):**
  $$\text{Completion Rate} = \frac{\text{Count}(\text{status} = \text{COMPLETED})}{\text{Count}(\text{status} \in \{\text{COMPLETED, CANCELED, NO\_SHOW, EXPIRED}\})} \times 100$$
  * *شرایط استثنا:* اگر مخرج صفر باشد، مقدار `0.00%` بازگردانده می‌شود.
* **نرخ لغو (Cancellation Rate):**
  $$\text{Cancellation Rate} = \frac{\text{Count}(\text{status} = \text{CANCELED})}{\text{Total Created Reservations in Period}} \times 100$$
* **نرخ عدم حضور (No-Show Rate):**
  $$\text{No-Show Rate} = \frac{\text{Count}(\text{status} = \text{NO\_SHOW})}{\text{Count}(\text{status} \in \{\text{COMPLETED, CANCELED, NO\_SHOW}\})} \times 100$$

### ۲. زمان پیش‌رزرو (Booking Lead Time)
* **تعریف:** مدت زمان بین ثبت درخواست رزرو توسط کاربر (`createdAt`) و زمان شروع برنامه‌ریزی‌شده جلسه (`startTime`).
* **فرمول:**
  $$\text{Lead Time (Minutes)} = \max\left(0, \left\lfloor \frac{\text{startTime} - \text{createdAt}}{60,000} \right\rfloor\right)$$
* **شاخص‌های گزارش‌شده:**
  * **میانگین زمان پیش‌رزرو (`averageLeadTimeMinutes`):** مجموع دقائق پیش‌رزرو تقسیم بر تعداد رزروها.
  * **میانهٔ زمان پیش‌رزرو (`medianLeadTimeMinutes`):** مقدار صدک ۵۰ام لیست مرتب‌شدهٔ دقائق پیش‌رزرو برای کاهش اثر داده‌های پرت.

### ۳. ظرفیت عملیاتی و نرخ بهره‌برداری ایستگاه‌ها (Station Capacity & Utilization)
* **ساعات کاری روزانه مرکز (`dailyOperatingHours`):**
  محاسبه‌شده از روی `openingTime` و `closingTime` مرکز بازی (مثلاً ۰۹:۰۰ تا ۲۳:۰۰ = ۱۴ ساعت). در صورت عدم تنظیم، به‌صورت پیش‌فرض ۲۴ ساعت در نظر گرفته می‌شود.
* **ظرفیت کل اسمی دوره (`totalOperatingHours`):**
  $$\text{Total Operating Hours} = \text{Days Count} \times \text{Daily Operating Hours}$$
* **ساعات خارج از سرویس / تعمیرات (`downtimeHours`):**
  مجموع ساعات هم‌پوشانی رکوردهای `StationMaintenance` ایستگاه با بازهٔ زمانی درخواستی گزارش.
* **ظرفیت عملیاتی قابل‌استفاده (`availableOperationalHours`):**
  $$\text{Available Hours} = \max(0, \text{Total Operating Hours} - \text{Downtime Hours})$$
* **نرخ رزروشدن / برنامه‌ریزی (`bookingRate`):**
  $$\text{Booking Rate} = \min\left(100, \frac{\text{Planned Hours Booked}}{\text{Available Hours}} \times 100\right)$$
* **نرخ بهره‌برداری واقعی (`utilizationRate`):**
  $$\text{Utilization Rate} = \min\left(100, \frac{\text{Actual Gaming Session Hours}}{\text{Available Hours}} \times 100\right)$$
* **درآمد به ازای ساعت در دسترس (`revenuePerAvailableStationHour`):**
  $$\text{Revenue / Available Hour} = \frac{\text{Total Station Revenue}}{\text{Available Hours}}$$

### ۴. شناسایی انومالی‌های مالی و رزرو (Anomalies Tracking)
* **رزرو لغوشده با پرداخت موفق (`canceledWithPaidCount`):**
  تعداد رزروهایی که وضعیت آن‌ها `CANCELED` است اما حداقل یک پرداخت موفق با وضعیت `PAID` دارند.
* **مبلغ استردادنشده (`unrefundedCanceledAmount`):**
  مجموع مبالغ پرداخت‌شده برای رزروهای لغوشده که هنوز استرداد (`SUCCESSFUL Refund`) برای آن‌ها ثبت نشده است.

---

## C. منابع داده و محدودیت‌های تاریخچه و کیفیت داده

۱. **جدول‌های مرجع داده‌ای:**
   - **`Reservation`**: منبع اصلی وضعیت رزرو، زمان برنامه‌ریزی‌شده (`startTime`, `endTime`)، مبلغ کل (`totalPrice`) و وضعیت پرداخت.
   - **`ReservationHistory`**: منبع audit log تغییرات حالت رزرو (`fromStatus`, `toStatus`, `createdAt`).
   - **`GamingSession`**: منبع کارکرد واقعی ایستگاه (`startTime`, `endTime`, `actualHours`, `pausedMinutes`).
   - **`StationMaintenance`**: منبع ثبت تعمیرات و بازه‌های خارج از سرویس بودن تجهیزات (`startTime`, `endTime`, `reason`).
   - **`GamingCenter`**: منبع ساعات کاری مرکز (`openingTime`, `closingTime`).
   - **`Payment` / `Refund`**: منبع جریانات مالی متناظر با رزروها.

۲. **محدودیت‌ها و عدم بازسازی فرضی تاریخچه:**
   - چنانچه رکوردهای تاریخچه حالت (`ReservationHistory`) برای رزروهای قدیمی موجود نباشد، روند تغییرات گذشته از روی حالت فعلی بازسازی معکوس **نمی‌شود** تا ناخالصی در داده ایجاد نگردد.
   - زمان برنامه‌ریزی‌شده (`totalHours`) هرگز به‌جای زمان جلسهٔ واقعی (`actualHours`) جا زده نمی‌شود.

---

## D. مسیر فایل‌ها، سرویس‌ها و تغییرات کد

| نام فایل | نقش و مسئولیت | تغییرات اعمال‌شده |
| :--- | :--- | :--- |
| `sayra/src/modules/analytics/analytics.repo.ts` | لایهٔ دسترسی به داده‌های تحلیلی | افزودن متدهای `getGamingCenterDetails`, `getStationMaintenanceStats`, `getStationGamingSessionStats`, `getReservationLeadTimeStats` و `getCanceledWithPaidStats`. |
| `sayra/src/modules/analytics/analytics.station.ts` | لایهٔ منطق دامنه و محاسبهٔ KPIها | ارتقاء `getReservationReport` (محاسبه lead time، تفکیک actual/planned، انومالی‌ها) و `getStationPerformance` (ساعات کاری، کسر downtime، تفکیک bookingRate و utilizationRate). |
| `sayra/src/modules/analytics/analytics.validators.ts` | اعتبارسنچی پارامترها و مرزها | مدیریت صحیح منطقهٔ زمانی و مرزهای ابتدا/انتهای روز (`resolveTimezoneAndBoundaries`). |
| `sayra/tests/unit/modules/analytics/analytics.station.spec.ts` | تست‌های واحد منطق تحلیلی | افزودن سناریوهای تست صفرمخرج، پیش‌رزرو، کسر downtime تعمیرات و تفکیک نرخ‌ها. |
| `sayra/tests/api/analytics/analytics.api.spec.ts` | تست‌های یکپارچه‌سازی API و ایزولاسیون Tenant | به‌روزرسانی mockهای Prisma و تأیید صحت پاسخ‌های API برای نقش‌های مختلف. |

---

## E. تست‌ها و نتایج واقعی اجرای آزمایش‌ها

تمامی ۸۵ مجموعه تست پروژه (شامل ۱۰ مجموعه تست اختصاصی ماژول تحلیلی و ۴۸۵ تست واحد/یکپارچه‌سازی) با موفقیت کامل پاس شدند:

```text
PASS tests/unit/modules/analytics/analytics.station.spec.ts
PASS tests/unit/modules/analytics/analytics.repo.spec.ts
PASS tests/unit/modules/analytics/analytics.customers.spec.ts
PASS tests/unit/modules/analytics/analytics.phase6.spec.ts
PASS tests/unit/modules/analytics/analytics.benchmarks.spec.ts
PASS tests/unit/modules/analytics/analytics.validators.spec.ts
PASS tests/unit/modules/analytics/analytics.producer.spec.ts
PASS tests/unit/modules/analytics/analytics.phase5.spec.ts
PASS tests/unit/modules/analytics/analytics.financials.spec.ts
PASS tests/api/analytics/analytics.api.spec.ts

Test Suites: 85 passed, 85 total
Tests:       485 passed, 485 total
Snapshots:   0 total
Time:        110.185 s
```

### موارد تست‌شده در پوشش تست جدید:
۱. **محاسبهٔ صحیح Lead Time:** تست میانه و میانگین زمان پیش‌رزرو بر حسب دقیقه.
۲. **تفکیک Planned vs Actual:** عدم جایگزینی زمان اسمی با زمان واقعی جلسه.
۳. **کسر Downtime تعمیرات:** کسر دقیق ساعات تعمیرات از ساعات کاری مرکز و محاسبهٔ درست `availableOperationalHours`.
۴. **تفکیک Booking Rate از Utilization Rate:** صحت محاسبهٔ دو نرخ به‌صورت مستقل.
۵. **ایمنی در برابر صفرمخرج:** عدم تولید مقادیر `NaN` یا `Infinity` هنگام صفر بودن رزروها یا ساعات کاری.
۶. **ایزولاسیون مستحکم Tenant:** عدم دسترسی مدیر یک مرکز به داده‌های مراکز دیگر بدون مجوز صریح.

---

## F. شکاف‌های جمع‌آوری داده (Data Collection Gaps)

۱. **انصراف کاربران در وب‌سایت بدون ثبت Waitlist (`DATA_COLLECTION_MISSING`):**
   کاربرانی که وارد صفحهٔ انتخاب سانس می‌شوند اما به دلیل پر بودن ظرفیت یا عدم تناسب قیمت رزرو را تکمیل نمی‌کنند و وارد لیست انتظار هم نمی‌شوند. این موارد به‌عنوان کمبود ظرفیت ادعا نشدند.
۲. **دلایل خرابی جزیی در ثبت رزروهای حضوری Walk-in:**
   علت لغو یا عدم حضور برخی رزروهای حضوری فاقد شرح متنی جزیی است که نیازمند الزام فیلد `cancelReason` در نرم‌افزار اپراتور مرکز است.

---

## G. قراردادهای استفاده برای فاز ۶ و هشدارهای Integration

۱. **الزام ایزولاسیون Tenant در APIها:**
   تمامی درخواست‌های تحلیلی باید از مسیرهای نیازمند `tenantGuard` عبور کنند. پارامتر `gamingCenterId` در سطح سرور کنترل می‌شود.
۲. **فرمت پاسخ‌های API:**
   تمامی مقادیر درصدی به‌صورت عدد اعشاری با دو رقم اعشار (مثلاً `80.25` برای ۸۰.۲۵٪) و مبالغ مالی گردشده به عدد صحیح ارائه می‌شوند.
۳. **قاعدهٔ K-Anonymity در مقایسه‌های فاز ۷ / ۶:**
   در شاخص‌های مقایسه‌ای بین‌مرکزی (Benchmarking)، چنانچه تعداد همتایان فعال در یک کوهورت کمتر از ۵ مرکز باشد (`k < 5`)، پاسخ به‌صورت `SUPPRESSED` ارسال می‌گردد تا از افشای داده‌های تجاری مراکز جلوگیری شود.
