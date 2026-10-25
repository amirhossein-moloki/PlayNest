# ساختار پایگاه داده، همگامی و تحلیل ریسک‌های Concurrency

## ۱. خلاصه‌ی موجودیت‌های رزرو (Reservation Data Architecture)

سیستم رزرو پلتفرم Sayra بر پایه پایگاه داده PostgreSQL و ORM Prisma بنا شده است. موجودیت‌های کلیدی چرخه رزرو عبارتند از:

* **Reservation:** رکورد اصلی رزرو تک ایستگاه شامل `startTime`, `endTime`, `status`, `paymentState`, `totalPrice`, `discountAmount` و اسنپ‌شات ایستگاه.
* **GroupBooking:** رکورد رزرو گروهی که می‌تواند چند `GroupBookingItem` و چندین `Reservation` مربوطه را مدیریت کند.
* **GameStation:** ایستگاه بازی (PC, Console, VR) شامل قیمت ساعتی و محدودیت‌های اجاره.
* **StaffShift:** شیفت‌های کاری پرسنل جهت سنجش دسترسی‌پذیری.
* **ReservationTimeProposal:** پیشنهادات تغییر زمان رزرو توسط پرسنل.
* **Payment:** سوابق تراکنش‌های پرداخت بانکی/آنلاین.
* **WalletTransaction:** تراکنش‌های کیف پول مشتری جهت شارژ/بازگشت وجه.

---

## ۲. سطح ایزوله‌سازی تراکنش‌ها و مکانیزم‌های قفل‌گذاری (Transaction & Locking Strategy)

### الف. تراکنش‌های Prisma و سطح ایزوله‌سازی (Isolation Level)
در کدپایه سیستم رزرو، تمام تراکنش‌های اصلی ایجاد رزرو انفرادی و رزرو گروهی به صورت صریح با سطح ایزوله‌سازی **`RepeatableRead`** اجرا می‌شوند:

```typescript
// sayra/src/modules/reservation/reservation.station.ts
const result = await ReservationRepo.transaction(async (tx) => {
  // ...
}, {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
});
```

### ب. قفل‌گذاری بدبینانه (Pessimistic Locking - SELECT FOR UPDATE)
برای جلوگیری از ثبت همزمان دو رزرو روی یک ایستگاه در سطح برنامه‌نویسی، متد `lockStationForUpdate` و `lockStationsForUpdate` با استفاده از کوئری خام `SELECT FOR UPDATE` اجرا می‌شوند:

```typescript
// sayra/src/modules/reservation/reservation.repo.ts
async lockStationForUpdate(stationId: string, tx: Prisma.TransactionClient): Promise<void> {
  const client = tx || prisma;
  try {
    await client.$executeRaw`SELECT id FROM "GameStation" WHERE id = ${stationId} FOR UPDATE`;
  } catch {
    // In unit test mocks or environments without raw sql, proceed gracefully
  }
}
```

در رزروهای گروهی، جهت جلوگیری از **Deadlock** در درخواست‌های همزمان، ابتدا تمامی `stationId`ها به ترتیب حروف الفبا مرتب (Sort) شده و سپس قفل‌گذاری می‌شوند:

```typescript
async lockStationsForUpdate(stationIds: string[], tx: Prisma.TransactionClient): Promise<void> {
  const client = tx || prisma;
  const sortedIds = [...stationIds].sort();
  for (const id of sortedIds) {
    try {
      await client.$executeRaw`SELECT id FROM "GameStation" WHERE id = ${id} FOR UPDATE`;
    } catch {}
  }
}
```

---

## ۳. تحلیل ریسک‌های همگامی و Race Condition ها (Concurrency Risk Analysis)

### ۱. آسیب‌پذیری Race Condition در ثبت همزمان رزرو روی یک ایستگاه (Station Double-Booking Risk)
* **تحلیل:** اگرچه قفل بدبینانه روی جدول `GameStation` اعمال می‌شود، اما قفل کردن خود ایستگاه مانع از ایجاد دو رزرو غیرهمپوشان در زمان‌های مختلف نمی‌شود، ولی دو درخواست همزمان برای **یک زمان یکسان** را به ترتیب صف می‌کند.
* **ضعف کشف‌شده در کد:** در هندل کردن خطای تراکنش عمومی (`createPublicReservation` سطر ۳۳۳ و `updateReservation` سطر ۵۵۹)، کدی نوشته شده است که خطای دیتابیسی `23P01` با نام اندیس `Reservation_no_overlap_active` را Catch می‌کند:
  ```typescript
  if (error && typeof error === 'object' && 'code' in error && error.code === '23P01' && 'message' in error && typeof error.message === 'string' && error.message.includes('Reservation_no_overlap_active')) {
    throw new AppError('This time slot is already booked.', httpStatus.CONFLICT, { code: 'SLOT_NOT_AVAILABLE' });
  }
  ```
* **یافته کُد کاوی:** اندیس `Reservation_no_overlap_active` یا PostgreSQL exclusion constraint در هیچ‌یک از فایل‌های `schema.prisma` یا مایگریشن‌های دیتابیس (`sayra/prisma/migrations`) وجود ندارد! بنابراین، در صورت لغو قفل یا استفاده از دیتابیس بدون `SELECT FOR UPDATE` (مانند برخی رپیکاهای خواندن)، پایگاه داده هیچ محدودیتی روی همپوشانی بازه‌های زمانی ایجاد نمی‌کند و خطر رزرو تکراری (Overbooking) وجود دارد.

---

### ۲. آسیب‌پذیری Concurrency در سقف رزروهای فعال مشتری (Max Active Reservation Limit Race Condition)
* **تحلیل:** قانون `BR-RES-001` مشتریان را به حداکثر ۲ رزرو فعال محدود می‌کند.
* **مکانیزم بررسی:** تابع `countActiveReservationsForCustomer` ابتدا سعی می‌کند سطر حساب مشتری را قفل کند:
  ```typescript
  await client.$executeRaw`SELECT id FROM "CustomerAccount" WHERE id = ${customerAccountId} FOR UPDATE`;
  ```
* **ریسک همگامی:** اگر مشتری همزمان دو درخواست ثبت رزرو ارسال کند، قفل `CustomerAccount` درخواست دوم را منتظر نگه می‌دارد. پس از پایان تراکنش اول (که رزرو اول را ایجاد کرده)، درخواست دوم اجرا شده، تعداد رزروها را ۲ می‌شمارد و رزرو دوم را ثبت می‌کند. اما اگر ۳ درخواست همزمان ارسال شوند، قفل‌گذاری صف‌بندی کرده و درخواست سوم پس از ثبت رزرو دوم متوجه تعداد ۲ رزرو فعال شده و با خطا رد می‌شود. بنابراین قفل‌گذاری روی `CustomerAccount` در این سناریو به درستی از تخطی سقف جلوگیری می‌کند، مگر اینکه حساب مشتری هنوز ایجاد نشده باشد (مشتری جدید).

---

### ۳. آسیب‌پذیری در پردازش همزمان وب‌هوک‌های پرداخت (Payment Webhook Idempotency & Race Condition)
* **تحلیل:** وب‌هوک‌های درگاه پرداخت ممکن است به صورت تکراری یا همزمان توسط درگاه ارسال شوند.
* **مکانیزم موجود:** جدول `Payment` دارای قیود یکتایی زیر است:
  * `@@unique([provider, providerPaymentId])`
  * `@@unique([gamingCenterId, idempotencyKey])`
* **ارزیابی:** قید یکتایی `provider_payment_id` در پایگاه داده تضمین می‌کند که یک پرداخت یکسان نمی‌تواند دوبار ثبت شود. همچنین در `webhooksStation.handlePaymentWebhook` وضعیت پرداخت قبل از به‌روزرسانی بررسی می‌شود.

---

### ۴. چالش‌های منطقه زمانی و ساعت تابستانی (Time Zone & UTC Handling)
* **مکانیزم:** تمام تاریخ‌ها در Prisma با نوع `@db.Timestamptz(6)` ذخیره می‌شوند که زمان را به صورت استاندارد UTC در دیتابیس نگه می‌دارد.
* **تبدیل‌ها:** در زمان محاسبات شیفت پرسنل و دسترسی‌پذیری اسلات‌ها، از کتابخانه `date-fns-tz` و متد `toZonedTime` استفاده می‌شود:
  ```typescript
  const timeZone = gamingCenter.settings?.timeZone || 'UTC';
  const zonedStartAt = toZonedTime(startTime, timeZone);
  ```
* **ارزیابی:** از آنجا که مقایسه‌ها روی شیفت‌ها پس از تبدیل به زمان محلی مرکز بازی انجام می‌شود، تغییرات daylight saving time (DST) با تکیه بر IANA timezones (مانند `Asia/Tehran`) توسط `date-fns-tz` هندل می‌شوند.

---

## ۴. خلاصه قیود و قفل‌های پایگاه داده (Summary Table)

| موجودیت / جدول | قوی‌تر القا شده / قید (Constraint) | مکانیزم قفل (Lock Mechanism) | سطح خطر Concurrency | وضعیت در کدپایه |
| :--- | :--- | :--- | :--- | :--- |
| **GameStation** | Primary Key `id` | `SELECT FOR UPDATE` در شروع تراکنش رزرو | پایین (در صورت اجرای تراکنش) | پیاده‌سازی شده |
| **CustomerAccount** | Primary Key `id`, Unique `phone` | `SELECT FOR UPDATE` در بررسی سقف رزرو | متوسط (در مشتریان جدید وجود ندارد) | پیاده‌سازی شده |
| **Reservation** | Primary Key `id`, Foreign Keys | نیازمند Exclusion Constraint همپوشانی | **بالا** | قید دیتابیسی وجود ندارد (فقط کنترل نرم‌افزاری) |
| **Payment** | Unique `[provider, providerPaymentId]` | قید یکتایی دیتابیس (Unique Index) | بسیار پایین | پیاده‌سازی شده |
| **GroupBooking** | Primary Key `id`, Foreign Keys | قفل متوالی مرتب‌شده ایستگاه‌ها | پایین | پیاده‌سازی شده |
