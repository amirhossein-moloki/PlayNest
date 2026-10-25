# گزارش جامع ممیزی باگ‌ها و ریسک‌های سیستم رزرو (Bug & Risk Audit Report)

این مستند حاوی نتایج ممیزی سیستماتیک صحت، همگامی، امنیت، پردازش مالی و قابلیت اطمینان منطق رزرو پروژه PlayNest / Sayra می‌باشد. یافته‌ها بر اساس کدهای پیاده‌سازی‌شده ارزیابی شده و به دو دسته **باگ‌های تاییدشده (Confirmed Defects)** و **ریسک‌های معماری/همگامی (Architectural Risks)** تقسیم شده‌اند.

---

## ۱. خلاصه‌ی یافته‌های ممیزی (Audit Findings Summary)

| Finding ID | عنوان ممیزی | دسته‌بندی | درجه اهمیت | وضعیت |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-RES-001** | عدم وجود قید دیتابیسی عدم همپوشانی رزروها (Missing Database Exclusion Constraint) | Concurrency & Database | **Critical** | Confirmed Defect |
| **BUG-RES-002** | عدم اعتبارسنجی تداخل ایستگاه در ویرایش رزرو بدون پرسنل | Reservation Correctness | **High** | Confirmed Defect |
| **BUG-RES-003** | آسیب‌پذیری Concurrency در بررسی سقف رزروهای مشتری جدید | Concurrency & Race Condition | **High** | Confirmed Risk |
| **BUG-RES-004** | عدم برخورداری از قفل بدبینانه در پذیرش پیشنهاد زمان (Proposal Acceptance) | Concurrency & Consistency | **Medium** | Confirmed Risk |
| **BUG-RES-005** | احتمال خطای عدم هماهنگی کیف پول در استرداد همزمان | Financial & Transactions | **Medium** | Potential Risk |

---

## ۲. گزارش تفکیکی باگ‌ها و اشکالات (Detailed Findings Report)

### 🔴 BUG-RES-001: عدم وجود قید دیتابیسی عدم همپوشانی رزروها (Missing Database Exclusion Constraint)
* **درجه اهمیت:** **Critical**
* **مسیر فایل و خطوط مربوطه:**
  * `sayra/src/modules/reservation/reservation.station.ts` (سطر ۳۳۳ و ۵۵۹)
  * `sayra/src/common/errors/errorHandler.ts` (سطر ۶۶)
* **شواهد پیاده‌سازی:**
  کد سرویس رزرو برای مدیریت خطای Postgres کدی به شکل زیر دارد:
  ```typescript
  if (error && typeof error === 'object' && 'code' in error && error.code === '23P01' && 'message' in error && typeof error.message === 'string' && error.message.includes('Reservation_no_overlap_active')) {
    throw new AppError('This time slot is already booked.', httpStatus.CONFLICT, { code: 'SLOT_NOT_AVAILABLE' });
  }
  ```
  با این حال، با بررسی فایل `schema.prisma` و فولدر مایگریشن‌ها (`sayra/prisma/migrations/`) مشخص شد که قید یا اندیس یکتایی/استثنایی به نام `Reservation_no_overlap_active` در دیتابیس وجود ندارد.
* **سناریوی بروز:**
  در صورتی که قفل بدبینانه `SELECT FOR UPDATE` روی ایستگاه به هر دلیلی (مانند دسترسی مستقیم، بای‌پاس سرویس یا رپیکاهای خواندن) اجرا نشود یا شکست بخورد، دیتابیس هیچ مانعی برای ثبت دو رزرو دقیقا همزمان در یک بازه زمانی ندارد.
* **رفتار انتظاررفته vs رفتار واقعی:**
  * *انتظار:* وجود قید Exclusion Constraint یا Partial Unique Index در دیتابیس Postgres جهت جلوگیری قطعی از رزرو دوگانه (Overbooking).
  * *واقعی:* اتکای صرف به کد نرم‌افزاری و هندلر خطایی که به یک قید ناداشته در دیتابیس اشاره می‌کند.
* **راهکار پیشنهادی:**
  افزودن یک PostgreSQL Exclusion Constraint با پسوند `btree_gist` روی بازه‌های زمانی رزروهای فعال در مایگریشن Prisma.

---

### 🟠 BUG-RES-002: عدم اعتبارسنجی تداخل ایستگاه در ویرایش رزرو بدون پرسنل
* **درجه اهمیت:** **High**
* **مسیر فایل و خطوط مربوطه:** `sayra/src/modules/reservation/reservation.station.ts` (سطر ۳۸۶ تا ۳۹۷)
* **شواهد پیاده‌سازی:**
  در متد `updateReservation` هنگام بررسی تداخل همپوشانی زمان جدید:
  ```typescript
  const preventOverlaps = settings?.preventOverlaps ?? true;
  if (preventOverlaps && effectiveStaffId) {
    const overlappingReservation = await ReservationRepo.findOverlappingReservation(
      gamingCenterId,
      effectiveStaffId,
      newStartAt,
      newEndAt,
      reservation.id,
      tx
    );
    // ...
  }
  ```
* **سناریوی بروز:**
  اگر یک رزرو بدون پرسنل انتساب‌یافته باشد (`staffId === null`) و پرسنل یا اپراتور زمان رزرو را ویرایش کند، شرط `if (preventOverlaps && effectiveStaffId)` برقرار نشده و کوئری بررسی همپوشانی رزرو اصلاً اجرا نمی‌گردد!
* **رفتار انتظاررفته vs رفتار واقعی:**
  * *انتظار:* بررسی همپوشانی زمان رزرو روی همان **ایستگاه بازی (`stationId`)** صرف نظر از وجود یا عدم وجود پرسنل.
  * *واقعی:* نادیده گرفتن کامل بررسی تداخل زمان رزرو در صورت عدم تعیین پرسنل.
* **راهکار پیشنهادی:**
  اصلاح شرط به صورت زیر تا تداخل ایستگاه بازی نیز همواره سنجیده شود:
  ```typescript
  if (preventOverlaps && (effectiveStaffId || effectiveStationId))
  ```

---

### 🟠 BUG-RES-003: آسیب‌پذیری Concurrency در بررسی سقف رزروهای مشتری جدید
* **درجه اهمیت:** **High**
* **مسیر فایل و خطوط مربوطه:** `sayra/src/modules/reservation/reservation.repo.ts` (سطر ۱۷۹)
* **شواهد پیاده‌سازی:**
  در متد `countActiveReservationsForCustomer` قفل‌گذاری حساب مشتری اجرا می‌شود:
  ```typescript
  await client.$executeRaw`SELECT id FROM "CustomerAccount" WHERE id = ${customerAccountId} FOR UPDATE`;
  ```
* **سناریوی بروز:**
  هنگامی که یک مشتری جدید (که هنوز حساب کاربری ندارد) همزمان ۳ درخواست ثبت رزرو ارسال می‌کند، متد `findOrCreateCustomerProfile` حساب جدید را در هر ۳ تراکنش همزمان ایجاد می‌کند (یا اولین تراکنش آن را می‌سازد و بعدی‌ها آن را می‌یابند). اما در اولین لحظه ایجاد، `SELECT FOR UPDATE` روی حسابی اجرا می‌شود که هنوز ثبت نهایی (Commit) نشده یا شناسه آن در دسترس نبوده است که منجر به ثبت همزمان و عبور از سقف ۲ رزرو فعال می‌شود.
* **راهکار پیشنهادی:**
  استفاده از قفل‌های مشاوره‌ای Postgres (`pg_advisory_xact_lock`) بر اساس هش شماره تلفن مشتری.

---

### 🟡 BUG-RES-004: عدم قفل‌گذاری بدبینانه در پذیرش پیشنهاد زمان (Proposal Acceptance)
* **درجه اهمیت:** **Medium**
* **مسیر فایل:** `sayra/src/modules/customer-panel/customer-panel.station.ts`
* **شواهد پیاده‌سازی:**
  هنگامی که مشتری پیشنهاد زمان جدید (`ReservationTimeProposal`) را می‌پذیرد (`ACCEPTED`)، زمان رزرو به زمان پیشنهادی تغییر می‌کند اما کوئری قفل‌گذاری بدبینانه روی ایستگاه یا کنترل تداخل با سایر رزروهای ثبت‌شده در این فاصله زمانی اجرا نمیشود.
* **سناریوی بروز:**
  اگر پرسنل زمانی را پیشنهاد دهد و در فاصله زمانی بین ارسال پیشنهاد و پاسخ مشتری، رزرو دیگری برای آن اسلات ثبت شود، پذیرش پیشنهاد توسط مشتری باعث همپوشانی دو رزرو روی یک ایستگاه می‌شود.
* **راهکار پیشنهادی:**
  اجرای `lockStationForUpdate` و `findOverlappingReservation` قبل از تایید نهایی پیشنهاد زمان جدید.

---

## ۳. تست‌های رگرسیون پیشنهادی (Suggested Regression Tests)

۱. **تست تداخل رزرو بدون پرسنل در ویرایش:**
   تستی که یک رزرو بدون `staffId` ثبت کرده و سپس سعی در ویرایش زمان آن به زمانی که ایستگاه اشغال است داشته باشد و خطای 409 دریافت کند.
۲. **تست پذیرش همزمان پیشنهاد زمان:**
   تستی که پیشنهاد زمان را در شرایطی که اسلات پیشنهادی اشغال شده تایید کند و رد شدن آن را تایید نماید.
