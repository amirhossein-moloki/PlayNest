# گزارش جامع و نهایی فاز ۰ و فاز ۱ تحلیل‌های دامنهٔ رزرو، مرکز، تجهیزات و ظرفیت (Play-Nest Analytics)

**تاریخ گزارش:** ۲۶ اکتبر ۲۰۲۶
**نقش:** مهندس ارشد محصول و Analytics
**دامنه:** چرخهٔ رزرو، عملکرد مراکز، وضعیت و بهره‌برداری تجهیزات و ظرفیت
**وضعیت کلی:** کامل، پیاده‌سازی‌شده در کد و لایهٔ دامنه، و تأییدشده با تست‌های خودکار

---

## A. ماتریس Requirement ID → قابلیت → وضعیت قبل/بعد

| Requirement ID | نام قابلیت / شاخص | وضعیت قبل | وضعیت بعد | جزئیات تغییرات و دلایل فنی |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-RES-001** | تعداد درخواست/رزروهای ایجادشده به تفکیک status | ناقص (فاقد محاسبهٔ lead time و تفکیک انومالی) | **تکمیل‌شده** | افزودن تفکیک کامل وضعیت‌ها (`COMPLETED`, `CANCELED`, `NO_SHOW`, `EXPIRED`, `CONFIRMED`, `PENDING`, `IN_PROGRESS`)، محاسبهٔ Lead Time (میانه و میانگین)، و شناسایی انومالی رزروهای لغوشده دارای پرداخت. |
| **REQ-RES-002** | نرخ تکمیل رزرو (Completion Rate) | غیردقیق (استفاده از مخرج کلی ناایمن) | **تکمیل‌شده** | فرمول دقیق: `COMPLETED / (COMPLETED + CANCELED + NO_SHOW + EXPIRED)` با ایمنی کامل در برابر صفرمخرج. |
| **REQ-RES-003** | نرخ لغو رزرو (Cancellation Rate) | ساده | **تکمیل‌شده** | فرمول دقیق: `CANCELED / totalReservationsCreated` با ایمنی صفرمخرج. |
| **REQ-RES-004** | نرخ عدم حضور (No-Show Rate) | ساده | **تکمیل‌شده** | فرمول دقیق: `NO_SHOW / (COMPLETED + CANCELED + NO_SHOW)` با ایمنی صفرمخرج. |
| **REQ-RES-005** | زمان پیش‌رزرو (Booking Lead Time) | ناموجود | **تکمیل‌شده** | محاسبهٔ دقیق فاصلهٔ ثبت درخواست تا شروع برنامه‌ریزی‌شده (`startTime - createdAt`) بر حسب دقیقه به‌صورت میانگین و میانه. |
| **REQ-STN-001** | نرخ اشغال و بهره‌برداری ایستگاه‌ها | غیردقیق (فرض ۲۴ ساعته) | **تکمیل‌شده** | لحاظ ساعات کاری واقعی مرکز (`openingTime`/`closingTime`) و کسر بازه‌های تعمیرات تجهیزات (`StationMaintenance`). |
| **REQ-STN-002** | تفکیک زمان برنامه‌ریزی‌شده و مدت جلسهٔ واقعی | ناموجود | **تکمیل‌شده** | تفکیک صریح `plannedHoursBooked` از `actualSessionHours` و ارائهٔ مستقل `bookingRate` و `utilizationRate`. |
| **REQ-STN-003** | ساعات توقف تجهیزات (Equipment Downtime) | ناموجود | **تکمیل‌شده** | محاسبهٔ مجموع ساعات خارج از سرویس بودن ایستگاه‌ها از رکوردهای `StationMaintenance`. |
| **REQ-FIN-001** | درآمد عملیاتی به ازای ایستگاه-ساعت در دسترس | ناموجود | **تکمیل‌شده** | محاسبهٔ `Revenue / Available Operational Station Hours` جهت سنجش بهره‌وری مالی واقعی تجهیزات. |
| **REQ-OPS-001** | تقاضای ازدست‌رفته / ظرفیت محدود | ادعای فرضی | **تکمیل‌شده (مستند)** | محاسبهٔ دقیق تقاضای ناموفق ثبت‌شده بر اساس ورودی‌ها و پیشنهادهای منقضی/ردشدهٔ Waitlist. عدم انتساب ریزش‌های ثبت‌نشده به کمبود ظرفیت بدون شواهد. |
| **REQ-WEB-001** | نرخ تبدیل بازدیدکننده وب به رزرو | `DATA_COLLECTION_MISSING` | **شکاف ثبت‌شده** | نیازمند سرویس Ingestion رویدادهای وب‌سایت. بدون شواهد، دادهٔ ساختگی ارائه نگردیده است. |

---

## B. تعریف دقیق و فرمول هر KPI پیاده‌سازی‌شده

### ۱. نرخ‌های چرخهٔ رزرو (Reservation Lifecycle Rates)
* **نرخ تکمیل (Completion Rate):**
  $$\text{Completion Rate} = \frac{\text{Count}(\text{status} = \text{COMPLETED})}{\text{Count}(\text{status} \in \{\text{COMPLETED, CANCELED, NO\_SHOW, EXPIRED}\})} \times 100$$
  * *شرایط استثنا:* در صورت صفر بودن مخرج، مقدار `0.00%` بازگردانده می‌شود.

* **نرخ لغو (Cancellation Rate):**
  $$\text{Cancellation Rate} = \frac{\text{Count}(\text{status} = \text{CANCELED})}{\text{Total Created Reservations in Period}} \times 100$$

* **نرخ عدم حضور (No-Show Rate):**
  $$\text{No-Show Rate} = \frac{\text{Count}(\text{status} = \text{NO\_SHOW})}{\text{Count}(\text{status} \in \{\text{COMPLETED, CANCELED, NO\_SHOW}\})} \times 100$$

### ۲. زمان پیش‌رزرو (Booking Lead Time)
* **تعریف:** مدت زمان بین ایجاد درخواست رزرو (`createdAt`) و زمان شروع برنامه‌ریزی‌شده جلسه (`startTime`).
* **فرمول دقیقه:**
  $$\text{Lead Time (Minutes)} = \max\left(0, \left\lfloor \frac{\text{startTime} - \text{createdAt}}{60,000} \right\rfloor\right)$$
* **شاخص‌های گزارش‌شده:**
  * **میانگین (`averageLeadTimeMinutes`):** مجموع دقایق پیش‌رزرو تقسیم بر تعداد.
  * **میانه (`medianLeadTimeMinutes`):** مقدار صدک ۵۰ام لیست مرتب‌شده برای حذف اثر داده‌های پرت.

### ۳. ظرفیت عملیاتی و نرخ بهره‌برداری ایستگاه‌ها (Station Capacity & Utilization)
* **ساعات کاری روزانه مرکز (`dailyOperatingHours`):**
  محاسبه‌شده از روی `openingTime` و `closingTime` مرکز بازی (مثلاً ۰۹:۰۰ تا ۲۳:۰۰ = ۱۴ ساعت). در صورت عدم تنظیم، پیش‌فرض ۲۴ ساعت لحاظ می‌شود.
* **ظرفیت اسمی کل دوره (`totalOperatingHours`):**
  $$\text{Total Operating Hours} = \text{Days Count} \times \text{Daily Operating Hours}$$
* **ساعات خارج از سرویس / تعمیرات (`downtimeHours`):**
  مجموع ساعات هم‌پوشانی رکوردهای `StationMaintenance` ایستگاه با بازهٔ زمانی درخواستی.
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
  تعداد رزروهایی که وضعیت آن‌ها `CANCELED` است اما دارای حداقل یک پرداخت موفق `PAID` هستند.
* **مبلغ استردادنشده (`unrefundedCanceledAmount`):**
  مجموع مبالغ پرداخت‌شده برای رزروهای لغوشده که هنوز استرداد (`SUCCESSFUL Refund`) برای آن‌ها ثبت نشده است.

---

## C. منابع داده و محدودیت‌های تاریخچه و کیفیت داده

۱. **جدول‌های مرجع داده‌ای:**
   - **`Reservation`**: منبع اصلی وضعیت رزرو، زمان برنامه‌ریزی‌شده (`startTime`, `endTime`)، مبلغ کل (`totalPrice`) و وضعیت پرداخت.
   - **`ReservationHistory`**: audit log تغییرات حالت رزرو (`fromStatus`, `toStatus`, `createdAt`).
   - **`GamingSession`**: منبع کارکرد واقعی ایستگاه (`startTime`, `endTime`, `actualHours`, `pausedMinutes`).
   - **`StationMaintenance`**: ثبت تعمیرات و بازه‌های خارج از سرویس بودن تجهیزات (`startTime`, `endTime`, `reason`).
   - **`GamingCenter`**: ساعات کاری مرکز (`openingTime`, `closingTime`).
   - **`Payment` / `Refund`**: جریانات مالی متناظر با رزروها.

۲. **قوانین عدم بازسازی فرضی:**
   - چنانچه رکوردهای تاریخچه حالت (`ReservationHistory`) موجود نباشد، روند گذشته از روی status فعلی بازسازی معکوس **نمی‌شود**.
   - زمان برنامه‌ریزی‌شده هرگز به عنوان کارکرد واقعی جلسه جا زده **نمی‌شود**.

---

## D. مسیر فایل‌ها، سرویس‌ها و APIها

| نام فایل | نقش و مسئولیت |
| :--- | :--- |
| `sayra/src/modules/analytics/analytics.repo.ts` | لایهٔ دسترسی به داده‌ها (`getGamingCenterDetails`, `getStationMaintenanceStats`, `getStationGamingSessionStats`, `getReservationLeadTimeStats`, `getCanceledWithPaidStats`) |
| `sayra/src/modules/analytics/analytics.station.ts` | منطق دامنه و محاسبهٔ KPIها (`getReservationReport`, `getStationPerformance`) |
| `sayra/src/modules/analytics/analytics.validators.ts` | اعتبارسنچی زمان و مرزها (`resolveTimezoneAndBoundaries`) |
| `sayra/src/modules/analytics/analytics.routes.ts` | مسیرهای API تحلیلی تحت `tenantGuard` |
| `sayra/tests/unit/modules/analytics/analytics.station.spec.ts` | تست‌های واحد منطق تحلیلی |
| `sayra/tests/api/analytics/analytics.api.spec.ts` | تست‌های یکپارچه‌سازی API و ایزولاسیون Tenant |

---

## E. تست‌ها و نتایج واقعی اجرای آزمایش‌ها

تمامی تست‌های اختصاصی ماژول تحلیلی و تست‌های یکپارچه‌سازی با موفقیت کامل پاس شدند:

```text
PASS tests/api/analytics/analytics.api.spec.ts
PASS tests/unit/modules/analytics/analytics.repo.spec.ts
PASS tests/unit/modules/analytics/analytics.station.spec.ts
PASS tests/unit/modules/analytics/analytics.customers.spec.ts
PASS tests/unit/modules/analytics/analytics.benchmarks.spec.ts
PASS tests/unit/modules/analytics/analytics.phase6.spec.ts
PASS tests/unit/modules/analytics/analytics.financials.spec.ts
PASS tests/unit/modules/analytics/analytics.validators.spec.ts
PASS tests/unit/modules/analytics/analytics.shared-layer.spec.ts
PASS tests/unit/modules/analytics/analytics.phase5.spec.ts
PASS tests/unit/modules/analytics/analytics.producer.spec.ts

Test Suites: 11 passed, 11 total
Tests:       70 passed, 70 total
Snapshots:   0 total
Time:        12.498 s
```

---

## F. شکاف‌های جمع‌آوری داده (Data Collection Gaps)

۱. **انصراف کاربر در وب‌سایت بدون ثبت Waitlist (`DATA_COLLECTION_MISSING`):**
   کاربرانی که سانس‌ها را مرور می‌کنند اما رزرو یا لیست انتظاری ثبت نمی‌کنند. این موارد به عنوان کمبود ظرفیت ادعا نگردیدند.
۲. **علت لغو جزیی رزروهای حضوری:**
   علت دقیق عدم حضور یا لغو برخی رزروهای Walk-in نیازمند اجباری‌شدن فیلد شرح علت در پنل اپراتور است.

---

## G. قراردادهای استفاده برای فاز ۶ و هشدارهای Integration

۱. **ایزولاسیون Tenant در APIها:**
   تمام درخواست‌های تحلیلی حتماً باید از مسیرهای محافظت‌شده با `tenantGuard` عبور کنند.
۲. **فرمت پاسخ‌های API:**
   درصدهای گزارش‌شده عدد اعشاری با ۲ رقم اعشار (مانند `85.50`) و مبالغ گردشده به عدد صحیح می‌باشند.
۳. **قاعدهٔ K-Anonymity (فاز ۷ / ۶):**
   در شاخص‌های مقایسه‌ای بین‌مرکزی (Benchmarking)، در صورت کمتر بودن همتاهای فعال از ۵ مرکز (`k < 5`)، پاسخ به‌صورت `SUPPRESSED` ارسال می‌شود.
