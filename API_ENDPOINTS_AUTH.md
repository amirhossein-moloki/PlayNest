# راهنمای کامل APIها و وضعیت احراز هویت (API Endpoints & Authentication Status)

این مستند شامل لیست کامل کلیه مسیرها (Endpoints) و APIهای سیستم به همراه وضعیت نیاز به کلید API (`x-api-key`)، توکن احراز هویت کاربر (`JWT Token`) و سطوح دسترسی/نقش‌های مورد نیاز می‌باشد.

---

## نکات کلیدی درباره ساختار امنیت و احراز هویت

1. **مستندات Swagger UI و فایل‌های استاتیک:**
   - مسیر `/api-docs` و فایل‌های آپلود شده `/uploads/*` به صورت عمومی (Public) در دسترس هستند و نیاز به کلید API یا توکن احراز هویت ندارند.
2. **کلید API استاتیک (`x-api-key`):**
   - تمامی مسیرهای موجود در ریشه `/api/v1/*` تحت میدل‌ور `apiKeyMiddleware` قرار دارند و ارسال هدر `x-api-key` برای تمام درخواست‌های این ریشه **الزامی** است.
3. **توکن احراز هویت JWT (`authMiddleware`):**
   - مسیرهای خصوصی و مدیریتی علاوه بر کلید API، نیازمند توکن معتبر JWT در هدر `Authorization: Bearer <token>` می‌باشند.
4. **کنترل دسترسی مبتنی بر نقش (RBAC) و چند مستأجری (Tenant Guard):**
   - نقش‌های تعریف شده عبارتند از: `STAFF` (پرسنل)، `SUPERVISOR` (سرپرست)، `MANAGER` (مدیر گیمینگ سنتر)، `ADMIN` (مدیر ارشد سیستم) و `SUPPORT` (کارشناس پشتیبانی).
   - مسیرهای مشتریان با عنوان `CUSTOMER` مشخص شده‌اند.

---

## جدول جامع APIهای سیستم

| شماره | ماژول / دسته بندی | متد | مسیر API (Endpoint) | نیاز به کلید API (`x-api-key`) | نیاز به توکن JWT (`authMiddleware`) | سطح دسترسی / نقش مورد نیاز | توضیحات |
| :---: | :--- | :---: | :--- | :---: | :---: | :--- | :--- |
| **1** | **مستندات** | `GET` | `/api-docs` | ❌ خیر | ❌ خیر | عمومی (Public) | مشاهده مستندات تعاملی Swagger |
| **2** | **فایل‌های استاتیک** | `GET` | `/uploads/*` | ❌ خیر | ❌ خیر | عمومی (Public) | دسترسی به فایل‌ها و رسانه‌های آپلود شده |
| **3** | **سلامت سیستم** | `GET` | `/api/v1/health` | ✅ بله | ❌ خیر | عمومی (Public) | بررسی وضعیت سلامت سرویس |
| **4** | **احراز هویت** | `POST` | `/api/v1/auth/user/otp/request` | ✅ بله | ❌ خیر | عمومی | درخواست کد OTP ورود پرسنل |
| **5** | **احراز هویت** | `POST` | `/api/v1/auth/user/otp/verify` | ✅ بله | ❌ خیر | عمومی | تایید کد OTP پرسنل |
| **6** | **احراز هویت** | `POST` | `/api/v1/auth/user/login/otp` | ✅ بله | ❌ خیر | عمومی | ورود پرسنل با کد OTP |
| **7** | **احراز هویت** | `POST` | `/api/v1/auth/customer/otp/request` | ✅ بله | ❌ خیر | عمومی | درخواست کد OTP برای مشتریان |
| **8** | **احراز هویت** | `POST` | `/api/v1/auth/customer/otp/verify` | ✅ بله | ❌ خیر | عمومی | تایید کد OTP و ورود/ثبت‌نام مشتری |
| **9** | **احراز هویت** | `POST` | `/api/v1/auth/login` | ✅ بله | ❌ خیر | عمومی | ورود کلاسیک پرسنل با رمز عبور |
| **10** | **احراز هویت** | `POST` | `/api/v1/auth/refresh` | ✅ بله | ❌ خیر | عمومی | تمدید توکن احراز هویت (Refresh Token) |
| **11** | **احراز هویت** | `POST` | `/api/v1/auth/logout` | ✅ بله | ✅ بله | هر کاربر متصل | خروج از حساب کاربری و ابطال نشست |
| **12** | **احراز هویت** | `GET` | `/api/v1/auth/me` | ✅ بله | ✅ بله | هر کاربر متصل | دریافت اطلاعات کاربر جاری |
| **13** | **مراکز بازی** | `GET` | `/api/v1/gamingCenters` | ✅ بله | ❌ خیر | عمومی | دریافت لیست تمام گیمینگ سنترها |
| **14** | **مراکز بازی** | `GET` | `/api/v1/gamingCenters/:id` | ✅ بله | ❌ خیر | عمومی | دریافت جزییات یک گیمینگ سنتر |
| **15** | **مراکز بازی** | `POST` | `/api/v1/gamingCenters` | ✅ بله | ✅ بله | کاربر متصل | ثبت گیمینگ سنتر جدید |
| **16** | **مراکز بازی** | `PATCH` | `/api/v1/gamingCenters/:id` | ✅ بله | ✅ بله | `MANAGER` | بروزرسانی اطلاعات مرکز بازی |
| **17** | **مراکز بازی** | `DELETE` | `/api/v1/gamingCenters/:id` | ✅ بله | ✅ بله | `ADMIN` | حذف مرکز بازی |
| **18** | **ایستگاه‌های بازی** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/stations` | ✅ بله | ✅ بله | کاربران احرازهویت‌شده مرکز | لیست ایستگاه‌های یک مرکز |
| **19** | **ایستگاه‌های بازی** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/stations` | ✅ بله | ✅ بله | `SUPERVISOR`, `MANAGER`, `ADMIN` | تعریف ایستگاه جدید |
| **20** | **ایستگاه‌های بازی** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/stations/:id` | ✅ بله | ✅ بله | کاربران احرازهویت‌شده مرکز | دریافت جزییات ایستگاه |
| **21** | **ایستگاه‌های بازی** | `PATCH` | `/api/v1/gamingCenters/:gamingCenterId/stations/:id` | ✅ بله | ✅ بله | `SUPERVISOR`, `MANAGER`, `ADMIN` | ویرایش ایستگاه |
| **22** | **ایستگاه‌های بازی** | `DELETE` | `/api/v1/gamingCenters/:gamingCenterId/stations/:id` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | حذف ایستگاه |
| **23** | **ایستگاه‌های بازی** | `PATCH` | `/api/v1/gamingCenters/:gamingCenterId/stations/:id/status` | ✅ بله | ✅ بله | `STAFF`, `SUPERVISOR`, `MANAGER`, `ADMIN` | تغییر وضعیت کارکرد ایستگاه |
| **24** | **ایستگاه‌های بازی** | `GET` | `/api/v1/public/gamingCenters/:gamingCenterSlug/stations` | ✅ بله | ❌ خیر | عمومی | مشاهده لیست ایستگاه‌های فعال مرکز |
| **25** | **پرسنل و کاربران** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/staff` | ✅ بله | ✅ بله | کاربران احرازهویت‌شده مرکز | لیست پرسنل مرکز |
| **26** | **پرسنل و کاربران** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/staff/:userId` | ✅ بله | ✅ بله | کاربران احرازهویت‌شده مرکز | جزییات یک عضو پرسنل |
| **27** | **پرسنل و کاربران** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/staff` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | افزودن عضو جدید به پرسنل |
| **28** | **پرسنل و کاربران** | `PATCH` | `/api/v1/gamingCenters/:gamingCenterId/staff/:userId` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | ویرایش اطلاعات پرسنل |
| **29** | **پرسنل و کاربران** | `DELETE` | `/api/v1/gamingCenters/:gamingCenterId/staff/:userId` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | حذف/غیرفعال‌سازی پرسنل |
| **30** | **شیفت‌های کاری** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/staff/:userId/staffShifts` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | ثبت شیفت کاری جدید |
| **31** | **شیفت‌های کاری** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/staff/:userId/staffShifts` | ✅ بله | ✅ بله | خود کاربر / `MANAGER`, `ADMIN` | دریافت لیست شیفت‌های پرسنل |
| **32** | **شیفت‌های کاری** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/staff/:userId/staffShifts/:shiftId` | ✅ بله | ✅ بله | خود کاربر / `MANAGER`, `ADMIN` | جزییات یک شیفت |
| **33** | **شیفت‌های کاری** | `PATCH` | `/api/v1/gamingCenters/:gamingCenterId/staff/:userId/staffShifts/:shiftId` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | ویرایش شیفت کاری |
| **34** | **شیفت‌های کاری** | `DELETE` | `/api/v1/gamingCenters/:gamingCenterId/staff/:userId/staffShifts/:shiftId` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | حذف شیفت کاری |
| **35** | **ظرفیت و زمان‌ها** | `GET` | `/api/v1/public/gamingCenters/:gamingCenterSlug/availability/slots` | ✅ بله | ❌ خیر | عمومی | دریافت سانس‌ها و اسلات‌های خالی |
| **36** | **رزروها (مدیریت)** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/reservation` | ✅ بله | ✅ بله | پرسنل و مدیران | ثبت رزرو حضوری/دستی |
| **37** | **رزروها (مدیریت)** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/reservation` | ✅ بله | ✅ بله | پرسنل و مدیران | دریافت لیست تمام رزروها |
| **38** | **رزروها (مدیریت)** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/reservation/:id` | ✅ بله | ✅ بله | پرسنل و مدیران | دریافت جزییات یک رزرو |
| **39** | **رزروها (مدیریت)** | `PATCH` | `/api/v1/gamingCenters/:gamingCenterId/reservation/:id/status` | ✅ بله | ✅ بله | پرسنل و مدیران | تغییر وضعیت رزرو |
| **40** | **رزروها (مدیریت)** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/reservation/:id/check-in` | ✅ بله | ✅ بله | پرسنل و مدیران | ثبت ورود و چک‌این رزرو |
| **41** | **رزروها (مدیریت)** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/reservation/:id/cancel` | ✅ بله | ✅ بله | پرسنل و مدیران | لغو رزرو |
| **42** | **رزروها (مدیریت)** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/reservation/:id/complete` | ✅ بله | ✅ بله | پرسنل و مدیران | اتمام رزرو |
| **43** | **رزروها (مدیریت)** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/reservation/:id/extend` | ✅ بله | ✅ بله | پرسنل و مدیران | تمدید زمان رزرو |
| **44** | **رزروها (مدیریت)** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/reservation/:id/transfer` | ✅ بله | ✅ بله | پرسنل و مدیران | جابجایی رزرو به ایستگاه دیگر |
| **45** | **رزروها (مدیریت)** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/reservation/walk-in` | ✅ بله | ✅ بله | پرسنل و مدیران | ثبت رزرو فوری حضوری |
| **46** | **رزروها (مدیریت)** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/reservation/station/:stationId/active` | ✅ بله | ✅ بله | پرسنل و مدیران | دریافت رزرو فعال ایستگاه |
| **47** | **رزروها (عمومی)** | `POST` | `/api/v1/public/gamingCenters/:gamingCenterSlug/reservation` | ✅ بله | ❌ خیر | عمومی | ثبت رزرو آنلاین توسط کاربران عمومی |
| **48** | **مدیریت مشتریان** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/customers` | ✅ بله | ✅ بله | پرسنل و مدیران | لیست مشتریان گیمینگ سنتر |
| **49** | **مدیریت مشتریان** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/customers/:id` | ✅ بله | ✅ بله | پرسنل و مدیران | جزییات مشتری |
| **50** | **مدیریت مشتریان** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/customers` | ✅ بله | ✅ بله | پرسنل و مدیران | افزودن مشتری جدید |
| **51** | **مدیریت مشتریان** | `PATCH` | `/api/v1/gamingCenters/:gamingCenterId/customers/:id` | ✅ بله | ✅ بله | پرسنل و مدیران | ویرایش پروفایل مشتری |
| **52** | **مدیریت مشتریان** | `DELETE` | `/api/v1/gamingCenters/:gamingCenterId/customers/:id` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | حذف مشتری |
| **53** | **نظرات و امتیازها** | `PATCH` | `/api/v1/gamingCenters/:gamingCenterId/ratings/:id/status` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | تایید/رد نظر مشتریان |
| **54** | **نظرات و امتیازها** | `POST` | `/api/v1/public/gamingCenters/:gamingCenterSlug/ratings` | ✅ بله | ❌ خیر | عمومی | ثبت نظر و امتیاز توسط کاربر |
| **55** | **نظرات و امتیازها** | `GET` | `/api/v1/public/gamingCenters/:gamingCenterSlug/ratings` | ✅ بله | ❌ خیر | عمومی | مشاهده نظرات تایید شده |
| **56** | **اطلاعات عمومی** | `GET` | `/api/v1/public/gamingCenters/:gamingCenterSlug` | ✅ بله | ❌ خیر | عمومی | اطلاعات پروفایل عمومی گیمینگ سنتر |
| **57** | **تنظیمات** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/settings` | ✅ بله | ✅ بله | کاربران احرازهویت‌شده مرکز | مشاهده تنظیمات مرکز |
| **58** | **تنظیمات** | `PATCH` | `/api/v1/gamingCenters/:gamingCenterId/settings` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | بروزرسانی تنظیمات مرکز |
| **59** | **کمیسیون‌ها** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/commissions` | ✅ بله | ✅ بله | کاربران احرازهویت‌شده مرکز | لیست کمیسیون‌ها |
| **60** | **کمیسیون‌ها** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/commissions` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | تنظیم قوانین کمیسیون |
| **61** | **کمیسیون‌ها** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/commissions/payouts` | ✅ بله | ✅ بله | کاربران احرازهویت‌شده مرکز | لیست تسویه‌ها |
| **62** | **کمیسیون‌ها** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/commissions/payouts` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | ثبت درخواست تسویه |
| **63** | **تخفیف‌ها** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/discounts` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | تعریف کد تخفیف جدید |
| **64** | **تخفیف‌ها** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/discounts` | ✅ بله | ✅ بله | کاربران احرازهویت‌شده مرکز | لیست کدهای تخفیف |
| **65** | **تخفیف‌ها** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/discounts/:id` | ✅ بله | ✅ بله | کاربران احرازهویت‌شده مرکز | جزییات یک کد تخفیف |
| **66** | **تخفیف‌ها** | `PATCH` | `/api/v1/gamingCenters/:gamingCenterId/discounts/:id` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | ویرایش کد تخفیف |
| **67** | **تخفیف‌ها** | `PATCH` | `/api/v1/gamingCenters/:gamingCenterId/discounts/:id/toggle-status` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | فعال/غیرفعال‌سازی کد تخفیف |
| **68** | **تخفیف‌ها** | `DELETE` | `/api/v1/gamingCenters/:gamingCenterId/discounts/:id` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | حذف کد تخفیف |
| **69** | **حسابرسی (Audit)** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/audit-logs` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | مشاهده لاگ‌های حسابرسی و تغییرات |
| **70** | **اعلان‌ها** | `GET` | `/api/v1/notifications` | ✅ بله | ✅ بله | هر کاربر متصل | دریافت لیست اعلان‌ها |
| **71** | **اعلان‌ها** | `GET` | `/api/v1/notifications/unread-count` | ✅ بله | ✅ بله | هر کاربر متصل | تعداد اعلان‌های خوانده‌نشده |
| **72** | **اعلان‌ها** | `PATCH` | `/api/v1/notifications/:id/read` | ✅ بله | ✅ بله | هر کاربر متصل | تغییر وضعیت اعلان به خوانده شده |
| **73** | **پنل مشتری** | `GET` | `/api/v1/customer/me` | ✅ بله | ✅ بله | `CUSTOMER` | دریافت پروفایل مشتری متصل |
| **74** | **پنل مشتری** | `GET` | `/api/v1/customer/reservation` | ✅ بله | ✅ بله | `CUSTOMER` | لیست رزروهای خود مشتری |
| **75** | **پنل مشتری** | `GET` | `/api/v1/customer/:reservationId` | ✅ بله | ✅ بله | `CUSTOMER` | جزییات یک رزرو مشتری |
| **76** | **پنل مشتری** | `POST` | `/api/v1/customer/reservation/:reservationId/cancel` | ✅ بله | ✅ بله | `CUSTOMER` | درخواست لغو رزرو توسط مشتری |
| **77** | **پنل مشتری** | `POST` | `/api/v1/customer/reservation/:reservationId/pay` | ✅ بله | ✅ بله | `CUSTOMER` | پرداخت رزرو توسط مشتری |
| **78** | **پنل مشتری** | `GET` | `/api/v1/customer/wallet/balance` | ✅ بله | ✅ بله | `CUSTOMER` | مشاهده موجودی کیف پول |
| **79** | **پنل مشتری** | `POST` | `/api/v1/customer/wallet/charge` | ✅ بله | ✅ بله | `CUSTOMER` | شارژ کیف پول |
| **80** | **پنل مشتری** | `POST` | `/api/v1/customer/wallet/transactions` | ✅ بله | ✅ بله | `CUSTOMER` | لیست تراکنش‌های کیف پول |
| **81** | **تیکت‌های مشتری** | `GET` | `/api/v1/tickets` | ✅ بله | ✅ بله | کاربران / مشتریان | لیست تیکت‌های پشتیبانی خود کاربر |
| **82** | **تیکت‌های مشتری** | `GET` | `/api/v1/tickets/:ticketId` | ✅ بله | ✅ بله | کاربران / مشتریان | مشاهده جزییات تیکت |
| **83** | **تیکت‌های مشتری** | `POST` | `/api/v1/tickets` | ✅ بله | ✅ بله | کاربران / مشتریان | ثبت تیکت جدید |
| **84** | **تیکت‌های مشتری** | `POST` | `/api/v1/tickets/:ticketId/messages` | ✅ بله | ✅ بله | کاربران / مشتریان | ارسال پاسخ در تیکت |
| **85** | **تیکت پشتیبانی** | `GET` | `/api/v1/support/tickets` | ✅ بله | ✅ بله | `SUPPORT`, `ADMIN` | مشاهده تمام تیکت‌های سیستم |
| **86** | **تیکت پشتیبانی** | `GET` | `/api/v1/support/tickets/:ticketId` | ✅ بله | ✅ بله | `SUPPORT`, `ADMIN` | مشاهده جزییات تیکت پشتیبانی |
| **87** | **تیکت پشتیبانی** | `PATCH` | `/api/v1/support/tickets/:ticketId/assign` | ✅ بله | ✅ بله | `SUPPORT`, `ADMIN` | ارجاع تیکت به کارشناس |
| **88** | **تیکت پشتیبانی** | `PATCH` | `/api/v1/support/tickets/:ticketId/status` | ✅ بله | ✅ بله | `SUPPORT`, `ADMIN` | تغییر وضعیت تیکت |
| **89** | **تیکت پشتیبانی** | `POST` | `/api/v1/support/tickets/:ticketId/messages` | ✅ بله | ✅ بله | `SUPPORT`, `ADMIN` | ارسال پاسخ کارشناس |
| **90** | **تیکت مدیریتی** | `GET` | `/api/v1/admin/tickets` | ✅ بله | ✅ بله | `ADMIN` | مدیریت کل تیکت‌ها |
| **91** | **تیکت مدیریتی** | `GET` | `/api/v1/admin/tickets/statistics` | ✅ بله | ✅ بله | `ADMIN` | گزارشات و آمار تیکت‌ها |
| **92** | **تیکت مدیریتی** | `PATCH` | `/api/v1/admin/tickets/:ticketId/assign` | ✅ بله | ✅ بله | `ADMIN` | ارجاع تیکت توسط مدیر |
| **93** | **تیکت مدیریتی** | `PATCH` | `/api/v1/admin/tickets/:ticketId/status` | ✅ بله | ✅ بله | `ADMIN` | بروزرسانی وضعیت تیکت |
| **94** | **تحلیلی / آمار** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/analytics/summary` | ✅ بله | ✅ بله | `MANAGER` | گزارش خلاصه درآمد و آمار |
| **95** | **تحلیلی / آمار** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/analytics/staff` | ✅ بله | ✅ بله | `MANAGER` | آمار کارکرد و عملکرد پرسنل |
| **96** | **تحلیلی / آمار** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/analytics/stations` | ✅ بله | ✅ بله | `MANAGER` | آمار کارکرد ایستگاه‌ها |
| **97** | **تحلیلی / آمار** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/analytics/revenue-chart` | ✅ بله | ✅ بله | `MANAGER` | نمودار درآمدی در بازه زمانی |
| **98** | **نشست‌های بازی** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/reservation/:reservationId/sessions/start` | ✅ بله | ✅ بله | کاربران مرکز | شروع تایمر/نشست بازی |
| **99** | **نشست‌های بازی** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/reservation/:reservationId/sessions/pause` | ✅ بله | ✅ بله | کاربران مرکز | توقف موقت نشست بازی |
| **100** | **نشست‌های بازی** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/reservation/:reservationId/sessions/resume` | ✅ بله | ✅ بله | کاربران مرکز | ادامه نشست بازی |
| **101** | **نشست‌های بازی** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/reservation/:reservationId/sessions/stop` | ✅ بله | ✅ بله | کاربران مرکز | پایان دادن به نشست بازی |
| **102** | **پرداخت‌ها** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/reservation/:reservationId/payments/initiate` | ✅ بله | ✅ بله | کاربران مرکز | ایجاد لینک/تراکنش پرداخت رزرو |
| **103** | **مدیریت CMS** | `GET/POST/PATCH/DELETE` | `/api/v1/gamingCenters/:gamingCenterId/pages/*` | ✅ بله | ✅ بله | `MANAGER` | مدیریت صفحات CMS |
| **104** | **مدیریت CMS** | `GET/POST/DELETE` | `/api/v1/gamingCenters/:gamingCenterId/media/*` | ✅ بله | ✅ بله | `MANAGER` | مدیریت رسانه‌های CMS |
| **105** | **مدیریت CMS** | `GET/POST/PATCH/DELETE` | `/api/v1/gamingCenters/:gamingCenterId/links/*` | ✅ بله | ✅ بله | `MANAGER` | مدیریت لینک‌ها و شبکه اجتماعی |
| **106** | **مدیریت CMS** | `GET/POST/PATCH/DELETE` | `/api/v1/gamingCenters/:gamingCenterId/addresses/*` | ✅ بله | ✅ بله | `MANAGER` | مدیریت آدرس‌ها |
| **107** | **مدیریت CMS** | `GET/PATCH` | `/api/v1/gamingCenters/:gamingCenterId/site-settings` | ✅ بله | ✅ بله | `MANAGER` | تنظیمات قالب و ظاهر سایت |
| **108** | **پیش‌نمایش CMS** | `GET/POST` | `/api/v1/admin/gamingCenters/:gamingCenterId/pages/*` | ✅ بله | ✅ بله | `MANAGER` | پیش‌نمایش و پنل مدیریتی CMS |
| **109** | **بلاگ (پست‌ها)** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/blog/posts` | ✅ بله | ✅ بله | `STAFF`, `SUPERVISOR`, `MANAGER`, `ADMIN` | ایجاد پست جدید |
| **110** | **بلاگ (پست‌ها)** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/blog/posts` | ✅ بله | ✅ بله | کاربران مرکز | مشاهده لیست پست‌ها |
| **111** | **بلاگ (پست‌ها)** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/blog/posts/:id` | ✅ بله | ✅ بله | کاربران مرکز | مشاهده جزییات پست |
| **112** | **بلاگ (پست‌ها)** | `PATCH` | `/api/v1/gamingCenters/:gamingCenterId/blog/posts/:id` | ✅ بله | ✅ بله | `STAFF`, `SUPERVISOR`, `MANAGER`, `ADMIN` | ویرایش پست (نویسنده یا مدیر) |
| **113** | **بلاگ (پست‌ها)** | `DELETE` | `/api/v1/gamingCenters/:gamingCenterId/blog/posts/:id` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | حذف پست |
| **114** | **بلاگ (سری‌ها)** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/blog/posts/series` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | تعریف سری مطالب |
| **115** | **بلاگ (نظرات)** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/blog/comments/tree` | ✅ بله | ❌ خیر | عمومی | درخت نظرات پست |
| **116** | **بلاگ (نظرات)** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/blog/comments` | ✅ بله | ✅ بله | کاربر متصل | ثبت نظر بر روی پست |
| **117** | **بلاگ (نظرات)** | `PATCH` | `/api/v1/gamingCenters/:gamingCenterId/blog/comments/:id` | ✅ بله | ✅ بله | کاربر متصل | ویرایش نظر خود |
| **118** | **بلاگ (نظرات)** | `DELETE` | `/api/v1/gamingCenters/:gamingCenterId/blog/comments/:id` | ✅ بله | ✅ بله | کاربر متصل | حذف نظر خود |
| **119** | **بلاگ (نظرات)** | `GET` | `/api/v1/gamingCenters/:gamingCenterId/blog/comments` | ✅ بله | ✅ بله | `SUPERVISOR`, `MANAGER`, `ADMIN` | لیست کل نظرات جهت نظارت |
| **120** | **بلاگ (نظرات)** | `PATCH` | `/api/v1/gamingCenters/:gamingCenterId/blog/comments/:id/moderate` | ✅ بله | ✅ بله | `SUPERVISOR`, `MANAGER`, `ADMIN` | تایید یا رد نظر |
| **121** | **بلاگ (دسته‌بندی)** | `POST/PATCH/DELETE` | `/api/v1/gamingCenters/:gamingCenterId/blog/taxonomy/categories/*` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | مدیریت دسته‌بندی‌های بلاگ |
| **122** | **بلاگ (برچسب‌ها)** | `POST/PATCH/DELETE` | `/api/v1/gamingCenters/:gamingCenterId/blog/taxonomy/tags/*` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | مدیریت تگ‌های بلاگ |
| **123** | **بلاگ (واکنش‌ها)** | `POST` | `/api/v1/gamingCenters/:gamingCenterId/blog/reactions/toggle` | ✅ بله | ✅ بله | کاربر متصل | ثبت/تغییر پسند و واکنش به پست |
| **124** | **بلاگ (ناوبری)** | `POST/PATCH/DELETE` | `/api/v1/gamingCenters/:gamingCenterId/blog/navigation/*` | ✅ بله | ✅ بله | `MANAGER`, `ADMIN` | مدیریت منوها و آیتم‌های ناوبری |
| **125** | **صفحات عمومی CMS** | `GET` | `/api/v1/public/gamingCenters/:gamingCenterSlug/pages` | ✅ بله | ❌ خیر | عمومی | دریافت صفحات سایت به صورت عمومی |
| **126** | **رسانه‌های عمومی CMS** | `GET` | `/api/v1/public/gamingCenters/:gamingCenterSlug/media` | ✅ بله | ❌ خیر | عمومی | دریافت گالری/رسانه‌ها به صورت عمومی |
| **127** | **لینک‌های عمومی CMS** | `GET` | `/api/v1/public/gamingCenters/:gamingCenterSlug/links` | ✅ بله | ❌ خیر | عمومی | دریافت لینک‌های ارتباطی و شبکه‌ها |
| **128** | **آدرس‌های عمومی CMS** | `GET` | `/api/v1/public/gamingCenters/:gamingCenterSlug/addresses` | ✅ بله | ❌ خیر | عمومی | دریافت آدرس‌ها و اطلاعات تماس |
| **129** | **بلاگ عمومی** | `GET` | `/api/v1/public/gamingCenters/:gamingCenterSlug/blog` | ✅ بله | ❌ خیر | عمومی | مشاهده لیست مطالب بلاگ |
| **130** | **بلاگ عمومی** | `GET` | `/api/v1/public/gamingCenters/:gamingCenterSlug/blog/posts/:slug` | ✅ بله | ❌ خیر | عمومی | مشاهده مطلب بلاگ با اسلاگ |
| **131** | **وب‌هوک پرداخت** | `POST` | `/api/v1/webhooks/zarinpal` | ✅ بله | ❌ خیر | عمومی (مخصوص درگاه زرین‌پال) | دریافت لیسنر تاییدیه پرداخت درگاه |

---
