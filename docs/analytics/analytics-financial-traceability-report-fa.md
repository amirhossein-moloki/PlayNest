# Play-Nest Analytics Phase 2 — گزارش جامع شفافیت و ردگیری‌پذیری مالی (Financial Traceability Report)

## ۱. نقش و هدف سیستم مالی Analytics
این گزارش توسط **مهندس ارشد مالی/داده** تدوین شده است تا صحت کامل، ردگیری‌پذیری (Traceability)، قابلیت تطبیق (Reconciliation)، و عدم بیان هرگونه ادعای مالی بدون مدرک را تضمین کند.

سیستم تحلیلی مالی Play-Nest به‌صورت **۱۰۰٪ Read-Only** عمل کرده و هیچ تراکنش، وضعیت یا مانده حسابی را در پایگاه دادهٔ عملیاتی تغییر نمی‌دهد.

---

## ۲. ماتریس نگاشت KPIهای مالی به منابع داده (KPI Mapping Matrix)

| کد شاخص | عنوان فارسی شاخص | منبع داده (جدول / فیلد) | وضعیت‌های شمول / استثنا | پایه زمانی (Timestamp) | واحد پول & فرمول | روش تطبیق (Reconciliation) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **M-FIN-001** | **مبلغ ناخالص وصول‌شده** (Gross Cash Collected) | `Payment.amount` | **شامل**: `status = PAID`<br>**مستثنا**: `FAILED`, `PENDING`, `EXPIRED`, `CANCELED` | `paidAt` (زمان تأیید پرداخت) | واحد فرعی/ریال (`Int`)<br>`SUM(Payment.amount)` به‌تفکیک `currency` | تطبیق با مدخل دفترکل `PAYMENT_COLLECTION` (قانون `REC-001` و `REC-002`) |
| **M-FIN-002** | **مبلغ کل بازپرداخت‌ها** (Total Refunded Amount) | `Refund.amount` | **شامل**: `status = SUCCESSFUL`<br>**مستثنا**: `PENDING`, `FAILED` | `processedAt` (زمان واریز) | واحد فرعی/ریال (`Int`)<br>`SUM(Refund.amount)` به‌تفکیک `currency` | تطبیق با مدخل دفترکل `REFUND_DISBURSEMENT` (قانون `REC-003`) |
| **M-FIN-003** | **خالص وجه وصول‌شده** (Net Cash Collected) | ترکیبی (`Payment` و `Refund`) | `Payment.status = PAID`<br>`Refund.status = SUCCESSFUL` | `paidAt` / `processedAt` | واحد فرعی/ریال (`Int`)<br>`Gross Cash Collected - Total Refunded` | تطبیق مابه التفاوت دفترکل دریافت و پرداخت |
| **M-FIN-004** | **نرخ موفقیت پرداخت** (Payment Success Rate) | `Payment.status` | **صورت**: تعداد `PAID`<br>**مخرج**: کل تلاش‌های پرداخت (`PAID + FAILED + EXPIRED + CANCELED`) | `createdAt` | درصد (`Percentage`) با دقت ۲ رقم اعشار<br>`(PAID Count / Total Attempt Count) * 100` | شمارش تلاش‌های یکتا بر اساس `idempotencyKey` |
| **M-FIN-005** | **تلاش‌های ناموفق پرداخت** (Failed Payment Attempts) | `Payment` | **شامل**: `status IN (FAILED, EXPIRED, CANCELED)` | `createdAt` | تعداد + مبلغ شناور (`amount`) | تحلیل علل شکست از فیلد `failureReason` |
| **M-FIN-006** | **تعهدات کیف‌پول ایفا نشده** (Unearned Wallet Liability) | `CustomerAccount.walletBalance` | **شامل**: مشتریان مرتبط با مرکز (`gamingCenterId`) | لحظه‌ای / آخرین به‌روزرسانی | واحد فرعی/ریال (`Int`)<br>`SUM(CustomerAccount.walletBalance)` | تطبیق با تراکنش‌های `TOP_UP` و `RESERVATION_PAYMENT` |
| **M-FIN-007** | **کمیسیون و درآمد Play-Nest** (Platform Commission Revenue) | `Earning.commissionAmount` | **شامل**: `status IN (CHARGED, PENDING)` | `calculatedAt` / `chargedAt` | واحد فرعی/ریال (`Int`)<br>`SUM(Earning.commissionAmount)` | تطبیق با نرخ درصد `CommissionPolicy.percentBps` (قانون `REC-006`) |
| **M-FIN-008** | **سهم خالص مرکز گیمینگ** (Gaming Center Share) | ترکیبی (`Payment`, `Refund`, `Earning`) | پرداخت‌های موفق منهای بازپرداخت‌ها و کمیسیون | `paidAt` | واحد فرعی/ریال (`Int`)<br>`Net Collected - Play-Nest Commission` | تطبیق سه‌جانبه درگاه، مرکز و پلتفرم |
| **M-FIN-009** | **هزینه و سود خالص مرکز** (Costs & Net Profit) | **فاقد منبع داده** | **غیرقابل محاسبه** (`NOT_CALCULABLE`) | N/A | N/A | **عدم امکان ادعا** به دلیل نبود جدول هزینه‌های مرکز (`CenterExpense`) |

---

## ۳. کشف مستند منابع عملیاتی تراکنش‌ها

### ۳.۱. تراکنش‌های پرداخت (Payment Entities)
- **جدول مرجع**: `Payment`
- **شناسه‌های یکتا و مرجع درگاه**: `id` (CUID)، `providerPaymentId` (شناسه تراکنش درگاه)، `referenceCode` (کد پیگیری بانکی/POS)، `idempotencyKey` (کلید یکتایی در سطح مرکز).
- **وضعیت‌ها**: `INITIATED`, `PENDING`, `PAID`, `FAILED`, `CANCELED`, `REFUNDED`, `PARTIALLY_REFUNDED`, `EXPIRED`.
- **تفکیک زمان درخواست و تأیید**: `createdAt` (زمان ایجاد درخواست پرداخت) در برابر `paidAt` (زمان دریافت تأییدیه پرداخت از درگاه یا اپراتور).

### ۳.۲. مبالغ رزرو و تخفیف‌ها
- **جدول مرجع**: `AnalyticsReservation` / `Reservation`
- **مبلغ اولیه**: `totalPrice` + `discountAmount`
- **تخفیف**: `discountAmount` (بر حسب ریال/minor units)
- **مبلغ نهایی سفارش**: `totalPrice` (مبلغ نهایی قابل پرداخت پس از کسر تخفیف)
- **واحد پول**: `currency` (پیش‌فرض `IRR`).

### ۳.۳. بازپرداخت‌ها (Refund Entities)
- **جدول مرجع**: `Refund`
- **وضعیت‌ها**: `PENDING`, `SUCCESSFUL`, `FAILED`
- **محتوا**: `amount`, `currency`, `reason`, `failureReason`, `providerRefundId`, `processedAt` (زمان واریز نهایی).

### ۳.۴. دفترکل مالی (Ledger Entry)
- **جدول مرجع**: `LedgerEntry`
- **انواع ثبت مالی**:
  - `PAYMENT_COLLECTION`: دریافت وجه از پرداخت موفق
  - `REFUND_DISBURSEMENT`: خروج وجه بابت بازپرداخت
  - `COMMISSION_DEDUCTION`: کسر کمیسیون پلتفرم
  - `SETTLEMENT_PAYOUT`: تسویه نهایی با مرکز
  - `ADJUSTMENT`: تعدیلات دستی یا سیستم
- **کنترل یکتایی**: `idempotencyKey` به عنوان منبع کنترل مستقل.

---

## ۴. قواعد قطعی محاسبات مالی و رفع مغایرت‌ها

۱. **تفکیک مفاهیم مالی**:
   - مبلغ اولیه رزرو، مبلغ نهایی، مبلغ پرداخت‌شده موفق، مبلغ بازپرداخت‌شده، خالص وجه وصول‌شده، سهم مرکز، کمیسیون پلتفرم و سود خالص به‌هیچ‌وجه با یکدیگر خلط نمی‌شوند.
۲. **دقت عددی و جلوگیری از خطای Float**:
   - تمامی محاسبات منحصراً با اعداد صحیح (`Int`) در واحد minor units (ریال) انجام می‌شوند.
   - از هرگونه گردکردن با ممیز شناور (`float`) جلوگیری شده و در صورت نیاز از تابع `Math.round()` روی مقادیر integer استفاده می‌شود.
۳. **تک‌ارزی و ایزوله‌سازی Currency**:
   - جمع‌زدن مبالغ ارزی متفاوت (مانند IRR و USD) بدون نرخ تبدیل رسمی و timestamp تأییدشده ممنوع است. گزارش‌های تحلیلی مبالغ را به‌تفکیک ارز تفکیک و ایزوله می‌کنند.
۴. **جلوگیری از شمارش مضاعف (Double-Count Prevention)**:
   - در کوئری‌های ترکیبی (JOIN یک‌به‌چند)، از تجمیع مستقیم روی جداول فرعی پرهیز شده و از `groupBy` مجزا بر روی شناسه‌های یکتا استفاده می‌شود.
۵. **عدم ادعای سودآوری بدون داده**:
   - به دلیل عدم وجود جدول ثبت هزینه‌های عملیاتی مرکز گیمینگ، سود خالص (`Net Profit`) و حاشیه سود (`Profit Margin`) صریحاً **غیرقابل محاسبه** (`NOT_CALCULABLE`) اعلام می‌گردد.

---

## ۵. بخش‌های الزامی خروجی پایان فاز (Sections A through H)

### A. تعریف دقیق هر شاخص و مبنای زمانی آن
- **M-FIN-001 (Gross Cash Collected)**: مجموع مبالغ دریافت شده از پرداخت‌های موفق بر پایه `paidAt`.
- **M-FIN-002 (Total Refunded)**: مجموع مبالغ بازپرداخت‌شده موفق بر پایه `processedAt`.
- **M-FIN-003 (Net Cash Collected)**: تفاضل ناخالص و بازپرداخت‌ها در بازه زمانی تعیین‌شده.
- **M-FIN-004 (Payment Success Rate)**: نسبت پرداخت‌های موفق به کل درخواست‌های پرداخت بر پایه `createdAt`.
- **M-FIN-006 (Unearned Wallet Liability)**: مانده تعهد ایفا نشده کیف‌پول مشتریان بر پایه زمان استعلام.
- **M-FIN-007 (Platform Commission Revenue)**: مجموع درآمد کمیسیون Play-Nest بر پایه `calculatedAt`.

### B. منبع / مدل / فیلد و شواهد هر ورودی
- `Payment.amount` & `Payment.status`: جهت محاسبه مبالغ وصولی و شکست خورده.
- `Refund.amount` & `Refund.status`: جهت محاسبه بازپرداخت‌های عملیاتی.
- `LedgerEntry.entryType` & `LedgerEntry.amount`: جهت کنترل منبع مستقل دفترکل.
- `CustomerAccount.walletBalance`: جهت محاسبه تعهدات کیف‌پول.
- `Earning.commissionAmount`: جهت محاسبه درآمد کمیسیون پلتفرم.

### C. قواعد Reconciliation و نتایج تطبیق واقعی
- **REC-001**: پرداخت‌های با وضعیت `PAID` باید حتماً ثبت `PAYMENT_COLLECTION` در دفترکل داشته باشند.
- **REC-002**: مبلغ پرداخت موفق باید دقیقاً برابر با مبلغ ثبت شده در دفترکل باشد.
- **REC-003**: بازپرداخت‌های `SUCCESSFUL` باید دارای ثبت `REFUND_DISBURSEMENT` باشند.
- **REC-004**: کلید یکتایی `idempotencyKey` دفترکل نباید تکراری باشد.
- **REC-005**: واریز به کیف‌پول (`DEPOSIT`) باید مقدار مثبت داشته باشد.
- **REC-006**: محاسبه کمیسیون باید با نرخ درصد `CommissionPolicy.percentBps` مطابقت داشته باشد.

### D. فایل‌های تغییریافته و دلیل هر تغییر
- `sayra/src/modules/analytics/analytics.station.ts`: ایزوله‌سازی مبالغ ارزی متناظر با هر `currency` و افزودن اعلامیه رسمی `NOT_CALCULABLE` برای هزینه‌ها و سود خالص.
- `sayra/tests/unit/modules/analytics/analytics.financials.spec.ts`: توسعه تست‌های واحد برای بررسی ایزوله‌سازی چندارزی و وضعیت غیرقابل‌محاسبه بودن سود.
- `docs/analytics/analytics-financial-traceability-report-fa.md`: ایجاد این سند جامع گزارش ردگیری‌پذیری و شفافیت مالی.

### E. تست‌های اجراشده و نتیجه
- اجرای موفق کامل مجموعه تست‌های واحد و یکپارچه‌سازی (`npm test`): **۸۶ Test Suite، ۴۹۵ تست پاس‌شده** بدون هیچ‌گونه خطا یا regression.

### F. موارد ناممکن / غیرقابل‌تأیید
- **سود خالص (Net Profit) و حاشیه سود (Profit Margin)**: به دلیل عدم وجود داده و جدول ثبت هزینه‌های ثابت و متغیر مرکز (مانند اجاره، برق، حقوق پرسنل، استهلاک)، صریحاً غیرقابل محاسبه (`NOT_CALCULABLE`) اعلام شد.

### G. نیازهای تصمیم کسب‌وکار یا مالی که باید توسط انسان تأیید شود
۱. **تعریف ساختار هزینه‌های مرکز (`CenterExpense`)**: تعیین الگوی ثبت هزینه‌های عملیاتی جهت امکان محاسبات سود در فازهای بعدی.
۲. **قواعد نرخ تبدیل ارزی**: تعیین مرجع رسمی نرخ تبدیل ارزی در صورتی که مرکز گیمینگ تراکنش‌های چندارزی همزمان داشته باشد.

### H. قراردادهای KPI / API برای فاز ۶
- اندپوئینت `/gamingCenters/:gamingCenterId/analytics/financials` و `/financials/overview` قرارداد داده‌ای تثبیت‌شده برای ارائه به مالکان در فاز ۶ آماده ارائه می‌باشد.
