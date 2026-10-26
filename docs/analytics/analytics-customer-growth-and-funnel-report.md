# گزارش جامع تحلیل مشتری، قیف تبدیل، عملکرد تخفیف‌ها و شکاف‌های ردیابی (Play-Nest Customer Growth, Funnel & Gap Report)

---

## ۱. مقدمه و نقش اجرایی
این گزارش سند رسمی پیاده‌سازی و سنجش تحلیل مشتریان، مراجعات تکراری، کوهورت‌های retention، قیف تبدیل عملیاتی، تحلیل اثر تخفیف‌ها و شناساگر شکاف‌های ردیابی در پلتفرم **Play-Nest Analytics** است.

تمام محاسبات و گزارش‌ها بر اساس **اصل حریم خصوصی، پرهیز از فرضیات بدون داده و تفکیک دقیق موجودیت‌ها** پیاده‌سازی شده‌اند.

---

## ۲. ماتریس تفکیک موجودیت‌های مشتری (Entity Taxonomy Matrix)

برای جلوگیری از خلط مفاهیم، ۵ موجودیت متمایز مشتری در کد، API و مستندات تعریف شده‌اند:

| نام موجودیت | تعریف دقیق | منبع داده | شرط محاسبه |
|---|---|---|---|
| **حساب کاربری (Registered Account)** | حساب مشتری ثبت‌شده در پلتفرم | `CustomerAccount` | ایجاد حساب در دیتابیس (`createdAt`) |
| **مشتری رزروکننده (Reserving Customer)** | کاربر دارای حداقل یک ثبت رزرو در بازه | `Reservation` | `customerAccountId` با حداقل ۱ رزرو ایجادشده در بازه |
| **مشتری پرداخت‌کننده (Paying Customer)** | کاربر دارای حداقل یک پرداخت موفق در بازه | `Payment` | `status = 'PAID'` در بازه برای رزرو مرکز |
| **مشتری جلسه واقعی (Completed Session Customer / Active Customer)** | کاربر دارای حداقل یک جلسه بازی/رزرو تکمیل‌شده | `GamingSession` / `Reservation` | `status = 'COMPLETED'` در بازه زمانی |
| **مشتری جدید (New Session Customer)** | مشتری که اولین جلسه/رزرو تکمیل‌شده تاریخی او در بازه فعلی واقع شده است | `Reservation` (`_min.startTime`) | اولین `startTime` تکمیل‌شده در بازه فعلی |
| **مشتری بازگشتی (Returning Customer)** | مشتری فعال در بازه فعلی که اولین جلسه تکمیل‌شده او قبل از شروع بازه فعلی بوده است | `Reservation` | اولین `startTime` < تاریخ شروع بازه |

---

## ۳. کاتالوگ KPIهای پیاده‌سازی‌شده (Implemented KPI Catalog)

### الف) تحلیل مشتری و مراجعات تکراری
- **`activeCustomers`**: تعداد مشتریان متمایز دارای رزرو/جلسه تکمیل‌شده در بازه.
- **`newCustomers`**: تعداد مشتریانی که اولین مراجعه تاریخی آن‌ها در این بازه بوده است.
- **`returningCustomers`**: تعداد مشتریان فعال با سابقه مراجعه قبل از این بازه.
- **`repeatCustomers`**: تعداد مشتریان فعال دارای $\ge 2$ مراجعه در بازه فعلی.
- **`repeatVisitRate`**: درصد مشتریان تکراری به کل مشتریان فعال (`repeatCustomers / activeCustomers * 100`).
- **`avgDaysBetweenVisits`**: میانگین فاصله زمانی (به روز) بین مراجعات متوالی مشتریان تکراری.
- **`totalRecordedSpend`**: مجموع ارزش مالی رزروهای تکمیل‌شده در بازه.
- **`avgSpendPerActiveCustomer`**: میانگین هزینه کرد هر مشتری فعال.
- **`avgSpendPerVisit`**: میانگین هزینه کرد در هر مراجعه.
- *توضیح شفاف:* این اعداد هزینه کرد تاریخی ثبت‌شده هستند و ادعای ارزش طول عمر پیش‌بینانه (Predictive LTV) نمی‌سازند.

### ب) قیف تبدیل عملیاتی (Operational Conversion Funnel)
به دلیل عدم وجود Event Collector در سمت وب/اپلیکیشن (`DATA_COLLECTION_MISSING`)، قیف ترافیک وب نمایش داده نمی‌شود. قیف تبدیل عملیاتی مستقیماً از **تغییرات حالات واقعی دیتابیس** استخراج می‌گردد:

1. **مرحله ۱ - ایجاد رزرو (Reservation Created):** تعداد کل رزروهای ثبت‌شده در بازه.
2. **مرحله ۲ - پرداخت موفق (Payment Succeeded):** تعداد رزروهای ایجادشده که دارای پرداخت وضعیت `PAID` با `paidAt >= createdAt` هستند.
3. **مرحله ۳ - شروع جلسه بازی (Gaming Session Started):** تعداد رزروهایی که وارد جلسه بازی واقعی شدند (`startTime >= createdAt`).
4. **مرحله ۴ - تکمیل رزرو (Reservation Completed):** تعداد رزروهایی که به وضعیت نهایی `COMPLETED` رسیدند.

**معیارهای محاسبه‌شده در هر گام قیف:**
- `conversionFromInitial`: نرخ تبدیل نسبت به مرحله ۱ (درصد).
- `conversionFromPrevious`: نرخ تبدیل نسبت به مرحله قبلی (درصد).
- `droppedCount`: تعداد ریزش در این مرحله (`count_prev - count_curr`).
- `avgDurationFromPreviousMinutes`: میانگین زمان طی شده بین دو مرحله (به دقیقه).

### ج) تحلیل اثربخشی تخفیف‌ها (Discount Performance Analytics)
- **`discountedReservationsCount`**: تعداد رزروهای دارای کد یا مبلغ تخفیف.
- **`nonDiscountedReservationsCount`**: تعداد رزروهای بدون تخفیف.
- **`discountPenetrationRate`**: درصد استفاده از تخفیف در کل رزروها.
- **`totalDiscountAmountGiven`**: مجموع مبلغ تخفیف اعطایی (به واحد پول).
- **`avgDiscountAmount`**: میانگین مبلغ تخفیف در هر رزرو تخفیف‌دار.
- **مقایسه عملکرد:** نرخ تکمیل (`completionRate`) و میانگین مبلغ رزرو (`avgOrderValue`) برای رزروهای تخفیف‌دار در مقایسه با بدون تخفیف.
- *توضیح عدم علیت:* استفاده از کد تخفیف به تنهایی اثبات‌کننده افزایشی بودن (Incrementality) یا ROI کمپین نیست و صرفاً الگوی بازخرید را نشان می‌دهد.

---

## ۴. جدول شکاف‌ها و کاتالوگ رویدادهای ردیابی (Instrumentation Gaps & Event Catalog)

### وضعیت کلی زیرساخت جمع‌آوری داده

| حوزه | وضعیت استاندار (Status) | علت فنی و اثر کسب‌وکاری | اقدام پیشنهادی |
|---|---|---|---|
| **ترافیک وب (Web Traffic)** | `DATA_COLLECTION_MISSING` | عدم ثبت بازدید صفحات و جست‌وجوی ایستگاه‌ها در Frontend؛ عدم امکان محاسبه نرخ تبدیل وب | استقرار اسکریپت Web Event Collector |
| **انتساب کمپین (Campaign Attribution)** | `PARTIALLY_COLLECTED` | عدم ذخیره‌سازی پارامترهای UTM/Campaign در مدل رزرو؛ عدم امکان محاسبه ROAS دقیق | افزودن پارامترهای UTM به کوکی جلسه و مدل `Reservation` |
| **دفترکل وفاداری (Loyalty Ledger)** | `MISSING_LEDGER` | وجود مدل عضویت بدون دفترکل کسب/مصرف/انقضای امتیازات | ایجاد مدل `LoyaltyPointsLedger` با تراکنش‌های دوبل |

### کاتالوگ رویدادهای ضروری وب و اپلیکیشن (Required Event Catalog)

| نام رویداد (Event Name) | محرک (Trigger) | پ think حداقل (Minimal Payload) | شناسه مستعار (Actor Key) | سطح رضایت (Consent) | سیاست نگهداری (Retention) | کلید یکتایی (Deduplication) | معیار پذیرش QA |
|---|---|---|---|---|---|---|---|
| `page_view` | لود صفحه وب توسط کاربر | `{ url, referrer, deviceType }` | `visitor_session_id` | Essential / Anonymized | ۹۰ روز خام، ۳۶۵ روز تجمیعی | `visitor_session_id + page_path + minute` | شلیک زیر ۵۰۰ میلی‌ثانیه با شناسه جلسه معتبر |
| `center_search` | جست‌وجو یا فیلتر مرکز/ایستگاه | `{ query, stationType, dateFilter }` | `visitor_session_id` | Analytics Consent | ۹۰ روز خام | `visitor_session_id + query + timestamp` | شلیک هنگام ارسال کوئری غیرخالی |
| `booking_started` | کلیک روی رزرو زمان خاص | `{ gamingCenterId, stationId, startTime }` | `visitor_session_id` | Analytics Consent | ۱۸۰ روز | `visitor_session_id + stationId + startTime` | شلیک هنگام باز شدن صفحه پیش‌پرداخت |
| `booking_completed` | تکمیل موفق رزرو/پرداخت | `{ reservationId, totalPrice, discountCode }` | `customer_account_id` | Contractual / Service | ۷ سال (مالی) | `reservationId` | شلیک دقیقاً یک‌بار به ازای هر رزرو |

---

## ۵. تغییرات فایل‌ها و اندپوئینت‌های API

### فایل‌های تغییریافته/ایجادشده
1. **`sayra/src/modules/analytics/analytics.repo.ts`**:
   - افزودن `getRegisteredAccountsStats`
   - افزودن `getReservingCustomersCount`
   - افزودن `getPayingCustomersCount`
   - افزودن `getFunnelReservations`
   - افزودن `getDiscountPerformanceReservations`
2. **`sayra/src/modules/analytics/analytics.station.ts`**:
   - بروزرسانی `getCustomerSummary` با تفکیک پنج‌گانه موجودیت‌ها
   - پیاده‌سازی `getConversionFunnel`
   - پیاده‌سازی `getDiscountAnalytics`
   - پیاده‌سازی `getInstrumentationGaps`
3. **`sayra/src/modules/analytics/analytics.controller.ts` & `analytics.routes.ts`**:
   - سوار کردن مسیرهای زیر:
     * `GET /gamingCenters/:gamingCenterId/analytics/funnel`
     * `GET /gamingCenters/:gamingCenterId/analytics/discounts`
     * `GET /gamingCenters/:gamingCenterId/analytics/instrumentation-gaps`
4. **`sayra/src/docs/openapi.yaml`**:
   - مستندسازی کامل تمامی مسیرهای جدید مطابق OpenAPI 3.0.
5. **`sayra/tests/unit/modules/analytics/analytics.customers.spec.ts` & `analytics.benchmarks.spec.ts`**:
   - افزودن ۴ مجموعه تست واحد جامع برای قیف تبدیل، تخفیف‌ها، شکاف‌ها و ماک‌های جدید.

---

## ۶. نتایج تست‌ها و اعتبارسنجی (Test Evidence)

- **تست‌های واحد (Unit Tests):** ۶۰ تست از ۶۰ تست در ۱۰ سوئیت تست با موفقیت پاس شدند (`npm test`).
- **اعتبارسنجی OpenAPI:** لینتر Spectral با صفر خطا اجرا شد (`npm run api:validate`).
- **اعتبارسنجی ESLint:** دستور `npm run lint` بدون خطا اجرا شد.

---

## ۷. ملاحظات حریم خصوصی، رضایت و امنیت (Privacy & Security)

1. **ماسک کردن اطلاعات شناسایی (PII Masking):**
   - شماره تلفن مشتریان به فرمت `0912***1234` ماسک می‌شود.
   - شناسه مستعار `customerAccountId` یا `visitor_session_id` به عنوان کلید تحلیلی استفاده می‌شود.
2. **جداسازی مستأجران (Tenant Isolation):**
   - تمامی مسیرها با میدل‌ور `tenantGuard` محافظت شده و به `gamingCenterId` محدود هستند.
3. **سرکوب کوهورت‌های کوچک (K-Anonymity):**
   - در بنچ‌مارک‌ها و گزارش‌های کوهورت، گروه‌های با جمعیت $k < 5$ سرکوب (`SUPPRESSED`) می‌شوند.

---

## ۸. قراردادهای API برای فازهای بعدی (Phase 6 / Phase 12 Contracts)

تمامی اندپوئینت‌های تحلیلی پاسخ استاندارد به ساختار زیر برمی‌گردانند:

```json
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2026-03-01T00:00:00.000Z",
      "endDate": "2026-03-31T23:59:59.999Z",
      "timeZone": "Asia/Tehran"
    },
    "entityTaxonomyBreakdown": {
      "registeredAccountsInPeriod": 12,
      "totalRegisteredAccounts": 150,
      "reservingCustomersCount": 45,
      "payingCustomersCount": 40,
      "completedSessionCustomersCount": 38
    }
  }
}
```

**وضعیت نهایی:** این پیاده‌سازی کامل بوده و آماده تحویل به فازهای بعدی است.
