# راهنمای جامع APIهای سیستم گیم‌نت (Sevra)

این مستند شامل لیست کامل نقاط دسترسی (Endpoints)، متدها، پارامترهای ورودی و سطوح دسترسی مورد نیاز برای تعامل با بک‌اند سیستم است. تمامی مسیرها با پیش‌وند `/api/v1` شروع می‌شوند.

---

## ۱. احراز هویت (Authentication)
تمامی مسیرها زیرمجموعه `/auth` هستند.

| متد | مسیر | توضیحات | پارامترهای Body | دسترسی |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/user/otp/request` | درخواست کد OTP برای کارکنان | `phone` | عمومی |
| POST | `/user/otp/verify` | تایید کد و دریافت توکن | `phone`, `code` | عمومی |
| POST | `/user/login/otp` | ورود مستقیم کاربر به شعبه با OTP | `phone`, `gamingCenterId` | عمومی |
| POST | `/customer/otp/request` | درخواست کد OTP برای مشتریان | `phone` | عمومی |
| POST | `/customer/otp/verify` | تایید هویت مشتری و ورود | `phone`, `code` | عمومی |
| POST | `/login` | ورود کلاسیک (مخصوص مدیران سیستم) | `phone`, `password`, `gamingCenterId` | عمومی |
| POST | `/refresh` | تمدید توکن منقضی شده | `refreshToken` | عمومی |
| POST | `/logout` | خروج از حساب و ابطال توکن | - | کاربر لاگین شده |
| GET | `/me` | دریافت اطلاعات پروفایل جاری | - | کاربر لاگین شده |

---

## ۲. مدیریت مرکز بازی (Gaming Centers)
مسیر اصلی: `/gamingCenters`

| متد | مسیر | توضیحات | نقش مورد نیاز |
| :--- | :--- | :--- | :--- |
| GET | `/` | لیست تمام مراکز (برای ادمین سیستم) | عمومی / ادمین |
| POST | `/` | ایجاد مرکز جدید | SYSTEM_ADMIN |
| GET | `/:id` | جزئیات یک مرکز | عمومی |
| PATCH | `/:id` | ویرایش اطلاعات مرکز | MANAGER |
| DELETE | `/:id` | حذف (غیرفعال‌سازی) مرکز | MANAGER |

---

## ۳. ایستگاه‌های بازی (Game Stations)
مدیریت کنسول‌ها و سیستم‌های PC. مسیر: `/gamingCenters/:gamingCenterId/stations`

| متد | مسیر | توضیحات | پارامترهای اصلی Body | دسترسی |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/` | لیست تمام ایستگاه‌های مرکز | - | STAFF / MANAGER |
| POST | `/` | تعریف ایستگاه جدید | `name`, `stationType`, `hourlyPrice`, ... | MANAGER |
| GET | `/:stationId` | جزئیات فنی یک ایستگاه | - | STAFF / MANAGER |
| PATCH | `/:stationId` | ویرایش تنظیمات ایستگاه | اختیاری: `hourlyPrice`, `isActive`, ... | MANAGER |
| DELETE | `/:stationId` | حذف ایستگاه | - | MANAGER |

---

## ۴. رزرواسیون - پنل مدیریت (Reservations)
مسیر: `/gamingCenters/:gamingCenterId/reservations`

| متد | مسیر | توضیحات | پارامترهای اصلی Body | دسترسی |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/` | لیست و فیلتر رزروها | `page`, `status`, `dateFrom`, ... | STAFF / MANAGER |
| POST | `/` | ثبت رزرو حضوری توسط اپراتور | `stationId`, `staffId`, `startTime`, `customer` | STAFF / MANAGER |
| GET | `/:reservationId` | جزئیات کامل یک رزرو | - | STAFF / MANAGER |
| PATCH | `/:reservationId` | ویرایش زمان یا ایستگاه | `stationId`, `startTime`, ... | MANAGER / SUPERVISOR |
| POST | `/:reservationId/confirm` | تایید نوبت رزرو شده | - | MANAGER / SUPERVISOR |
| POST | `/:reservationId/cancel` | لغو رزرو با ذکر دلیل | `reason` | MANAGER / SUPERVISOR |
| POST | `/:reservationId/complete` | اتمام بازی و تسویه | - | MANAGER / SUPERVISOR |
| POST | `/:reservationId/no-show` | ثبت عدم حضور مشتری | - | MANAGER / SUPERVISOR |

---

## ۵. رزرو آنلاین و ظرفیت (Public / Online Booking)
مسیر: `/public/gamingCenters/:salonSlug`

| متد | مسیر | توضیحات | پارامترها | نکات فنی |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/stations` | لیست ایستگاه‌های فعال عمومی | - | - |
| GET | `/availability/slots` | مشاهده زمان‌های خالی | `stationId`, `startDate`, `endDate` | Query Params |
| POST | `/reservations` | ثبت رزرو آنلاین توسط مشتری | `stationId`, `startTime`, `customer` | نیاز به `idempotency-key` در هدر |

---

## ۶. پنل اختصاصی مشتری (Customer Panel)
مسیر: `/customer` (نیاز به توکن مشتری)

| متد | مسیر | توضیحات | پارامترها |
| :--- | :--- | :--- | :--- |
| GET | `/me` | اطلاعات حساب مشتری | - |
| GET | `/reservations` | تاریخچه رزروهای مشتری | - |
| GET | `/:reservationId` | جزئیات یک رزرو خاص | - |
| POST | `/reservations/:reservationId/cancel` | لغو رزرو توسط خود مشتری | `reason` |
| POST | `/reservations/:reservationId/ratings` | ثبت امتیاز و نظر | `rating` (1-5), `comment` |

---

## ۷. کارکنان و شیفت‌ها (Staff & Shifts)
مسیر: `/gamingCenters/:gamingCenterId/staff`

| متد | مسیر | توضیحات | پارامترها | دسترسی |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/` | لیست پرسنل مرکز | - | تمام کارکنان مرکز |
| POST | `/` | افزودن کارمند جدید | `fullName`, `phone`, `role` | MANAGER |
| PUT | `/:userId` | ویرایش پروفایل کارمند | `isActive`, `role`, `fullName` | MANAGER |
| DELETE | `/:userId` | حذف کارمند | - | MANAGER |
| PUT | `/:userId/staffShifts` | تنظیم برنامه کاری هفته | آرایه‌ای از شیفت‌ها با `dayOfWeek`, `startTime`, `endTime` | MANAGER |

---

## ۸. مدیریت مشتریان - CRM
مسیر: `/gamingCenters/:gamingCenterId/customers`

| متد | مسیر | توضیحات | پارامترهای Query/Body |
| :--- | :--- | :--- | :--- |
| GET | `/` | جستجو در بانک مشتریان | `search`, `page`, `limit` |
| GET | `/:customerId` | مشاهده تاریخچه مشتری | - |
| POST | `/` | ایجاد پروفایل مشتری دستی | `phone`, `fullName` |
| PATCH | `/:customerId` | ویرایش نوت‌های مشتری | `note`, `displayName` |

---

## ۹. مالی و تحلیل (Analytics & Finance)
مسیر: `/gamingCenters/:gamingCenterId`

| بخش | متد | مسیر | توضیحات | دسترسی |
| :--- | :--- | :--- | :--- | :--- |
| **تحلیل** | GET | `/analytics/summary` | آمار کل عملکرد مرکز | MANAGER |
| **تحلیل** | GET | `/analytics/revenue-chart` | داده‌های نمودار درآمدی | MANAGER |
| **تحلیل** | GET | `/analytics/stations` | آمار استفاده از دستگاه‌ها | MANAGER |
| **تنظیمات** | GET | `/settings` | تنظیمات قوانین رزرو | STAFF / MANAGER |
| **تنظیمات** | PATCH | `/settings` | به‌روزرسانی ساعات کاری و قوانین | MANAGER |
| **پورسانت** | GET | `/commissions` | لیست کارمزدهای پلتفرم | MANAGER |
| **لاگ** | GET | `/audit-logs` | گزارش تغییرات حساس سیستم | MANAGER |

---

## ۱۰. مدیریت محتوا (CMS)
مسیر: `/gamingCenters/:gamingCenterId` (دسترسی: MANAGER)

| متد | مسیر | توضیحات | کاربرد |
| :--- | :--- | :--- | :--- |
| POST | `/media/upload` | آپلود تصویر | `file`, `purpose` (COVER, GALLERY, LOGO) |
| GET | `/pages` | لیست صفحات استاتیک | مدیریت لندینگ‌ها |
| POST | `/pages` | ایجاد صفحه جدید | `slug`, `title`, `sections` (JSON) |
| PUT | `/site-settings` | تنظیمات سئو و عمومی | `seoTitle`, `seoDescription` |

---

## نکات کلیدی برای پیاده‌سازی فرانت‌اند

### ساختار پاسخ (Response Structure)
تمام پاسخ‌های موفق (Status 2xx):
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "...",
    "pagination": { "total": 100, "page": 1, ... }
  }
}
```

### ساختار خطا (Error Structure)
در صورت بروز خطا (Status 4xx/5xx):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "توضیحات خطا به زبان انسانی",
    "details": { ... }
  }
}
```

### جلوگیری از تکرار (Idempotency)
برای درخواست‌های ثبت رزرو آنلاین (`POST /public/.../reservations`)، ارسال هدر `idempotency-key` الزامی است. این کلید باید برای هر تلاش منحصربه‌فرد، یکتا باشد (مثلاً UUID).

### امنیت و جداسازی (Multi-tenancy)
بسیاری از مسیرها شامل `:gamingCenterId` هستند. سیستم به طور خودکار چک می‌کند که کاربر لاگین شده حتماً به آن مرکز دسترسی داشته باشد (`tenantGuard`).
