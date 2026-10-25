# شناسنامه جامع قوانین کسب‌وکار سیستم رزرو (Verified Business Rules Inventory)

این مستند استخراج و ثبت تمام قوانین موجود در کدپایه پروژه PlayNest / Sayra را بر اساس کد واقعی ارائه می‌دهد. تمامی قوانین با کدشناسه، توضیحات، رفتار پیاده‌سازی، مسیر فایل و سطح اطمینان مشخص شده‌اند.

---

## ۱. جدول قوانین اصلی کسب‌وکار (Core Rules Inventory)

| شناسه قانون (Rule ID) | عنوان قانون | شرح قانون | رفتار پیاده‌سازی واقعی | مسیر فایل و تابع | سطح اطمینان |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BR-RES-001** | سقف رزروهای فعال مشتری | هر مشتری حداکثر می‌تواند ۲ رزرو فعال داشته باشد. | شمارش رزروهای منفرد و گروهی فعال (`CONFIRMED`, `IN_PROGRESS` و `PENDING` غیرمنقضی). در صورت رسیدن به ۲، خطای `ACTIVE_RESERVATION_LIMIT_REACHED` با کُد HTTP 409 پرتاب می‌شود. | `sayra/src/modules/reservation/reservation.repo.ts`<br>`assertActiveReservationLimitNotExceeded` | Verified |
| **BR-RES-002** | رزرو آنلاین در گذشته | ثبت رزرو عمومی نباید در زمان گذشته انجام شود. | مقایسه `startTime` با `new Date()`. اگر کمتر باشد، خطای HTTP 400 با کد `RESERVATION_START_TIME_IN_PAST` صادر می‌شود. | `sayra/src/modules/reservation/reservation.station.ts`<br>`createPublicReservation` | Verified |
| **BR-RES-003** | الزام احراز هویت OTP | در صورت فعال بودن تنظیمات مرکز، ثبت عمومی نیازمند تأیید پیامکی قبلی است. | اگر `requireOtpForPublicBooking === true` باشد، آخرین کد OTP مصرف‌شده در ۵ دقیقه اخیر بررسی می‌شود. در صورت عدم وجود، خطای HTTP 401 با کد `OTP_REQUIRED` رخ می‌دهد. | `sayra/src/modules/reservation/reservation.station.ts`<br>`createPublicReservation` | Verified |
| **BR-RES-004** | انظباط شیفت پرسنل در رزرو عمومی | زمان رزرو عمومی باید کاملاً با شیفت فعال پرسنل مطابقت داشته باشد. | استعلام شیفت پرسنل بر اساس روز هفته در منطقه زمانی مرکز (`timeZone`). اگر زمان شروع رزرو قبل از شروع شیفت یا زمان پایان بعد از پایان شیفت باشد، خطای HTTP 409 صادر می‌شود. | `sayra/src/modules/reservation/reservation.station.ts`<br>`createPublicReservation` | Verified |
| **BR-RES-005** | جلوگیری از تداخل زمان بازی | دو رزرو فعال نمی‌توانند برای یک پرسنل یا یک ایستگاه در بازه زمانی همپوشان ثبت شوند. | پرس‌وجوی تداخل با شرط `startTime < newEndTime AND endTime > newStartTime` برای رزروهای غیرترمینو. در صورت وجود تداخل، خطای HTTP 409 رخ می‌دهد. | `sayra/src/modules/reservation/reservation.repo.ts`<br>`findOverlappingReservation` | Verified |
| **BR-RES-006** | انقضای رزروهای معطل (Pending Expiration) | رزروهای عمومی در حالت PENDING دارای مهلت انقضای ۱ دقیقه‌ای هستند. | ثبت `expiresAt = now + 60s` هنگام ایجاد رزرو عمومی PENDING. کارگر پس‌زمینه `expireStaleReservations` وضعیت آن‌ها را به `EXPIRED` تغییر می‌دهد. | `sayra/src/modules/reservation/reservation.station.ts`<br>`expireStaleReservations` | Verified |
| **BR-RES-007** | بازگشت وجه خودکار به کیف پول در لغو | با لغو رزرو تاییدشده، تمام مبالغ پرداختی به کیف پول مشتری بازگردانده می‌شود. | جمع پرداختی‌های موفق (`PaymentStatus.PAID`) رزرو، ثبت واریزی کیف پول نوع `REFUND` و تغییر وضعیت پرداخت رزرو به `REFUNDED`. | `sayra/src/modules/wallet/wallet.station.ts`<br>`refundReservationToWallet` | Verified |
| **BR-RES-008** | اولویت‌بندی اعمال تخفیف‌ها | تخفیف‌های سطح ایستگاه نسبت به تخفیف‌های کل مرکز اولویت دارند. | فیلتر تخفیف‌های فعال در زمان رزرو. اگر تخفیف سطح ایستگاه وجود داشته باشد، تخفیف‌های کل مرکز نادیده گرفته می‌شوند. در صورت وجود چند تخفیف، تخفیفی که بیشترین مبلغ کسر را ایجاد کند انتخاب می‌شود. | `sayra/src/modules/discounts/discounts.station.ts`<br>`selectBestDiscount` | Verified |
| **BR-RES-009** | محدودیت تغییر رزروهای ترمینال | رزروهایی که در وضعیت پایانی قرار دارند قابل ویرایش نیستند. | بررسی وضعیت رزرو با `ReservationStateMachine.isTerminalState`. وضعیت‌های `COMPLETED`, `CANCELED`, `NO_SHOW`, `EXPIRED` غیرقابل ویرایش می‌باشند (HTTP 409). | `sayra/src/modules/reservation/reservation.station.ts`<br>`updateReservation` | Verified |
| **BR-RES-010** | فرآیند پیشنهاد زمان جدید (Proposal Workflow) | پرسنل می‌توانند زمان جدید پیشنهاد دهند؛ ثبت پیشنهاد جدید، پیشنهاد معلق قبلی را لغو می‌کند. | ایجاد رکورد `ReservationTimeProposal` با وضعیت `PENDING` و لغو تمام پیشنهادهای قبلی در حالت PENDING. پذیرش مشتری زمان رزرو را تغییر داده و رد مشتری پیشنهاد را رد می‌کند. | `sayra/src/modules/reservation/reservation.station.ts`<br>`proposeTime` | Verified |
| **BR-RES-011** | قفل متوالی ایستگاه‌ها در رزرو گروهی | در رزرو گروهی، ایستگاه‌ها به ترتیب حروف الفبا / شناسه قفل می‌شوند تا از Deadlock جلوگیری شود. | سورت شناسه ایستگاه‌ها و اجرای `SELECT id FROM "GameStation" WHERE id = $1 FOR UPDATE` به ترتیب سورت شده قبل از استعلام تداخل. | `sayra/src/modules/reservation/reservation.repo.ts`<br>`lockStationsForUpdate` | Verified |
| **BR-RES-012** | محدودیت حداقل و حداکثر اجاره ایستگاه | مدت اجاره رزرو گروهی باید در بازه مجاز minRentHours و maxRentHours ایستگاه باشد. | بررسی `totalHours` با min/max اجاره ایستگاه. در صورت عدم رعایت، خطای HTTP 400 صادر می‌گردد. | `sayra/src/modules/group-booking/group-booking.station.ts`<br>`createGroupBooking` | Verified |

---

## ۲. مشخصات و جزئیات تکنیکال قوانین (Detailed Specifications)

### قانون سقف رزروهای فعال (BR-RES-001)
* **کلاس / فایل:** `sayra/src/modules/reservation/reservation.repo.ts`
* **تابع:** `countActiveReservationsForCustomer` / `assertActiveReservationLimitNotExceeded`
* **کد پیاده‌سازی:**
  ```typescript
  const activeCount = await this.countActiveReservationsForCustomer(customerAccountId, tx);
  if (activeCount >= 2) {
    throw new AppError('Maximum active reservation limit (2) reached.', httpStatus.CONFLICT, {
      code: 'ACTIVE_RESERVATION_LIMIT_REACHED',
    });
  }
  ```
* **توضیحات:** شمارش مجموع رزروهای انفرادی بدون groupBookingId و تمام رزروهای گروهی در وضعیت‌های CONFIRMED، IN_PROGRESS یا PENDING غیرمنقضی.

---

### قانون محاسبه تخفیف و اولویت‌بندی (BR-RES-008)
* **کلاس / فایل:** `sayra/src/modules/discounts/discounts.station.ts`
* **تابع:** `selectBestDiscount`
* **کد پیاده‌سازی:**
  ```typescript
  const stationDiscounts = discounts.filter((d) => d.targetType === DiscountTargetType.STATION);
  const candidateDiscounts = stationDiscounts.length > 0
    ? stationDiscounts
    : discounts.filter((d) => d.targetType === DiscountTargetType.GAMING_CENTER);
  ```
* **توضیحات:** در صورتی که برای یک ایستگاه تخفیف خاص تعریف شده باشد، کلا تخفیف عمومی مرکز بازی کنار گذاشته شده و بین تخفیف‌های خود ایستگاه، بالاترین مقدار تخفیف اعمال می‌گردد.

---

## ۳. رفتارهای غیرمستند یا مبهم (Unknown & Inconsistent Behaviors)

1. **مدیریت تداخل در تغییر رزرو انفرادی (Update Reservation):**
   * در متد `updateReservation` سرویس `reservationStation` (سطر ۳۸۶)، کنترل تداخل زمان فقط بر اساس `effectiveStaffId` چک می‌شود و اگر پرسنل مشخص نشده باشد، تداخل ایستگاه بازی چک نمی‌شود (مگر اینکه خطای دیتابیسی رخ دهد).
2. **عدم قفل حساب مشتری در کنترل سقف رزرو (Concurrency Gap):**
   * در تابع `countActiveReservationsForCustomer` دستور `SELECT FOR UPDATE` روی `CustomerAccount` اجرا می‌شود اما در صورتی که دیتابیس در تست یا SQLite باشد این لایه نادیده گرفته می‌شود و در PostgreSQL نیز امکان Race Condition در صورت نبود Unique Index وجود دارد.
