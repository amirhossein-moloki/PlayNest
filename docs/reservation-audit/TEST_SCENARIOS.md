# تحلیل پوشش آزمون‌ها و سناریوهای تست (Test Coverage & Scenario Analysis)

این مستند به بررسی پوشش تست‌های موجود در پروژه PlayNest / Sayra، نگاشت آن‌ها به قوانین کسب‌وکار، و معرفی سناریوهای تست مفقود (Missing Test Scenarios) همراه با کد پیاده‌سازی نمونه در فریم‌ورک Jest می‌پردازد.

---

## ۱. ارزیابی پوشش تست‌های موجود (Existing Test Analysis)

فایل‌های اصلی تست مربوط به رزرو در مسیرهای زیر قرار دارند:
* **تست‌های واحد (Unit Tests):**
  * `sayra/tests/unit/modules/reservations/reservations.station.spec.ts`: تست منطق اصلی رزرو انفرادی و اعتبارسنجی‌ها.
  * `sayra/tests/unit/modules/reservations/reservations.state.spec.ts`: تست ماشین وضعیت و انتقال‌های مجاز.
  * `sayra/tests/unit/modules/reservations/reservations.proposals.spec.ts`: تست ثبت و پاسخ به پیشنهادات زمان.
  * `sayra/tests/unit/modules/availability/availability.station.spec.ts`: تست محاسبه اسلات‌های زمان آزاد.
  * `sayra/tests/unit/modules/group-booking/group-booking.station.spec.ts`: تست ایجاد رزروهای گروهی.
* **تست‌های یکپارچگی و API (Integration & API Tests):**
  * `sayra/tests/api/reservations/reservations.api.spec.ts`
  * `sayra/tests/integration/modules/reservations/reservations.integration.spec.ts`

---

## ۲. سناریوهای تست مفقود شده (Missing Test Scenarios)

### سناریوی ۱: تست Concurrency - درخواست‌های همزمان ثبت رزرو روی یک اسلات (Double Booking Race Condition)
* **توضیحات:** دو درخواست همزمان API برای ثبت رزرو روی یک ایستگاه در یک بازه زمانی یکسان ارسال می‌شود.
* **هدف:** اطمینان از اینکه قفل بدبینانه `SELECT FOR UPDATE` مانع از ایجاد دو رزرو همزمان شده و یکی از درخواست‌ها با خطای HTTP 409 خنثی می‌شود.
* **کد نمونه تست Jest:**
  ```typescript
  it('should prevent double booking when two concurrent creation requests arrive', async () => {
    const payload = {
      stationId: testStation.id,
      staffId: testStaff.id,
      startTime: '2026-11-01T10:00:00Z',
      customer: { fullName: 'Concurrent User', phone: '+989120000000' }
    };

    // Send two concurrent requests
    const [res1, res2] = await Promise.all([
      request(app).post('/api/v1/reservations').set('x-api-key', apiKey).send(payload),
      request(app).post('/api/v1/reservations').set('x-api-key', apiKey).send(payload)
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);
  });
  ```

---

### سناریوی ۲: تست عدم اعتبارسنجی تداخل ایستگاه در ویرایش رزرو بدون پرسنل
* **توضیحات:** ویرایش زمان رزروی که پرسنل انتساب‌یافته ندارد (`staffId: null`) به بازه‌ای که ایستگاه بازی قبلاً رزرو شده است.
* **هدف:** شناسایی و خنثی‌سازی باگ BUG-RES-002.
* **کد نمونه تست Jest:**
  ```typescript
  it('should reject updating reservation time to an occupied slot even when staffId is null', async () => {
    const res1 = await createTestReservation({ stationId: station.id, staffId: null, startTime: timeA });
    const res2 = await createTestReservation({ stationId: station.id, staffId: null, startTime: timeB });

    const response = await request(app)
      .patch(`/api/v1/reservations/${res2.id}`)
      .set('x-api-key', apiKey)
      .send({ startTime: timeA });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SLOT_NOT_AVAILABLE');
  });
  ```

---

### سناریوی ۳: تست عدم تکرار پردازش وب‌هوک تکراری پرداخت (Payment Webhook Idempotency)
* **توضیحات:** ارسال دوبار پشت سر هم وب‌هوک موفقیت پرداخت با یک `providerPaymentId` یکسان.
* **هدف:** اطمینان از اینکه شارژ کیف پول یا تغییر وضعیت رزرو دوبار تکرار نمی‌شود.

---

## ۳. خلاصه ماتریس پوشش تست‌ها (Test Matrix Summary)

| عنوان سناریو | نوع تست | پوشش فعلی | اولویت اضافه شدن |
| :--- | :--- | :--- | :--- |
| **تایید انتقال‌های ماشین وضعیت** | Unit | پوشش کامل | - |
| **انقضای رزروهای معطل PENDING** | Unit/Integration | پوشش نسبی | متوسط |
| **تداخل رزرو همزمان (Concurrency)** | Integration | **فاقد پوشش** | **بسیار بالا** |
| **ویرایش رزرو بدون پرسنل** | Integration | **فاقد پوشش** | **بالا** |
| **وب‌هوک تکراری درگاه پرداخت** | Integration | **فاقد پوشش** | **بالا** |
