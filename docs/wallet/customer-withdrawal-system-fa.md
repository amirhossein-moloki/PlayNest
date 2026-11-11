# مستندات فنی سامانه درخواست برداشت از کیف پول کاربران (Customer Wallet Withdrawal System)

این سند معماری، مدل‌های پایگاه داده، قوانین کسب‌وکار، امنیت، جریان‌های کاری و مشخصات API سیستم برداشت از کیف پول کاربران را در سامانه Sayra تشریح می‌کند.

---

## ۱. مدل‌های دیتابیس و روابط (Database Models & Relations)

### ۱.۱. انوم‌ها (Enums)
- **`WithdrawalRequestStatus`**:
  - `PENDING`: در انتظار بررسی مدیر پلتفرم
  - `APPROVED`: تأیید شده توسط مدیر و ورود به مرحله پرداخت
  - `REJECTED`: رد شده توسط مدیر (همراه با دلیل)
  - `PROCESSING`: در حال انجام انتقال وجه
  - `PAID`: پرداخت موفق و تکمیل نهایی
  - `FAILED`: خطای پرداخت / انتقال ناموفق
  - `CANCELLED`: لغو شده
- **`WalletTransactionType`** (توسعه‌یافته):
  - `REFUND`: استرداد وجه رزرو
  - `RESERVATION_PAYMENT`: پرداخت هزینه رزرو از کیف پول
  - `DEPOSIT`: شارژ کیف پول
  - `MANUAL_ADJUSTMENT`: اصلاح دستی موجودی توسط مدیر
  - `WITHDRAWAL_HOLD`: رزرو اتمیک موجودی هنگام ثبت درخواست برداشت
  - `WITHDRAWAL_REFUND`: آزادسازی و بازگشت مبلغ درخواست ردشده یا ناموفق به موجودی قابل برداشت
  - `WITHDRAWAL_PAID`: کسر قطعی مبلغ از موجودی کل کیف پول پس از پرداخت موفق

### ۱.۲. مدل `CustomerAccount` (فیلدهای جدید)
- `walletBalance`: موجودی کل کیف پول به ریال (authoritative integer)
- `reservedBalance`: موجودی رزروشده برای درخواست‌های برداشت در جریان (PENDING / APPROVED / PROCESSING)
- `availableBalance`: موجودی قابل برداشت/مصرف که به صورت `walletBalance - reservedBalance` محاسبه می‌شود.
- `lastWithdrawalRequestAt`: تاریخ و ساعت ثبت آخرین درخواست برداشت جهت اعمال محدودیت ۲۴ ساعته.

### ۱.۳. مدل `WithdrawalRequest`
- `id`: شناسه یکتا (CUID)
- `customerAccountId`: کلید خارجی به حساب کاربر (`CustomerAccount`)
- `amount`: مبلغ درخواستی (عدد صحیح مثبت به ریال)
- `currency`: واحد پولی (پیش‌فرض "IRR")
- `status`: وضعیت درخواست (`WithdrawalRequestStatus`)
- `rejectionReason`: دلیل رد درخواست توسط مدیر
- `paymentReference`: شناسه پیگیری پرداخت بانکی
- `bankDetails`: اطلاعات حساب مقصد شامل شبا (`sheba`)، شماره کارت (`cardNumber`)، نام صاحب حساب (`accountHolderName`) و نام بانک (`bankName`)
- `reviewerAdminId`: شناسه مدیر پلتفرم بررسی‌کننده (`PlatformAdmin`)
- `approvedAt`: زمان تأیید مدیر
- `processedAt`: زمان شروع پردازش پرداخت
- `paidAt`: زمان نهایی پرداخت
- `rejectedAt`: زمان رد درخواست
- `cancelledAt`: زمان لغو درخواست
- `createdAt` و `updatedAt`: زمان‌بندی ثبت و به‌روزرسانی

### ۱.۴. مدل `CustomerNotification`
ساختار اختصاصی اعلان‌های درون‌برنامه‌ای کاربران عادی (`CustomerAccount`)، مجزا از اعلان‌های پرسنل (`Notification` برای `User`):
- `id`, `customerAccountId`, `title`, `message`, `type`, `isRead`, `metadata`, `createdAt`, `updatedAt`

---

## ۲. قوانین و الزامات کسب‌وکار (Business Rules & SLA)

1. **اعتبارسنجی مبلغ**:
   - مبلغ باید عدد صحیح مثبت (`> 0`) باشد.
   - مبلغ درخواستی نباید از موجودی قابل برداشت (`availableBalance = walletBalance - reservedBalance`) بیشتر باشد.
2. **محدودیت زمانی ۲۴ ساعته**:
   - هر کاربر در هر بازه ۲۴ ساعته تقویمی صرفاً مجاز به ثبت ۱ درخواست برداشت است.
   - بررسی به صورت سخت‌گیرانه در سطح سرور و پایگاه داده انجام می‌شود (`now < lastWithdrawalRequestAt + 24h`).
3. **هم‌زمانی و رزرو اتمیک (Concurrency & Atomicity)**:
   - ثبت درخواست داخل تراکنش دیتابیس با قفل ردیف (`SELECT ... FOR UPDATE` روی `CustomerAccount`) انجام می‌شود تا درخواست‌های هم‌زمان نتوانند از سقف موجودی عبور کنند یا دو درخواست در یک لحظه ثبت نمایند.
   - با ثبت درخواست، مقدار `amount` به `reservedBalance` افزوده می‌شود و تراکنش `WITHDRAWAL_HOLD` در تاریخچه کیف پول کاربر درج می‌گردد.
4. **رد درخواست توسط مدیر**:
   - در صورت رد درخواست، مبلغ رزروشده از `reservedBalance` کسر شده و تراکنش `WITHDRAWAL_REFUND` ثبت می‌گردد؛ موجودی قابل برداشت بلافاصله آزاد می‌شود. ثبت دلیل رد الزامی است.
5. **تکمیل پرداخت (`PAID`)**:
   - وضعیت `PAID` تنها پس از انجام واقعی پرداخت ثبت می‌شود. در این حالت، مبلغ هم از `reservedBalance` و هم از `walletBalance` کسر شده و تراکنش `WITHDRAWAL_PAID` درج می‌گردد.
6. **مهلت ۷۲ ساعته پرداخت (72-Hour Payout SLA)**:
   - درخواست‌های تأییدشده (`APPROVED`) باید حداکثر ظرف ۷۲ ساعت پرداخت شوند.
   - اندپوینت اختصاصی `GET /api/v1/platform-admin/withdrawals/overdue` درخواست‌هایی را که زمان تأیید آن‌ها بیش از ۷۲ ساعت گذشته است فهرست می‌کند.
7. **استقلال از درگاه‌ها**:
   - سیستم برداشت از درگاه‌ها و سرویس‌های واسط (مانند زیبال) مستقل است و وضعیت پرداخت بدون نیاز به endpoint فرضی توسط مدیر پلتفرم ثبت می‌شود.

---

## ۳. فهرست APIهای سیستم برداشت

### ۳.۱. اندپوینت‌های کاربر (`/api/v1/customer/...`)
- `GET /api/v1/customer/wallet`: دریافت وضعیت موجودی کیف پول، موجودی رزروشده، موجودی قابل برداشت و وضعیت امکان برداشت در ۲۴ ساعت آینده.
- `POST /api/v1/customer/wallet/withdraw`: ثبت درخواست برداشت جدید (Body: `{ amount, bankDetails, note }`).
- `GET /api/v1/customer/wallet/withdrawals`: لیست درخواست‌های برداشت خود کاربر با فیلتر وضعیت و صفحه‌بندی.
- `GET /api/v1/customer/wallet/withdrawals/:id`: مشاهده جزئیات یک درخواست برداشت متعلق به خود کاربر.
- `GET /api/v1/customer/wallet/transactions`: دریافت تاریخچه تراکنش‌های کیف پول با صفحه‌بندی و فیلتر نوع تراکنش.
- `GET /api/v1/customer/wallet/transactions/:id`: جزئیات یک تراکنش متعلق به خود کاربر.
- `GET /api/v1/customer/notifications`: مشاهده اعلان‌های درون‌برنامه‌ای کاربر و تعداد اعلان‌های خوانده‌نشده.
- `PATCH /api/v1/customer/notifications/:id/read`: علامت‌گذاری اعلان به عنوان خوانده‌شده.

### ۳.۲. اندپوینت‌های مدیریت پلتفرم (`/api/v1/platform-admin/...`)
- `GET /api/v1/platform-admin/withdrawals`: مشاهده تمام درخواست‌ها با فیلتر وضعیت، بازه تاریخی، جستجو بر اساس شناسه یا کاربر، و مرتب‌سازی.
- `GET /api/v1/platform-admin/withdrawals/overdue`: مشاهده درخواست‌های تأییدشده‌ای که از مهلت ۷۲ ساعته پرداخت عبور کرده‌اند.
- `GET /api/v1/platform-admin/withdrawals/:id`: مشاهده جزئیات کامل درخواست، اطلاعات کاربر، موجودی‌ها و تاریخچه تراکنش‌ها.
- `POST /api/v1/platform-admin/withdrawals/:id/approve`: تأیید درخواست برداشت توسط مدیر (Body: `{ note }`).
- `POST /api/v1/platform-admin/withdrawals/:id/reject`: رد درخواست همراه با دلیل اجباری (Body: `{ reason, note }`).
- `PATCH /api/v1/platform-admin/withdrawals/:id/payment`: تغییر وضعیت پرداخت به `PROCESSING`، `PAID` یا `FAILED` همراه با شناسه پیگیری (Body: `{ status, paymentReference, note }`).

---

## ۴. کنترل دسترسی و امنیت (Security & Permissions)
- تمامی مسیرهای کاربری ملزم به احراز هویت توکن Bearer و تطابق نقش `CUSTOMER` هستند. شناسه کاربر مستقیماً از توکن استخراج می‌شود.
- تمامی مسیرهای مدیریتی توسط گارد `requirePlatformAdmin` محافظت شده و دسترسی کاربران عادی به آن‌ها با خطای ۴۰۳ مسدود می‌گردد.
- تمام عملیات تغییر موجودی و وضعیت‌ها در تراکنش‌های ایزوله دیتابیس صورت می‌پذیرد و رویدادهای حساس در `AuditLog` ذخیره می‌شوند.
